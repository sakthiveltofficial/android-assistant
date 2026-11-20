# Security policy

Android Assistant holds powerful permissions (it can read the screen and perform taps and typing through Android's accessibility API) and handles users' model API keys, so security reports are taken seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private reporting instead:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability** (private security advisory).

Include what you found, how to reproduce it, the affected version/commit, and the impact you foresee. You can expect an acknowledgement within a few days. This is a volunteer project, so fix timelines are best-effort, but we will keep you updated and credit you if you wish.

## In scope

- Ways for on-screen content (web pages, messages, notifications) to make the agent perform actions the user did not ask for (prompt injection), or to bypass the confirmation gate.
- Leaking or mishandling of API keys, conversation history or screen content.
- The overlay or accessibility service being abused to intercept or inject input.
- Unsafe handling of downloaded model files or provider responses.

## Out of scope

- Mistakes made by a model within the user's own request and permissions.
- Issues that need a rooted or already-compromised device.
- Vulnerabilities in third-party libraries with no way to exploit them here (report those upstream).

## For users

Only install builds you trust. Grant the accessibility permission only to a build you have built yourself or obtained from a source you trust. Cloud models receive screenshots and on-screen text while a task runs; use an on-device model if that is a concern.
