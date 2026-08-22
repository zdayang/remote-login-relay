# ToolArks Remote Login Relay — self-hosted

![Remote Login Relay: when an AI agent is blocked by login while you are away, finish the login from your phone](assets/how-it-works.png)

Remote Login Relay lets you finish a human-only browser login from your phone when a local AI agent is working on your Mac. It exposes one exact Chrome page for a short, owner-controlled handoff; it does not share the desktop or ask the agent to handle your password.

## The problem

Agents such as Codex and Claude Code can carry a browser workflow a long way, but authentication often stops them at the last step: a QR code, one-time code, phone prompt, passkey, CAPTCHA, or consent screen. The alternatives are to wait until you return to the Mac, give the agent sensitive credentials, or expose the whole desktop. This package provides a narrower handoff: one exact Chrome page, one owner, one temporary session.

## How it works

1. The Skill matches one open Chrome tab by a specific URL or title fragment and refuses zero or ambiguous matches.
2. A local gateway connects to that tab through Chrome DevTools Protocol.
3. A short-lived random token is placed in a phone link. The gateway and public tunnel are started only for the handoff.
4. The phone receives images of that tab and sends bounded pointer, keyboard, scroll, back, and reload actions.
5. After login, the agent confirms the original page left the login screen, then the gateway and tunnel are stopped.

Passwords, verification codes, cookies, browser storage, and session tokens are not exported to the AI workflow.

## What the open-source package includes

- Codex and Claude Code Skill;
- one-tab Chrome controller and local gateway;
- mobile browser interface;
- guided setup for SMTP email delivery;
- stable domain + named Cloudflare Tunnel route;
- temporary Cloudflare Quick Tunnel route when you do not have a domain;
- ToolArks-branded email test and login-link delivery;
- English and Simplified Chinese documentation;
- contract, email, and isolated-Chrome end-to-end tests.

Start with the [self-hosted setup guide](self-hosted/README.md) or [简体中文说明](self-hosted/README.zh-CN.md). The setup wizard asks whether you have a domain, whether you have a Cloudflare account, and how you want to proceed. If the setup is too much, it explains the separately operated hosted option; no account or purchase is created automatically.

## Security boundary

- Exactly one explicitly matched Chrome tab is shared, never the whole desktop.
- The Chrome debugging port stays on localhost and must never be published directly.
- The complete temporary URL is a bearer credential. Anyone who receives it can control the selected tab until it expires or the session is stopped.
- The self-hosted package stores SMTP passwords in macOS Keychain when configured with an authenticated mailbox; secrets are not written to `config.env`.
- Quick Tunnel addresses are temporary and change between runs. A stable address requires your own domain and named Cloudflare Tunnel.
- No macOS account password is requested during installation or use.
- Windows, Safari, whole-machine control, sleeping Macs, multi-user sharing, and permanent unattended access are not supported in the current release.

Read [SECURITY.md](SECURITY.md) before exposing a self-hosted hostname.

## Repository layout

```text
remote-login-relay/
├── assets/           Product workflow illustration
├── core/             Shared one-tab Chrome controller
├── self-hosted/      MIT-licensed Skill, gateway, mobile UI, and setup scripts
└── SECURITY.md
```

## Evidence status

The one-tab controller, fail-closed tab selection, email delivery, temporary tunnel flow, and isolated-Chrome gateway have automated technical coverage. Real customer demand and repeat use are not yet validated. Treat this as an early open-source product, not as an authentication service or security bypass.

## License

The self-hosted edition is licensed under the [MIT License](self-hosted/LICENSE).
