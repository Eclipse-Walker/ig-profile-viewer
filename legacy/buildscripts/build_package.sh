#!/bin/bash

version=$(grep -Po '"version": *"\K[^"]*' manifest.json)

zipfile="ig-profile-viewer-$version.zip"

if [ ! -d "package" ]; then
  mkdir package
else
  rm -rf package/*
fi

files_to_zip=("icons" "background.js" "manifest.json" "rule.json" "rules.json")

zip -r "package/$zipfile" "${files_to_zip[@]}"

echo "Zipping complete! Created package/$zipfile"

