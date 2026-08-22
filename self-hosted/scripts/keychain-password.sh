#!/bin/zsh
set -eu

if [[ -n "${REMOTE_RELAY_SMTP_PASSWORD:-}" ]]; then
  print -rn -- "$REMOTE_RELAY_SMTP_PASSWORD"
  exit 0
fi

SERVICE="${REMOTE_RELAY_SMTP_KEYCHAIN_SERVICE:-com.toolarks.remote-login-relay.smtp}"
USER_NAME="${REMOTE_RELAY_SMTP_USER:-}"
[[ -n "$USER_NAME" ]] || exit 0
command -v security >/dev/null || { print -u2 "macOS security command is required to read the SMTP password"; exit 1; }
security find-generic-password -a "$USER_NAME" -s "$SERVICE" -w
