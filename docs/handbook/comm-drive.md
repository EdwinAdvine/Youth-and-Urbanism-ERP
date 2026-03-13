---
title: "Drive: File Storage & Sharing"
slug: drive-file-storage-sharing
category: communication
article_type: guide
module: drive
tags: [drive, files, storage, sharing, minio, onlyoffice, versioning]
sort_order: 5
is_pinned: false
excerpt: Upload, organise, and share files with your team using the built-in Drive (MinIO-backed).
---

# Drive: File Storage & Sharing

Urban Vibes Dynamics Drive is your team's central file store. All files are stored on your own MinIO server — no Google Drive, no Dropbox, no files leaving your infrastructure. Storage is fast, private, and under your full control.

## Uploading Files

1. Open the **Drive** module from the left sidebar.
2. Navigate to the folder where you want to upload (or stay in the root).
3. Click **Upload** and select files from your computer, or drag and drop files directly onto the Drive window.

You can upload multiple files at once. A progress indicator shows each file's upload status. Once complete, files appear in the current folder immediately.

## Folder Structure

Create folders to organise your files logically:

1. Click **New Folder**, enter a name, and press Enter.
2. Drag and drop files or other folders into it.

Recommended folder conventions for teams: one top-level folder per department (e.g., `Finance`, `HR`, `Marketing`, `Projects`), with sub-folders per year or per project. Urban Vibes Dynamics automatically creates a dedicated **project folder** in Drive whenever a new Project is created (see Project integration below).

## Sharing Files and Folders

By default, files are private to the uploader. To share:

1. Right-click any file or folder and select **Share**.
2. Choose one of two options:
   - **Share with specific users**: search for team members and set their access as **View** or **Edit**.
   - **Generate share link**: creates a time-limited presigned URL. Set the expiry (1 hour, 24 hours, 7 days, or 30 days). Anyone with the link can download the file — no login required. Useful for sending files to clients or vendors.
3. Click **Done** to apply.

## ONLYOFFICE Integration: Edit Documents in the Browser

Drive is tightly integrated with ONLYOFFICE Document Server. Any `.docx`, `.xlsx`, or `.pptx` file (Microsoft Word, Excel, or PowerPoint format) can be opened and edited directly inside Urban Vibes Dynamics — no need to download and reupload:

1. Click the file to open the preview panel.
2. Click **Edit in ONLYOFFICE**.
3. The document opens in a full browser-based editor with full formatting support.
4. Changes are saved back to Drive automatically when you close the editor.

Multiple team members can edit the same document simultaneously in ONLYOFFICE — perfect for collaborative proposals, budgets, or presentations.

## Storage Quota

Your organisation's total Drive storage is configured by the Super Admin in **Admin → Settings → Storage**. Individual users or departments can be assigned storage limits. The Drive sidebar shows your current usage. When quota is near, the system sends an alert to the Super Admin.

## File Versioning

Every time a file is modified (through upload or ONLYOFFICE editing), Drive saves the previous version automatically. To view or restore an older version:

1. Right-click the file and select **Version History**.
2. A list of versions appears with timestamps and the name of who made each change.
3. Click **Restore** on any version to roll back to it.

## Project Folder Auto-Creation

When a new Project is created in the Projects module, Urban Vibes Dynamics automatically creates a corresponding folder in Drive named after the project. All project-related files (contracts, specs, deliverables) can be stored there. The folder link appears in the Project detail page under the **Drive** tab.
