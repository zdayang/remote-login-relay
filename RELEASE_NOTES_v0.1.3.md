# Remote Login Relay v0.1.3

This release turns the original proof of concept into a guided self-hosted handoff for Codex, Claude Code, and other local AI agents.

## What changed

- Deliver the same short-lived phone link in the active AI conversation and by ToolArks-branded email notification.
- Guide first-time users through a named Cloudflare Tunnel, a no-domain Quick Tunnel, or the separately operated ToolArks Cloud option.
- Configure Gmail, Microsoft 365, or custom SMTP while keeping the mailbox password in macOS Keychain.
- Refuse zero or ambiguous Chrome-tab matches and reject explicit expired or timed-out login pages before publishing a link.
- Improve mobile pointer, keyboard, scroll, reload, and frame acknowledgement behavior for a more responsive handoff.
- Add English and Simplified Chinese setup documentation, a clearer security boundary, and automated contract, email, and isolated-Chrome end-to-end coverage.

## Install

```bash
git clone https://github.com/zdayang/remote-login-relay.git
cd remote-login-relay/self-hosted
npm install
./scripts/setup.sh
./scripts/test-email.sh
./scripts/install.sh codex       # or: ./scripts/install.sh claude
```

Then ask the agent to use `$remote-login-relay` when an already-open Chrome page reaches a human-only login, QR code, one-time code, passkey, CAPTCHA, phone prompt, or consent step.

## Safety boundary

Remote Login Relay shares one exact Chrome tab for one short-lived session. It does not export passwords, verification codes, cookies, browser storage, or the whole desktop. The complete phone URL is a temporary bearer credential; send it only to the authorized user and stop the relay immediately after login.

## Help us validate real use

This early self-hosted release has no hidden product telemetry. After trying it, please use one of the voluntary GitHub issue forms:

- First handoff worked
- Setup or handoff blocked

Do not post credentials, temporary relay URLs, or screenshots of private pages.
