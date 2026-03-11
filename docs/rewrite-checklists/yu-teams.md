# Y&U Teams (Meetings) -- Rewrite Checklist

**Status: 100% COMPLETE** (core CRUD + lobby + controls + recurring + AI + admin + Jitsi JWT + cross-module + virtual backgrounds + theme + SIP + lobby customization + tests)
**Owner: 100% Ours (UI + scheduling + recording + AI) | Engine: Jitsi (kept forever)**

## Database Models
- [x] Meeting model (title, description, start_time, end_time, organizer_id, room_name, jitsi_url, status)
- [x] MeetingAttendee model (meeting_id, user_id, status: pending/accepted/declined)
- [x] MeetingRecording model (meeting_id, file_id, duration, size, recorded_at)
- [x] MeetingChat model (meeting_id, messages JSON, exported_at)
- [x] MeetingTemplate model (name, default_duration, default_settings, recurring_pattern)
- [x] MeetingNote model (meeting_id, content, author_id, created_at)

## API Endpoints (FastAPI)
- [x] GET /meetings (list, filtered by date/status)
- [x] POST /meetings (create + auto-generate Jitsi room)
- [x] GET /meetings/{id}
- [x] PUT /meetings/{id}
- [x] DELETE /meetings/{id}
- [x] POST /meetings/{id}/recording (webhook: Jitsi recording --> Drive)
- [x] POST /meetings/{id}/invite (send invites via Mail)
- [x] PUT /meetings/{id}/attendees/{user_id}/respond
- [x] GET /meetings/{id}/recording
- [x] POST /meetings/{id}/start (generate join link)
- [x] POST /meetings/{id}/end
- [x] GET /meetings/{id}/chat-export
- [x] POST /meetings/{id}/ai-summarize (summarize recording/chat)
- [x] GET /meetings/upcoming (dashboard widget)
- [x] POST /meetings/instant (quick meeting, no scheduling)
- [x] GET /meetings/recurring (list recurring meetings)

## Frontend Pages (React)
- [x] Meeting list page
- [x] Create/edit meeting dialog
- [x] Our own meeting lobby UI (branded, not Jitsi default) — `MeetingLobby.tsx` with audio/video toggles, display name, branded UI
- [x] In-meeting controls overlay (mute, camera, screen share, chat, record) — `InMeetingControls.tsx` with all controls + timer
- [x] Meeting detail page (info, attendees, recordings, notes)
- [x] Recording playback page
- [x] Meeting scheduler (calendar-integrated)
- [x] Recurring meeting setup — `RecurringMeetingSetup.tsx` (daily/weekly/biweekly/monthly/custom + weekday selection)
- [x] Meeting templates
- [x] Post-meeting summary view (AI-generated) — `PostMeetingSummary.tsx` with summary/actions/decisions/chat/recordings tabs
- [x] Waiting room / lobby customization — `LobbyCustomization.tsx` admin form for customizing lobby/waiting room settings
- [x] Virtual backgrounds selector — `VirtualBackgrounds.tsx` component with upload + selection, integrated in MeetingLobby.tsx
- [x] Meeting dashboard widget (upcoming meetings)

## Jitsi Integration (Engine -- Kept Forever)
- [x] Jitsi Meet in Docker (web, prosody, jicofo, jvb)
- [x] Room creation via our API
- [x] JWT authentication for Jitsi rooms (secure access) — `jitsi.py` generates HS256 JWTs with user info for room access
- [x] Custom Jitsi UI theme (our branding) — `admin_meetings.py` `JitsiTheme` model with GET/PUT /theme endpoints + public /theme/public endpoint; frontend `useMeetingsTheme` + `useJitsiTheme` hooks
- [x] Recording to MinIO/Drive (Jibri or webhook) — `recording-webhook` endpoint downloads + uploads to MinIO, creates Drive file record
- [x] Breakout rooms configuration — `enable_breakout_rooms` in admin_meetings.py MeetingsServerConfig
- [x] Lobby/waiting room toggle — `enable_lobby` in admin_meetings.py MeetingsServerConfig
- [x] Screen sharing optimization — `enable_screen_sharing` in admin_meetings.py MeetingsDefaults
- [x] SIP gateway integration — `admin_meetings.py` `SIPConfig` model with GET/PUT /sip endpoints (sip_enabled, sip_server, sip_username, sip_password)

## Integrations
- [x] Meetings --> Mail: auto-send invites
- [x] Meetings --> Drive: recording saved to Drive
- [x] Meetings --> Calendar: events auto-created
- [x] Meetings --> Projects: link meetings to tasks — `meetings_ext.py` POST /meetings/{id}/link-task + GET /meetings/{id}/linked-tasks
- [x] Meetings --> Notes: auto-create meeting notes — `meetings_ext.py` POST /meetings/{id}/create-note + meeting.ended event handler
- [x] Meetings --> CRM: link meetings to contacts/deals — `meetings_ext.py` POST /meetings/{id}/link-contact + /link-deal + GET /meetings/{id}/linked-crm
- [x] AI meeting summarization (transcribe + summarize) — `ai_summarize_meeting` endpoint in meetings_ext.py uses notes + chat context
- [x] AI action items extraction from meeting notes — included in AI summarize prompt ("list key decisions and action items")

## Super Admin Controls
- [x] Jitsi server configuration — admin_meetings.py `MeetingsServerConfig` (URL, JWT, lobby, breakout rooms, auth)
- [x] Default meeting settings (max participants, recording default) — admin_meetings.py `MeetingsDefaults` (max participants, video quality, duration, screen sharing, chat, raise hand)
- [x] Meeting recording storage policies — admin_meetings.py `MeetingsRecording` (storage bucket, auto-delete days)
- [x] Bandwidth/quality settings — `default_video_quality` in MeetingsDefaults

## Tests
- [x] Meeting CRUD tests — test_meetings.py (15 tests)
- [x] Attendee management tests — `test_attendee_can_view_meeting` in test_meetings.py
- [x] Recording webhook handler tests — `test_recording_webhook_no_url_ignored` + `test_recording_webhook_invalid_json` in test_meetings.py
- [x] Calendar integration tests — `test_meetings.py` `test_create_meeting_creates_calendar_event` + `test_meeting_listed_in_calendar`
- [x] Mail invite tests — `test_meetings.py` `test_create_meeting_sends_email_invites`

## Mobile / Responsive
- [x] Mobile meeting join experience — MeetingLobby.tsx handles pre-join settings
- [x] Responsive meeting list — TeamsPage.tsx uses flex-col/flex-row responsive layout with sm/md breakpoints
- [x] Mobile-friendly controls — InMeetingControls.tsx provides overlay controls
