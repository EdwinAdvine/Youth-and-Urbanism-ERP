# Mfa — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 5


## Contents

- [mfa.py](#mfa) (5 endpoints)

---

## mfa.py

MFA (Multi-Factor Authentication) endpoints.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/mfa/setup` | `mfa_setup` | — |
| `POST` | `/mfa/verify-setup` | `mfa_verify_setup` | — |
| `POST` | `/mfa/verify` | `mfa_verify` | — |
| `POST` | `/mfa/backup-codes` | `mfa_backup_codes` | — |
| `DELETE` | `/mfa/disable` | `mfa_disable` | — |

### `POST /mfa/setup`

**Function:** `mfa_setup` (line 30)

**Parameters:** `request`

**Response model:** `MFASetupResponse`

**Auth:** `current_user`


### `POST /mfa/verify-setup`

**Function:** `mfa_verify_setup` (line 41)

**Parameters:** `request`, `totp_code`

**Response model:** `MFABackupCodesResponse`

**Auth:** `current_user`


### `POST /mfa/verify`

**Function:** `mfa_verify` (line 53)

**Parameters:** `request`, `payload`

**Response model:** `TokenResponse`


### `POST /mfa/backup-codes`

**Function:** `mfa_backup_codes` (line 68)

**Parameters:** `request`

**Response model:** `MFABackupCodesResponse`

**Auth:** `current_user`


### `DELETE /mfa/disable`

**Function:** `mfa_disable` (line 79)

**Parameters:** `request`

**Response model:** `MessageResponse`

**Auth:** `current_user`

