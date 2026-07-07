#!/bin/bash
# Builds a minified package/ig-profile-viewer-<version>/ using bun.
# Minify only (store-safe) — NOT obfuscation, which Chrome Web Store forbids.

# Resolve bun: PATH first, then common install dirs (Git Bash on Windows often
# doesn't have ~/.bun on PATH). Override with BUN=/path/to/bun if needed.
BUN="${BUN:-bun}"
if ! command -v "$BUN" >/dev/null 2>&1; then
  for c in "$HOME/.bun/bin/bun" "$HOME/.bun/bin/bun.exe" "$USERPROFILE/.bun/bin/bun.exe"; do
    [ -x "$c" ] && BUN="$c" && break
  done
fi
if ! command -v "$BUN" >/dev/null 2>&1 && [ ! -x "$BUN" ]; then
  echo "Error: bun not found. Install from https://bun.sh or set BUN=/path/to/bun" >&2
  exit 1
fi

version=$(grep -Po '"version": *"\K[^"]*' manifest.json)
outdir="package/ig-profile-viewer-$version"

rm -rf "$outdir"
mkdir -p "$outdir/icons"

"$BUN" build background.js --minify --target=browser --outfile "$outdir/background.js"
cp -r icons/* "$outdir/icons/"
cp manifest.json rules.json "$outdir/"

echo "Build (minified) complete! -> $outdir"
