#!/bin/zsh
set -eu

APP_ROOT="${REMOTE_RELAY_FREE_HOME:-$HOME/Library/Application Support/ToolArks/RemoteLoginRelayFree}"
PUBLIC_URL=""
TUNNEL_CONFIG=""
TUNNEL_NAME=""

while (( $# )); do
  case "$1" in
    --public-url) PUBLIC_URL="$2"; shift 2 ;;
    --tunnel-config) TUNNEL_CONFIG="$2"; shift 2 ;;
    --tunnel-name) TUNNEL_NAME="$2"; shift 2 ;;
    *) print -u2 "Unknown option: $1"; exit 2 ;;
  esac
done

[[ "$PUBLIC_URL" == https://* ]] || { print -u2 "--public-url must use HTTPS"; exit 2; }
[[ -f "$TUNNEL_CONFIG" ]] || { print -u2 "Tunnel config not found: $TUNNEL_CONFIG"; exit 2; }
[[ -n "$TUNNEL_NAME" ]] || { print -u2 "--tunnel-name is required"; exit 2; }

mkdir -p "$APP_ROOT"
chmod 700 "$APP_ROOT"
CONFIG_FILE="$APP_ROOT/config.env"
{
  print -r -- "REMOTE_RELAY_PUBLIC_URL=${(q)PUBLIC_URL}"
  print -r -- "REMOTE_RELAY_TUNNEL_CONFIG=${(q)TUNNEL_CONFIG}"
  print -r -- "REMOTE_RELAY_TUNNEL_NAME=${(q)TUNNEL_NAME}"
} > "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"
print "Saved self-hosted configuration to $CONFIG_FILE"
