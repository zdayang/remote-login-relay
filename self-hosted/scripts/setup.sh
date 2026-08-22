#!/bin/zsh
set -eu

PACKAGE_ROOT="${0:A:h:h}"
HOSTED_URL="https://toolarks.com/en/remote-login-relay"
print "ToolArks Remote Login Relay — self-hosted setup"
print "This wizard stores settings under: ${REMOTE_RELAY_SELF_HOSTED_HOME:-$HOME/Library/Application Support/ToolArks/RemoteLoginRelay}"
print ""
print "The relay needs two things: a public HTTPS path and an email sender."
print "Do you have a domain that is already managed by Cloudflare?"
print "  1) Yes — use a stable hostname and a named Cloudflare Tunnel"
print "  2) No — use a temporary Cloudflare Quick Tunnel (random URL per run)"
print "  3) Too much setup — I want the hosted version"
read -r "ROUTE?Choose 1, 2, or 3 [1/2/3]: "
if [[ "$ROUTE" == 3 ]]; then
  print "The hosted version removes domain, tunnel, and email setup: $HOSTED_URL"
  exit 0
fi
[[ "$ROUTE" == 1 || "$ROUTE" == 2 ]] || { print -u2 "Please choose 1, 2, or 3."; exit 2; }

ARGS=(--tunnel-mode named)
if [[ "$ROUTE" == 1 ]]; then
  read -r "PUBLIC_URL?HTTPS hostname (for example https://relay.example.com): "
  read -r "TUNNEL_CONFIG?Path to your Cloudflare tunnel YAML: "
  read -r "TUNNEL_NAME?Cloudflare tunnel name: "
  ARGS+=(--public-url "$PUBLIC_URL" --tunnel-config "$TUNNEL_CONFIG" --tunnel-name "$TUNNEL_NAME")
else
  print "Quick Tunnel does not require a domain or a Cloudflare account. It creates a temporary trycloudflare.com URL."
  print "If you need the same address every time, stop and choose option 1 after getting a domain."
  read -r "CF_ACCOUNT?Do you have a Cloudflare account anyway? [y/N]: "
  [[ "$CF_ACCOUNT" == [yY] ]] && print "Your account is optional for Quick Tunnel; no account login is needed by this setup."
  ARGS=(--tunnel-mode quick)
fi

print ""
print "Choose the email service that will send the temporary login link to your phone:"
print "  1) Gmail / Google Workspace (use a 16-character App Password, not your normal password)"
print "  2) Outlook / Microsoft 365 (SMTP AUTH must be enabled for the mailbox)"
print "  3) Other SMTP provider"
read -r "MAIL_PROVIDER?Choose 1, 2, or 3: "
case "$MAIL_PROVIDER" in
  1)
    SMTP_HOST="smtp.gmail.com"; SMTP_PORT="587"; SMTP_SECURE="0"; SMTP_REQUIRE_TLS="1"
    print "Create a Google App Password first: Google Account → Security → 2-Step Verification → App passwords."
    ;;
  2)
    SMTP_HOST="smtp.office365.com"; SMTP_PORT="587"; SMTP_SECURE="0"; SMTP_REQUIRE_TLS="1"
    print "Confirm SMTP AUTH is enabled for this Microsoft 365 mailbox before testing."
    ;;
  3)
    read -r "SMTP_HOST?SMTP hostname: "
    read -r "SMTP_PORT?SMTP port [587]: "
    SMTP_PORT="${SMTP_PORT:-587}"
    print "Security: 1) STARTTLS (recommended) 2) TLS on connect (465) 3) no TLS (only for a trusted local SMTP server)"
    read -r "SMTP_SECURITY?Choose 1, 2, or 3: "
    case "$SMTP_SECURITY" in
      2) SMTP_SECURE="1"; SMTP_REQUIRE_TLS="0" ;;
      3) SMTP_SECURE="0"; SMTP_REQUIRE_TLS="0" ;;
      *) SMTP_SECURE="0"; SMTP_REQUIRE_TLS="1" ;;
    esac
    ;;
  *) print -u2 "Please choose 1, 2, or 3."; exit 2 ;;
esac

read -r "SMTP_FROM?Sender email address: "
read -r "NOTIFY_TO?Phone notification email address: "
read -r "SMTP_AUTH?Does this SMTP service require a username and password? [Y/n]: "
SMTP_USER=""
SMTP_PASSWORD=""
if [[ ! "$SMTP_AUTH" =~ ^[nN]$ ]]; then
  read -r "SMTP_USER?SMTP username (usually the sender email): "
  print -n "SMTP App Password / password (hidden; never saved in config.env): "
  read -r -s SMTP_PASSWORD
  print ""
fi

export REMOTE_RELAY_SMTP_PASSWORD="$SMTP_PASSWORD"
ARGS+=(--smtp-host "$SMTP_HOST" --smtp-port "$SMTP_PORT" --smtp-secure "$SMTP_SECURE" --smtp-require-tls "$SMTP_REQUIRE_TLS" --smtp-user "$SMTP_USER" --smtp-from "$SMTP_FROM" --notify-to "$NOTIFY_TO")
if [[ -n "$SMTP_USER" ]]; then ARGS+=(--smtp-keychain-service "com.toolarks.remote-login-relay.smtp"); fi
"$PACKAGE_ROOT/scripts/configure.sh" "${ARGS[@]}"
unset REMOTE_RELAY_SMTP_PASSWORD SMTP_PASSWORD

print ""
print "Configuration is saved. Before the first real login, run:"
print "  $PACKAGE_ROOT/scripts/test-email.sh"
print "That test sends no login link and confirms the sender can deliver to $NOTIFY_TO."
print "Then install the Skill with: $PACKAGE_ROOT/scripts/install.sh codex"
