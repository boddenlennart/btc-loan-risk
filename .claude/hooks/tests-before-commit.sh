#!/bin/sh
# Claude Code hook (PreToolUse, Bash): before Claude runs "git commit", the fast unit tests must pass.
# Enforces "commit only when all tests pass" (decision 012). Exit 2 blocks the command and tells Claude why.
cmd=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac
cd "$CLAUDE_PROJECT_DIR" || exit 0
export PATH="$CLAUDE_PROJECT_DIR/.tools/node/bin:$PATH"
if ! out=$(npm run --silent test:fast 2>&1); then
  echo "Blocked: unit tests fail, so this commit would break the rule 'commit only when all tests pass'." >&2
  echo "$out" | grep -E "FAIL|×|Tests " | head -20 >&2
  exit 2
fi
exit 0
