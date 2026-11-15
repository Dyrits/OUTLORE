#!/bin/sh
# Prepares a git worktree of this repository to run: copies the installed packages of the checkout that holds it,
# so no `bun install` is needed. Run it from the new worktree, which belongs in `.worktrees/<name>` (git-ignored).
#
# Why not `bun install`: inside Claude Code's sandbox, a package that ships a `.gitmodules` file or a `.vscode` folder
# cannot be written ("EPERM: copy file .gitmodules"), and running the install outside the sandbox asks the owner.
# Those files are no use in node_modules, so the copy leaves them out. The links between the workspaces are relative,
# so each worktree's packages resolve to the worktree's own sources.
#
# Usage: .agents/worktree-setup.sh [path of the checkout holding the packages; default: the main checkout]
set -eu
here=$(pwd -P)
source=${1:-$(cd "$(git rev-parse --git-common-dir)/.." && pwd -P)}
[ "$source" != "$here" ] || { echo "Run this from a linked worktree, not from the checkout that holds the packages." >&2; exit 1; }
[ -d "$source/node_modules" ] || { echo "No node_modules in $source: run \`bun install\` there first." >&2; exit 1; }

for folder in node_modules apps/*/node_modules packages/*/node_modules; do
  [ -d "$source/$folder" ] || continue
  rm -rf "${here:?}/$folder"
  mkdir -p "$here/$folder"
  tar -C "$source/$folder" --exclude .gitmodules --exclude .vscode -cf - . | tar -C "$here/$folder" -xf -
done
echo "Packages copied from $source."
