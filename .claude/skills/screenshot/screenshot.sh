#!/usr/bin/env bash
# Takes a screenshot of the built app, after steps written as the body of a
# Playwright test, using the journeys' helpers. Runs against the e2e
# service's own temp archive, so nothing touches the user's archive.
#
# Usage: .claude/skills/screenshot/screenshot.sh <out.png> <steps file> [--full-page] [--size 1280x820]
set -uo pipefail
cd "$(dirname "$0")/../../.."

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh" >/dev/null
  nvm use >/dev/null
fi

out="$1"
steps="$2"
shift 2
full=false
width=1280
height=820
while [ $# -gt 0 ]; do
  case "$1" in
    --full-page) full=true ;;
    --size) width="${2%x*}"; height="${2#*x}"; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

spec=test/e2e/zz-screenshot.e2e.ts
trap 'rm -f "$spec"' EXIT
{
  echo "import { expect, test } from '@playwright/test';"
  echo "import { fixtureSets } from '../../apps/backend/test/support/lab-scans.ts';"
  echo "import * as journeys from './support/journeys.ts';"
  echo "test('screenshot', async ({ page }) => {"
  echo "  const { createRoll, addCamera, addScans, renumber } = journeys;"
  echo "  void expect; void fixtureSets; void createRoll; void addCamera; void addScans; void renumber;"
  echo "  await page.setViewportSize({ width: $width, height: $height });"
  cat "$steps"
  echo "  await page.screenshot({ path: '$out', fullPage: $full });"
  echo "});"
} > "$spec"

result=$(pnpm -s e2e "$spec" 2>&1)
if echo "$result" | grep -qE '1 passed'; then
  echo "saved $out"
else
  echo "$result" | grep -E 'Error|✘|›' | head -20
  exit 1
fi
