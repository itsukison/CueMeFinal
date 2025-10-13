#!/bin/bash

# CI Validation Script for SystemAudioCapture Binary
# Ensures Info.plist with NSAudioCaptureUsageDescription is embedded
# Exit code 0 = success, 1 = failure (blocks CI)

set -e

echo "🔍 CI: Validating SystemAudioCapture binary for production deployment..."

# Determine binary path based on build stage
if [[ -f "./dist-native/SystemAudioCapture" ]]; then
    BINARY_PATH="./dist-native/SystemAudioCapture"
elif [[ -f "./release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture" ]]; then
    BINARY_PATH="./release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture"
elif [[ -f "./release/mac-arm64/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture" ]]; then
    BINARY_PATH="./release/mac-arm64/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture"
else
    echo "❌ CI FAILED: SystemAudioCapture binary not found"
    echo "   Expected paths:"
    echo "   - ./dist-native/SystemAudioCapture"
    echo "   - ./release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture"
    exit 1
fi

echo "📦 Found binary at: $BINARY_PATH"

# 1. Check binary exists and is executable
if [[ ! -f "$BINARY_PATH" ]]; then
    echo "❌ CI FAILED: Binary file not found"
    exit 1
fi

if [[ ! -x "$BINARY_PATH" ]]; then
    echo "❌ CI FAILED: Binary is not executable (permissions: $(stat -f '%Lp' "$BINARY_PATH"))"
    exit 1
fi

echo "✅ Binary exists and is executable"

# 2. CRITICAL: Check Info.plist is embedded
echo "🔍 Checking for embedded Info.plist..."
if ! otool -s __TEXT __info_plist "$BINARY_PATH" > /dev/null 2>&1; then
    echo "❌ CI FAILED: Info.plist NOT embedded in binary"
    echo "   This is CRITICAL for macOS 14.2+ compatibility"
    echo "   Fix: Check native-modules/system-audio/build.sh"
    exit 1
fi

echo "✅ Info.plist is embedded"

# 3. CRITICAL: Verify NSAudioCaptureUsageDescription key exists
echo "🔍 Verifying NSAudioCaptureUsageDescription key..."

# Extract Info.plist section and check for the key
PLIST_CONTENT=$(otool -s __TEXT __info_plist "$BINARY_PATH" 2>&1 || true)

if echo "$PLIST_CONTENT" | grep -q "NSAudioCaptureUsageDescription"; then
    echo "✅ NSAudioCaptureUsageDescription key present"
else
    echo "❌ CI FAILED: NSAudioCaptureUsageDescription NOT found in Info.plist"
    echo "   This key is REQUIRED for macOS 14.2+ system audio capture"
    echo "   Fix: Add the key to native-modules/system-audio/Info.plist"
    exit 1
fi

# 4. Verify code signature (warning only, not blocking)
echo "🔍 Checking code signature..."
if codesign --verify --deep --strict "$BINARY_PATH" 2>&1; then
    echo "✅ Code signature is valid"
else
    echo "⚠️  Code signature invalid or missing (may be normal for development builds)"
fi

# 5. Test binary execution (status command)
echo "🧪 Testing binary execution..."
if "$BINARY_PATH" status > /dev/null 2>&1; then
    echo "✅ Binary executes successfully"
else
    echo "⚠️  Binary test inconclusive (permission may be required)"
fi

# 6. Test selftest mode (should work without permissions)
echo "🧪 Testing selftest mode..."
if "$BINARY_PATH" --selftest > /dev/null 2>&1; then
    echo "✅ Selftest mode works"
else
    echo "❌ CI FAILED: Selftest mode should work without permissions"
    exit 1
fi

echo ""
echo "✅ ✅ ✅ CI VALIDATION PASSED ✅ ✅ ✅"
echo ""
echo "Binary is ready for production deployment with:"
echo "  - Embedded Info.plist ✓"
echo "  - NSAudioCaptureUsageDescription key ✓"
echo "  - Executable permissions ✓"
echo "  - Basic functionality ✓"
echo ""

exit 0
