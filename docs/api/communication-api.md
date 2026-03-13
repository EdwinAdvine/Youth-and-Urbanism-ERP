# Communication — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 201


## Contents

- [chat.py](#chat) (33 endpoints)
- [chat_extended.py](#chat-extended) (56 endpoints)
- [mail.py](#mail) (24 endpoints)
- [mail_accounts.py](#mail-accounts) (8 endpoints)
- [mail_advanced.py](#mail-advanced) (61 endpoints)
- [mail_ext.py](#mail-ext) (14 endpoints)
- [mail_filters.py](#mail-filters) (5 endpoints)

---

## chat.py

Y&U Teams — Chat & Channels REST API.

Endpoints for channel CRUD, messaging, threading, reactions, presence,
search, pinning, bookmarks, and channel tabs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/channels` | `create_channel` | Create a new channel and add creator + initial members. |
| `GET` | `/channels` | `list_channels` | List channels the current user is a member of. |
| `GET` | `/channels/discover` | `discover_channels` | Discover public channels the user is NOT yet a member of. |
| `GET` | `/channels/{channel_id}` | `get_channel` | Get channel details. Must be a member (or channel is public). |
| `PUT` | `/channels/{channel_id}` | `update_channel` | Update channel name/topic/description. Requires admin or owner role. |
| `POST` | `/channels/{channel_id}/archive` | `archive_channel` | Archive a channel. Requires owner role. |
| `DELETE` | `/channels/{channel_id}` | `delete_channel` | Delete a channel. Super admin or channel owner only. |
| `GET` | `/channels/{channel_id}/members` | `list_channel_members` | List all members of a channel. |
| `POST` | `/channels/{channel_id}/members` | `add_channel_member` | Add a member to a channel. |
| `PUT` | `/channels/{channel_id}/members/{user_id}` | `update_channel_member` | Update a member's role or notification preferences. |
| `DELETE` | `/channels/{channel_id}/members/{user_id}` | `remove_channel_member` | Remove a member from a channel. Self-leave or admin kick. |
| `POST` | `/channels/{channel_id}/join` | `join_channel` | Join a public channel. |
| `GET` | `/channels/{channel_id}/messages` | `list_messages` | List messages in a channel with cursor-based pagination. |
| `POST` | `/channels/{channel_id}/messages` | `send_message` | Send a message in a channel. |
| `PUT` | `/messages/{message_id}` | `edit_message` | Edit a message. Only the sender can edit. |
| `DELETE` | `/messages/{message_id}` | `delete_message` | Soft-delete a message. Sender or channel admin. |
| `GET` | `/messages/{message_id}/thread` | `get_thread` | Get a message thread (root + replies). |
| `POST` | `/messages/{message_id}/reactions` | `toggle_reaction` | Add or remove a reaction on a message (toggle). |
| `POST` | `/channels/{channel_id}/read` | `mark_channel_read` | Mark a channel as read up to now. |
| `POST` | `/channels/{channel_id}/typing` | `send_typing` | Notify that the user is typing. Published via event bus for WS fanout. |
| `PUT` | `/presence` | `update_presence` | Update the current user's presence status (stored in Redis). |
| `GET` | `/presence` | `get_presence` | Get presence for a list of users. |
| `GET` | `/search` | `search_messages` | Full-text search across messages in channels the user belongs to. |
| `POST` | `/channels/{channel_id}/pin/{message_id}` | `pin_message` | Pin a message to the channel. |
| `DELETE` | `/channels/{channel_id}/pin/{message_id}` | `unpin_message` | Unpin a message from the channel. |
| `GET` | `/channels/{channel_id}/pins` | `list_pinned_messages` | List pinned messages in a channel. |
| `POST` | `/bookmarks` | `create_bookmark` | Bookmark a message for personal reference. |
| `GET` | `/bookmarks` | `list_bookmarks` | List the current user's bookmarked messages. |
| `DELETE` | `/bookmarks/{bookmark_id}` | `delete_bookmark` | Remove a bookmark. |
| `GET` | `/channels/{channel_id}/tabs` | `list_tabs` | List tabs for a channel. |
| `POST` | `/channels/{channel_id}/tabs` | `create_tab` | Add a tab to a channel. |
| `DELETE` | `/channels/{channel_id}/tabs/{tab_id}` | `delete_tab` | Remove a tab from a channel. |
| `POST` | `/dm` | `get_or_create_dm` | Get or create a DM channel between current user and target user. |

### `POST /channels`

**Function:** `create_channel` (line 102)

Create a new channel and add creator + initial members.

**Parameters:** `body`

**Auth:** `current_user`


### `GET /channels`

**Function:** `list_channels` (line 178)

List channels the current user is a member of.

**Parameters:** `team_id`, `channel_type`, `include_archived`, `skip`, `limit`

**Auth:** `current_user`


### `GET /channels/discover`

**Function:** `discover_channels` (line 222)

Discover public channels the user is NOT yet a member of.

**Parameters:** `team_id`, `search`, `skip`, `limit`

**Auth:** `current_user`


### `GET /channels/{channel_id}`

**Function:** `get_channel` (line 255)

Get channel details. Must be a member (or channel is public).

**Parameters:** `channel_id`

**Auth:** `current_user`


### `PUT /channels/{channel_id}`

**Function:** `update_channel` (line 279)

Update channel name/topic/description. Requires admin or owner role.

**Parameters:** `channel_id`, `body`

**Auth:** `current_user`


### `POST /channels/{channel_id}/archive`

**Function:** `archive_channel` (line 311)

Archive a channel. Requires owner role.

**Parameters:** `channel_id`

**Auth:** `current_user`


### `DELETE /channels/{channel_id}`

**Function:** `delete_channel` (line 333)

Delete a channel. Super admin or channel owner only.

**Parameters:** `channel_id`

**Auth:** `current_user`


### `GET /channels/{channel_id}/members`

**Function:** `list_channel_members` (line 357)

List all members of a channel.

**Parameters:** `channel_id`

**Auth:** `current_user`


### `POST /channels/{channel_id}/members`

**Function:** `add_channel_member` (line 387)

Add a member to a channel.

**Parameters:** `channel_id`, `body`

**Auth:** `current_user`


### `PUT /channels/{channel_id}/members/{user_id}`

**Function:** `update_channel_member` (line 443)

Update a member's role or notification preferences.

**Parameters:** `channel_id`, `user_id`, `body`

**Auth:** `current_user`


### `DELETE /channels/{channel_id}/members/{user_id}`

**Function:** `remove_channel_member` (line 481)

Remove a member from a channel. Self-leave or admin kick.

**Parameters:** `channel_id`, `user_id`

**Auth:** `current_user`


### `POST /channels/{channel_id}/join`

**Function:** `join_channel` (line 507)

Join a public channel.

**Parameters:** `channel_id`

**Auth:** `current_user`


### `GET /channels/{channel_id}/messages`

**Function:** `list_messages` (line 544)

List messages in a channel with cursor-based pagination.

**Parameters:** `channel_id`, `before`, `after`, `limit`

**Auth:** `current_user`


### `POST /channels/{channel_id}/messages`

**Function:** `send_message` (line 599)

Send a message in a channel.

**Parameters:** `channel_id`, `body`

**Auth:** `current_user`


### `PUT /messages/{message_id}`

**Function:** `edit_message` (line 664)

Edit a message. Only the sender can edit.

**Parameters:** `message_id`, `body`

**Auth:** `current_user`


### `DELETE /messages/{message_id}`

**Function:** `delete_message` (line 698)

Soft-delete a message. Sender or channel admin.

**Parameters:** `message_id`

**Auth:** `current_user`


### `GET /messages/{message_id}/thread`

**Function:** `get_thread` (line 738)

Get a message thread (root + replies).

**Parameters:** `message_id`, `limit`, `offset`

**Auth:** `current_user`


### `POST /messages/{message_id}/reactions`

**Function:** `toggle_reaction` (line 775)

Add or remove a reaction on a message (toggle).

**Parameters:** `message_id`, `body`

**Auth:** `current_user`


### `POST /channels/{channel_id}/read`

**Function:** `mark_channel_read` (line 824)

Mark a channel as read up to now.

**Parameters:** `channel_id`

**Auth:** `current_user`


### `POST /channels/{channel_id}/typing`

**Function:** `send_typing` (line 841)

Notify that the user is typing. Published via event bus for WS fanout.

**Parameters:** `channel_id`

**Auth:** `current_user`


### `PUT /presence`

**Function:** `update_presence` (line 862)

Update the current user's presence status (stored in Redis).

**Parameters:** `body`

**Auth:** `current_user`


### `GET /presence`

**Function:** `get_presence` (line 894)

Get presence for a list of users.

**Parameters:** `user_ids`

**Auth:** `current_user`


### `GET /search`

**Function:** `search_messages` (line 929)

Full-text search across messages in channels the user belongs to.

**Parameters:** `q`, `channel_id`, `limit`, `offset`

**Auth:** `current_user`


### `POST /channels/{channel_id}/pin/{message_id}`

**Function:** `pin_message` (line 971)

Pin a message to the channel.

**Parameters:** `channel_id`, `message_id`

**Auth:** `current_user`


### `DELETE /channels/{channel_id}/pin/{message_id}`

**Function:** `unpin_message` (line 1005)

Unpin a message from the channel.

**Parameters:** `channel_id`, `message_id`

**Auth:** `current_user`


### `GET /channels/{channel_id}/pins`

**Function:** `list_pinned_messages` (line 1027)

List pinned messages in a channel.

**Parameters:** `channel_id`

**Auth:** `current_user`


### `POST /bookmarks`

**Function:** `create_bookmark` (line 1056)

Bookmark a message for personal reference.

**Parameters:** `body`

**Auth:** `current_user`


### `GET /bookmarks`

**Function:** `list_bookmarks` (line 1090)

List the current user's bookmarked messages.

**Parameters:** `limit`, `offset`

**Auth:** `current_user`


### `DELETE /bookmarks/{bookmark_id}`

**Function:** `delete_bookmark` (line 1118)

Remove a bookmark.

**Parameters:** `bookmark_id`

**Auth:** `current_user`


### `GET /channels/{channel_id}/tabs`

**Function:** `list_tabs` (line 1140)

List tabs for a channel.

**Parameters:** `channel_id`

**Auth:** `current_user`


### `POST /channels/{channel_id}/tabs`

**Function:** `create_tab` (line 1158)

Add a tab to a channel.

**Parameters:** `channel_id`, `body`

**Auth:** `current_user`


### `DELETE /channels/{channel_id}/tabs/{tab_id}`

**Function:** `delete_tab` (line 1185)

Remove a tab from a channel.

**Parameters:** `channel_id`, `tab_id`

**Auth:** `current_user`


### `POST /dm`

**Function:** `get_or_create_dm` (line 1210)

Get or create a DM channel between current user and target user.

**Parameters:** `user_id`

**Auth:** `current_user`


---

## chat_extended.py

Y&U Teams — Phase 2-3 API endpoints.

Calling, webhooks, slash commands, channel templates, shared channels,
transcription, whiteboards, compliance, live events, decisions, analytics.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/slash-commands` | `list_slash_commands` | — |
| `POST` | `/slash-commands` | `create_slash_command` | — |
| `DELETE` | `/slash-commands/{command_id}` | `delete_slash_command` | — |
| `POST` | `/slash-commands/execute` | `execute_slash_command` | Execute a slash command and return the result. |
| `GET` | `/webhooks/incoming` | `list_incoming_webhooks` | — |
| `POST` | `/webhooks/incoming` | `create_incoming_webhook` | — |
| `DELETE` | `/webhooks/incoming/{webhook_id}` | `delete_incoming_webhook` | — |
| `POST` | `/webhooks/incoming/{token}/send` | `receive_webhook_message` | Public endpoint — external systems POST here to send messages. |
| `GET` | `/webhooks/outgoing` | `list_outgoing_webhooks` | — |
| `POST` | `/webhooks/outgoing` | `create_outgoing_webhook` | — |
| `DELETE` | `/webhooks/outgoing/{webhook_id}` | `delete_outgoing_webhook` | — |
| `POST` | `/calls` | `initiate_call` | — |
| `PUT` | `/calls/{call_id}` | `update_call` | — |
| `GET` | `/calls/active` | `list_active_calls` | — |
| `GET` | `/channel-templates` | `list_channel_templates` | — |
| `POST` | `/channel-templates` | `create_channel_template` | — |
| `DELETE` | `/channel-templates/{template_id}` | `delete_channel_template` | — |
| `POST` | `/channel-templates/{template_id}/apply` | `apply_channel_template` | Apply a template to an existing channel (adds tabs, sets topic, posts welcome). |
| `POST` | `/shared-channels` | `share_channel` | — |
| `PUT` | `/shared-channels/{link_id}/accept` | `accept_shared_channel` | — |
| `GET` | `/shared-channels` | `list_shared_channels` | — |
| `GET` | `/meetings/{meeting_id}/transcript` | `get_meeting_transcript` | — |
| `POST` | `/meetings/{meeting_id}/transcribe` | `start_transcription` | Kick off async transcription via Celery task. |
| `GET` | `/meetings/{meeting_id}/summary` | `get_meeting_summary` | — |
| `POST` | `/meetings/{meeting_id}/generate-summary` | `generate_meeting_summary` | Trigger AI summary generation via Celery task. |
| `GET` | `/whiteboards` | `list_whiteboards` | — |
| `POST` | `/whiteboards` | `create_whiteboard` | — |
| `PUT` | `/whiteboards/{whiteboard_id}` | `update_whiteboard` | — |
| `DELETE` | `/whiteboards/{whiteboard_id}` | `delete_whiteboard` | — |
| `GET` | `/compliance/retention` | `list_retention_policies` | — |
| `POST` | `/compliance/retention` | `create_retention_policy` | — |
| `PUT` | `/compliance/retention/{policy_id}` | `update_retention_policy` | — |
| `DELETE` | `/compliance/retention/{policy_id}` | `delete_retention_policy` | — |
| `GET` | `/compliance/dlp-rules` | `list_dlp_rules` | — |
| `POST` | `/compliance/dlp-rules` | `create_dlp_rule` | — |
| `PUT` | `/compliance/dlp-rules/{rule_id}/toggle` | `toggle_dlp_rule` | — |
| `DELETE` | `/compliance/dlp-rules/{rule_id}` | `delete_dlp_rule` | — |
| `GET` | `/compliance/dlp-violations` | `list_dlp_violations` | — |
| `PUT` | `/compliance/dlp-violations/{violation_id}/resolve` | `resolve_dlp_violation` | — |
| `GET` | `/compliance/audit-logs` | `list_chat_audit_logs` | — |
| `POST` | `/compliance/ediscovery` | `ediscovery_search` | — |
| `GET` | `/live-events` | `list_live_events` | — |
| `POST` | `/live-events` | `create_live_event` | — |
| `PUT` | `/live-events/{event_id}` | `update_live_event` | — |
| `POST` | `/live-events/{event_id}/register` | `register_for_live_event` | — |
| `POST` | `/live-events/{event_id}/qa` | `ask_question` | — |
| `PUT` | `/live-events/qa/{qa_id}/answer` | `answer_question` | — |
| `GET` | `/live-events/{event_id}/qa` | `list_event_qa` | — |
| `POST` | `/live-events/qa/{qa_id}/upvote` | `upvote_question` | — |
| `GET` | `/decisions` | `list_decisions` | — |
| `POST` | `/decisions` | `create_decision` | — |
| `PUT` | `/decisions/{decision_id}/status` | `update_decision_status` | — |
| `GET` | `/notification-preferences` | `get_notification_preferences` | — |
| `PUT` | `/notification-preferences` | `update_notification_preferences` | — |
| `GET` | `/analytics` | `get_teams_analytics` | — |
| `GET` | `/analytics/live` | `get_live_analytics` | Real-time analytics computed on the fly. |

### `GET /slash-commands`

**Function:** `list_slash_commands` (line 66)

**Parameters:** `_user`


### `POST /slash-commands`

**Function:** `create_slash_command` (line 79)

**Parameters:** `data`, `user`

**Response model:** `SlashCommandOut`


### `DELETE /slash-commands/{command_id}`

**Function:** `delete_slash_command` (line 94)

**Parameters:** `command_id`, `_user`


### `POST /slash-commands/execute`

**Function:** `execute_slash_command` (line 106)

Execute a slash command and return the result.

**Parameters:** `command`, `args`, `channel_id`, `user`


### `GET /webhooks/incoming`

**Function:** `list_incoming_webhooks` (line 175)

**Parameters:** `channel_id`, `_user`


### `POST /webhooks/incoming`

**Function:** `create_incoming_webhook` (line 190)

**Parameters:** `data`, `user`

**Response model:** `IncomingWebhookOut`


### `DELETE /webhooks/incoming/{webhook_id}`

**Function:** `delete_incoming_webhook` (line 208)

**Parameters:** `webhook_id`, `_user`


### `POST /webhooks/incoming/{token}/send`

**Function:** `receive_webhook_message` (line 220)

Public endpoint — external systems POST here to send messages.

**Parameters:** `token`, `payload`


### `GET /webhooks/outgoing`

**Function:** `list_outgoing_webhooks` (line 268)

**Parameters:** `_user`


### `POST /webhooks/outgoing`

**Function:** `create_outgoing_webhook` (line 281)

**Parameters:** `data`, `user`

**Response model:** `OutgoingWebhookOut`


### `DELETE /webhooks/outgoing/{webhook_id}`

**Function:** `delete_outgoing_webhook` (line 296)

**Parameters:** `webhook_id`, `_user`


### `POST /calls`

**Function:** `initiate_call` (line 310)

**Parameters:** `data`, `user`

**Response model:** `CallSessionOut`


### `PUT /calls/{call_id}`

**Function:** `update_call` (line 341)

**Parameters:** `call_id`, `data`, `user`

**Response model:** `CallSessionOut`


### `GET /calls/active`

**Function:** `list_active_calls` (line 382)

**Parameters:** `_user`


### `GET /channel-templates`

**Function:** `list_channel_templates` (line 397)

**Parameters:** `_user`


### `POST /channel-templates`

**Function:** `create_channel_template` (line 408)

**Parameters:** `data`, `user`

**Response model:** `ChannelTemplateOut`


### `DELETE /channel-templates/{template_id}`

**Function:** `delete_channel_template` (line 423)

**Parameters:** `template_id`, `_user`


### `POST /channel-templates/{template_id}/apply`

**Function:** `apply_channel_template` (line 435)

Apply a template to an existing channel (adds tabs, sets topic, posts welcome).

**Parameters:** `template_id`, `channel_id`, `user`


### `POST /shared-channels`

**Function:** `share_channel` (line 483)

**Parameters:** `data`, `user`

**Response model:** `SharedChannelOut`


### `PUT /shared-channels/{link_id}/accept`

**Function:** `accept_shared_channel` (line 502)

**Parameters:** `link_id`, `_user`


### `GET /shared-channels`

**Function:** `list_shared_channels` (line 518)

**Parameters:** `team_id`, `_user`


### `GET /meetings/{meeting_id}/transcript`

**Function:** `get_meeting_transcript` (line 535)

**Parameters:** `meeting_id`, `_user`

**Response model:** `TranscriptOut`


### `POST /meetings/{meeting_id}/transcribe`

**Function:** `start_transcription` (line 558)

Kick off async transcription via Celery task.

**Parameters:** `meeting_id`, `_user`


### `GET /meetings/{meeting_id}/summary`

**Function:** `get_meeting_summary` (line 570)

**Parameters:** `meeting_id`, `_user`


### `POST /meetings/{meeting_id}/generate-summary`

**Function:** `generate_meeting_summary` (line 584)

Trigger AI summary generation via Celery task.

**Parameters:** `meeting_id`, `data`, `_user`

**Response model:** `dict`


### `GET /whiteboards`

**Function:** `list_whiteboards` (line 602)

**Parameters:** `channel_id`, `meeting_id`, `_user`


### `POST /whiteboards`

**Function:** `create_whiteboard` (line 620)

**Parameters:** `data`, `user`

**Response model:** `WhiteboardOut`


### `PUT /whiteboards/{whiteboard_id}`

**Function:** `update_whiteboard` (line 635)

**Parameters:** `whiteboard_id`, `state_url`, `thumbnail_url`, `is_locked`, `_user`

**Response model:** `WhiteboardOut`


### `DELETE /whiteboards/{whiteboard_id}`

**Function:** `delete_whiteboard` (line 660)

**Parameters:** `whiteboard_id`, `_user`


### `GET /compliance/retention`

**Function:** `list_retention_policies` (line 674)

**Parameters:** `_user`


### `POST /compliance/retention`

**Function:** `create_retention_policy` (line 685)

**Parameters:** `data`, `user`

**Response model:** `RetentionPolicyOut`


### `PUT /compliance/retention/{policy_id}`

**Function:** `update_retention_policy` (line 700)

**Parameters:** `policy_id`, `data`, `_user`

**Response model:** `RetentionPolicyOut`


### `DELETE /compliance/retention/{policy_id}`

**Function:** `delete_retention_policy` (line 719)

**Parameters:** `policy_id`, `_user`


### `GET /compliance/dlp-rules`

**Function:** `list_dlp_rules` (line 733)

**Parameters:** `_user`


### `POST /compliance/dlp-rules`

**Function:** `create_dlp_rule` (line 744)

**Parameters:** `data`, `user`

**Response model:** `DLPRuleOut`


### `PUT /compliance/dlp-rules/{rule_id}/toggle`

**Function:** `toggle_dlp_rule` (line 759)

**Parameters:** `rule_id`, `_user`


### `DELETE /compliance/dlp-rules/{rule_id}`

**Function:** `delete_dlp_rule` (line 775)

**Parameters:** `rule_id`, `_user`


### `GET /compliance/dlp-violations`

**Function:** `list_dlp_violations` (line 787)

**Parameters:** `rule_id`, `user_id`, `is_resolved`, `limit`, `offset`, `_user`


### `PUT /compliance/dlp-violations/{violation_id}/resolve`

**Function:** `resolve_dlp_violation` (line 812)

**Parameters:** `violation_id`, `user`


### `GET /compliance/audit-logs`

**Function:** `list_chat_audit_logs` (line 831)

**Parameters:** `channel_id`, `actor_id`, `action`, `from_date`, `to_date`, `limit`, `offset`, `_user`


### `POST /compliance/ediscovery`

**Function:** `ediscovery_search` (line 864)

**Parameters:** `data`, `_user`

**Response model:** `EDiscoveryResult`


### `GET /live-events`

**Function:** `list_live_events` (line 918)

**Parameters:** `status`, `_user`


### `POST /live-events`

**Function:** `create_live_event` (line 933)

**Parameters:** `data`, `user`

**Response model:** `LiveEventOut`


### `PUT /live-events/{event_id}`

**Function:** `update_live_event` (line 954)

**Parameters:** `event_id`, `data`, `_user`

**Response model:** `LiveEventOut`


### `POST /live-events/{event_id}/register`

**Function:** `register_for_live_event` (line 973)

**Parameters:** `event_id`, `user`


### `POST /live-events/{event_id}/qa`

**Function:** `ask_question` (line 994)

**Parameters:** `event_id`, `data`, `user`

**Response model:** `LiveEventQAOut`


### `PUT /live-events/qa/{qa_id}/answer`

**Function:** `answer_question` (line 1010)

**Parameters:** `qa_id`, `data`, `user`

**Response model:** `LiveEventQAOut`


### `GET /live-events/{event_id}/qa`

**Function:** `list_event_qa` (line 1030)

**Parameters:** `event_id`, `_user`


### `POST /live-events/qa/{qa_id}/upvote`

**Function:** `upvote_question` (line 1046)

**Parameters:** `qa_id`, `user`


### `GET /decisions`

**Function:** `list_decisions` (line 1072)

**Parameters:** `channel_id`, `search`, `limit`, `offset`, `_user`


### `POST /decisions`

**Function:** `create_decision` (line 1096)

**Parameters:** `data`, `user`

**Response model:** `DecisionOut`


### `PUT /decisions/{decision_id}/status`

**Function:** `update_decision_status` (line 1115)

**Parameters:** `decision_id`, `new_status`, `_user`


### `GET /notification-preferences`

**Function:** `get_notification_preferences` (line 1134)

**Parameters:** `user`


### `PUT /notification-preferences`

**Function:** `update_notification_preferences` (line 1147)

**Parameters:** `data`, `user`

**Response model:** `NotificationPrefOut`


### `GET /analytics`

**Function:** `get_teams_analytics` (line 1176)

**Parameters:** `team_id`, `from_date`, `to_date`, `_user`


### `GET /analytics/live`

**Function:** `get_live_analytics` (line 1197)

Real-time analytics computed on the fly.

**Parameters:** `_user`


---

## mail.py

Mail API — built-in SMTP/IMAP + PostgreSQL storage.

Messages are stored in the ``mailbox_messages`` table and sent via the
``smtp_client`` integration.

Enhanced with: inbox rules, signatures, read receipts, AI reply suggestions.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/folders` | `list_folders` | — |
| `GET` | `/messages` | `list_messages` | — |
| `GET` | `/message/{message_id}` | `get_message` | — |
| `POST` | `/send` | `send_email` | — |
| `PUT` | `/message/{message_id}/read` | `mark_as_read` | — |
| `PUT` | `/message/{message_id}/star` | `toggle_star` | Toggle the starred flag on a message. |
| `PUT` | `/message/{message_id}/move` | `move_message` | Move a message to a different folder. |
| `DELETE` | `/message/{message_id}` | `delete_message` | — |
| `GET` | `/message/{message_id}/attachment/{attachment_id}` | `download_attachment` | — |
| `POST` | `/message/{message_id}/attachment/{attachment_id}/save-to-drive` | `save_attachment_to_drive` | — |
| `POST` | `/reply` | `reply_to_email` | — |
| `POST` | `/forward` | `forward_email` | — |
| `GET` | `/rules` | `list_rules` | — |
| `POST` | `/rules` | `create_rule` | — |
| `PUT` | `/rules/{rule_id}` | `update_rule` | — |
| `DELETE` | `/rules/{rule_id}` | `delete_rule` | — |
| `GET` | `/signatures` | `list_signatures` | — |
| `POST` | `/signatures` | `create_signature` | — |
| `PUT` | `/signatures/{sig_id}` | `update_signature` | — |
| `DELETE` | `/signatures/{sig_id}` | `delete_signature` | — |
| `GET` | `/read-receipts` | `list_read_receipts` | — |
| `POST` | `/read-receipts/{receipt_id}/confirm` | `confirm_read_receipt` | — |
| `POST` | `/ai-suggest-reply` | `ai_suggest_reply` | — |
| `POST` | `/attachments/upload` | `upload_attachment` | Upload a file to MinIO for use as an email attachment. |

### `GET /folders`

**Function:** `list_folders` (line 155)

**Auth:** `current_user`


### `GET /messages`

**Function:** `list_messages` (line 192)

**Parameters:** `folder`, `page`, `limit`, `account_id`

**Auth:** `current_user`


### `GET /message/{message_id}`

**Function:** `get_message` (line 236)

**Parameters:** `message_id`

**Auth:** `current_user`


### `POST /send`

**Function:** `send_email` (line 258)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /message/{message_id}/read`

**Function:** `mark_as_read` (line 376)

**Parameters:** `message_id`

**Auth:** `current_user`


### `PUT /message/{message_id}/star`

**Function:** `toggle_star` (line 397)

Toggle the starred flag on a message.

**Parameters:** `message_id`, `starred`

**Auth:** `current_user`


### `PUT /message/{message_id}/move`

**Function:** `move_message` (line 420)

Move a message to a different folder.

**Parameters:** `message_id`, `folder`

**Auth:** `current_user`


### `DELETE /message/{message_id}`

**Function:** `delete_message` (line 445)

**Parameters:** `message_id`, `permanent`

**Auth:** `current_user`


### `GET /message/{message_id}/attachment/{attachment_id}`

**Function:** `download_attachment` (line 477)

**Parameters:** `message_id`, `attachment_id`

**Auth:** `current_user`


### `POST /message/{message_id}/attachment/{attachment_id}/save-to-drive`

**Function:** `save_attachment_to_drive` (line 517)

**Parameters:** `message_id`, `attachment_id`, `folder_path`

**Auth:** `current_user`


### `POST /reply`

**Function:** `reply_to_email` (line 586)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /forward`

**Function:** `forward_email` (line 648)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /rules`

**Function:** `list_rules` (line 702)

**Auth:** `current_user`


### `POST /rules`

**Function:** `create_rule` (line 722)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /rules/{rule_id}`

**Function:** `update_rule` (line 744)

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `DELETE /rules/{rule_id}`

**Function:** `delete_rule` (line 760)

**Parameters:** `rule_id`

**Auth:** `current_user`


### `GET /signatures`

**Function:** `list_signatures` (line 772)

**Auth:** `current_user`


### `POST /signatures`

**Function:** `create_signature` (line 792)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /signatures/{sig_id}`

**Function:** `update_signature` (line 818)

**Parameters:** `sig_id`, `payload`

**Auth:** `current_user`


### `DELETE /signatures/{sig_id}`

**Function:** `delete_signature` (line 843)

**Parameters:** `sig_id`

**Auth:** `current_user`


### `GET /read-receipts`

**Function:** `list_read_receipts` (line 855)

**Auth:** `current_user`


### `POST /read-receipts/{receipt_id}/confirm`

**Function:** `confirm_read_receipt` (line 875)

**Parameters:** `receipt_id`


### `POST /ai-suggest-reply`

**Function:** `ai_suggest_reply` (line 890)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /attachments/upload`

**Function:** `upload_attachment` (line 946)

Upload a file to MinIO for use as an email attachment.

Returns a storage_key that can be referenced when sending the message.

**Parameters:** `file`

**Auth:** `current_user`


---

## mail_accounts.py

Mail Accounts API — multi-account management for @youthandurbanism.org emails.

Provides CRUD for mail accounts, domain validation, IMAP credential testing,
and a unified inbox endpoint across all user accounts.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/accounts` | `add_account` | Add a new @youthandurbanism.org email account. |
| `GET` | `/accounts` | `list_accounts` | List all email accounts for the current user. |
| `GET` | `/accounts/{account_id}` | `get_account` | Get a single email account's details (without password). |
| `PATCH` | `/accounts/{account_id}` | `update_account` | Update display name, sync_enabled, or is_default for an account. |
| `DELETE` | `/accounts/{account_id}` | `delete_account` | Remove an email account and optionally purge all its synced messages. |
| `POST` | `/accounts/{account_id}/test` | `test_account` | Test IMAP connectivity for an existing account. |
| `POST` | `/accounts/{account_id}/sync` | `sync_account_now` | Trigger an immediate IMAP sync for one account. |
| `GET` | `/accounts/unified-inbox` | `unified_inbox` | Fetch messages across all accounts in a unified view. |

### `POST /accounts`

**Function:** `add_account` (line 99)

Add a new @youthandurbanism.org email account.

Validates domain, tests IMAP credentials against Stalwart, encrypts
password, stores the account, and triggers an initial sync.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /accounts`

**Function:** `list_accounts` (line 180)

List all email accounts for the current user.

**Auth:** `current_user`


### `GET /accounts/{account_id}`

**Function:** `get_account` (line 195)

Get a single email account's details (without password).

**Parameters:** `account_id`

**Auth:** `current_user`


### `PATCH /accounts/{account_id}`

**Function:** `update_account` (line 214)

Update display name, sync_enabled, or is_default for an account.

**Parameters:** `account_id`, `payload`

**Auth:** `current_user`


### `DELETE /accounts/{account_id}`

**Function:** `delete_account` (line 250)

Remove an email account and optionally purge all its synced messages.

**Parameters:** `account_id`, `purge_messages`

**Auth:** `current_user`


### `POST /accounts/{account_id}/test`

**Function:** `test_account` (line 296)

Test IMAP connectivity for an existing account.

**Parameters:** `account_id`

**Auth:** `current_user`


### `POST /accounts/{account_id}/sync`

**Function:** `sync_account_now` (line 331)

Trigger an immediate IMAP sync for one account.

**Parameters:** `account_id`

**Auth:** `current_user`


### `GET /accounts/unified-inbox`

**Function:** `unified_inbox` (line 358)

Fetch messages across all accounts in a unified view.

**Parameters:** `folder`, `limit`, `offset`, `account_id`

**Auth:** `current_user`


---

## mail_advanced.py

Era Mail Advanced — AI triage, focused inbox, smart folders, FTS, calendar, cross-module routing.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/triage` | `triage_inbox` | Batch-classify all unread inbox messages using AI + CRM/Support context. |
| `POST` | `/triage/{message_id}` | `classify_single_message` | Classify a single message using AI + CRM/Support context. |
| `GET` | `/triage/summary` | `triage_summary` | Return triage summary counts by ai_category for user's unread inbox. |
| `POST` | `/extract-actions/{message_id}` | `extract_actions` | Extract action items, deadlines, and meeting proposals from a message or thread. |
| `GET` | `/focused` | `list_focused` | Messages with priority_score >= 0.6, folder=INBOX, not deleted. |
| `GET` | `/other` | `list_other` | Messages with priority_score < 0.6 or NULL, folder=INBOX, not deleted. |
| `POST` | `/sender-score` | `compute_sender_score` | Compute or refresh the focused inbox sender score for a given email. |
| `GET` | `/smart-folders` | `list_smart_folders` | — |
| `POST` | `/smart-folders` | `create_smart_folder` | — |
| `DELETE` | `/smart-folders/{folder_id}` | `delete_smart_folder` | — |
| `GET` | `/search-folders` | `list_search_folders` | — |
| `POST` | `/search-folders` | `create_search_folder` | — |
| `DELETE` | `/search-folders/{folder_id}` | `delete_search_folder` | — |
| `GET` | `/search` | `advanced_search` | Advanced search with ILIKE on subject and body_text (tsvector upgrade is migr... |
| `GET` | `/categories` | `list_categories` | — |
| `POST` | `/categories` | `create_category` | — |
| `DELETE` | `/categories/{cat_id}` | `delete_category` | — |
| `GET` | `/quick-steps` | `list_quick_steps` | — |
| `POST` | `/quick-steps` | `create_quick_step` | — |
| `PUT` | `/quick-steps/{step_id}` | `update_quick_step` | — |
| `DELETE` | `/quick-steps/{step_id}` | `delete_quick_step` | — |
| `POST` | `/quick-steps/{step_id}/execute/{message_id}` | `execute_quick_step` | Load quick step actions and apply them to a message via the rule engine actio... |
| `PUT` | `/message/{message_id}/pin` | `toggle_pin` | — |
| `PUT` | `/message/{message_id}/flag` | `set_flag` | — |
| `PUT` | `/message/{message_id}/categorize` | `categorize_message` | — |
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/templates` | `create_template` | — |
| `PUT` | `/templates/{template_id}` | `update_template` | — |
| `DELETE` | `/templates/{template_id}` | `delete_template` | — |
| `POST` | `/templates/{template_id}/render` | `render_template` | Render a template by replacing {{key}} placeholders with provided variable va... |
| `POST` | `/rules/{rule_id}/test/{message_id}` | `test_rule_endpoint` | Test a rule against a message without executing actions. |
| `POST` | `/rules/{rule_id}/run-now` | `run_rule_now` | Run a rule against all messages in a given folder. |
| `POST` | `/extract-calendar/{message_id}` | `extract_calendar` | Use AI to extract dates, times, participants, and location from an email. |
| `POST` | `/create-ticket/{message_id}` | `create_ticket_from_email` | Create a support ticket from an email and publish event. |
| `POST` | `/create-invoice/{message_id}` | `create_invoice_from_email` | Use AI to extract invoice data from an email for one-click invoice creation. |
| `POST` | `/create-crm-lead/{message_id}` | `create_crm_lead` | Create a CRM lead from the email sender and publish event. |
| `GET` | `/analytics/overview` | `analytics_overview` | Personal mail analytics: sent/received counts, avg response time, unread count. |
| `GET` | `/analytics/top-contacts` | `analytics_top_contacts` | Top 10 contacts by email volume. |
| `GET` | `/analytics/hourly-heatmap` | `analytics_hourly_heatmap` | Emails received by hour of day (0-23). |
| `POST` | `/summarize-thread` | `summarize_thread` | Load all messages by ID, send to AI, return a thread summary. |
| `POST` | `/ai-draft` | `ai_draft_reply` | Generate a full AI draft reply with Era context. |
| `GET` | `/shared-mailboxes` | `list_shared_mailboxes` | — |
| `POST` | `/shared-mailboxes` | `create_shared_mailbox` | — |
| `GET` | `/contacts/profiles` | `list_contact_profiles` | — |
| `GET` | `/contacts/profile/{email:path}` | `get_contact_profile` | Get detailed contact profile with cross-module data (CRM, deals, invoices, ti... |
| `POST` | `/ai-draft-context` | `ai_draft_with_context` | Generate a full AI draft reply enriched with CRM, Finance, Projects, and Supp... |
| `POST` | `/summarize-thread-enhanced` | `summarize_thread_enhanced` | Summarize a thread with structured output: summary, decisions, action items, ... |
| `POST` | `/tone-check` | `tone_check` | Analyze draft text for tone and provide suggestions. |
| `POST` | `/smart-compose` | `smart_compose` | Generate ghost text autocomplete while typing. |
| `GET` | `/financial-ribbon/{sender_email:path}` | `financial_ribbon` | The Financial Context Ribbon — shows real-time financial context for a sender. |
| `POST` | `/meeting-prep` | `meeting_prep` | Pre-meeting briefing from Era data: recent emails, CRM, projects, support per... |
| `POST` | `/contacts/sync` | `sync_contacts` | Scan email history, create/update MailContactProfile records, enrich from CRM. |
| `GET` | `/contacts/relationship/{email:path}` | `contact_relationship` | Relationship graph: email frequency trend, sentiment trend, thread count. |
| `POST` | `/contacts/detect-duplicates` | `detect_duplicates` | Find potential duplicate contacts between mail profiles and CRM. |
| `POST` | `/templates/{template_id}/render-erp` | `render_template_erp` | Render a template by pulling live ERP data for {{crm.contact.name}}, {{financ... |
| `POST` | `/schedule-send` | `schedule_send` | Set scheduled_send_at on a draft message. Celery beat picks it up and sends it. |
| `DELETE` | `/schedule-send/{message_id}` | `cancel_scheduled_send` | Cancel a scheduled send by clearing scheduled_send_at. |
| `POST` | `/rules/{rule_id}/ai-condition` | `add_ai_rule_condition` | Add a natural-language AI condition to a mail rule. The rule engine evaluates... |
| `GET` | `/message/{message_id}/annotations` | `list_annotations` | List internal team annotations/comments on a message. |
| `POST` | `/message/{message_id}/annotations` | `create_annotation` | Add an internal annotation/comment to a message (invisible to sender). |
| `DELETE` | `/annotations/{annotation_id}` | `delete_annotation` | Delete an annotation (only the author can delete). |

### `POST /triage`

**Function:** `triage_inbox` (line 148)

Batch-classify all unread inbox messages using AI + CRM/Support context.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /triage/{message_id}`

**Function:** `classify_single_message` (line 161)

Classify a single message using AI + CRM/Support context.

**Parameters:** `message_id`

**Auth:** `current_user`


### `GET /triage/summary`

**Function:** `triage_summary` (line 182)

Return triage summary counts by ai_category for user's unread inbox.

**Auth:** `current_user`


### `POST /extract-actions/{message_id}`

**Function:** `extract_actions` (line 226)

Extract action items, deadlines, and meeting proposals from a message or thread.

**Parameters:** `message_id`

**Auth:** `current_user`


### `GET /focused`

**Function:** `list_focused` (line 271)

Messages with priority_score >= 0.6, folder=INBOX, not deleted.

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `GET /other`

**Function:** `list_other` (line 309)

Messages with priority_score < 0.6 or NULL, folder=INBOX, not deleted.

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `POST /sender-score`

**Function:** `compute_sender_score` (line 347)

Compute or refresh the focused inbox sender score for a given email.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /smart-folders`

**Function:** `list_smart_folders` (line 464)

**Auth:** `current_user`


### `POST /smart-folders`

**Function:** `create_smart_folder` (line 493)

**Parameters:** `payload`

**Auth:** `current_user`


### `DELETE /smart-folders/{folder_id}`

**Function:** `delete_smart_folder` (line 514)

**Parameters:** `folder_id`

**Auth:** `current_user`


### `GET /search-folders`

**Function:** `list_search_folders` (line 531)

**Auth:** `current_user`


### `POST /search-folders`

**Function:** `create_search_folder` (line 554)

**Parameters:** `payload`

**Auth:** `current_user`


### `DELETE /search-folders/{folder_id}`

**Function:** `delete_search_folder` (line 574)

**Parameters:** `folder_id`

**Auth:** `current_user`


### `GET /search`

**Function:** `advanced_search` (line 596)

Advanced search with ILIKE on subject and body_text (tsvector upgrade is migration-level).

**Parameters:** `q`, `from_addr`, `has_attachment`, `is_unread`, `label`, `before`, `after`, `page`, `limit`

**Auth:** `current_user`


### `GET /categories`

**Function:** `list_categories` (line 684)

**Auth:** `current_user`


### `POST /categories`

**Function:** `create_category` (line 709)

**Parameters:** `payload`

**Auth:** `current_user`


### `DELETE /categories/{cat_id}`

**Function:** `delete_category` (line 729)

**Parameters:** `cat_id`

**Auth:** `current_user`


### `GET /quick-steps`

**Function:** `list_quick_steps` (line 746)

**Auth:** `current_user`


### `POST /quick-steps`

**Function:** `create_quick_step` (line 774)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /quick-steps/{step_id}`

**Function:** `update_quick_step` (line 795)

**Parameters:** `step_id`, `payload`

**Auth:** `current_user`


### `DELETE /quick-steps/{step_id}`

**Function:** `delete_quick_step` (line 827)

**Parameters:** `step_id`

**Auth:** `current_user`


### `POST /quick-steps/{step_id}/execute/{message_id}`

**Function:** `execute_quick_step` (line 847)

Load quick step actions and apply them to a message via the rule engine action applier.

**Parameters:** `step_id`, `message_id`

**Auth:** `current_user`


### `PUT /message/{message_id}/pin`

**Function:** `toggle_pin` (line 922)

**Parameters:** `message_id`, `pinned`

**Auth:** `current_user`


### `PUT /message/{message_id}/flag`

**Function:** `set_flag` (line 935)

**Parameters:** `message_id`, `payload`

**Auth:** `current_user`


### `PUT /message/{message_id}/categorize`

**Function:** `categorize_message` (line 958)

**Parameters:** `message_id`, `payload`

**Auth:** `current_user`


### `GET /templates`

**Function:** `list_templates` (line 976)

**Auth:** `current_user`


### `POST /templates`

**Function:** `create_template` (line 1008)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /templates/{template_id}`

**Function:** `update_template` (line 1031)

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


### `DELETE /templates/{template_id}`

**Function:** `delete_template` (line 1067)

**Parameters:** `template_id`

**Auth:** `current_user`


### `POST /templates/{template_id}/render`

**Function:** `render_template` (line 1084)

Render a template by replacing {{key}} placeholders with provided variable values.

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


### `POST /rules/{rule_id}/test/{message_id}`

**Function:** `test_rule_endpoint` (line 1124)

Test a rule against a message without executing actions.

**Parameters:** `rule_id`, `message_id`

**Auth:** `current_user`


### `POST /rules/{rule_id}/run-now`

**Function:** `run_rule_now` (line 1142)

Run a rule against all messages in a given folder.

**Parameters:** `rule_id`, `folder`, `limit`

**Auth:** `current_user`


### `POST /extract-calendar/{message_id}`

**Function:** `extract_calendar` (line 1190)

Use AI to extract dates, times, participants, and location from an email.

**Parameters:** `message_id`

**Auth:** `current_user`


### `POST /create-ticket/{message_id}`

**Function:** `create_ticket_from_email` (line 1238)

Create a support ticket from an email and publish event.

**Parameters:** `message_id`

**Auth:** `current_user`


### `POST /create-invoice/{message_id}`

**Function:** `create_invoice_from_email` (line 1286)

Use AI to extract invoice data from an email for one-click invoice creation.

**Parameters:** `message_id`

**Auth:** `current_user`


### `POST /create-crm-lead/{message_id}`

**Function:** `create_crm_lead` (line 1330)

Create a CRM lead from the email sender and publish event.

**Parameters:** `message_id`

**Auth:** `current_user`


### `GET /analytics/overview`

**Function:** `analytics_overview` (line 1396)

Personal mail analytics: sent/received counts, avg response time, unread count.

**Parameters:** `days`

**Auth:** `current_user`


### `GET /analytics/top-contacts`

**Function:** `analytics_top_contacts` (line 1469)

Top 10 contacts by email volume.

**Parameters:** `days`

**Auth:** `current_user`


### `GET /analytics/hourly-heatmap`

**Function:** `analytics_hourly_heatmap` (line 1507)

Emails received by hour of day (0-23).

**Parameters:** `days`

**Auth:** `current_user`


### `POST /summarize-thread`

**Function:** `summarize_thread` (line 1546)

Load all messages by ID, send to AI, return a thread summary.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /ai-draft`

**Function:** `ai_draft_reply` (line 1613)

Generate a full AI draft reply with Era context.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /shared-mailboxes`

**Function:** `list_shared_mailboxes` (line 1659)

**Auth:** `current_user`


### `POST /shared-mailboxes`

**Function:** `create_shared_mailbox` (line 1686)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /contacts/profiles`

**Function:** `list_contact_profiles` (line 1728)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `GET /contacts/profile/{email:path}`

**Function:** `get_contact_profile` (line 1776)

Get detailed contact profile with cross-module data (CRM, deals, invoices, tickets).

**Parameters:** `email`

**Auth:** `current_user`


### `POST /ai-draft-context`

**Function:** `ai_draft_with_context` (line 1917)

Generate a full AI draft reply enriched with CRM, Finance, Projects, and Support data.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /summarize-thread-enhanced`

**Function:** `summarize_thread_enhanced` (line 1936)

Summarize a thread with structured output: summary, decisions, action items, questions.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /tone-check`

**Function:** `tone_check` (line 1956)

Analyze draft text for tone and provide suggestions.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /smart-compose`

**Function:** `smart_compose` (line 1968)

Generate ghost text autocomplete while typing.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /financial-ribbon/{sender_email:path}`

**Function:** `financial_ribbon` (line 1985)

The Financial Context Ribbon — shows real-time financial context for a sender.

**Parameters:** `sender_email`

**Auth:** `current_user`


### `POST /meeting-prep`

**Function:** `meeting_prep` (line 1997)

Pre-meeting briefing from Era data: recent emails, CRM, projects, support per attendee.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /contacts/sync`

**Function:** `sync_contacts` (line 2018)

Scan email history, create/update MailContactProfile records, enrich from CRM.

**Auth:** `current_user`


### `GET /contacts/relationship/{email:path}`

**Function:** `contact_relationship` (line 2029)

Relationship graph: email frequency trend, sentiment trend, thread count.

**Parameters:** `email`

**Auth:** `current_user`


### `POST /contacts/detect-duplicates`

**Function:** `detect_duplicates` (line 2041)

Find potential duplicate contacts between mail profiles and CRM.

**Auth:** `current_user`


### `POST /templates/{template_id}/render-erp`

**Function:** `render_template_erp` (line 2057)

Render a template by pulling live ERP data for {{crm.contact.name}}, {{finance.invoice.amount}}, etc.

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


### `POST /schedule-send`

**Function:** `schedule_send` (line 2159)

Set scheduled_send_at on a draft message. Celery beat picks it up and sends it.

**Parameters:** `payload`

**Auth:** `current_user`


### `DELETE /schedule-send/{message_id}`

**Function:** `cancel_scheduled_send` (line 2190)

Cancel a scheduled send by clearing scheduled_send_at.

**Parameters:** `message_id`

**Auth:** `current_user`


### `POST /rules/{rule_id}/ai-condition`

**Function:** `add_ai_rule_condition` (line 2213)

Add a natural-language AI condition to a mail rule. The rule engine evaluates it via AI.

**Parameters:** `rule_id`, `payload`

**Auth:** `current_user`


### `GET /message/{message_id}/annotations`

**Function:** `list_annotations` (line 2252)

List internal team annotations/comments on a message.

**Parameters:** `message_id`

**Auth:** `current_user`


### `POST /message/{message_id}/annotations`

**Function:** `create_annotation` (line 2288)

Add an internal annotation/comment to a message (invisible to sender).

**Parameters:** `message_id`, `payload`

**Auth:** `current_user`


### `DELETE /annotations/{annotation_id}`

**Function:** `delete_annotation` (line 2316)

Delete an annotation (only the author can delete).

**Parameters:** `annotation_id`

**Auth:** `current_user`


---

## mail_ext.py

Mail extensions — threads, drafts, search, labels, snooze, contacts, cross-module links.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/threads` | `list_threads` | — |
| `POST` | `/messages/draft` | `save_draft` | Save a draft message in PostgreSQL. |
| `GET` | `/search` | `search_messages` | Search messages using PostgreSQL ILIKE. |
| `GET` | `/labels` | `list_labels` | — |
| `POST` | `/labels` | `create_label` | — |
| `PUT` | `/labels/{label_id}` | `update_label` | — |
| `DELETE` | `/labels/{label_id}` | `delete_label` | — |
| `POST` | `/messages/{message_id}/snooze` | `snooze_message` | Snooze a message — mark it as read now, schedule it to reappear later. |
| `POST` | `/messages/{message_id}/save-to-drive` | `save_message_attachments_to_drive` | Download all attachments from a mail message and save them to the user's Driv... |
| `POST` | `/messages/{message_id}/link-crm` | `link_message_to_crm` | Create a CRM activity entry linking this email to a contact or deal. |
| `GET` | `/messages/{message_id}/crm-links` | `get_message_crm_links` | Return all CRM activity entries linked to this email. |
| `POST` | `/messages/{message_id}/convert-to-task` | `convert_message_to_task` | Create a project task from an email message — subject becomes title, body bec... |
| `POST` | `/messages/{message_id}/save-as-note` | `save_message_as_note` | Create a Note from an email — subject becomes title, body becomes content, wi... |
| `GET` | `/contacts` | `list_mail_contacts` | Get frequently used email contacts by querying recent sent messages. |

### `GET /threads`

**Function:** `list_threads` (line 79)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `POST /messages/draft`

**Function:** `save_draft` (line 103)

Save a draft message in PostgreSQL.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /search`

**Function:** `search_messages` (line 141)

Search messages using PostgreSQL ILIKE.

**Parameters:** `q`, `sender`, `has_attachment`, `date_from`, `date_to`, `page`, `limit`

**Auth:** `current_user`


### `GET /labels`

**Function:** `list_labels` (line 203)

**Auth:** `current_user`


### `POST /labels`

**Function:** `create_label` (line 215)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /labels/{label_id}`

**Function:** `update_label` (line 232)

**Parameters:** `label_id`, `payload`

**Auth:** `current_user`


### `DELETE /labels/{label_id}`

**Function:** `delete_label` (line 251)

**Parameters:** `label_id`

**Auth:** `current_user`


### `POST /messages/{message_id}/snooze`

**Function:** `snooze_message` (line 266)

Snooze a message — mark it as read now, schedule it to reappear later.

This marks the message as read and stores a snooze record.
When the snooze time arrives, a Celery task will unmark read to re-surface it.

**Parameters:** `message_id`, `payload`

**Auth:** `current_user`


### `POST /messages/{message_id}/save-to-drive`

**Function:** `save_message_attachments_to_drive` (line 345)

Download all attachments from a mail message and save them to the user's Drive (MinIO).

**Parameters:** `message_id`, `payload`

**Auth:** `current_user`


### `POST /messages/{message_id}/link-crm`

**Function:** `link_message_to_crm` (line 446)

Create a CRM activity entry linking this email to a contact or deal.

**Parameters:** `message_id`, `payload`

**Auth:** `current_user`


### `GET /messages/{message_id}/crm-links`

**Function:** `get_message_crm_links` (line 528)

Return all CRM activity entries linked to this email.

**Parameters:** `message_id`

**Auth:** `current_user`


### `POST /messages/{message_id}/convert-to-task`

**Function:** `convert_message_to_task` (line 570)

Create a project task from an email message — subject becomes title, body becomes description.

**Parameters:** `message_id`, `payload`

**Auth:** `current_user`


### `POST /messages/{message_id}/save-as-note`

**Function:** `save_message_as_note` (line 655)

Create a Note from an email — subject becomes title, body becomes content, with back-link to email.

**Parameters:** `message_id`, `payload`

**Auth:** `current_user`


### `GET /contacts`

**Function:** `list_mail_contacts` (line 725)

Get frequently used email contacts by querying recent sent messages.

**Parameters:** `q`, `limit`

**Auth:** `current_user`


---

## mail_filters.py

Mail Filters API — CRUD for server-side Sieve-compatible mail filters.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/filters` | `list_filters` | — |
| `POST` | `/filters` | `create_filter` | — |
| `GET` | `/filters/{filter_id}` | `get_filter` | — |
| `PUT` | `/filters/{filter_id}` | `update_filter` | — |
| `DELETE` | `/filters/{filter_id}` | `delete_filter` | — |

### `GET /filters`

**Function:** `list_filters` (line 54)

**Auth:** `current_user`


### `POST /filters`

**Function:** `create_filter` (line 71)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /filters/{filter_id}`

**Function:** `get_filter` (line 92)

**Parameters:** `filter_id`

**Auth:** `current_user`


### `PUT /filters/{filter_id}`

**Function:** `update_filter` (line 104)

**Parameters:** `filter_id`, `payload`

**Auth:** `current_user`


### `DELETE /filters/{filter_id}`

**Function:** `delete_filter` (line 123)

**Parameters:** `filter_id`

**Auth:** `current_user`

