#!/bin/bash

JSON_FILE="manifest.json"

if [[ ! -f "$JSON_FILE" ]]; then
  echo "Error: File $JSON_FILE does not exist."
  exit 1
fi

current_version=$(jq -r '.version' "$JSON_FILE")

if [[ -z "$current_version" ]]; then
  echo "Error: Could not read version from $JSON_FILE."
  exit 1
fi

IFS='.' read -r -a version_parts <<< "$current_version"

((version_parts[2]++))

new_version=$(IFS='.'; echo "${version_parts[*]}")

jq --arg version "$new_version" '.version = $version' "$JSON_FILE" > temp.json && mv temp.json "$JSON_FILE"

echo "Bump version from $current_version to $new_version"
