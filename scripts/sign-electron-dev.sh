#!/bin/bash

ELECTRON_APP="./node_modules/electron/dist/Electron.app"

echo "🔐 Signing Electron.app with stable identifier..."
echo "   This prevents permission loss between builds"
echo ""

# Sign with consistent identifier
codesign --force --deep --sign - \
  --identifier "com.cueme.electron.dev" \
  "$ELECTRON_APP"

if [ $? -eq 0 ]; then
    echo "✅ Successfully signed with identifier: com.cueme.electron.dev"
    echo ""
    echo "📋 NEXT STEPS:"
    echo "   1. Open: System Settings → Privacy & Security → Screen Recording"
    echo "   2. Click the (+) button"
    echo "   3. Navigate to and select:"
    echo "      $(cd "$(dirname "$0")/.." && pwd)/node_modules/electron/dist/Electron.app"
    echo "   4. Enable the toggle"
    echo "   5. Restart CueMe"
    echo ""
    echo "💡 Permission will now persist across builds!"
else
    echo "❌ Signing failed"
    exit 1
fi
