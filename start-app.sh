#!/bin/bash
# Watch Commander - Start Script
# Run this in Terminal whenever you need to start the app

PROJECT="/Users/johncooper/watch-commander-ops-hub"

echo ""
echo "======================================"
echo "  Watch Commander - Starting App"
echo "======================================"
echo ""

# --- Start Frontend in background ---
echo "▶ Starting Frontend..."
osascript -e 'tell app "Terminal" to do script "cd /Users/johncooper/watch-commander-ops-hub/frontend && bunx vite --host 127.0.0.1"'
echo "  Frontend will be at: http://localhost:5173"
echo ""

# --- Start Backend in a new Terminal tab ---
echo "▶ Starting Backend..."
osascript -e 'tell app "Terminal" to do script "cd /Users/johncooper/watch-commander-ops-hub/backend && encore run"'
echo "  Backend will be at: http://localhost:4000"
echo ""

# --- Wait for backend to be ready ---
echo "⏳ Waiting for backend to start (this takes ~15 seconds)..."
for i in $(seq 1 30); do
  sleep 2
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/localauth/create-admin -X POST -H "Content-Type: application/json" -d '{}' 2>/dev/null)
  if [ "$STATUS" = "200" ]; then
    echo ""
    echo "✅ Backend is ready!"
    break
  fi
  echo -n "."
done

echo ""
echo "🔑 Resetting admin password..."
RESULT=$(curl -s -X POST http://127.0.0.1:4000/localauth/create-admin \
  -H "Content-Type: application/json" \
  -d '{}')
echo "   $RESULT"

echo ""
echo "======================================"
echo "  App is ready!"
echo "======================================"
echo ""
echo "  🌐 Open:     http://localhost:5173"
echo "  📧 Email:    coopj1978@gmail.com"
echo "  🔑 Password: Admin123!"
echo ""
echo "  (Keep this window open while using the app)"
echo "======================================"
echo ""
