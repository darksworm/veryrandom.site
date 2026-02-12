#!/usr/bin/env bash
while true; do
  NS=$(dig veryrandom.site NS +short 2>/dev/null | head -1)
  echo "$(date +%H:%M:%S) - NS: $NS"
  if echo "$NS" | grep -qi cloudflare; then
    osascript -e 'display notification "NS records now point to Cloudflare!" with title "veryrandom.site" sound name "Glass"'
    echo "DONE! Cloudflare NS detected."
    exit 0
  fi
  sleep 60
done
