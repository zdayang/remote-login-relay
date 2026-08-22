#!/bin/zsh
set -eu

PACKAGE_ROOT="${0:A:h:h}"
APP_ROOT="${REMOTE_RELAY_SELF_HOSTED_HOME:-$HOME/Library/Application Support/ToolArks/RemoteLoginRelay}"
CONFIG_FILE="$APP_ROOT/config.env"
[[ -f "$CONFIG_FILE" ]] || { print -u2 "Run scripts/setup.sh first."; exit 1; }
source "$CONFIG_FILE"
command -v node >/dev/null || { print -u2 "Missing dependency: node"; exit 1; }

PASSWORD="$(REMOTE_RELAY_SMTP_PASSWORD="${REMOTE_RELAY_SMTP_PASSWORD:-}" "$PACKAGE_ROOT/scripts/keychain-password.sh")"
export REMOTE_RELAY_SMTP_PASSWORD="$PASSWORD"
node "$PACKAGE_ROOT/src/test-email.mjs"
unset REMOTE_RELAY_SMTP_PASSWORD PASSWORD
