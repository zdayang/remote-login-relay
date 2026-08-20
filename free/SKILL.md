---
name: remote-login-relay-free
description: Self-host a temporary phone handoff for one exact Chrome tab when a local AI agent is blocked by a QR code, verification code, phone-number prompt, or third-party consent screen.
---

# Remote Login Relay Free

Use this Skill only to let the Mac owner personally complete a sensitive step in one already-open Chrome tab.

## Safety boundary

- Never read, copy, export, log, or forward cookies, passwords, verification codes, or session tokens.
- Never expose Chrome's debugging port to the public internet.
- Never share the whole desktop.
- Select one exact tab with a specific URL or title fragment. If more than one tab matches, stop and request a more specific fragment.
- The remote link is a temporary sensitive credential. Send it only through a channel explicitly chosen by the user.
- Default to 30 minutes and stop the gateway immediately after read-back confirms the login succeeded.

## Run

1. Confirm the Free package has been configured with the user's own HTTPS hostname and Cloudflare tunnel.
2. Run `scripts/start.sh 30 '<specific URL or title fragment>'`.
3. Give the user the final link printed by the command.
4. After the user reports completion, read the original Chrome tab and confirm that it left the login screen.
5. Run `scripts/stop.sh`, then `scripts/status.sh`; report the shutdown result.

This Free edition is self-hosted. ToolArks does not provide a domain, email delivery, relay availability, or installation support.
