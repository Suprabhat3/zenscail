# Gmail & Calendar Integration with Corsair

## Overview

When you use Gmail or Google Calendar, it is likely that a regular workflow takes a few more clicks than it should. Or maybe sending a calendar invite is too many steps on the UI.

Many startups have tried to make managing email and calendar seamless, but this is hard to do because everyone uses it slightly differently.

Corsair provides the building blocks to hundreds of integrations. You can use those building blocks to wire your app into almost any other app. You can also use Corsair's MCP to let any agent get full access to integrations so it can do things on your behalf.

This means you can make new UIs that are set up exactly how you need, and power them using Corsair.

## Requirements

Use Corsair to create Gmail and Google Calendar integrations. Use the Gmail API to make it more intuitive to search, draft, send and receive emails. Use the Google Calendar API to make it easier to manage your schedule and send calendar invites and updates.

Once this is done, your email and calendar management will not be limited to how Google, Superhuman, or anyone else sees the way your workflows should be. Instead, you can decide exactly what needs to be more prominent.

## Tech Stack

- Next.js
- Postgres
- Corsair
- Ngrok (optional, can be used for webhooks)

## Bonus Tasks

The most high-value bonus task is to add agent chat using the Corsair MCP. This will let users chat to send emails and calendar invites.

### Example Use Case

> "Send a calendar invite to friend@corsair.dev at 9 AM next Thursday. Send him an email too saying I look forward to our meeting."

### Additional Features

- Use Corsair's built-in webhooks so you can get all new emails and calendar invites in realtime without having to poll the Google APIs
- Add automatic email filtering by sending the email subject and body through a cheap LLM to determine priority level
- Wire in keystrokes so users can do common actions via the keyboard instead of clicking around
- Use the Corsair search API to add a better UI around Gmail advanced search
- Add a vector database to the existing Postgres database. Since Corsair caches all emails that come through it, you can search locally instead of using the Gmail API. This allows lightning-fast search across the entire email and calendar in under 1 second

