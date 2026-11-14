#!/bin/bash
# MagicTouch - Mac launcher. Double-click this file.
cd "$(dirname "$0")"
URL="http://localhost:8080/"
if command -v node >/dev/null 2>&1; then node serve.js & SERVER=$!
elif command -v python3 >/dev/null 2>&1; then python3 -m http.server 8080 --bind 127.0.0.1 & SERVER=$!
else echo "Need Node.js or Python 3 installed."; read -p "Press Enter to close"; exit 1; fi
sleep 1
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ -x "$CHROME" ]; then
  # separate profile so the flags always apply; camera permission is remembered there
  "$CHROME" --user-data-dir="$HOME/.magictouch-chrome" --no-first-run \
    --autoplay-policy=no-user-gesture-required --start-fullscreen --app="$URL" >/dev/null 2>&1 &
else
  open "$URL"
fi
echo "MagicTouch is running at $URL - keep this window open. Close it to stop."
wait $SERVER
