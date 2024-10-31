#!/bin/bash

version=$(jq -r '.version' manifest.json)

echo "Bumping version to $version"

git tag -a "v$version" -m "Version $version"
git push origin "v$version"

echo $version
