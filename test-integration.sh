#!/bin/bash

# Test script for SystemAudioCapture integration
# Tests the complete pipeline from Swift binary to CueMe integration

set -e

echo "🧪 Testing SystemAudioCapture Integration"
echo "========================================="

# Test 1: Swift Binary Basic Functionality
echo ""
echo "Test 1: Swift Binary Commands"
echo "------------------------------"

echo "Testing status command..."
STATUS_OUTPUT=$(./dist-native/SystemAudioCapture status)
echo "✅ Status: $STATUS_OUTPUT"

echo "Testing permissions command..."
PERMISSION_OUTPUT=$(./dist-native/SystemAudioCapture permissions)
echo "✅ Permissions: $PERMISSION_OUTPUT"

# Test 2: Build Process
echo ""
echo "Test 2: Build Process"
echo "---------------------"

echo "Testing native build script..."
./scripts/build-native.sh > /dev/null 2>&1
if [[ -f "./dist-native/SystemAudioCapture" ]]; then
    echo "✅ Build script creates binary successfully"
else
    echo "❌ Build script failed to create binary"
    exit 1
fi

# Test 3: CueMe Build Integration
echo ""
echo "Test 3: CueMe Build Integration"
echo "-------------------------------"

echo "Testing full CueMe build..."
npm run build > /dev/null 2>&1
if [[ $? -eq 0 ]]; then
    echo "✅ CueMe builds successfully with integration"
else
    echo "❌ CueMe build failed"
    exit 1
fi

# Test 4: Binary Packaging
echo ""
echo "Test 4: Binary Packaging"
echo "------------------------"

if [[ -f "./dist-electron/main.js" ]] && [[ -f "./dist-native/SystemAudioCapture" ]]; then
    echo "✅ Both Electron main.js and SystemAudioCapture binary exist"
else
    echo "❌ Missing required files after build"
    exit 1
fi

# Test 5: File Permissions
echo ""
echo "Test 5: File Permissions"
echo "------------------------"

if [[ -x "./dist-native/SystemAudioCapture" ]]; then
    echo "✅ SystemAudioCapture binary is executable"
else
    echo "❌ SystemAudioCapture binary is not executable"
    exit 1
fi

echo ""
echo "🎉 All Integration Tests Passed!"
echo "================================="
echo ""
echo "Summary:"
echo "- ✅ Swift binary commands work correctly"
echo "- ✅ Build process integrates Swift compilation"
echo "- ✅ CueMe builds successfully with new system audio"
echo "- ✅ All required files are packaged correctly"
echo "- ✅ File permissions are set correctly"
echo ""
echo "The SystemAudioCapture integration is ready for production use!"
echo "Next: Start CueMe and test the audio capture functionality in the UI."