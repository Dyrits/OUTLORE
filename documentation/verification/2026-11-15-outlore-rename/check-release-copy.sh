#!/usr/bin/env bash
# Runs the release workflow's real "legacy name" lines (cut out of .github/workflows/package.yml) on stand-in installers,
# once per tag, and prints which files the release would upload and which names SHA512SUMS.txt would list.
# Usage: bash check-release-copy.sh <workflow file> <tag>
set -euo pipefail
workflow="$1"; export RELEASE_TAG="$2"
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
mkdir "$work/installers"
for name in Outlore-0.1.9-mac-arm64.dmg Outlore-0.1.9-mac-x64.dmg Outlore-0.1.9-win-x64.exe Outlore-0.1.9-linux-x86_64.AppImage; do echo "$name" > "$work/installers/$name"; done
fragment=$(sed -n '/# An installed Iskios (0.1.3/,/sha512sum -- /p' "$workflow")
# The fragment ends with the sha512sum line, which writes SHA512SUMS.txt inside installers.
(cd "$work" && set -e && eval "$fragment" && printf 'legacy=%s\n' "${#legacy[@]}" && cut -c129- installers/SHA512SUMS.txt | sed 's/^ *\*\?//' | sort)
