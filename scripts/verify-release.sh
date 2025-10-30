#!/bin/bash

# v1.0.100 Release Verification Script
# Run this AFTER downloading the release from GitHub

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 CueMe v1.0.100 Release Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

APP_PATH="/Applications/CueMe.app"
HELPER_PATH="$APP_PATH/Contents/Resources/Library/LoginItems/AudioTeeHelper.app"
HELPER_BINARY="$HELPER_PATH/Contents/MacOS/audiotee"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# Check 1: App exists
echo "1️⃣ Checking if CueMe.app is installed..."
if [ -d "$APP_PATH" ]; then
    echo -e "${GREEN}✅ CueMe.app found${NC}"
else
    echo -e "${RED}❌ CueMe.app not found in /Applications/${NC}"
    echo "   Please install the app first"
    exit 1
fi

# Check 2: Helper app exists
echo ""
echo "2️⃣ Checking if AudioTeeHelper.app exists..."
if [ -d "$HELPER_PATH" ]; then
    echo -e "${GREEN}✅ AudioTeeHelper.app found${NC}"
else
    echo -e "${RED}❌ AudioTeeHelper.app not found${NC}"
    echo "   Expected at: $HELPER_PATH"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: Helper binary exists
echo ""
echo "3️⃣ Checking if audiotee binary exists..."
if [ -f "$HELPER_BINARY" ]; then
    echo -e "${GREEN}✅ audiotee binary found${NC}"
else
    echo -e "${RED}❌ audiotee binary not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 4: Helper bundle ID
echo ""
echo "4️⃣ Verifying helper bundle ID..."
if [ -f "$HELPER_PATH/Contents/Info.plist" ]; then
    BUNDLE_ID=$(defaults read "$HELPER_PATH/Contents/Info.plist" CFBundleIdentifier 2>/dev/null)
    if [ "$BUNDLE_ID" = "com.cueme.audiotee-helper" ]; then
        echo -e "${GREEN}✅ Correct bundle ID: $BUNDLE_ID${NC}"
    else
        echo -e "${RED}❌ Wrong bundle ID: $BUNDLE_ID${NC}"
        echo "   Expected: com.cueme.audiotee-helper"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Info.plist not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 5: Code signature
echo ""
echo "5️⃣ Verifying code signature..."
if codesign --verify --deep --strict --verbose=2 "$HELPER_PATH" 2>&1 | grep -q "valid on disk"; then
    echo -e "${GREEN}✅ Helper app signature is valid${NC}"
else
    echo -e "${RED}❌ Helper app signature is invalid${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 6: Critical entitlements
echo ""
echo "6️⃣ Verifying critical entitlements..."

ENTITLEMENTS=$(codesign -d --entitlements - "$HELPER_PATH" 2>&1)

# Check screen-capture
if echo "$ENTITLEMENTS" | grep -q "com.apple.security.device.screen-capture"; then
    echo -e "${GREEN}✅ screen-capture entitlement present${NC}"
else
    echo -e "${RED}❌ CRITICAL: screen-capture entitlement MISSING!${NC}"
    echo "   System audio will NOT work without this!"
    ERRORS=$((ERRORS + 1))
fi

# Check app-sandbox
if echo "$ENTITLEMENTS" | grep -A 2 "com.apple.security.app-sandbox" | grep -q "false"; then
    echo -e "${GREEN}✅ app-sandbox disabled (required for Core Audio Taps)${NC}"
elif echo "$ENTITLEMENTS" | grep -A 2 "com.apple.security.app-sandbox" | grep -q "true"; then
    echo -e "${RED}❌ CRITICAL: app-sandbox is enabled (should be false)!${NC}"
    echo "   Core Audio Taps will be blocked!"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${YELLOW}⚠️  app-sandbox entitlement not found (may default to false)${NC}"
fi

# Check audio-input
if echo "$ENTITLEMENTS" | grep -q "com.apple.security.device.audio-input"; then
    echo -e "${GREEN}✅ audio-input entitlement present${NC}"
else
    echo -e "${YELLOW}⚠️  audio-input entitlement missing${NC}"
fi

# Check 7: Embedded Info.plist in binary
echo ""
echo "7️⃣ Verifying embedded Info.plist in binary..."
if otool -l "$HELPER_BINARY" 2>/dev/null | grep -q "__info_plist"; then
    echo -e "${GREEN}✅ Binary has embedded Info.plist${NC}"
else
    echo -e "${RED}❌ Binary missing embedded Info.plist${NC}"
    echo "   Required for Core Audio Taps on macOS 14.2+"
    ERRORS=$((ERRORS + 1))
fi

# Check 8: Screen Recording permission
echo ""
echo "8️⃣ Checking Screen Recording permission..."
echo ""

TCC_DB="$HOME/Library/Application Support/com.apple.TCC/TCC.db"

# Try to query TCC database (may require Full Disk Access)
HELPER_BUNDLE_ID="com.cueme.audiotee-helper"
PERMISSION_STATUS=$(sqlite3 "$TCC_DB" "SELECT allowed FROM access WHERE service='kTCCServiceScreenCapture' AND client='$HELPER_BUNDLE_ID';" 2>/dev/null)

if [ -z "$PERMISSION_STATUS" ]; then
    echo -e "${YELLOW}⚠️  AudioTeeHelper does NOT have Screen Recording permission${NC}"
    echo ""
    echo "   📋 To grant permission:"
    echo "   1. Open System Settings > Privacy & Security > Screen Recording"
    echo "   2. Click the '+' button"
    echo "   3. Press Cmd+Shift+G and paste this path:"
    echo "      $HELPER_PATH"
    echo "   4. Select AudioTeeHelper.app and click 'Open'"
    echo "   5. Enable the checkbox"
    echo "   6. Restart CueMe"
    echo ""
elif [ "$PERMISSION_STATUS" = "1" ]; then
    echo -e "${GREEN}✅ AudioTeeHelper has Screen Recording permission${NC}"
else
    echo -e "${RED}❌ AudioTeeHelper permission is denied${NC}"
    echo "   Please enable it in System Settings > Screen Recording"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
    echo ""
    echo "   The helper app is correctly built and signed."
    echo ""
    if [ -z "$PERMISSION_STATUS" ]; then
        echo "   Next step: Grant Screen Recording permission (see instructions above)"
    else
        echo "   You're ready to use system audio capture!"
    fi
else
    echo -e "${RED}❌ FOUND $ERRORS ERROR(S)${NC}"
    echo ""
    echo "   The helper app has issues that need to be fixed."
    echo "   Please rebuild and release a new version."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
