---
title: Teams & Group Chats
slug: comm-teams
category: communication
article_type: guide
module: chat
tags: [teams, groups, channels, chat, collaboration]
sort_order: 9
is_pinned: false
excerpt: Create team channels and group chats to organise communication by department or project.
---

# Teams & Group Chats

## Channel Types

Urban ERP Chat supports three channel types:

| Type | Access | Use Case |
|------|--------|----------|
| Public | Visible to all users; anyone can join | Company-wide announcements, general discussion |
| Private | Invite only; hidden from non-members | Department teams, sensitive projects |
| Direct Message | 1-on-1 or small group (no channel name required) | Quick personal conversations |

## Creating a Channel

Click **Chat → + New Channel** and fill in:

- **Name** — use lowercase with hyphens (e.g., `finance-team`, `project-alpha`)
- **Description** — what this channel is for; shown in the channel directory
- **Type** — Public or Private
- **Initial members** — add the first set of members at creation time

Public channels are discoverable in the channel directory. Private channels are only visible to members.

## Naming Convention

Adopt a consistent naming convention across your organisation. Recommended patterns:

- `#general` — company-wide conversation
- `#[department]-team` — e.g., `#finance-team`, `#hr-team`
- `#project-[name]` — e.g., `#project-alpha`, `#project-website-relaunch`
- `#[topic]` — e.g., `#announcements`, `#random`, `#tech-support`

> **Tip:** Create a project-specific channel when a project starts and archive it when the project closes — this keeps all project chat in one searchable place.

## Pinning Channels

Pin your most-used channels so they always appear at the top of your sidebar. Right-click a channel name and select **Pin to Sidebar**. Pinned channels are personal — each user manages their own pins.

## Channel Topics

Set a topic that appears beneath the channel name in the header — useful for showing current focus areas or deadlines. Example: `Q2 Budget Review — Closes March 31`. Update the topic from **Channel Settings → Edit Topic**.

## @Mentions

Use mentions to notify people directly:

- **@username** — notifies a specific person; they receive an in-app notification and (optionally) an email
- **@channel** — notifies all members of the channel, whether online or offline
- **@here** — notifies only currently online members (use for less urgent messages to reduce noise)

## Threads

Reply to any message in a thread to keep discussions organised. Threads keep the main channel feed clean while preserving the full conversation context. Click **Reply in Thread** on any message. Threads are visible in the sidebar under **Threads** for easy access to all your active conversations.

## Pinned Messages

Pin important messages — decisions, links, reference documents — so they are easy to find later. Hover over a message, click the **...** menu, and select **Pin Message**. All pinned messages in a channel are accessible from **Channel Info → Pinned Messages**.

## File Sharing

Drag and drop files directly into any chat. Behaviour by file type:

- **Images** — preview inline in the message feed; click to view full size
- **Videos** — inline player
- **Documents and other files** — shown as a download card with file name and size

All shared files are stored in the Drive module (MinIO). They are searchable and accessible from **Drive** as well as the chat thread where they were shared.

## Search

Use the global search bar (Cmd+K / Ctrl+K) to search across all channels you are a member of. Filter results by:

- Channel or person
- Date range
- File type
- Messages containing a specific @mention

Search results link directly to the message in context.
