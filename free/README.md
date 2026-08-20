# Remote Login Relay Free

Temporarily hand one exact Chrome tab to your phone when a local AI agent is blocked by a QR code, verification code, phone-number prompt, or third-party consent screen.

This edition is free and open source. You provide your own HTTPS hostname and Cloudflare Tunnel. ToolArks does not host your relay, receive browser frames, or provide an availability guarantee.

## What it does

- Shares one explicitly matched Chrome tab, not the whole desktop.
- Keeps passwords, verification codes, cookies, and session tokens out of the AI workflow.
- Generates a random temporary link that expires after 30 minutes by default.
- Restores the original desktop page dimensions when the session closes.
- Rejects public `/health` probes.

## Requirements

- macOS 13 or newer.
- Node.js 20 or newer.
- Google Chrome or Chromium launched with a local debugging port.
- `cloudflared` and a Cloudflare named tunnel that routes your HTTPS hostname to `http://127.0.0.1:6081`.

## Configure

```bash
./scripts/configure.sh \
  --public-url https://remote.example.com \
  --tunnel-config "$HOME/.cloudflared/config.yml" \
  --tunnel-name my-remote-login
```

No Cloudflare credential is copied into this package. The configuration file remains on your Mac.

## Install the Skill

```bash
./scripts/install.sh codex
# or
./scripts/install.sh claude
```

## Start a session

```bash
./scripts/start.sh 30 'accounts.example.com/login'
```

If zero or more than one Chrome tab matches, the command stops instead of guessing.

## Stop and verify

```bash
./scripts/stop.sh
./scripts/status.sh
```

## Security model

The URL fragment contains a random bearer token. Browsers do not send URL fragments in HTTP requests; the phone page reads it and supplies it only to the local gateway. Anyone who receives the complete link can control the selected tab until the link expires or the gateway is stopped. Treat the link like a short-lived secret.

See [README.zh-CN.md](README.zh-CN.md) for Simplified Chinese.
