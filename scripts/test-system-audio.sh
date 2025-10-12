#!/bin/bash

# System Audio Diagnostic Script
# Tests and diagnoses system audio capture issues

echo "🔍 System Audio Capture Diagnostic Tool"
echo "========================================"
echo ""

# Test 1: Check macOS version
echo "1. Checking macOS version..."
MACOS_VERSION=$(sw_vers -productVersion)
MACOS_MAJOR=$(echo "$MACOS_VERSION" | cut -d. -f1)
echo "   macOS version: $MACOS_VERSION"

if [[ $MACOS_MAJOR -lt 13 ]]; then
    echo "   ⚠️  WARNING: ScreenCaptureKit requires macOS 13.0+, you have $MACOS_VERSION"
else
    echo "   ✅ macOS version compatible"
fi
echo ""

# Test 2: Check binary exists
echo "2. Checking SystemAudioCapture binary..."
if [[ -f "./dist-native/SystemAudioCapture" ]]; then
    echo "   ✅ Binary exists at: ./dist-native/SystemAudioCapture"
    ls -lh ./dist-native/SystemAudioCapture
else
    echo "   ❌ Binary not found!"
    exit 1
fi
echo ""

# Test 3: Check permissions via binary
echo "3. Testing permission status..."
PERM_OUTPUT=$(./dist-native/SystemAudioCapture permissions 2>&1)
echo "   Output: $PERM_OUTPUT"

if echo "$PERM_OUTPUT" | grep -q '"granted":true'; then
    echo "   ✅ Permissions appear granted"
else
    echo "   ❌ Permissions NOT granted"
    echo ""
    echo "   📝 To fix:"
    echo "   1. Open System Settings"
    echo "   2. Go to Privacy & Security → Screen Recording"
    echo "   3. Enable permission for Electron/CueMe"
    echo "   4. Restart the app"
fi
echo ""

# Test 4: Check Screen Recording permission status via system
echo "4. Checking macOS Screen Recording permission..."
if command -v tccutil &> /dev/null; then
    echo "   Checking TCC database..."
    # This requires Full Disk Access to query, so may fail
    tccutil reset ScreenCapture 2>/dev/null && echo "   (Permissions reset - will ask again)" || echo "   (Cannot reset - requires Full Disk Access)"
fi
echo ""

# Test 5: Try to start streaming
echo "5. Testing audio stream start (will run for 2 seconds)..."
./dist-native/SystemAudioCapture start-stream 2>&1 &
STREAM_PID=$!
sleep 2

# Check if process is still running
if ps -p $STREAM_PID > /dev/null; then
    echo "   ✅ Stream process running"
    kill $STREAM_PID 2>/dev/null
    wait $STREAM_PID 2>/dev/null
else
    echo "   ❌ Stream process died immediately"
    echo "   This usually means permission was denied by macOS"
fi
echo ""

# Test 6: Check for error messages
echo "6. Running stream with error capture..."
STREAM_OUTPUT=$(./dist-native/SystemAudioCapture start-stream 2>&1 &
SPID=$!
sleep 1
kill $SPID 2>/dev/null
wait $SPID 2>/dev/null)

if echo "$STREAM_OUTPUT" | grep -qi "error"; then
    echo "   ❌ Errors detected:"
    echo "$STREAM_OUTPUT" | grep -i "error"
elif echo "$STREAM_OUTPUT" | grep -q "READY"; then
    echo "   ✅ Stream started successfully"
else
    echo "   ⚠️  Unclear status, output:"
    echo "$STREAM_OUTPUT" | head -5
fi
echo ""

echo "========================================"
echo "📋 Summary & Recommendations:"
echo ""
echo "If you see permission errors:"
echo "  1. Open: System Settings → Privacy & Security → Screen Recording"
echo "  2. Find 'Electron' or add it manually from:"
echo "     /Users/kotan/CueMeFinal-1/node_modules/electron/dist/Electron.app"
echo "  3. Enable the toggle"
echo "  4. COMPLETELY QUIT and restart CueMe"
echo ""
echo "If errors persist:"
echo "  - Try: tccutil reset ScreenCapture"
echo "  - Restart your Mac"
echo "  - Check Console.app for detailed system logs"
echo ""
echo "For immediate testing, use microphone instead of system audio"
echo "========================================"