# Admin — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 88


## Contents

- [admin.py](#admin) (11 endpoints)
- [admin_db_health.py](#admin-db-health) (1 endpoints)
- [admin_docs.py](#admin-docs) (10 endpoints)
- [admin_drive.py](#admin-drive) (7 endpoints)
- [admin_mail.py](#admin-mail) (8 endpoints)
- [admin_mail_dns.py](#admin-mail-dns) (3 endpoints)
- [admin_meetings.py](#admin-meetings) (14 endpoints)
- [admin_parity.py](#admin-parity) (1 endpoints)
- [app_admin.py](#app-admin) (3 endpoints)
- [backups.py](#backups) (7 endpoints)
- [license.py](#license) (4 endpoints)
- [roles.py](#roles) (12 endpoints)
- [user_import.py](#user-import) (2 endpoints)
- [users.py](#users) (5 endpoints)

---

## admin.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/stats` | `get_stats` | — |
| `GET` | `/app-admins` | `list_app_admins` | — |
| `POST` | `/app-admins` | `grant_app_admin` | — |
| `DELETE` | `/app-admins/{app_admin_id}` | `revoke_app_admin` | — |
| `GET` | `/ai-config` | `get_ai_config` | — |
| `PUT` | `/ai-config` | `update_ai_config` | — |
| `POST` | `/ai-config/test` | `test_ai_connection` | Test connectivity to the configured AI provider without saving changes. |
| `GET` | `/audit-logs` | `get_audit_logs` | — |
| `GET` | `/audit-logs/general` | `get_general_audit_logs` | — |
| `GET` | `/users/{user_id}/app-access` | `get_user_app_access` | — |
| `PUT` | `/users/{user_id}/app-access` | `set_user_app_access` | — |

### `GET /stats`

**Function:** `get_stats` (line 33)

**Auth:** `_`


### `GET /app-admins`

**Function:** `list_app_admins` (line 89)

**Auth:** `_`


### `POST /app-admins`

**Function:** `grant_app_admin` (line 103)

**Parameters:** `request`, `payload`

**Response model:** `AppAdminResponse`

**Auth:** `current_user`


### `DELETE /app-admins/{app_admin_id}`

**Function:** `revoke_app_admin` (line 122)

**Parameters:** `request`, `app_admin_id`

**Auth:** `current_user`


### `GET /ai-config`

**Function:** `get_ai_config` (line 136)

**Response model:** `AIConfigResponse`

**Auth:** `_`


### `PUT /ai-config`

**Function:** `update_ai_config` (line 157)

**Parameters:** `request`, `payload`

**Response model:** `AIConfigResponse`

**Auth:** `current_user`


### `POST /ai-config/test`

**Function:** `test_ai_connection` (line 176)

Test connectivity to the configured AI provider without saving changes.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /audit-logs`

**Function:** `get_audit_logs` (line 219)

**Parameters:** `skip`, `limit`

**Auth:** `_`


### `GET /audit-logs/general`

**Function:** `get_general_audit_logs` (line 241)

**Parameters:** `skip`, `limit`, `user_id`, `action`, `resource_type`

**Auth:** `_`


### `GET /users/{user_id}/app-access`

**Function:** `get_user_app_access` (line 263)

**Parameters:** `user_id`

**Auth:** `_`


### `PUT /users/{user_id}/app-access`

**Function:** `set_user_app_access` (line 276)

**Parameters:** `request`, `user_id`, `payload`

**Auth:** `current_user`


---

## admin_db_health.py

Admin database health endpoint — Super Admin only.

Provides a real-time snapshot of the database cluster health for the
Admin Dashboard DatabaseHealthWidget:

    GET /api/v1/admin/db-health

Returns:
    - Replication status: primary node + replica lag for each standby
    - Connection pool stats: active/waiting/idle connections via PgBouncer
    - Last backup info: timestamp, type, age
    - PostgreSQL version and cluster mode (single / patroni-ha)

All queries use the read replica session where available to avoid
adding load to the primary for monitoring traffic.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `db_health` | Return database health metrics for the Admin Dashboard. |

### `GET `

**Function:** `db_health` (line 34)

Return database health metrics for the Admin Dashboard.

**Auth:** `current_user`


---

## admin_docs.py

Super Admin ONLYOFFICE / Docs configuration endpoints.

All config is stored in the system_settings table as JSON values
under the 'docs_admin' category.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/config` | `get_docs_config` | — |
| `PUT` | `/config` | `update_docs_config` | — |
| `GET` | `/templates` | `get_docs_templates` | — |
| `PUT` | `/templates` | `update_docs_templates` | — |
| `GET` | `/quotas` | `get_docs_quotas` | — |
| `PUT` | `/quotas` | `update_docs_quotas` | — |
| `GET` | `/file-types` | `get_docs_file_types` | — |
| `PUT` | `/file-types` | `update_docs_file_types` | — |
| `GET` | `/retention` | `get_docs_retention` | — |
| `PUT` | `/retention` | `update_docs_retention` | — |

### `GET /config`

**Function:** `get_docs_config` (line 107)

**Response model:** `DocsServerConfig`

**Auth:** `_admin`


### `PUT /config`

**Function:** `update_docs_config` (line 115)

**Parameters:** `payload`

**Response model:** `DocsServerConfig`

**Auth:** `_admin`


### `GET /templates`

**Function:** `get_docs_templates` (line 130)

**Response model:** `DocsTemplates`

**Auth:** `_admin`


### `PUT /templates`

**Function:** `update_docs_templates` (line 138)

**Parameters:** `payload`

**Response model:** `DocsTemplates`

**Auth:** `_admin`


### `GET /quotas`

**Function:** `get_docs_quotas` (line 153)

**Response model:** `DocsQuotas`

**Auth:** `_admin`


### `PUT /quotas`

**Function:** `update_docs_quotas` (line 161)

**Parameters:** `payload`

**Response model:** `DocsQuotas`

**Auth:** `_admin`


### `GET /file-types`

**Function:** `get_docs_file_types` (line 176)

**Response model:** `DocsFileTypes`

**Auth:** `_admin`


### `PUT /file-types`

**Function:** `update_docs_file_types` (line 184)

**Parameters:** `payload`

**Response model:** `DocsFileTypes`

**Auth:** `_admin`


### `GET /retention`

**Function:** `get_docs_retention` (line 199)

**Response model:** `DocsRetention`

**Auth:** `_admin`


### `PUT /retention`

**Function:** `update_docs_retention` (line 207)

**Parameters:** `payload`

**Response model:** `DocsRetention`

**Auth:** `_admin`


---

## admin_drive.py

Super Admin drive/storage configuration endpoints.

All config is stored in the system_settings table as JSON values
under the 'drive_admin' category.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/quotas` | `get_drive_quotas` | — |
| `PUT` | `/quotas` | `update_drive_quotas` | — |
| `GET` | `/file-types` | `get_drive_file_types` | — |
| `PUT` | `/file-types` | `update_drive_file_types` | — |
| `GET` | `/retention` | `get_drive_retention` | — |
| `PUT` | `/retention` | `update_drive_retention` | — |
| `GET` | `/health` | `get_drive_health` | — |

### `GET /quotas`

**Function:** `get_drive_quotas` (line 98)

**Response model:** `DriveQuotas`

**Auth:** `_admin`


### `PUT /quotas`

**Function:** `update_drive_quotas` (line 106)

**Parameters:** `payload`

**Response model:** `DriveQuotas`

**Auth:** `_admin`


### `GET /file-types`

**Function:** `get_drive_file_types` (line 121)

**Response model:** `DriveFileTypes`

**Auth:** `_admin`


### `PUT /file-types`

**Function:** `update_drive_file_types` (line 129)

**Parameters:** `payload`

**Response model:** `DriveFileTypes`

**Auth:** `_admin`


### `GET /retention`

**Function:** `get_drive_retention` (line 144)

**Response model:** `DriveRetention`

**Auth:** `_admin`


### `PUT /retention`

**Function:** `update_drive_retention` (line 152)

**Parameters:** `payload`

**Response model:** `DriveRetention`

**Auth:** `_admin`


### `GET /health`

**Function:** `get_drive_health` (line 171)

**Response model:** `DriveHealth`

**Auth:** `_admin`


---

## admin_mail.py

Super Admin mail server configuration endpoints.

All config is stored in the system_settings table as JSON values
under the 'mail_admin' category.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/config` | `get_mail_config` | — |
| `PUT` | `/config` | `update_mail_config` | — |
| `GET` | `/policies` | `get_mail_policies` | — |
| `PUT` | `/policies` | `update_mail_policies` | — |
| `GET` | `/spam` | `get_spam_config` | — |
| `PUT` | `/spam` | `update_spam_config` | — |
| `GET` | `/quotas` | `get_mail_quotas` | — |
| `PUT` | `/quotas` | `update_mail_quotas` | — |

### `GET /config`

**Function:** `get_mail_config` (line 100)

**Response model:** `MailServerConfig`

**Auth:** `_admin`


### `PUT /config`

**Function:** `update_mail_config` (line 108)

**Parameters:** `payload`

**Response model:** `MailServerConfig`

**Auth:** `_admin`


### `GET /policies`

**Function:** `get_mail_policies` (line 123)

**Response model:** `MailPolicies`

**Auth:** `_admin`


### `PUT /policies`

**Function:** `update_mail_policies` (line 131)

**Parameters:** `payload`

**Response model:** `MailPolicies`

**Auth:** `_admin`


### `GET /spam`

**Function:** `get_spam_config` (line 146)

**Response model:** `MailSpamConfig`

**Auth:** `_admin`


### `PUT /spam`

**Function:** `update_spam_config` (line 154)

**Parameters:** `payload`

**Response model:** `MailSpamConfig`

**Auth:** `_admin`


### `GET /quotas`

**Function:** `get_mail_quotas` (line 169)

**Response model:** `MailQuotas`

**Auth:** `_admin`


### `PUT /quotas`

**Function:** `update_mail_quotas` (line 177)

**Parameters:** `payload`

**Response model:** `MailQuotas`

**Auth:** `_admin`


---

## admin_mail_dns.py

Admin Mail DNS Configuration — DNS record guidance and verification.

Provides endpoints for Super Admins to:
- View required DNS records (MX, SPF, DKIM, DMARC)
- Verify DNS records are properly configured
- Check TLS certificate status


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/dns-config` | `get_dns_config` | Return the DNS records that must be configured for the mail domain. |
| `POST` | `/verify-dns` | `verify_dns` | Check whether the required DNS records exist and have correct values. |
| `GET` | `/tls-status` | `tls_status` | Check the TLS certificate status for the SMTP server. |

### `GET /dns-config`

**Function:** `get_dns_config` (line 50)

Return the DNS records that must be configured for the mail domain.

Generates MX, SPF, DKIM, and DMARC records based on the current settings.

**Auth:** `current_user`


### `POST /verify-dns`

**Function:** `verify_dns` (line 123)

Check whether the required DNS records exist and have correct values.

Uses ``socket.getaddrinfo`` and ``dns.resolver`` (if available) for lookups.
Falls back to basic socket lookups when the ``dnspython`` package is not installed.

**Auth:** `current_user`


### `GET /tls-status`

**Function:** `tls_status` (line 225)

Check the TLS certificate status for the SMTP server.

Attempts an SSL handshake to the SMTP host on the configured port
(or 465 for implicit TLS) and reports certificate details.

**Auth:** `current_user`


---

## admin_meetings.py

Super Admin Jitsi / Meetings configuration endpoints.

All config is stored in the system_settings table as JSON values
under the 'meetings_admin' category.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/config` | `get_meetings_config` | — |
| `PUT` | `/config` | `update_meetings_config` | — |
| `GET` | `/defaults` | `get_meetings_defaults` | — |
| `PUT` | `/defaults` | `update_meetings_defaults` | — |
| `GET` | `/recording` | `get_meetings_recording` | — |
| `PUT` | `/recording` | `update_meetings_recording` | — |
| `GET` | `/lobby` | `get_lobby_settings` | — |
| `PUT` | `/lobby` | `update_lobby_settings` | — |
| `GET` | `/lobby/public` | `get_lobby_settings_public` | — |
| `GET` | `/theme` | `get_jitsi_theme` | — |
| `PUT` | `/theme` | `update_jitsi_theme` | — |
| `GET` | `/theme/public` | `get_jitsi_theme_public` | — |
| `GET` | `/sip` | `get_sip_config` | — |
| `PUT` | `/sip` | `update_sip_config` | — |

### `GET /config`

**Function:** `get_meetings_config` (line 127)

**Response model:** `MeetingsServerConfig`

**Auth:** `_admin`


### `PUT /config`

**Function:** `update_meetings_config` (line 135)

**Parameters:** `payload`

**Response model:** `MeetingsServerConfig`

**Auth:** `_admin`


### `GET /defaults`

**Function:** `get_meetings_defaults` (line 150)

**Response model:** `MeetingsDefaults`

**Auth:** `_admin`


### `PUT /defaults`

**Function:** `update_meetings_defaults` (line 158)

**Parameters:** `payload`

**Response model:** `MeetingsDefaults`

**Auth:** `_admin`


### `GET /recording`

**Function:** `get_meetings_recording` (line 173)

**Response model:** `MeetingsRecording`

**Auth:** `_admin`


### `PUT /recording`

**Function:** `update_meetings_recording` (line 181)

**Parameters:** `payload`

**Response model:** `MeetingsRecording`

**Auth:** `_admin`


### `GET /lobby`

**Function:** `get_lobby_settings` (line 196)

**Response model:** `LobbySettings`

**Auth:** `_admin`


### `PUT /lobby`

**Function:** `update_lobby_settings` (line 204)

**Parameters:** `payload`

**Response model:** `LobbySettings`

**Auth:** `_admin`


### `GET /lobby/public`

**Function:** `get_lobby_settings_public` (line 215)

**Response model:** `LobbySettings`


### `GET /theme`

**Function:** `get_jitsi_theme` (line 226)

**Response model:** `JitsiTheme`

**Auth:** `_admin`


### `PUT /theme`

**Function:** `update_jitsi_theme` (line 234)

**Parameters:** `payload`

**Response model:** `JitsiTheme`

**Auth:** `_admin`


### `GET /theme/public`

**Function:** `get_jitsi_theme_public` (line 245)

**Response model:** `JitsiTheme`


### `GET /sip`

**Function:** `get_sip_config` (line 256)

**Response model:** `SIPConfig`

**Auth:** `_admin`


### `PUT /sip`

**Function:** `update_sip_config` (line 264)

**Parameters:** `payload`

**Response model:** `SIPConfig`

**Auth:** `_admin`


---

## admin_parity.py

Admin parity dashboard — Super Admin only.

Provides a real-time snapshot of model-router-frontend parity:

    GET /api/v1/admin/parity

Returns counts and gap details for:
  - Model files vs imported models
  - Router files vs registered routers
  - Alembic revision uniqueness
  - from __future__ usage in routers


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `parity_dashboard` | Return full parity audit results. |

### `GET `

**Function:** `parity_dashboard` (line 131)

Return full parity audit results.

**Auth:** `current_user`


---

## app_admin.py

Per-app admin dashboard endpoints.

Provides stats, config read, and config update scoped to individual
application modules (mail, forms, projects, drive, calendar, notes, etc.).
Access requires either Super Admin privileges or an AppAdmin record for
the requested app.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/apps/{app_name}/stats` | `get_app_stats` | — |
| `GET` | `/apps/{app_name}/config` | `get_app_config` | — |
| `PUT` | `/apps/{app_name}/config` | `update_app_config` | — |

### `GET /apps/{app_name}/stats`

**Function:** `get_app_stats` (line 265)

**Parameters:** `app_name`, `current_user`

**Response model:** `AppStats`


### `GET /apps/{app_name}/config`

**Function:** `get_app_config` (line 288)

**Parameters:** `app_name`, `current_user`

**Response model:** `AppConfig`


### `PUT /apps/{app_name}/config`

**Function:** `update_app_config` (line 307)

**Parameters:** `request`, `body`, `app_name`, `current_user`

**Response model:** `AppConfig`


---

## backups.py

Backup management API — Super Admin only.

Endpoints:
    GET  /backups              — list pg_dump backups (single-node)
    POST /backups              — trigger pg_dump backup (single-node)
    DELETE /backups/{filename} — delete a pg_dump backup

    # pgBackRest / HA mode endpoints:
    GET  /backups/status       — backup health (age, last result, WAL lag)
    GET  /backups/pitr-info    — available PITR window from pgBackRest
    POST /backups/verify       — trigger pgBackRest verify
    POST /backups/pitr-restore — trigger PITR restore to a timestamp (caution!)


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/status` | `backup_status` | Return backup health: age of last backup, WAL archiving status, pgBackRest info. |
| `GET` | `/pitr-info` | `pitr_info` | Return the earliest and latest timestamps available for Point-in-Time Recovery. |
| `POST` | `/verify` | `verify_backup` | Trigger a pgBackRest verify run in the background. |
| `POST` | `/pitr-restore` | `pitr_restore` | Initiate a PITR restore. DANGEROUS — stops all services and restores the DB. |
| `GET` | `` | `list_backups` | Return a list of all database backups stored in MinIO. |
| `POST` | `` | `create_backup` | Run pg_dump and upload a gzipped backup to MinIO. |
| `DELETE` | `/{filename}` | `delete_backup` | Delete a specific backup file from MinIO. |

### `GET /status`

**Function:** `backup_status` (line 50)

Return backup health: age of last backup, WAL archiving status, pgBackRest info.

**Auth:** `current_user`


### `GET /pitr-info`

**Function:** `pitr_info` (line 82)

Return the earliest and latest timestamps available for Point-in-Time Recovery.

**Auth:** `current_user`


### `POST /verify`

**Function:** `verify_backup` (line 111)

Trigger a pgBackRest verify run in the background.

**Parameters:** `request`, `background_tasks`

**Auth:** `current_user`


### `POST /pitr-restore`

**Function:** `pitr_restore` (line 132)

Initiate a PITR restore. DANGEROUS — stops all services and restores the DB.

This endpoint queues a Celery task that:
1. Stops backend and Celery workers.
2. Runs pgBackRest restore to the given timestamp.
3. Restarts services.

You MUST set confirm=true in the request body to proceed.

**Parameters:** `request`, `body`

**Auth:** `current_user`


### `GET `

**Function:** `list_backups` (line 178)

Return a list of all database backups stored in MinIO.

**Auth:** `current_user`


### `POST `

**Function:** `create_backup` (line 186)

Run pg_dump and upload a gzipped backup to MinIO.

**Parameters:** `request`

**Auth:** `current_user`


### `DELETE /{filename}`

**Function:** `delete_backup` (line 200)

Delete a specific backup file from MinIO.

**Parameters:** `filename`

**Auth:** `current_user`


---

## license.py

License / Subscription Tracking API — Super Admin only.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `get_license` | — |
| `POST` | `` | `activate_license` | — |
| `PUT` | `/{license_id}` | `update_license` | — |
| `GET` | `/status` | `license_status` | — |

### `GET `

**Function:** `get_license` (line 68)

**Auth:** `_`


### `POST `

**Function:** `activate_license` (line 92)

**Parameters:** `payload`

**Auth:** `_`


### `PUT /{license_id}`

**Function:** `update_license` (line 137)

**Parameters:** `license_id`, `payload`

**Auth:** `_`


### `GET /status`

**Function:** `license_status` (line 165)

**Auth:** `_`


---

## roles.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_roles` | — |
| `POST` | `` | `create_role` | — |
| `PUT` | `/{role_id}` | `update_role` | — |
| `DELETE` | `/{role_id}` | `delete_role` | — |
| `GET` | `/permissions` | `list_permissions` | — |
| `POST` | `/permissions` | `create_permission` | — |
| `POST` | `/{role_id}/permissions/{permission_id}` | `assign_permission` | — |
| `DELETE` | `/{role_id}/permissions/{permission_id}` | `remove_permission` | — |
| `POST` | `/assign` | `assign_role` | — |
| `DELETE` | `/assign/{user_id}/{role_id}` | `revoke_role` | — |
| `GET` | `/{role_id}/permissions` | `get_role_permissions` | — |
| `POST` | `/{role_id}/permissions/bulk` | `bulk_assign_permissions` | — |

### `GET `

**Function:** `list_roles` (line 26)

**Auth:** `_`


### `POST `

**Function:** `create_role` (line 35)

**Parameters:** `payload`

**Response model:** `RoleResponse`

**Auth:** `_`


### `PUT /{role_id}`

**Function:** `update_role` (line 45)

**Parameters:** `role_id`, `payload`

**Response model:** `RoleResponse`

**Auth:** `_`


### `DELETE /{role_id}`

**Function:** `delete_role` (line 56)

**Parameters:** `role_id`

**Auth:** `_`


### `GET /permissions`

**Function:** `list_permissions` (line 66)

**Auth:** `_`


### `POST /permissions`

**Function:** `create_permission` (line 80)

**Parameters:** `payload`

**Response model:** `PermissionResponse`

**Auth:** `_`


### `POST /{role_id}/permissions/{permission_id}`

**Function:** `assign_permission` (line 90)

**Parameters:** `role_id`, `permission_id`

**Auth:** `_`


### `DELETE /{role_id}/permissions/{permission_id}`

**Function:** `remove_permission` (line 100)

**Parameters:** `role_id`, `permission_id`

**Auth:** `_`


### `POST /assign`

**Function:** `assign_role` (line 111)

**Parameters:** `request`, `payload`

**Auth:** `current_user`


### `DELETE /assign/{user_id}/{role_id}`

**Function:** `revoke_role` (line 129)

**Parameters:** `request`, `user_id`, `role_id`

**Auth:** `current_user`


### `GET /{role_id}/permissions`

**Function:** `get_role_permissions` (line 149)

**Parameters:** `role_id`

**Auth:** `_`


### `POST /{role_id}/permissions/bulk`

**Function:** `bulk_assign_permissions` (line 163)

**Parameters:** `request`, `role_id`, `payload`

**Auth:** `current_user`


---

## user_import.py

Bulk User Import API — CSV upload, preview, confirm (Super Admin only).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/users/import/preview` | `import_preview` | Parse the uploaded CSV, validate each row (format, duplicates in DB), |
| `POST` | `/users/import/confirm` | `import_confirm` | Accept the validated rows from the preview step and batch-create users. |

### `POST /users/import/preview`

**Function:** `import_preview` (line 36)

Parse the uploaded CSV, validate each row (format, duplicates in DB),
and return a preview of valid and error rows.

**Parameters:** `file`

**Auth:** `_`


### `POST /users/import/confirm`

**Function:** `import_confirm` (line 54)

Accept the validated rows from the preview step and batch-create users.
Supports both ``{ "users": [...] }`` and ``{ "rows": [...] }`` payloads.

**Parameters:** `payload`

**Auth:** `_`


---

## users.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_users` | — |
| `POST` | `` | `create_user` | — |
| `GET` | `/{user_id}` | `get_user` | — |
| `PUT` | `/{user_id}` | `update_user` | — |
| `DELETE` | `/{user_id}` | `delete_user` | — |

### `GET `

**Function:** `list_users` (line 32)

**Parameters:** `skip`, `limit`

**Auth:** `_`


### `POST `

**Function:** `create_user` (line 44)

**Parameters:** `request`, `payload`

**Response model:** `UserMeResponse`

**Auth:** `current_user`


### `GET /{user_id}`

**Function:** `get_user` (line 59)

**Parameters:** `user_id`

**Response model:** `UserMeResponse`

**Auth:** `_`


### `PUT /{user_id}`

**Function:** `update_user` (line 69)

**Parameters:** `request`, `user_id`, `payload`

**Response model:** `UserMeResponse`

**Auth:** `current_user`


### `DELETE /{user_id}`

**Function:** `delete_user` (line 85)

**Parameters:** `request`, `user_id`

**Auth:** `current_user`

