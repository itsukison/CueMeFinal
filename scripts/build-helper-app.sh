#!/bin/bash
set -e

echo "🔨 Building AudioTeeHelper.app..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HELPER_DIR="$PROJECT_ROOT/helper-apps/AudioTeeHelper"
CUSTOM_BINARY="$PROJECT_ROOT/custom-binaries/audiotee"

echo "📁 Project root: $PROJECT_ROOT"
echo "📁 Helper dir: $HELPER_DIR"

# Verify custom binary exists
if [ ! -f "$CUSTOM_BINARY" ]; then
    echo -e "${RED}❌ Custom audiotee binary not found!${NC}"
    echo "   Expected: $CUSTOM_BINARY"
    echo "   Run: npm run build:native"
    exit 1
fi

# Create helper app structure
echo "📦 Creating helper app bundle structure..."
HELPER_APP="$PROJECT_ROOT/dist-helper/AudioTeeHelper.app"
rm -rf "$HELPER_APP"
mkdir -p "$HELPER_APP/Contents/MacOS"
mkdir -p "$HELPER_APP/Contents/Resources"

# Copy binary
echo "📋 Copying audiotee binary..."
cp "$CUSTOM_BINARY" "$HELPER_APP/Contents/MacOS/audiotee"
chmod +x "$HELPER_APP/Contents/MacOS/audiotee"

# Copy Info.plist
echo "📋 Copying Info.plist..."
cp "$HELPER_DIR/Info.plist" "$HELPER_APP/Contents/Info.plist"

# Verify Info.plist is embedded in binary
echo "🔍 Verifying binary has embedded Info.plist..."
if otool -l "$HELPER_APP/Contents/MacOS/audiotee" | grep -q "__info_plist"; then
    echo -e "${GREEN}✅ Binary has embedded Info.plist${NC}"
else
    echo -e "${YELLOW}⚠️  Binary lacks embedded Info.plist${NC}"
    echo "   This may cause issues on macOS 14.2+"
fi

# Sign the helper app
echo "🔏 Code signing helper app..."
# Use CSC_NAME (electron-builder) or APPLE_IDENTITY (custom), fallback to auto-discovery
IDENTITY="${CSC_NAME:-${APPLE_IDENTITY:-}}"
ENTITLEMENTS="$HELPER_DIR/entitlements.plist"

if [ ! -f "$ENTITLEMENTS" ]; then
    echo -e "${RED}❌ Entitlements not found: $ENTITLEMENTS${NC}"
    exit 1
fi

# Check if we have a valid signing identity
if [ -z "$IDENTITY" ]; then
    # Try to find a valid Developer ID
    IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | awk -F'"' '{print $2}')
fi

if [ -z "$IDENTITY" ] || [ "$IDENTITY" = "Developer ID Application" ]; then
    echo -e "${YELLOW}⚠️  No valid signing identity found - using ad-hoc signing${NC}"
    echo "   This is OK for development, but production builds need proper signing"
    IDENTITY="-"
    
    # Ad-hoc sign the binary with deep option to prevent re-signing
    codesign --force --deep --sign "$IDENTITY" \
        --entitlements "$ENTITLEMENTS" \
        "$HELPER_APP/Contents/MacOS/audiotee"
    
    # Ad-hoc sign the app bundle
    codesign --force --deep --sign "$IDENTITY" \
        --entitlements "$ENTITLEMENTS" \
        "$HELPER_APP"
else
    echo -e "${GREEN}✅ Using signing identity: $IDENTITY${NC}"
    
    # CRITICAL: Sign with deep option and preserve entitlements
    # This prevents electron-builder from re-signing with wrong entitlements
    
    # Sign the binary first with full options
    codesign --force --deep --sign "$IDENTITY" \
        --options runtime \
        --entitlements "$ENTITLEMENTS" \
        --timestamp \
        "$HELPER_APP/Contents/MacOS/audiotee"
    
    # Then sign the app bundle with the same entitlements
    codesign --force --deep --sign "$IDENTITY" \
        --options runtime \
        --entitlements "$ENTITLEMENTS" \
        --timestamp \
        "$HELPER_APP"
fi

# Verify signature
echo "🔍 Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$HELPER_APP"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Signature verification failed${NC}"
    exit 1
fi

# CRITICAL: Verify entitlements are correct
echo "🔍 Verifying entitlements..."
codesign -d --entitlements - "$HELPER_APP" 2>&1 > /tmp/helper-entitlements.txt

if grep -q "com.apple.security.device.screen-capture" /tmp/helper-entitlements.txt; then
    echo -e "${GREEN}✅ screen-capture entitlement present${NC}"
else
    echo -e "${RED}❌ CRITICAL: screen-capture entitlement MISSING!${NC}"
    echo "   Helper will not be able to capture system audio"
    exit 1
fi

if grep -q "com.apple.security.app-sandbox" /tmp/helper-entitlements.txt; then
    # Check if it's set to false
    if grep -A 2 "com.apple.security.app-sandbox" /tmp/helper-entitlements.txt | grep -q "false"; then
        echo -e "${GREEN}✅ app-sandbox disabled (required for Core Audio Taps)${NC}"
    else
        echo -e "${RED}❌ CRITICAL: app-sandbox is enabled (should be false)!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  app-sandbox entitlement not found (may default to false)${NC}"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Helper app signed successfully${NC}"
else
    echo -e "${RED}❌ Signature verification failed${NC}"
    exit 1
fi

# Display info
echo ""
echo "📊 Helper App Information:"
echo "   Location: $HELPER_APP"
echo "   Size: $(du -sh "$HELPER_APP" | awk '{print $1}')"
echo ""
codesign -dv "$HELPER_APP" 2>&1 | head -10

echo ""
echo -e "${GREEN}✅ AudioTeeHelper.app built successfully!${NC}"
