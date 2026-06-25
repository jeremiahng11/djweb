#!/usr/bin/env bash
# Serve the standalone Doodle Jump game over HTTP and open it in a browser.
#
# Why a server? Phaser loads JSON/atlas/font files via XHR, which browsers
# block on file:// URLs. The game MUST be served over http:// to run.

set -e
cd "$(dirname "$0")"

PORT="${1:-8080}"
URL="http://localhost:${PORT}/index.html"

echo "Serving Doodle Jump at ${URL}"
echo "Press Ctrl+C to stop."

# Open the browser shortly after the server starts (macOS/Linux best-effort).
( sleep 1; (command -v open >/dev/null && open "$URL") || \
                 (command -v xdg-open >/dev/null && xdg-open "$URL") || true ) &

exec python3 -m http.server "$PORT"
