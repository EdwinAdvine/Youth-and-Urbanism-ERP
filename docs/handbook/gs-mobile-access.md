---
title: Using Urban Vibes Dynamics on Mobile
slug: using-urban-vibes-dynamics-on-mobile
category: getting-started
article_type: guide
tags: [mobile, pwa, offline, tablet, ios, android]
sort_order: 8
is_pinned: false
excerpt: Access Urban Vibes Dynamics from your phone or tablet — mobile layout, offline mode, and PWA installation.
---

# Using Urban Vibes Dynamics on Mobile

Urban Vibes Dynamics is a fully responsive progressive web app (PWA). You can use it on any smartphone or tablet without installing anything from an app store. This guide covers the mobile layout, how to install it as a home-screen app, and what you can do offline.

---

## Mobile Layout Overview

On screens narrower than 768px, Urban Vibes Dynamics switches to its mobile layout:

- **Bottom tab bar** — the five most-used modules for your role are pinned here for one-tap access. Tapping the **More** tab expands the full module list.
- **Swipe navigation** — within list/detail views, swipe left on a record to reveal quick actions (edit, delete, assign). Swipe right to go back to the list.
- **Collapsible sections** — long forms collapse into accordion sections so you are not scrolling through dozens of fields at once. Tap a section header to expand it.
- **Floating action button (FAB)** — the `+` button in the bottom-right corner opens a quick-create menu for the most common record type in the current module (e.g. New Invoice in Finance, New Contact in CRM).

On tablets (768px–1024px), the layout is a hybrid: the left sidebar appears as a narrow icon rail with labels revealed on tap, and list/detail views use a split-pane layout.

---

## Installing as a PWA

Installing Urban Vibes Dynamics as a PWA gives you a full-screen experience with no browser chrome, faster load times, and a home-screen icon — just like a native app.

### On iPhone / iPad (Safari)

1. Open Urban Vibes Dynamics in **Safari** (PWA installation only works in Safari on iOS).
2. Tap the **Share** button (the box with an upward arrow) in the bottom toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Edit the name if you wish, then tap **Add**.

The Urban Vibes Dynamics icon will appear on your home screen. Launch it for a full-screen experience.

### On Android (Chrome)

1. Open Urban Vibes Dynamics in **Chrome**.
2. Tap the **three-dot menu** (top right).
3. Tap **Add to Home screen** (or **Install app** if Chrome shows a banner at the bottom).
4. Confirm by tapping **Add**.

### On Desktop (Chrome / Edge)

Click the **install icon** in the address bar (a monitor with a downward arrow). This creates a standalone desktop shortcut that opens Urban Vibes Dynamics in its own window, separate from your browser.

---

## Offline Capabilities

Urban Vibes Dynamics uses a service worker to cache key assets and recent data. The following works without an internet connection:

| Feature | Offline support |
|---|---|
| **Notes** | Full read and write — syncs on reconnect |
| **Calendar events** | Read-only — view events you have already loaded |
| **Contacts** (CRM) | Read-only — recently visited records |
| **Handbook** | Full read — all articles are pre-cached |
| **Tasks** (Projects) | Read-only — no new task creation |
| **Finance, HR, etc.** | Read-only for cached records; writes queue and retry |

When you are offline, a yellow banner appears at the top of the screen. Any actions that require connectivity are either blocked with a clear message or queued silently — you will see a "pending sync" indicator in the status bar when writes are queued.

---

## Limitations on Mobile

A small number of features require a desktop-class browser:

- **Document editing (ONLYOFFICE)** — opening `.docx`, `.xlsx`, or `.pptx` files for editing launches the ONLYOFFICE engine, which requires a desktop browser. On mobile you can preview documents but not edit them in-place.
- **Video meetings (Jitsi)** — for the best experience in video meetings, use a desktop browser or the Jitsi Meet native app and join via the meeting link. The in-app embedded meeting view on mobile is functional but limited to audio + screen share.
- **Analytics charts** — complex data visualisations are rendered in a simplified, touch-friendly format on mobile; some advanced chart types (scatter plots, heat maps) are desktop-only.
- **Bulk actions on tables** — multi-select bulk operations are hidden on mobile to avoid accidental taps; use desktop to perform bulk updates.

---

## Tips for Mobile Users

- **Pull to refresh** on any list view to fetch the latest data.
- **Long-press** a record card to enter multi-select mode without needing the checkbox column.
- **Landscape mode** on a tablet gives you access to the full split-pane layout and makes form-filling much easier.
- If text input feels cramped, use the **AI sidebar** (tap the sparkle icon in the top bar) to dictate or type natural language commands — for example, "log a call with John Smith at 3pm today" instead of filling in the activity form manually.
