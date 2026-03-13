---
title: ONLYOFFICE Document Editor
slug: integr-onlyoffice
category: integrations
article_type: guide
module: drive
tags: [onlyoffice, documents, spreadsheets, presentations, editing, collaboration]
sort_order: 1
is_pinned: false
excerpt: Edit documents, spreadsheets, and presentations directly in Urban ERP using the built-in ONLYOFFICE engine.
---

# ONLYOFFICE Document Editor

## What is ONLYOFFICE?

ONLYOFFICE is a full Office-compatible document editing engine embedded directly in Urban ERP. It provides a familiar word processor, spreadsheet, and presentation editor — no Microsoft Office licence, no Google Docs account, and no third-party cloud service required. All document data stays on your server.

ONLYOFFICE is one of the two engines kept permanently in Urban ERP (the other is Jitsi for video). It is not a removable integration — it is the document layer.

---

## Supported Formats

| Type | Formats |
|------|---------|
| Word processing | DOCX, ODT, TXT, RTF |
| Spreadsheets | XLSX, ODS, CSV |
| Presentations | PPTX, ODP |
| View only | PDF |

Files not in the above list open as a download rather than in the editor.

---

## Opening a Document

1. Navigate to **Drive**.
2. Click any supported file.
3. The ONLYOFFICE editor opens in a new browser tab in fullscreen mode.
4. The file is locked for editing while you have it open. Other users see the lock icon until collaborative editing begins (see below).

---

## Creating New Documents

1. Go to **Drive** and navigate to the folder where you want the file.
2. Click **New** in the top-right toolbar.
3. Choose **Document**, **Spreadsheet**, or **Presentation**.
4. A blank file is created in the current folder and opens immediately in the editor.
5. The file is named "Untitled Document" (or similar) — rename it by clicking the filename in the editor header.

---

## Collaborative Editing

Multiple users can edit the same document simultaneously. Urban ERP handles presence and conflict resolution through the ONLYOFFICE co-authoring engine.

- Each user's cursor appears in their profile colour.
- Their display name is shown as a label above the cursor.
- Edits are broadcast in near real-time (in Fast mode) or batched (in Strict mode).

---

## Real-Time Presence

The document editor header displays avatar icons for everyone currently viewing or editing the document. Hovering over an avatar shows the user's name and their last-active timestamp.

---

## Co-authoring Mode

Two co-authoring modes are available. Switch between them via **File → Advanced Settings → Co-authoring mode**:

| Mode | Behaviour |
|------|-----------|
| **Fast** | Changes from all users are visible instantly as they type. Best for collaborative writing. |
| **Strict** | Changes are only visible to others when a user explicitly saves (Ctrl+S). Best for complex spreadsheets where intermediate states may be invalid. |

> **Tip:** Use co-authoring in Strict mode for complex spreadsheets — in Fast mode, simultaneous cell edits can conflict.

---

## Comments

- Select text or a cell, then right-click → **Add Comment**.
- Type your comment and click **Add**.
- @mention a colleague (e.g., `@Jane Doe`) to send them an in-app notification.
- Comments appear in the right panel and are visible to all users with access to the file.
- Resolve a comment by clicking the tick icon — resolved comments are hidden but remain in history.

---

## Version History

Every time a document is saved, ONLYOFFICE creates a version entry.

1. In the editor, open **File → Version History**.
2. The History panel lists all versions with timestamp and the user who saved.
3. Click any version to preview it.
4. Click **Restore** to roll the document back to that version.

Previous versions are stored indefinitely. There is no automatic pruning.

---

## Document AI Copilot

The AI copilot is available inside the ONLYOFFICE editor:

1. Click the **AI** icon in the editor toolbar (sparkle icon, top-right area).
2. The copilot sidebar opens on the right.
3. Supported actions:
   - **Summarise** — generate a bullet-point summary of the document content.
   - **Rewrite** — rephrase selected text for clarity or tone.
   - **Translate** — translate selected text into a target language.
   - **Expand** — add more detail to a selected paragraph.
   - **Ask a question** — type a free-form question about the document content.

The copilot uses Urban ERP's AI layer (configured provider: OpenAI, Anthropic, or Grok). Document content is sent to the configured AI provider for processing.
