# label-emails

[![CI](https://github.com/codeallthethingz/label-emails/actions/workflows/node.js.yml/badge.svg)](https://github.com/codeallthethingz/label-emails/actions/workflows/node.js.yml)
[![coverage](https://codeallthethingz.github.io/label-emails/coverage/badge.svg)](https://codeallthethingz.github.io/label-emails/coverage/lcov-report/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-22.x-green.svg)](https://nodejs.org/)

A Google Apps Script that automatically triages your Gmail inbox using Google Contacts groups.

## How it works

Emails are labeled and routed based on which `isithuman:` contact group the sender belongs to in your Google Contacts:

| Sender's contact group | Gmail label applied | Action |
|---|---|---|
| `isithuman:human` | `human` | Stays in inbox |
| `isithuman:reading` | `reading` | Archived |
| `isithuman:<other>` | `<other>` | Archived |
| Not in contacts | `screener` | Archived for manual review |
| Manually screened out | `screened-out` | Filter created to skip inbox permanently |

When you later add a screened sender to your contacts, the script picks it up on the next run — removes the `screener` label, applies the correct label, and marks the thread unread so you don't miss it.

## Setup

1. Create a new [Google Apps Script](https://script.google.com/) project
2. Copy `index.js` into the script editor
3. Enable the **Gmail API** and **People API** advanced services
4. Create contact groups in Google Contacts with the `isithuman:` prefix (e.g. `isithuman:human`, `isithuman:reading`)
5. Set up a time-driven trigger to run `tagEmails` on your preferred interval

## Running tests

```
npm install
npm test
```

## License

MIT
