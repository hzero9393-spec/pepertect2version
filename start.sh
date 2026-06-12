#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js..."
  npx next dev -p 3000 2>&1
  echo "[$(date)] Next.js exited (code: $?), restarting in 2s..."
  sleep 2
done
