# ToolArks Remote Login Relay — self-hosted

An AI agent can operate a browser while you are away from the computer. When it reaches a human-only login step, this package lets you finish **that one Chrome page from your phone**. The link is sent by a ToolArks-branded email and expires with the handoff.

![Remote Login Relay workflow: an agent is blocked by login, the owner opens a branded email on a phone, and the same Chrome tab continues](../assets/how-it-works.png)

## Choose the least-friction setup

Run the guided setup first:

```bash
./scripts/setup.sh
```

It asks three practical questions instead of leaving you with unexplained environment variables:

1. **Do you have a domain managed by Cloudflare?** Choose the stable hostname route. You create a named Cloudflare Tunnel and point `relay.yourdomain.com` to the local gateway.
2. **Do you have a Cloudflare account but no domain?** Choose Quick Tunnel. It is a temporary development route, does not require a domain (or even an account login), and creates a random `trycloudflare.com` URL for each run. It is not a permanent address.
3. **Is this too much setup?** The wizard shows the ToolArks hosted option, which removes domain, tunnel, and sender-email setup: [use the hosted version](https://toolarks.com/en/remote-login-relay).

The same wizard configures delivery. Choose Gmail/Google Workspace, Outlook/Microsoft 365, or another SMTP provider. It gives the right host and security defaults, asks for the sender and phone notification address, and stores an SMTP App Password in macOS Keychain. The password is never written to `config.env`, printed, or sent to ToolArks.

Before a real handoff, verify delivery:

```bash
./scripts/test-email.sh
```

You should receive a message titled `ToolArks · self-hosted email test`. If it does not arrive, fix the provider setting before starting a relay. Gmail requires a Google App Password, not the normal account password. Microsoft 365 may require SMTP AUTH to be enabled for the mailbox.

## Requirements

- macOS 13 or newer;
- Node.js 20 or newer;
- Google Chrome or Chromium;
- `cloudflared` (`brew install cloudflared`);
- an SMTP mailbox that is allowed to send to your notification address;
- Codex or Claude Code if you want to use the packaged Skill.

## Install and prepare Chrome

```bash
npm install
./scripts/install.sh codex       # or: ./scripts/install.sh claude
```

Chrome 136 and newer require a non-default profile when remote debugging is enabled. Use a separate profile for agent-controlled work:

```bash
open -na "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/ToolArks/RemoteLoginRelayChrome"
```

Keep port `9222` on localhost. Sign in to the websites you need inside this Chrome profile, then confirm the endpoint:

```bash
curl --noproxy '*' http://127.0.0.1:9222/json/version
```

## Stable hostname route (domain + named tunnel)

If you selected the stable route, create the tunnel once:

```bash
cloudflared tunnel login
cloudflared tunnel create remote-login-relay
cloudflared tunnel route dns remote-login-relay relay.example.com
```

Create `~/.cloudflared/remote-login-relay.yml`:

```yaml
tunnel: YOUR_TUNNEL_UUID
credentials-file: /Users/YOUR_MAC_USER/.cloudflared/YOUR_TUNNEL_UUID.json

ingress:
  - hostname: relay.example.com
    service: http://127.0.0.1:6081
  - service: http_status:404
```

The setup wizard records the public hostname, YAML path, and tunnel name. The tunnel runs only during a handoff; it is not installed as a permanent service.

## Start a handoff

Open the login page in the isolated Chrome profile and identify exactly one tab:

```bash
./scripts/start.sh 30 'accounts.example.com/login'
```

The command refuses zero or ambiguous matches, starts the local gateway, starts the named or Quick Tunnel, verifies the public endpoint, and sends the complete temporary link to `REMOTE_RELAY_NOTIFY_TO`. It does not ask you to paste a password or verification code into chat.

Open the ToolArks email on your phone and finish the login. After the original Chrome tab has left the login screen:

```bash
./scripts/stop.sh
./scripts/status.sh
```

Stopping the relay does not clear the website's login state.

## Using the Skill

Ask the agent to use `$remote-login-relay` when it reaches a human-only login step. The Skill will:

1. guide first-run domain, Cloudflare, and email setup;
2. test email delivery before a real handoff;
3. select one exact blocked tab;
4. send a ToolArks-branded phone link;
5. verify the original tab and stop the relay.

The Skill never reads or requests browser passwords, cookies, verification codes, or session tokens.

## Security and limitations

The URL fragment contains a random bearer token. Anyone who receives the complete URL can control the selected Chrome page until expiry or shutdown. Never forward it, post it, or expose Chrome's debugging port. Use a dedicated Chrome profile and short sessions.

Quick Tunnel is deliberately temporary: its address changes on each run and Cloudflare does not promise it as a stable production hostname. A stable address requires your own domain and named tunnel. The self-hosted package runs on your Mac; ToolArks does not receive browser frames or SMTP credentials.

See [SECURITY.md](../SECURITY.md) and [SKILL.md](SKILL.md). Simplified Chinese: [README.zh-CN.md](README.zh-CN.md).

## License

MIT. See [LICENSE](LICENSE).
