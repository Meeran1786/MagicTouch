#!/bin/bash
# Double-click to start the MagicTouch wall on a Mac. Needs Node.js 18+ (nodejs.org).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org/ and double-click this file again."
  read -n 1 -s -r -p "Press any key to close."; exit 1
fi
(sleep 1.5; open -a "Google Chrome" "http://localhost:8090/" 2>/dev/null || open "http://localhost:8090/") &
node server/index.js
