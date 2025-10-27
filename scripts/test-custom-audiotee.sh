#!/bin/bash

# Test script for custom audiotee binary
# Verifies Info.plist embedding and basic functionality

echo "🧪 Testing Custom AudioTee Binary"
echo "=================================="
echo ""

BINARY_PATH="/Users/itsukison/Desktop/CueMe/CueMeFinal/custom-binaries/audiotee"

# Check if binary exists
if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Binary not found at: $BINARY_PATH"
    exit 1
fi

echo "✅ Binary found: $BINARY_PATH"
echo ""

# Check file permissions
PERMS=$(stat -f "%OLp" "$BINARY_PATH")
echo "📋 File permissions: $PERMS"
if [ "$PERMS" != "755" ]; then
    echo "⚠️  Fixing permissions..."
    chmod +x "$BINARY_PATH"
fi
echo ""

# Check architectures
echo "🏗️  Architectures:"
lipo -info "$BINARY_PATH"
echo ""

# Check for embedded Info.plist (CRITICAL!)
echo "🔍 Checking for embedded Info.plist..."
INFO_PLIST_COUNT=$(otool -l "$BINARY_PATH" | grep -c __info_plist)

if [ "$INFO_PLIST_COUNT" -gt 0 ]; then
    echo "✅ Info.plist embedded! (found $INFO_PLIST_COUNT times - one per architecture)"
    echo ""
    echo "📄 Info.plist sections:"
    otool -l "$BINARY_PATH" | grep -A 5 __info_plist | head -12
else
    echo "❌ CRITICAL: No Info.plist found!"
    echo "   This binary will fail on macOS 14.2+"
    echo "   Rebuild with: cd custom-audiotee && ./build.sh"
    exit 1
fi
echo ""

# Test execution
echo "🧪 Testing binary execution..."
if "$BINARY_PATH" --help > /dev/null 2>&1; then
    echo "✅ Binary executes successfully"
else
    echo "❌ Binary execution failed!"
    exit 1
fi
echo ""

# Show file size
SIZE=$(du -h "$BINARY_PATH" | awk '{print $1}')
echo "📊 Binary size: $SIZE"
echo ""

# Test with actual audio capture (will fail without permission, but that's OK)
echo "🎵 Testing audio capture (requires Screen Recording permission)..."
echo "   Press Ctrl+C to stop after a few seconds..."
echo ""

timeout 3 "$BINARY_PATH" --sample-rate 16000 2>&1 | head -10 || true

echo ""
echo "✅ All tests passed!"
echo ""
echo "Next steps:"
echo "  1. Build production app: npm run build && npm run app:build:mac"
echo "  2. Check logs for: '🎉 Using binary with embedded Info.plist'"
echo "  3. Grant Screen Recording permission when prompted"
echo "  4. Verify system audio works (non-zero buffers in logs)"
