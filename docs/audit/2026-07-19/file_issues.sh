#!/usr/bin/env bash
# Files every issue draft in issues.md to GitHub.
#
# Prereqs:
#   1. Enable Issues on the repo: Settings -> General -> Features -> Issues
#   2. `gh auth login` (or GH_TOKEN set)
#
# Usage: ./file_issues.sh [owner/repo]   (defaults to YazanKittaneh/who-owns-what)
set -euo pipefail

REPO="${1:-YazanKittaneh/who-owns-what}"
SRC="$(dirname "$0")/issues.md"

# Ensure labels exist (gh issue create fails on unknown labels).
for label in audit P0 P1 P2 security backend frontend data devops growth a11y; do
  gh label create "$label" --repo "$REPO" --force >/dev/null 2>&1 || true
done

# Split issues.md on "=== ISSUE ===" separators and file each block.
awk -v RS='=== ISSUE ===' 'NR > 1 { print > ("/tmp/wow_issue_" NR-1 ".txt") }' "$SRC"

count=0
for f in /tmp/wow_issue_*.txt; do
  title="$(grep -m1 '^TITLE: ' "$f" | sed 's/^TITLE: //')"
  labels="$(grep -m1 '^LABELS: ' "$f" | sed 's/^LABELS: //')"
  body="$(sed -n '/^BODY:$/,$p' "$f" | tail -n +2)"
  [ -z "$title" ] && continue
  echo "Filing: $title"
  gh issue create --repo "$REPO" --title "$title" --label "$labels" --body "$body"
  count=$((count + 1))
  sleep 3  # stay under GitHub's secondary rate limit for content creation
done

rm -f /tmp/wow_issue_*.txt
echo "Filed $count issues."
