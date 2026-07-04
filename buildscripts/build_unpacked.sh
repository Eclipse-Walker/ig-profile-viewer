#!/bin/bash
# Builds the loadable unpacked extension into package/ig-profile-viewer-<version>/
# (no zip — point chrome://extensions "Load unpacked" at that folder).

version=$(grep -Po '"version": *"\K[^"]*' manifest.json)
outdir="package/ig-profile-viewer-$version"

rm -rf "$outdir"
mkdir -p "$outdir"

files=("icons" "background.js" "manifest.json" "rule.json" "rules.json")
cp -r "${files[@]}" "$outdir/"

echo "Build complete! Unpacked extension at $outdir"
