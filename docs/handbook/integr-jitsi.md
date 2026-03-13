---
title: Jitsi Video Meetings
slug: integr-jitsi
category: integrations
article_type: guide
module: calendar
tags: [jitsi, video, meetings, conferencing, webrtc]
sort_order: 2
is_pinned: false
excerpt: Host video meetings directly in Urban ERP using the built-in Jitsi Meet engine — no external accounts needed.
---

# Jitsi Video Meetings

Urban ERP includes a self-hosted Jitsi Meet engine (`urban-erp-jitsi-web`). All meeting data stays on your server — no Zoom or Google Meet accounts needed.

## Starting a Meeting

- **From Meetings module:** Meetings → New Meeting → click **Start Video Call**
- **From a Calendar event:** open the event → click **Join Video Call**
- **From a CRM deal:** deal timeline → New Activity → Meeting → **Start Video Call**

Each meeting gets a unique URL (e.g. `https://yourdomain.com/meet/room-abc123`) that you can share with participants.

## Joining

Participants join in any modern browser — no plugin or app required. Mobile-friendly out of the box.

## Meeting Controls

| Control | What It Does |
|---------|-------------|
| Mute/Unmute | Toggle your microphone |
| Camera | Toggle your webcam |
| Screen Share | Share your entire screen or a specific window |
| Hand Raise | Signal you want to speak |
| Chat | Text chat sidebar visible to all participants |
| Participants | See who's in the meeting |

## Recordings

If enabled by a Super Admin, recordings start automatically when the meeting begins and are saved to **Drive** when the session ends. The link is posted in the meeting's timeline.

## Persistent Rooms

Create a named room for recurring meetings:

1. Meetings → Rooms → New Room
2. Set a name (e.g. "Finance Weekly") and optional password
3. Share the permanent URL — no new link needed each week

## Lobby (Waiting Room)

Enable the lobby so the host must admit each participant:

- **Room Settings → Enable Lobby**
- The host sees a list of waiting participants and admits them individually

## Security

- **Password protection** — set a room password; participants must enter it before joining
- **End-to-end encryption** — available for 1-on-1 calls (E2EE badge shown in UI)
- All traffic stays within your server network

## CRM & Projects Integration

Meetings created from a CRM deal or Project record are automatically logged in that record's timeline with a link to the recording (if enabled).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Video doesn't connect | Check browser microphone/camera permissions |
| Remote participants can't connect | Ensure ports 10000/UDP and 4443/TCP are open on your server firewall |
| Poor quality | Check server CPU — Jitsi is resource-intensive with many participants |

> **Tip:** Use persistent named rooms for recurring team meetings — no new link needed each week. Just bookmark the room URL.
