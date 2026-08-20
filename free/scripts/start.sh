#!/bin/zsh
set -eu

PACKAGE_ROOT="${0:A:h:h}"
APP_ROOT="${REMOTE_RELAY_FREE_HOME:-$HOME/Library/Application Support/ToolArks/RemoteLoginRelayFree}"
RUNTIME_DIR="$APP_ROOT/runtime"
CONFIG_FILE="$APP_ROOT/config.env"
DURATION_MINUTES="${1:-30}"
TARGET_MATCH="${2:-}"
CDP_HTTP="${REMOTE_RELAY_CDP_HTTP:-http://127.0.0.1:9222}"
PORT="${REMOTE_RELAY_PORT:-6081}"
GATEWAY_LABEL="${REMOTE_RELAY_GATEWAY_LABEL:-com.toolarks.remote-login-relay-free.gateway}"
TUNNEL_LABEL="${REMOTE_RELAY_TUNNEL_LABEL:-com.toolarks.remote-login-relay-free.tunnel}"

[[ -f "$CONFIG_FILE" ]] || { print -u2 "Run scripts/configure.sh first."; exit 1; }
source "$CONFIG_FILE"
[[ "$DURATION_MINUTES" == <-> ]] && (( DURATION_MINUTES >= 1 && DURATION_MINUTES <= 120 )) || { print -u2 "Duration must be 1-120 minutes."; exit 2; }
[[ -n "$TARGET_MATCH" ]] || { print -u2 "A specific Chrome URL or title fragment is required."; exit 2; }

for command in node npm cloudflared openssl curl; do
  command -v "$command" >/dev/null || { print -u2 "Missing dependency: $command"; exit 1; }
done
[[ -f "$REMOTE_RELAY_TUNNEL_CONFIG" ]] || { print -u2 "Tunnel config not found: $REMOTE_RELAY_TUNNEL_CONFIG"; exit 1; }

mkdir -p "$RUNTIME_DIR" "$APP_ROOT/free/src" "$APP_ROOT/free/public"
chmod 700 "$APP_ROOT" "$RUNTIME_DIR"
ditto "$PACKAGE_ROOT/src/free-gateway.mjs" "$APP_ROOT/free/src/free-gateway.mjs"
ditto "$PACKAGE_ROOT/public/index.html" "$APP_ROOT/free/public/index.html"
ditto "$PACKAGE_ROOT/../core" "$APP_ROOT/core"
if [[ ! -d "$APP_ROOT/node_modules/ws" ]]; then
  npm install --prefix "$APP_ROOT" --no-audit --no-fund ws@8.18.3 >/dev/null
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
  "$(command -v node)" "$APP_ROOT/free/src/free-gateway.mjs"

for attempt in {1..60}; do
  curl --noproxy '*' --connect-timeout 1 --max-time 1 -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break
  sleep 0.25
done
curl --noproxy '*' --connect-timeout 1 --max-time 2 -fsS "http://127.0.0.1:$PORT/health" >/dev/null || { print -u2 "Gateway failed. See $RUNTIME_DIR/gateway.log"; "$PACKAGE_ROOT/scripts/stop.sh" >/dev/null 2>&1 || true; exit 1; }

launchctl submit -l "$TUNNEL_LABEL" -o "$RUNTIME_DIR/tunnel.log" -e "$RUNTIME_DIR/tunnel.log" -- \
  "$(command -v node)" "$PACKAGE_ROOT/scripts/run-with-timeout.mjs" "$DURATION_SECONDS" "$(command -v cloudflared)" tunnel --config "$REMOTE_RELAY_TUNNEL_CONFIG" run "$REMOTE_RELAY_TUNNEL_NAME"

print "Remote Login Relay Free is ready for $DURATION_MINUTES minutes:"
print "${REMOTE_RELAY_PUBLIC_URL%/}/#token=$TOKEN"
