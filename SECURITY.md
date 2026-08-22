# Security policy

Please report a suspected vulnerability privately to `support@toolarks.com`. Do not include passwords, verification codes, cookies, raw phone links, SMTP passwords, or other account secrets in the report.

## Scope

Security issues in the self-hosted one-tab gateway, session authorization, mobile input bridge, setup scripts, tunnel integration, and email delivery are in scope.

## Design boundary

- The self-hosted gateway binds only to localhost and requires a high-entropy session token through the public tunnel.
- Exactly one explicitly matched Chrome tab is exposed; the whole desktop is never shared.
- Session URLs expire and are intended only for the owner's phone.
- Chrome's debugging endpoint must never be published directly.
- SMTP passwords are stored in macOS Keychain when the guided setup uses an authenticated mailbox. They are not written to `config.env`.
- The installer never requests the user's macOS account password. Operating-system permission prompts must be approved locally, and the password must never be given to ToolArks or an AI agent.

No software can make a forwarded bearer link safe. If a link may have been exposed, close the local process and create a new session.
