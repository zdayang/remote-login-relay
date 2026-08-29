#!/bin/zsh
set -eu

PACKAGE_ROOT="${0:A:h:h}"
APP_ROOT="${REMOTE_RELAY_SELF_HOSTED_HOME:-$HOME/Library/Application Support/ToolArks/RemoteLoginRelay}"
RUNTIME_DIR="$APP_ROOT/runtime"
CONFIG_FILE="$APP_ROOT/config.env"
DURATION_MINUTES="${1:-30}"
TARGET_MATCH="${2:-}"
CDP_HTTP="${REMOTE_RELAY_CDP_HTTP:-http://127.0.0.1:9222}"
PORT="${REMOTE_RELAY_PORT:-6081}"
GATEWAY_LABEL="${REMOTE_RELAY_GATEWAY_LABEL:-com.toolarks.remote-login-relay.gateway}"
TUNNEL_LABEL="${REMOTE_RELAY_TUNNEL_LABEL:-com.toolarks.remote-login-relay.tunnel}"

[[ -f "$CONFIG_FILE" ]] || { print -u2 "Run scripts/configure.sh first."; exit 1; }
set -a
source "$CONFIG_FILE"
set +a
[[ "$DURATION_MINUTES" == <-> ]] && (( DURATION_MINUTES >= 1 && DURATION_MINUTES <= 120 )) || { print -u2 "Duration must be 1-120 minutes."; exit 2; }
[[ -n "$TARGET_MATCH" ]] || { print -u2 "A specific Chrome URL or title fragment is required."; exit 2; }

for command in node npm cloudflared openssl curl; do
  command -v "$command" >/dev/null || { print -u2 "Missing dependency: $command"; exit 1; }
done
REMOTE_RELAY_TUNNEL_MODE="${REMOTE_RELAY_TUNNEL_MODE:-named}"
if [[ "$REMOTE_RELAY_TUNNEL_MODE" == named ]]; then
  [[ -f "${REMOTE_RELAY_TUNNEL_CONFIG:-}" ]] || { print -u2 "Tunnel config not found: ${REMOTE_RELAY_TUNNEL_CONFIG:-unset}"; exit 1; }
elif [[ "$REMOTE_RELAY_TUNNEL_MODE" != quick ]]; then
  print -u2 "Unknown tunnel mode: $REMOTE_RELAY_TUNNEL_MODE"; exit 1
fi
[[ -n "${REMOTE_RELAY_SMTP_HOST:-}" && -n "${REMOTE_RELAY_SMTP_FROM:-}" && -n "${REMOTE_RELAY_NOTIFY_TO:-}" ]] || { print -u2 "Email is not configured. Run scripts/setup.sh first."; exit 1; }

mkdir -p "$RUNTIME_DIR" "$APP_ROOT/self-hosted/src" "$APP_ROOT/self-hosted/public"
chmod 700 "$APP_ROOT" "$RUNTIME_DIR"
ditto "$PACKAGE_ROOT/src/self-hosted-gateway.mjs" "$APP_ROOT/self-hosted/src/self-hosted-gateway.mjs"
ditto "$PACKAGE_ROOT/public/index.html" "$APP_ROOT/self-hosted/public/index.html"
ditto "$PACKAGE_ROOT/../core" "$APP_ROOT/core"
if [[ ! -d "$APP_ROOT/node_modules/ws" || ! -d "$APP_ROOT/node_modules/nodemailer" ]]; then
  npm install --prefix "$APP_ROOT" --no-audit --no-fund ws@8.21.3 nodemailer@9.0.5 >/dev/null
fi

"$PACKAGE_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true
TOKEN="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n')"
DURATION_SECONDS=$(( DURATION_MINUTES * 60 ))

TARGET_JSON="$(curl --noproxy '*' -fsS "$CDP_HTTP/json/list" | TARGET_MATCH="$TARGET_MATCH" /usr/bin/python3 -c 'import json,os,sys; n=os.environ["TARGET_MATCH"].lower(); p=[x for x in json.load(sys.stdin) if x.get("type")=="page" and n in (x.get("url","")+" "+x.get("title","")).lower()]; print(json.dumps(p))')"
TARGET_COUNT="$(print -r -- "$TARGET_JSON" | /usr/bin/python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"
(( TARGET_COUNT == 1 )) || { print -u2 "Expected exactly one matching Chrome tab, found $TARGET_COUNT. Use a more specific fragment."; exit 1; }
TARGET_ID="$(print -r -- "$TARGET_JSON" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')"

launchctl submit -l "$GATEWAY_LABEL" -o "$RUNTIME_DIR/gateway.log" -e "$RUNTIME_DIR/gateway.log" -- \
  /usr/bin/env REMOTE_RELAY_TOKEN="$TOKEN" REMOTE_RELAY_TARGET_ID="$TARGET_ID" REMOTE_RELAY_CDP_HTTP="$CDP_HTTP" REMOTE_RELAY_PORT="$PORT" REMOTE_RELAY_EXPIRES_SECONDS="$DURATION_SECONDS" NODE_PATH="$APP_ROOT/node_modules" \
  "$(command -v node)" "$APP_ROOT/self-hosted/src/self-hosted-gateway.mjs"

for attempt in {1..60}; do
  curl --noproxy '*' --connect-timeout 1 --max-time 1 -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.25
done
curl --noproxy '*' --connect-timeout 1 --max-time 2 -fsS "http://127.0.0.1:$PORT/health" >/dev/null || { print -u2 "Gateway failed. See $RUNTIME_DIR/gateway.log"; "$PACKAGE_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true; exit 1; }

PREFLIGHT_RESPONSE="$(curl --noproxy '*' --connect-timeout 2 --max-time 5 -sS -w '\n%{http_code}' "http://127.0.0.1:$PORT/preflight")"
PREFLIGHT_STATUS="${PREFLIGHT_RESPONSE##*$'\n'}"
PREFLIGHT_BODY="${PREFLIGHT_RESPONSE%$'\n'*}"
if [[ "$PREFLIGHT_STATUS" != 200 ]]; then
  print -u2 "No phone link was sent: the website's own login session is expired."
  print -u2 "Open a fresh sign-in page in Chrome, then start Remote Login Relay again."
  [[ -n "$PREFLIGHT_BODY" ]] && print -u2 "$PREFLIGHT_BODY"
  "$PACKAGE_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true
  exit 1
fi

PUBLIC_URL="${REMOTE_RELAY_PUBLIC_URL:-}"
if [[ "$REMOTE_RELAY_TUNNEL_MODE" == named ]]; then
  launchctl submit -l "$TUNNEL_LABEL" -o "$RUNTIME_DIR/tunnel.log" -e "$RUNTIME_DIR/tunnel.log" -- \
    "$(command -v node)" "$PACKAGE_ROOT/scripts/run-with-timeout.mjs" "$DURATION_SECONDS" "$(command -v cloudflared)" tunnel --config "$REMOTE_RELAY_TUNNEL_CONFIG" run "$REMOTE_RELAY_TUNNEL_NAME"
else
  QUICK_URL_FILE="$RUNTIME_DIR/quick-tunnel-url"
  rm -f "$QUICK_URL_FILE"
  launchctl submit -l "$TUNNEL_LABEL" -o "$RUNTIME_DIR/tunnel.log" -e "$RUNTIME_DIR/tunnel.log" -- \
    "$(command -v node)" "$PACKAGE_ROOT/scripts/run-quick-tunnel.mjs" "$DURATION_SECONDS" "$(command -v cloudflared)" "$PORT" "$QUICK_URL_FILE"
  for attempt in {1..120}; do
    [[ -s "$QUICK_URL_FILE" ]] && break
    sleep 0.25
  done
  [[ -s "$QUICK_URL_FILE" ]] || { print -u2 "Cloudflare Quick Tunnel did not provide a public URL. See $RUNTIME_DIR/tunnel.log"; "$PACKAGE_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true; exit 1; }
  PUBLIC_URL="$(tr -d '\r\n' < "$QUICK_URL_FILE")"
fi

[[ "$PUBLIC_URL" == https://* ]] || { print -u2 "Tunnel did not provide an HTTPS URL"; "$PACKAGE_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true; exit 1; }
for attempt in {1..60}; do
  if curl --noproxy '*' --connect-timeout 2 --max-time 3 -fsS "$PUBLIC_URL/api/tab?token=$TOKEN" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
curl --noproxy '*' --connect-timeout 2 --max-time 5 -fsS "$PUBLIC_URL/api/tab?token=$TOKEN" >/dev/null || { print -u2 "Public tunnel is not reachable. See $RUNTIME_DIR/tunnel.log"; "$PACKAGE_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true; exit 1; }

LOGIN_URL="${PUBLIC_URL%/}/#token=$TOKEN"
SMTP_PASSWORD="$(REMOTE_RELAY_SMTP_PASSWORD="${REMOTE_RELAY_SMTP_PASSWORD:-}" "$PACKAGE_ROOT/scripts/keychain-password.sh")"
export REMOTE_RELAY_SMTP_PASSWORD="$SMTP_PASSWORD"
if ! node "$PACKAGE_ROOT/src/send-link.mjs" "$LOGIN_URL"; then
  print -u2 "The relay is running but the email could not be sent. Fix SMTP and run scripts/test-email.sh, then start a new handoff.";
  "$PACKAGE_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true
  unset REMOTE_RELAY_SMTP_PASSWORD SMTP_PASSWORD
  exit 1
fi
unset REMOTE_RELAY_SMTP_PASSWORD SMTP_PASSWORD

print "Remote Login Relay is ready for $DURATION_MINUTES minutes."
print "A ToolArks login link was sent to: $REMOTE_RELAY_NOTIFY_TO"
print "Direct phone link (private and temporary): $LOGIN_URL"
print "Tunnel mode: $REMOTE_RELAY_TUNNEL_MODE"
if [[ "$REMOTE_RELAY_TUNNEL_MODE" == quick ]]; then
  print "Quick Tunnel URL (changes on the next run): $PUBLIC_URL"
fi
