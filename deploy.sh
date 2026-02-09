#!/usr/bin/env bash
set -euo pipefail

SERVER="ilmars@193.180.212.51"
APP_DIR="/home/ilmars/veryrandom.site"

echo "deploying to $SERVER..."

# Push latest code
git push origin main

# Pull, install, restart on server
ssh "$SERVER" "cd $APP_DIR && git pull && npm install --production && sudo systemctl restart veryrandom"

echo "deployed!"
