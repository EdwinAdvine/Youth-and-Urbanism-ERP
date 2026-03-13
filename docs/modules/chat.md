# Chat & Teams Module

> Real-time messaging with channels, DMs, file sharing, and Jitsi video calls.

## Overview

Y&U Teams provides real-time instant messaging with channels, direct messages, file sharing, reactions, threads, and integrated Jitsi video conferencing. Replaces Slack/Microsoft Teams.

---

## Features

- **Channels** — public and private topic-based channels
- **Direct Messages** — 1-to-1 and group DMs
- **Threads** — reply threads to keep conversations organized
- **File sharing** — share files from Drive or upload directly
- **Reactions** — emoji reactions on messages
- **Notifications** — desktop, email, and in-app notification preferences
- **Mentions** — @user and @channel mentions
- **Message search** — full-text search across all channels
- **Video calls** — start Jitsi meeting from any channel or DM
- **Status** — user online/away/busy/offline status
- **Webhooks** — send messages to channels from external systems

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/chat.py` | Core: channels, messages, DMs |
| `backend/app/api/v1/chat_extended.py` | Extended: threads, reactions, search |
| `backend/app/api/v1/chat_ws.py` | WebSocket for real-time message delivery |
| `backend/app/models/chat.py` | Chat SQLAlchemy models |

---

## Real-Time Architecture

Chat uses **WebSockets** for real-time delivery:
- Connection: `ws://backend/api/v1/chat/ws/{channel_id}?token={jwt}`
- Messages are also stored in PostgreSQL for history and search
- Redis pub/sub used to broadcast messages across multiple backend instances
