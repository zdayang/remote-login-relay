# Remote Login Relay

Remote Login Relay lets you finish a human-only browser login from your phone when a local AI agent is working on your Mac.

The agent hands off one exact Chrome tab for a short time. You enter the password, verification code, QR confirmation, or consent decision yourself. The agent does not receive your cookies or credentials, and the relay does not expose your whole desktop.

> Remote Login Relay is not remote desktop software, unattended login automation, or an authentication bypass. Your Mac must remain awake and online.

## The problem

Local agents such as Codex and Claude Code can carry a browser workflow a long way, but authentication often stops them at the last step:

- a QR code must be scanned from a phone;
- a one-time code or phone number should be entered only by the account owner;
- a third-party authorization screen requires a human decision;
- the owner is away from the Mac when the prompt appears.

The usual alternatives are awkward or too broad. You can abandon the workflow until you return to the Mac, give the agent sensitive credentials, or expose the entire desktop through a general remote-access tool. Remote Login Relay creates a narrower handoff: one selected tab, one owner, one temporary session.

## How it works

1. The local Skill matches a specific open Chrome tab by URL or title. It stops if zero or multiple tabs match.
2. A local gateway connects to that tab through Chrome DevTools Protocol.
3. A random, time-limited phone link is created. Sessions expire after 30 minutes by default.
4. The phone receives images of only that tab and sends back bounded pointer, keyboard, scroll, back, and reload actions.
5. After login, the agent confirms that the selected tab left the login page, then the gateway and tunnel are stopped.

Passwords, verification codes, cookies, browser storage, and session tokens are not exported to the AI workflow.

## Choose how to run it

### Self-hosted — open source

The MIT-licensed package includes:

- the Codex and Claude Code Skill;
- the one-tab Chrome controller and local gateway;
- the mobile browser interface;
- setup scripts and contract tests;
- English and Simplified Chinese documentation.

You supply and maintain your own Cloudflare account, Cloudflare-managed domain, named tunnel, and link-delivery method. ToolArks does not receive the browser frames and does not provide hosting, email delivery, uptime, or installation support for this edition.

Continue with the [self-hosted setup guide](self-hosted/README.md) or its [Simplified Chinese version](self-hosted/README.zh-CN.md).

### Remote Login Relay Cloud — managed service

“Managed Cloud” is the standard industry term for this edition: ToolArks operates the public domain, encrypted relay, email delivery, purchase verification, usage metering, and customer support. You do not need to configure Cloudflare, DNS, or your own notification system.

Both packages are one-time credit purchases. There is no subscription or automatic renewal.

| Package | Price | Successful new sessions | Validity | Best for |
|---|---:|---:|---:|---|
| Starter | $1.99 | 10 | 1 year | Occasional login blocks |
| Standard | $10 | 500 | 3 years | Frequent agent-driven browser work |

A credit is consumed only when a phone first connects to a new session. Creating a link, an email-delivery failure, or reconnecting to the same unexpired session does not consume another credit.

- [Buy Starter — 10 sessions](https://mindstructor.gumroad.com/l/remote-login-relay-starter)
- [Buy Standard — 500 sessions](https://mindstructor.gumroad.com/l/remote-login-relay-standard)
- Support: `support@toolarks.com`

Managed session notifications come from `relay@notify.toolarks.com`. This is a send-only address and cannot receive replies.

## Security boundary

- Exactly one explicitly matched Chrome tab is shared, never the whole desktop.
- The Chrome debugging port stays on localhost and must never be published directly.
- The complete temporary URL is a bearer credential. Anyone who receives it can control the selected tab until it expires or the session is stopped.
- In the self-hosted edition, Cloudflare carries traffic between your hostname and your Mac; ToolArks is not in that path.
- In Remote Login Relay Cloud, frames and input events are encrypted between the phone and Mac before crossing the ToolArks relay. ToolArks and its email provider necessarily process the complete temporary link in order to deliver it.
- No macOS account password is requested during installation or use.
- Windows, Safari, whole-machine control, sleeping Macs, multi-user sharing, and permanent unattended access are not supported in the current release.

Read [SECURITY.md](SECURITY.md) before exposing a self-hosted hostname.

## Repository layout

```text
remote-login-relay/
├── core/             Shared one-tab Chrome controller
├── self-hosted/      MIT-licensed Skill, gateway, mobile UI, and setup scripts
└── SECURITY.md
```

The open-source repository contains the self-hosted edition. The Remote Login Relay Cloud client and service are maintained separately by ToolArks and are not part of the public distribution.

## Evidence status

The one-tab controller, fail-closed tab selection, temporary-link flow, encrypted managed transport, email delivery, and credit-debit rules have passed technical tests. Real customer demand and repeat use are not yet validated. Treat the current release as an early product, not as a proven authentication service.

## License

The self-hosted edition is licensed under the [MIT License](self-hosted/LICENSE). The Remote Login Relay Cloud client is distributed under its own customer license.
