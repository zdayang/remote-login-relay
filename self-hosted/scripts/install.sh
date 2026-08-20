#!/bin/zsh
set -eu

PACKAGE_ROOT="${0:A:h:h}"
TARGET="${1:-codex}"
case "$TARGET" in
  codex) SKILL_ROOT="${CODEX_HOME:-$HOME/.codex}/skills/remote-login-relay" ;;
  claude) SKILL_ROOT="$HOME/.claude/skills/remote-login-relay" ;;
  *) print -u2 "Usage: $0 codex|claude"; exit 2 ;;
esac

for command in node npm cloudflared openssl curl; do
  command -v "$command" >/dev/null || { print -u2 "Missing dependency: $command"; exit 1; }
done

mkdir -p "$SKILL_ROOT"
ditto "$PACKAGE_ROOT/SKILL.md" "$SKILL_ROOT/SKILL.md"
ditto "$PACKAGE_ROOT/agents" "$SKILL_ROOT/agents"
mkdir -p "$SKILL_ROOT/package"
ditto "$PACKAGE_ROOT" "$SKILL_ROOT/package"
ditto "$PACKAGE_ROOT/../core" "$SKILL_ROOT/core"
print "Installed Remote Login Relay for $TARGET at $SKILL_ROOT"
