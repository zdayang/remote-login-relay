#!/bin/zsh
set -eu

APP_ROOT="${REMOTE_RELAY_SELF_HOSTED_HOME:-$HOME/Library/Application Support/ToolArks/RemoteLoginRelay}"
TUNNEL_MODE="named"
PUBLIC_URL=""
TUNNEL_CONFIG=""
TUNNEL_NAME=""
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="0"
SMTP_REQUIRE_TLS="1"
SMTP_USER=""
SMTP_FROM=""
NOTIFY_TO=""
SMTP_KEYCHAIN_SERVICE="com.toolarks.remote-login-relay.smtp"
SKIP_EMAIL="0"

while (( $# )); do
  case "$1" in
    --tunnel-mode) TUNNEL_MODE="$2"; shift 2 ;;
    --public-url) PUBLIC_URL="$2"; shift 2 ;;
    --tunnel-config) TUNNEL_CONFIG="$2"; shift 2 ;;
    --tunnel-name) TUNNEL_NAME="$2"; shift 2 ;;
    --smtp-host) SMTP_HOST="$2"; shift 2 ;;
    --smtp-port) SMTP_PORT="$2"; shift 2 ;;
    --smtp-secure) SMTP_SECURE="$2"; shift 2 ;;
    --smtp-require-tls) SMTP_REQUIRE_TLS="$2"; shift 2 ;;
    --smtp-user) SMTP_USER="$2"; shift 2 ;;
    --smtp-from) SMTP_FROM="$2"; shift 2 ;;
    --notify-to) NOTIFY_TO="$2"; shift 2 ;;
    --smtp-keychain-service) SMTP_KEYCHAIN_SERVICE="$2"; shift 2 ;;
    --skip-email) SKIP_EMAIL="1"; shift ;;
    *) print -u2 "Unknown option: $1"; exit 2 ;;
  esac
done

[[ "$TUNNEL_MODE" == named || "$TUNNEL_MODE" == quick ]] || { print -u2 "--tunnel-mode must be named or quick"; exit 2; }
if [[ "$TUNNEL_MODE" == named ]]; then
  [[ "$PUBLIC_URL" == https://* ]] || { print -u2 "--public-url must use HTTPS"; exit 2; }
  [[ -f "$TUNNEL_CONFIG" ]] || { print -u2 "Tunnel config not found: $TUNNEL_CONFIG"; exit 2; }
  [[ -n "$TUNNEL_NAME" ]] || { print -u2 "--tunnel-name is required"; exit 2; }
else
  PUBLIC_URL=""
  TUNNEL_CONFIG=""
  TUNNEL_NAME=""
fi

if [[ "$SKIP_EMAIL" != 1 ]]; then
  [[ -n "$SMTP_HOST" ]] || { print -u2 "--smtp-host is required. Run scripts/setup.sh."; exit 2; }
  [[ "$SMTP_PORT" == <-> ]] && (( SMTP_PORT >= 1 && SMTP_PORT <= 65535 )) || { print -u2 "--smtp-port must be a valid TCP port"; exit 2; }
  [[ -n "$SMTP_FROM" ]] || { print -u2 "--smtp-from is required. Run scripts/setup.sh."; exit 2; }
  [[ -n "$NOTIFY_TO" ]] || { print -u2 "--notify-to is required. Run scripts/setup.sh."; exit 2; }
  if [[ -n "${REMOTE_RELAY_SMTP_PASSWORD:-}" && -z "$SMTP_USER" ]]; then
    print -u2 "A password was provided without --smtp-user"; exit 2
  fi
fi

mkdir -p "$APP_ROOT"
chmod 700 "$APP_ROOT"
CONFIG_FILE="$APP_ROOT/config.env"
{
  print -r -- "REMOTE_RELAY_TUNNEL_MODE=${(q)TUNNEL_MODE}"
  print -r -- "REMOTE_RELAY_PUBLIC_URL=${(q)PUBLIC_URL}"
  print -r -- "REMOTE_RELAY_TUNNEL_CONFIG=${(q)TUNNEL_CONFIG}"
  print -r -- "REMOTE_RELAY_TUNNEL_NAME=${(q)TUNNEL_NAME}"
  if [[ "$SKIP_EMAIL" != 1 ]]; then
    print -r -- "REMOTE_RELAY_SMTP_HOST=${(q)SMTP_HOST}"
    print -r -- "REMOTE_RELAY_SMTP_PORT=${(q)SMTP_PORT}"
    print -r -- "REMOTE_RELAY_SMTP_SECURE=${(q)SMTP_SECURE}"
    print -r -- "REMOTE_RELAY_SMTP_REQUIRE_TLS=${(q)SMTP_REQUIRE_TLS}"
    print -r -- "REMOTE_RELAY_SMTP_USER=${(q)SMTP_USER}"
    print -r -- "REMOTE_RELAY_SMTP_FROM=${(q)SMTP_FROM}"
    print -r -- "REMOTE_RELAY_NOTIFY_TO=${(q)NOTIFY_TO}"
    print -r -- "REMOTE_RELAY_SMTP_KEYCHAIN_SERVICE=${(q)SMTP_KEYCHAIN_SERVICE}"
  fi
} > "$CONFIG_FILE"
chmod 600 "$CONFIG_FILE"

if [[ "$SKIP_EMAIL" != 1 && -n "$SMTP_USER" && -n "${REMOTE_RELAY_SMTP_PASSWORD:-}" ]]; then
  command -v security >/dev/null || { print -u2 "macOS security command is required to store the SMTP password"; exit 1; }
  security add-generic-password -a "$SMTP_USER" -s "$SMTP_KEYCHAIN_SERVICE" -w "$REMOTE_RELAY_SMTP_PASSWORD" -U >/dev/null
  unset REMOTE_RELAY_SMTP_PASSWORD
  print "SMTP password stored in macOS Keychain (service: $SMTP_KEYCHAIN_SERVICE)"
fi
print "Saved self-hosted configuration to $CONFIG_FILE"
