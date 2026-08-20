#!/bin/zsh
set -u
GATEWAY_LABEL="${REMOTE_RELAY_GATEWAY_LABEL:-com.toolarks.remote-login-relay-free.gateway}"
TUNNEL_LABEL="${REMOTE_RELAY_TUNNEL_LABEL:-com.toolarks.remote-login-relay-free.tunnel}"
gateway="stopped"; tunnel="stopped"
launchctl print "gui/$(id -u)/$GATEWAY_LABEL" >/dev/null 2>&1 && gateway="running"
launchctl print "gui/$(id -u)/$TUNNEL_LABEL" >/dev/null 2>&1 && tunnel="running"
print "gateway=$gateway tunnel=$tunnel"
[[ "$gateway" == "stopped" && "$tunnel" == "stopped" ]]
