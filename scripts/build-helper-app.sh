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

# NOTE: Code signing is intentionally SKIPPED here!
# Reason: In GitHub Actions, CSC_NAME is not available during the build phase.
# electron-builder extracts the signing certificate later, so we sign in afterPack.js instead.
# This ensures the helper app gets signed with the CORRECT entitlements.

echo ""
echo "📦 Helper app bundle created successfully (unsigned)"
echo "   Location: $HELPER_APP"
echo "   Size: $(du -sh "$HELPER_APP" | awk '{print $1}')"
echo ""
echo "⚠️  Note: Helper app will be signed in afterPack.js with correct entitlements"
echo "   Entitlements file: $ENTITLEMENTS"
echo ""
echo -e "${GREEN}✅ AudioTeeHelper.app built successfully (will be signed during packaging)!${NC}"
