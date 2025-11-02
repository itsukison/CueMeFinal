#!/bin/bash

# Reset CueMe for Permission Testing
# This script resets all permissions and clears app cache to test the first-time setup flow

set -e

APP_NAME="CueMe"
BUNDLE_ID="com.electron.cueme"

echo "🧹 Resetting $APP_NAME for permission testing..."

# 1. Kill the app if running
echo ""
echo "1️⃣  Stopping $APP_NAME if running..."
pkill -f "$APP_NAME" 2>/dev/null || echo "   App not running"

# 2. Reset TCC permissions
echo ""
echo "2️⃣  Resetting TCC permissions..."
echo "   Note: This requires Full Disk Access for Terminal"

# Reset microphone permission
tccutil reset Microphone "$BUNDLE_ID" 2>/dev/null || echo "   Could not reset Microphone (may need Full Disk Access)"

# Reset screen recording permission (if granted by mistake)
tccutil reset ScreenCapture "$BUNDLE_ID" 2>/dev/null || echo "   Could not reset Screen Recording (may need Full Disk Access)"

# Reset system audio permission (macOS 14+)
tccutil reset SystemAudioRecording "$BUNDLE_ID" 2>/dev/null || echo "   Could not reset System Audio (may need Full Disk Access or not available on this OS)"

# 3. Clear app cache and data
echo ""
echo "3️⃣  Clearing app cache and data..."

# Remove permission state file
PERMISSION_STATE="$HOME/Library/Application Support/$APP_NAME/permission-state.json"
if [ -f "$PERMISSION_STATE" ]; then
    rm -f "$PERMISSION_STATE"
    echo "   ✅ Removed permission state file"
else
    echo "   Permission state file not found"
fi

# Clear Electron cache
CACHE_DIR="$HOME/Library/Application Support/$APP_NAME/Cache"
if [ -d "$CACHE_DIR" ]; then
    rm -rf "$CACHE_DIR"
    echo "   ✅ Cleared Electron cache"
fi

# Clear code cache
CODE_CACHE_DIR="$HOME/Library/Application Support/$APP_NAME/Code Cache"
if [ -d "$CODE_CACHE_DIR" ]; then
    rm -rf "$CODE_CACHE_DIR"
    echo "   ✅ Cleared code cache"
fi

# Clear GPU cache
GPU_CACHE_DIR="$HOME/Library/Application Support/$APP_NAME/GPUCache"
if [ -d "$GPU_CACHE_DIR" ]; then
    rm -rf "$GPU_CACHE_DIR"
    echo "   ✅ Cleared GPU cache"
fi

# 4. Summary
echo ""
echo "✅ Reset complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Launch $APP_NAME"
echo "   2. You should see the permission dialog (first-time setup)"
echo "   3. Follow the UI to grant System Audio permission"
echo ""
echo "⚠️  If TCC reset failed (permission denied):"
echo "   Go to System Settings > Privacy & Security > Full Disk Access"
echo "   Add Terminal.app (or iTerm.app if using iTerm)"
echo "   Then run this script again"
echo ""
echo "🔍 Manual TCC reset (if script doesn't work):"
echo "   1. System Settings > Privacy & Security > Microphone"
echo "      - Remove $APP_NAME from the list"
echo "   2. System Settings > Privacy & Security > Screen Recording"
echo "      - Remove $APP_NAME from the list (if present)"
echo "   3. System Settings > Privacy & Security > System Audio"
echo "      - Remove $APP_NAME from the list (if present)"
echo ""
