# Remote Login Relay — Self-hosted

Use your phone to complete a human-only login step in one exact Chrome tab while a local AI agent works on your Mac.

This open-source edition runs on infrastructure you control. You provide a Cloudflare account, a domain managed by Cloudflare, a named Cloudflare Tunnel, and your own way to deliver the temporary link to your phone. ToolArks does not host this relay or receive its browser frames.

![Remote Login Relay workflow: one blocked tab, one private email link, one phone login, then done](../assets/how-it-works.png)

## Before you begin

You need:

- macOS 13 or newer;
- Node.js 20 or newer;
- Google Chrome or Chromium;
- `cloudflared`;
- a Cloudflare account and a domain whose DNS is managed by Cloudflare;
- Codex or Claude Code if you want to use the packaged Skill.

The commands below use:

- tunnel name: `remote-login-relay`
- public hostname: `relay.example.com`
- local gateway: `http://127.0.0.1:6081`

Replace the example hostname and tunnel identifiers with your own values.

## 1. Install dependencies

Install Node.js 20+ using your preferred package manager. Install `cloudflared` on macOS with Homebrew:

```bash
brew install cloudflared
```

From this directory, install the gateway dependency:

```bash
npm install
```

## 2. Start an isolated Chrome profile

Chrome 136 and newer require a non-default user-data directory when `--remote-debugging-port` is used. Start a separate Chrome profile for agent-controlled work:

```bash
open -na "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/ToolArks/RemoteLoginRelayChrome"
```

Sign in to the sites you need inside this Chrome profile. Do not publish port `9222`; it must remain reachable only from the Mac itself.

Confirm that Chrome is ready:

```bash
curl --noproxy '*' http://127.0.0.1:9222/json/version
```

## 3. Create a locally managed Cloudflare Tunnel

Authenticate, create the tunnel, and route your hostname:

```bash
cloudflared tunnel login
cloudflared tunnel create remote-login-relay
cloudflared tunnel route dns remote-login-relay relay.example.com
```

The create command prints a tunnel UUID and writes a credentials JSON file under `~/.cloudflared/`.

Create `~/.cloudflared/remote-login-relay.yml` with this shape:

```yaml
tunnel: YOUR_TUNNEL_UUID
credentials-file: /Users/YOUR_MAC_USER/.cloudflared/YOUR_TUNNEL_UUID.json

ingress:
  - hostname: relay.example.com
    service: http://127.0.0.1:6081
  - service: http_status:404
```

Validate the configuration:

```bash
cloudflared tunnel --config "$HOME/.cloudflared/remote-login-relay.yml" ingress validate
```

The included scripts start and stop the tunnel only for the lifetime of a handoff. Do not install this tunnel as a permanently running system service.

## 4. Configure Remote Login Relay

```bash
./scripts/configure.sh \
  --public-url https://relay.example.com \
  --tunnel-config "$HOME/.cloudflared/remote-login-relay.yml" \
  --tunnel-name remote-login-relay
```

The script stores the hostname and local tunnel paths under your user account with owner-only permissions. It does not copy Cloudflare credentials into the package.

## 5. Install the Skill

For Codex:

```bash
./scripts/install.sh codex
```

For Claude Code:

```bash
./scripts/install.sh claude
```

The installed Skill is named `remote-login-relay`.

## 6. Start a handoff

Open the target login page in the isolated Chrome profile, then use a URL or title fragment that identifies exactly one tab:

```bash
./scripts/start.sh 30 'accounts.example.com/login'
```

The command prints a URL ending in `#token=...`. Send that complete URL to your own phone using a private channel you control, open it in the phone browser, and finish the login.

If no tab or more than one tab matches, the command stops. Use a more specific fragment instead of weakening the selection rule.

## 7. Stop and verify

After the login succeeds:

```bash
./scripts/stop.sh
./scripts/status.sh
```

The selected Chrome tab remains signed in. Stopping the relay does not clear the website's login state.

## Using it with an AI agent

Ask the agent to use `$remote-login-relay` when it reaches a human-only login step. The Skill instructs the agent to:

1. select only the exact blocked tab;
2. start a 30-minute handoff;
3. give the complete temporary link only to you;
4. verify that the original tab left the login screen;
5. stop the gateway and tunnel immediately.

The agent must never ask you to paste a password, verification code, cookie, or session token into the chat.

## Troubleshooting

### Chrome endpoint is unavailable

Confirm that Chrome was launched with both `--remote-debugging-port=9222` and a non-default `--user-data-dir`, then run:

```bash
curl --noproxy '*' http://127.0.0.1:9222/json/list
```

### No tab or multiple tabs match

Use a longer URL or title fragment. The relay intentionally refuses to guess.

### The public link does not open

Check the tunnel status and local logs:

```bash
cloudflared tunnel info remote-login-relay
./scripts/status.sh
```

Verify that the tunnel configuration maps your exact hostname to `http://127.0.0.1:6081` and ends with the `http_status:404` catch-all rule.

### The Mac is asleep or offline

The relay cannot work. Wake the Mac, restore its network connection, and create a new session.

## Security model

The URL fragment contains a random bearer token. Browsers do not send URL fragments in ordinary HTTP requests; the phone page reads the fragment and presents the token to the local gateway. Anyone who receives the complete URL can control the selected tab until the link expires or the gateway is stopped.

- Never forward or post the complete link.
- Never expose Chrome's debugging port to LAN or public interfaces.
- Keep the default session short and stop it after use.
- Use a dedicated Chrome profile rather than Chrome's default profile.
- Review [SECURITY.md](../SECURITY.md) before use.

## Prefer a managed setup?

[Remote Login Relay Cloud](https://toolarks.com/en/remote-login-relay) removes the Cloudflare, domain, DNS, tunnel, and email setup. ToolArks operates the managed infrastructure and emails each temporary link to the activated address.

| Package | Price | Sessions | Validity |
|---|---:|---:|---:|
| Starter | $1.99 | 10 | 1 year |
| Standard | $10 | 500 | 2 years |

Both are one-time purchases with no subscription or automatic renewal. Support is available at `support@toolarks.com`; session notifications come from the send-only address `relay@notify.toolarks.com`.

## License

MIT. See [LICENSE](LICENSE).

Simplified Chinese: [README.zh-CN.md](README.zh-CN.md)
