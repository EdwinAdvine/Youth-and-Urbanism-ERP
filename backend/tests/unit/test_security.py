"""Unit tests for security utilities (no DB required)."""
from __future__ import annotations

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decrypt_field,
    encrypt_field,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password():
    """hash_password + verify_password round-trip."""
    hashed = hash_password("mysecretpassword")
    assert hashed != "mysecretpassword"
    assert verify_password("mysecretpassword", hashed) is True
    assert verify_password("wrongpassword", hashed) is False


def test_create_and_decode_access_token():
    """create_access_token + decode_token round-trip."""
    token = create_access_token(
        subject="user-123",
        email="test@example.com",
        is_superadmin=False,
    )
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["email"] == "test@example.com"
    assert payload["is_superadmin"] is False
    assert payload["type"] == "access"


def test_create_access_token_with_extra():
    """create_access_token includes extra claims."""
    token = create_access_token(
        subject="user-456",
        email="admin@example.com",
        is_superadmin=True,
        extra={"role": "finance_admin"},
    )
    payload = decode_token(token)
    assert payload["role"] == "finance_admin"
    assert payload["is_superadmin"] is True


def test_create_and_decode_refresh_token():
    """create_refresh_token + decode_token round-trip."""
    token = create_refresh_token(subject="user-789")
    payload = decode_token(token)
    assert payload["sub"] == "user-789"
    assert payload["type"] == "refresh"


def test_encrypt_and_decrypt_field():
    """encrypt_field + decrypt_field round-trip."""
    original = "sk-secret-api-key-12345"
    encrypted = encrypt_field(original)
    assert encrypted != original
    decrypted = decrypt_field(encrypted)
    assert decrypted == original


def test_encrypt_different_outputs():
    """encrypt_field produces different ciphertext each time (Fernet uses IV)."""
    val = "same-value"
    enc1 = encrypt_field(val)
    enc2 = encrypt_field(val)
    # Fernet uses a random IV, so encryptions should differ
    assert enc1 != enc2
    # But both decrypt to the same value
    assert decrypt_field(enc1) == val
    assert decrypt_field(enc2) == val
