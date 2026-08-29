---
name: remote-login-relay
description: Guide and run a self-hosted ToolArks phone handoff for one exact Chrome page when a local AI agent reaches a human-only login step.
---

# Remote Login Relay

Use this Skill when the user explicitly requests a phone handoff or when an already-open Chrome page reaches a human-only step such as sign-in, QR code, one-time code, phone prompt, passkey, CAPTCHA, or security confirmation. Do not invoke it for an ordinary login the agent can complete itself or a generic page error. Never ask the user to paste a password, verification code, cookie, or session token into chat.

## First-run setup

Before the first handoff, check for the self-hosted configuration file. If it is missing, run `scripts/setup.sh` and let the user choose:

1. **Own domain + named Cloudflare Tunnel** — a stable hostname. The user needs a domain whose DNS is managed by Cloudflare and a tunnel YAML file.
2. **No domain + Cloudflare Quick Tunnel** — no domain is needed and a Cloudflare account is optional. The URL is a temporary random `trycloudflare.com` address and changes on every run; this is for testing, not a permanent product URL.
3. **Too much setup, use it directly** — explain that the hosted ToolArks version removes domain, tunnel, and sender-email setup, then show `https://toolarks.com/en/remote-login-relay` (or `https://toolarks.com/zh/remote-login-relay`). Do not purchase or create an account without the user's instruction.

The wizard must ask plainly: “Do you have a domain?”, “Do you have a Cloudflare account?” (Quick Tunnel does not require one), and “How do you want to proceed?”. It also configures the notification email:

- Gmail / Google Workspace: `smtp.gmail.com`, port 587, STARTTLS, and a Google App Password, never the normal account password.
- Outlook / Microsoft 365: `smtp.office365.com`, port 587, STARTTLS, with SMTP AUTH enabled for the mailbox.
- Other providers: custom SMTP host, port, and security setting.

The sender and phone notification address may be the same. The password is entered hidden and stored in macOS Keychain; it is not written to `config.env`, printed, or requested in chat. After setup, run `scripts/test-email.sh` and wait for the ToolArks test message before creating a real handoff.

If configuration fails, report the exact failing step and retry the email test after correction. The normal flow deliberately provides both delivery paths: it prints the temporary URL for the current conversation and sends a ToolArks-branded email notification. Email failure still fails closed because the user may not be watching the conversation.

## Safety boundary

- Never read, copy, export, log, or forward cookies, passwords, verification codes, or session tokens.
- Never expose Chrome's debugging port to the public internet.
- Never share the whole desktop; expose one exact Chrome tab only.
- Select one exact tab with a specific URL or title fragment. If more than one tab matches, stop and request a more specific fragment.
- The remote link is a temporary sensitive credential. Return it only in the current authorized conversation and send it only to the configured notification address. The local terminal and conversation provider process it and may retain it under their own history or logging policies; never copy it into documentation, issues, or unrelated channels.
- Use 30 minutes by default and stop the gateway immediately after read-back confirms the login succeeded.

## Run

1. Confirm `scripts/setup.sh` and `scripts/test-email.sh` have completed successfully.
2. Ask which exact URL or title fragment identifies the login tab, then run `scripts/start.sh 30 '<specific URL or title fragment>'`.
3. The command starts the gateway and tunnel, verifies the public endpoint, and outputs the complete temporary link after the ToolArks email has been sent.
4. Return that exact link directly in the current conversation and tell the user the same link was emailed as an asynchronous notification.
5. Read the original Chrome tab and confirm that it left the login screen.
6. Run `scripts/stop.sh`, then `scripts/status.sh`; report the shutdown result.

The agent must never ask the user to paste a password, verification code, cookie, or session token into the chat.
