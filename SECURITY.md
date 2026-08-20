# Security policy

Please report a suspected vulnerability privately to `support@toolarks.com`. Do not include passwords, verification codes, cookies, raw phone links, or other account secrets in the report.

## Scope

Security issues in the one-tab gateway, managed relay, session authorization, encryption, credit enforcement, and installation scripts are in scope.

## Design boundary

- The free gateway binds only to localhost and requires a high-entropy session token through the public tunnel.
- The managed client encrypts browser frames and input events before the relay receives them.
- Session URLs expire and are intended only for the purchaser's own phone.
- Chrome's debugging endpoint must never be published directly.

No software can make a forwarded bearer link safe. If a link may have been exposed, close the local process and create a new session.
