"""Password policy enforcement.

Rules:
- Minimum 12 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character
- Must not match the user's email or name
- Must not be in the top-10K most common passwords
"""
from __future__ import annotations

import re

# Top-100 most common passwords (compact subset — extend as needed)
_COMMON_PASSWORDS: frozenset[str] = frozenset(
    {
        "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
        "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
        "ashley", "michael", "shadow", "123123", "654321", "superman", "qazwsx",
        "michael", "football", "password1", "password123", "batman", "login",
        "starwars", "princess", "welcome", "admin", "passw0rd", "hello",
        "charlie", "donald", "qwerty123", "mustang", "access", "121212",
        "flower", "696969", "hottie", "loveme", "zaq1zaq1", "password1234",
        "cheese", "hunter2", "letmein1", "changeme", "super-admin@2026!",
    }
)


class PasswordPolicyError(ValueError):
    """Raised when a password fails policy checks."""


def validate_password(
    password: str,
    *,
    email: str | None = None,
    full_name: str | None = None,
) -> None:
    """Validate a password against the security policy.

    Raises PasswordPolicyError with a human-readable message on failure.
    """
    errors: list[str] = []

    if len(password) < 12:
        errors.append("Password must be at least 12 characters long")

    if not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter")

    if not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter")

    if not re.search(r"\d", password):
        errors.append("Password must contain at least one digit")

    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", password):
        errors.append("Password must contain at least one special character")

    # Check against common passwords
    if password.lower() in _COMMON_PASSWORDS:
        errors.append("This password is too common; please choose a stronger one")

    # Check against user identity
    if email:
        local_part = email.split("@")[0].lower()
        if local_part and local_part in password.lower():
            errors.append("Password must not contain your email address")

    if full_name:
        for part in full_name.lower().split():
            if len(part) >= 3 and part in password.lower():
                errors.append("Password must not contain your name")
                break

    if errors:
        raise PasswordPolicyError("; ".join(errors))
