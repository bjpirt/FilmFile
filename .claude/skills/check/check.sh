#!/usr/bin/env bash
# Formats the code, runs everything `pnpm verify` runs, and optionally the
# browser journeys, printing a short summary: counts when all is well, and
# only the failures otherwise.
#
# Usage: .claude/skills/check/check.sh [--e2e] [--desktop] [--e2e-only] [--times N]
#   --e2e      the browser journeys only (pnpm e2e:web)
#   --desktop  every journey, the desktop app's among them, which launches
#              Electron (pnpm e2e): for the last check of a task or branch
set -uo pipefail
cd "$(dirname "$0")/../../.."

# The pre-commit hook and pnpm need the Node version in .nvmrc.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh" >/dev/null
  nvm use >/dev/null
fi

run_verify=1
run_e2e=0
e2e_script=e2e:web
times=1
while [ $# -gt 0 ]; do
  case "$1" in
    --e2e) run_e2e=1 ;;
    --desktop) run_e2e=1; e2e_script=e2e ;;
    --e2e-only) run_e2e=1; run_verify=0 ;;
    --times) times="$2"; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

status=0

if [ "$run_verify" = 1 ]; then
  pnpm -s format >/dev/null 2>&1
  out=$(pnpm verify 2>&1)
  if [ $? = 0 ]; then
    echo "verify: ok — $(echo "$out" | grep -E '^\s+Tests ' | tail -1 | xargs)"
  else
    status=1
    echo "verify: FAILED"
    # Prettier, ESLint, tsc and Vitest failures, with enough context to act on.
    echo "$out" | grep -E \
      '\[warn\]|^\s+[0-9]+:[0-9]+\s+(error|warning)|^/.*\.(ts|tsx)$|error TS|FAIL |×|AssertionError|Expected|Received|^\s*[-+] ' \
      | grep -v '^\s*$' | head -60
  fi
fi

if [ "$run_e2e" = 1 ]; then
  for i in $(seq 1 "$times"); do
    out=$(pnpm -s "$e2e_script" 2>&1)
    if [ $? = 0 ]; then
      echo "e2e run $i: ok — $(echo "$out" | grep -E '[0-9]+ passed' | tail -1 | xargs)"
    else
      status=1
      echo "e2e run $i: FAILED"
      echo "$out" | grep -E '✘|Error:|Expected|Received|Locator|waiting for|›.*e2e\.ts:[0-9]+' | head -40
    fi
  done
fi

exit $status
