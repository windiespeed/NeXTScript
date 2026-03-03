#!/bin/bash
# Usage: bash .\ship.sh "Your commit message"

if [ -z "$1" ]; then
  echo "Error: Please provide a commit message."
  echo "Usage: bash ship.sh \"Your commit message\""
  exit 1
fi

git add app/ components/ lib/ types/ package.json package-lock.json .env.local.example README.md
git commit -m "$1"
git push
