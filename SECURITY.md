# Security policy

Please report a suspected vulnerability privately to `support@toolarks.com`. Do not include passwords, verification codes, cookies, raw phone links, or other account secrets in the report.

Automated session notifications are sent from `relay@notify.toolarks.com`. That address is send-only and cannot receive email; do not reply to it.

## Scope

Security issues in the one-tab gateway, managed relay, session authorization, encryption, credit enforcement, and installation scripts are in scope.

## Design boundary

- The self-hosted gateway binds only to localhost and requires a high-entropy session token through the public tunnel.
- The managed client encrypts browser frames and input events before the relay receives them.
- Session URLs expire and are intended only for the purchaser's own phone.
- Chrome's debugging endpoint must never be published directly.
- The installer never requests the user's macOS account password. Operating-system permission prompts must be approved locally, and the password must never be given to ToolArks or an AI agent.

No software can make a forwarded bearer link safe. If a link may have been exposed, close the local process and create a new session.
