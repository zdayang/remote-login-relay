#!/bin/zsh
set -u
GATEWAY_LABEL="${REMOTE_RELAY_GATEWAY_LABEL:-com.toolarks.remote-login-relay-free.gateway}"
TUNNEL_LABEL="${REMOTE_RELAY_TUNNEL_LABEL:-com.toolarks.remote-login-relay-free.tunnel}"
launchctl remove "$GATEWAY_LABEL" >/dev/null 2>&1 || true
launchctl remove "$TUNNEL_LABEL" >/dev/null 2>&1 || true
print "Remote Login Relay Free stopped. Chrome login state was not cleared."
