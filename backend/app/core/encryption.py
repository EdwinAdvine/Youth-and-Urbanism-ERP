"""Column-level encryption using PostgreSQL pgcrypto extension.

Provides symmetric AES encryption for PII columns:
    - HR: employee national IDs, bank account details
    - Finance: payment instrument details

Encryption key is set via PG_ENCRYPTION_KEY env var (required in production).
pgcrypto functions ``pgp_sym_encrypt`` / ``pgp_sym_decrypt`` are used with
the AES cipher.

Usage:
    from app.core.encryption import encrypt_value, decrypt_value

    # Store encrypted (pass raw value, get SQL expression):
    await db.execute(
        text("UPDATE hr_employees SET national_id = pgp_sym_encrypt(:val, :key) WHERE id = :id"),
        {"val": "ID-12345678", "key": settings.PG_ENCRYPTION_KEY, "id": employee_id},
    )

    # Read decrypted:
    result = await db.execute(
        text("SELECT pgp_sym_decrypt(national_id::bytea, :key) FROM hr_employees WHERE id = :id"),
        {"key": settings.PG_ENCRYPTION_KEY, "id": employee_id},
    )

ORM helper:
    Use ``EncryptedString`` as a SQLAlchemy TypeDecorator to transparently
    encrypt/decrypt at the Python layer (useful for models that handle PII).

    class HREmployee(Base):
        national_id: Mapped[str | None] = mapped_column(EncryptedString(), nullable=True)
"""

from __future__ import annotations

import base64
import logging

from sqlalchemy import String
from sqlalchemy.types import TypeDecorator

logger = logging.getLogger(__name__)


def _get_key() -> str:
    from app.core.config import settings  # noqa: PLC0415 — lazy import
    key = getattr(settings, "PG_ENCRYPTION_KEY", "")
    if not key:
        logger.warning("PG_ENCRYPTION_KEY not set — column encryption will not protect data!")
    return key


def encrypt_value(plaintext: str | None) -> str | None:
    """Encrypt a string using Fernet (application-layer symmetric encryption).

    This is the application-layer alternative when pgcrypto SQL functions
    cannot be used (e.g., in ORM setters). Uses AES-128-CBC via the
    ``cryptography`` library.

    For SQL-layer encryption, use pgp_sym_encrypt directly in your query.

    Args:
        plaintext: The value to encrypt, or None.

    Returns:
        Base64-encoded ciphertext, or None.
    """
    if plaintext is None:
        return None
    key = _get_key()
    if not key:
        return plaintext  # graceful degradation in dev mode

    try:
        from cryptography.fernet import Fernet  # noqa: PLC0415

        # Derive a 32-byte Fernet key from PG_ENCRYPTION_KEY
        import hashlib
        fernet_key = base64.urlsafe_b64encode(
            hashlib.sha256(key.encode()).digest()
        )
        f = Fernet(fernet_key)
        return f.encrypt(plaintext.encode()).decode()
    except ImportError:
        logger.warning("cryptography package not installed — encryption skipped")
        return plaintext
    except Exception as exc:
        logger.error("Encryption failed: %s", exc)
        return plaintext


def decrypt_value(ciphertext: str | None) -> str | None:
    """Decrypt a value encrypted with ``encrypt_value``.

    Args:
        ciphertext: Base64 Fernet token, or None.

    Returns:
        Plaintext string, or None.
    """
    if ciphertext is None:
        return None
    key = _get_key()
    if not key:
        return ciphertext

    try:
        from cryptography.fernet import Fernet, InvalidToken  # noqa: PLC0415

        import hashlib
        fernet_key = base64.urlsafe_b64encode(
            hashlib.sha256(key.encode()).digest()
        )
        f = Fernet(fernet_key)
        return f.decrypt(ciphertext.encode()).decode()
    except ImportError:
        return ciphertext
    except Exception:
        # Return ciphertext as-is if decryption fails (e.g., unencrypted legacy data)
        return ciphertext


class EncryptedString(TypeDecorator):
    """SQLAlchemy TypeDecorator that transparently encrypts/decrypts string columns.

    Use this for PII columns that should be encrypted at rest. The database
    column stores the ciphertext; Python code sees plaintext.

    Example:
        class HREmployee(Base):
            national_id: Mapped[str | None] = mapped_column(
                EncryptedString(), nullable=True,
            )
    """

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """Encrypt before writing to database."""
        return encrypt_value(value)

    def process_result_value(self, value, dialect):
        """Decrypt after reading from database."""
        return decrypt_value(value)
