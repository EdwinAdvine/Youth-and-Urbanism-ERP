---
title: Live Chat Widget
slug: live-chat-widget
category: support
article_type: guide
module: support
tags: [support, live-chat, widget, embed, bot, customer]
sort_order: 3
is_pinned: false
excerpt: Embed a live chat widget on your website and handle chats inside Urban Vibes Dynamics.
---

# Live Chat Widget

The Urban Vibes Dynamics live chat widget lets website visitors start a conversation with your support team in real time. Agents manage all incoming chats from within the Support module — no third-party tool required.

## Getting the Embed Code

1. Go to **Support → Live Chat → Settings**.
2. You will see a one-line JavaScript embed code, for example:
   ```html
   <script src="https://erp.yourcompany.co.ke/chat-widget.js" data-token="abc123"></script>
   ```
3. Copy this code.

## Adding the Widget to Your Website

Paste the embed code just before the closing `</body>` tag on every page of your website where you want the chat bubble to appear. The widget is typically added site-wide (all pages), but you can restrict it to specific pages by only placing the code there.

Once added, a chat bubble appears in the bottom-right corner of your website. No server restarts or deployments are needed — the widget loads remotely from your Urban Vibes Dynamics server.

You can customise the widget's colour, greeting message, and operating hours in **Support → Live Chat → Settings**.

## How Visitors Start a Chat

A visitor clicks the chat bubble on your website. They see a greeting (configured by you, e.g., "Hello! How can we help you today?") and are prompted to type their message. The bot handles the initial greeting, asks for their name and email address, and attempts to answer the query using the knowledge base.

## Bot Handling

The built-in chat bot:

- Welcomes the visitor and collects their name and email.
- Searches the knowledge base for articles relevant to the visitor's question and presents suggested links.
- Answers straightforward questions (e.g., business hours, pricing inquiries) based on KB content.
- If the bot cannot resolve the issue, or if the visitor asks to speak to a human, the chat is escalated to a live agent.

## Agent View: Accepting and Replying

1. When a new chat comes in, agents logged into Urban Vibes Dynamics see a notification in **Support → Live Chat → Active Chats**.
2. Click **Accept** to take ownership of the chat.
3. The chat window opens. Type and send replies in real time. The visitor sees your messages instantly on your website.
4. You can see the visitor's name, email, the page they were on when they started the chat, and how long they have been waiting.

## Transferring to Another Agent

If you need to hand the chat to a colleague:

1. Click **Transfer** in the chat toolbar.
2. Select the agent or team to transfer to.
3. Optionally add a transfer note (the receiving agent sees this before taking over).

The visitor experiences a seamless handover — they see a message like "You have been connected to [Agent Name]."

## Chat Transcript Saved as Ticket

When a live chat ends (either the visitor closes it or the agent marks it resolved), Urban Vibes Dynamics automatically creates a **Support Ticket** containing the full chat transcript as the ticket body. This means:

- Every chat conversation is permanently stored and searchable.
- If the visitor follows up by email, the agent can find the previous chat context in the linked ticket.
- Managers can review chat quality from the Tickets view.

The auto-created ticket is linked to the visitor's CRM contact record (matched by email address), ensuring the full customer interaction history is always in one place.
