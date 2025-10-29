#!/bin/bash
set -e

echo "🧪 Testing AudioTeeHelper.app..."

# Find the built app
if [ -d "release/mac-arm64/CueMe.app" ]; then
    APP_PATH="release/mac-arm64/CueMe.app"
elif [ -d "release/mac/CueMe.app" ]; then
    APP_PATH="release/mac/CueMe.app"
else
    echo "❌ Built app not found in release/"
    exit 1
fi

HELPER_PATH="$APP_PATH/Contents/Library/LoginItems/AudioTeeHelper.app"

echo "📦 Testing helper at: $HELPER_PATH"

# Test 1: Helper app exists
if [ ! -d "$HELPER_PATH" ]; then
    echo "❌ Helper app not found!"
    exit 1
fi
echo "✅ Helper app exists"

# Test 2: Info.plist exists and has correct bundle ID
INFO_PLIST="$HELPER_PATH/Contents/Info.plist"
if [ ! -f "$INFO_PLIST" ]; then
    echo "❌ Info.plist not found!"
    exit 1
fi

BUNDLE_ID=$(defaults read "$INFO_PLIST" CFBundleIdentifier)
if [ "$BUNDLE_ID" != "com.cueme.audiotee-helper" ]; then
    echo "❌ Wrong bundle ID: $BUNDLE_ID"
    exit 1
fi
echo "✅ Info.plist correct (Bundle ID: $BUNDLE_ID)"

# Test 3: Binary exists and is executable
BINARY="$HELPER_PATH/Contents/MacOS/audiotee"
if [ ! -x "$BINARY" ]; then
    echo "❌ Binary not executable!"
    exit 1
fi
echo "✅ Binary is executable"

# Test 4: Code signature valid
if ! codesign --verify --deep --strict "$HELPER_PATH" 2>&1; then
    echo "❌ Code signature invalid!"
    exit 1
fi
echo "✅ Code signature valid"

# Test 5: Info.plist embedded in binary
if ! otool -l "$BINARY" | grep -q "__info_plist"; then
    echo "⚠️  Binary lacks embedded Info.plist (may still work)"
else
    echo "✅ Binary has embedded Info.plist"
fi

# Test 6: Check entitlements
echo ""
echo "📋 Entitlements:"
codesign --display --entitlements - "$HELPER_PATH" 2>&1 | grep -A 20 "<dict>"

echo ""
echo "✅ All tests passed!"
echo "📦 Helper app ready at: $HELPER_PATH"
