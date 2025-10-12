#!/bin/bash

# SystemAudioCapture Swift Build Script
# Builds the macOS ScreenCaptureKit-based system audio capture binary

set -e

echo "Building SystemAudioCapture Swift binary..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "Warning: SystemAudioCapture requires macOS for ScreenCaptureKit support"
    echo "Skipping Swift build on non-macOS platform"
    exit 0
fi

# Check Swift availability
if ! command -v swift &> /dev/null; then
    echo "Error: Swift compiler not found. Please install Xcode Command Line Tools:"
    echo "xcode-select --install"
    exit 1
fi

# Check macOS version (ScreenCaptureKit requires macOS 13+)
macos_version=$(sw_vers -productVersion)
macos_major=$(echo "$macos_version" | cut -d. -f1)
macos_minor=$(echo "$macos_version" | cut -d. -f2)

if [[ $macos_major -lt 13 ]]; then
    echo "Warning: ScreenCaptureKit requires macOS 13.0+, current version: $macos_version"
    echo "Building anyway for forward compatibility..."
fi

# Build directory
BUILD_DIR="$(pwd)"
OUTPUT_DIR="../../dist-native"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Build directory: $BUILD_DIR"
echo "Output directory: $OUTPUT_DIR"
echo "macOS version: $macos_version"

# Compile Swift binary
echo "Compiling SystemAudioCapture.swift..."

swiftc \
    -o SystemAudioCapture \
    -target arm64-apple-macos13.0 \
    -O \
    SystemAudioCapture.swift

# Copy to output directory
echo "Copying binary to $OUTPUT_DIR..."
cp SystemAudioCapture "$OUTPUT_DIR/"

# Set executable permissions
chmod +x "$OUTPUT_DIR/SystemAudioCapture"

# Code sign with entitlements
echo "Code signing binary with entitlements..."
if [[ -f "entitlements.plist" ]]; then
    codesign --force --sign - \
        --entitlements entitlements.plist \
        --timestamp \
        --deep \
        "$OUTPUT_DIR/SystemAudioCapture"
    
    if [[ $? -eq 0 ]]; then
        echo "✅ Binary code-signed successfully"
        # Verify the signature
        codesign -dv --entitlements - "$OUTPUT_DIR/SystemAudioCapture" 2>&1 | head -15
    else
        echo "⚠️  Code signing failed, but continuing..."
    fi
else
    echo "⚠️  entitlements.plist not found, skipping code signing"
fi

# Verify the binary
if [[ -f "$OUTPUT_DIR/SystemAudioCapture" ]]; then
    echo "✅ SystemAudioCapture binary built successfully"
    echo "Binary location: $OUTPUT_DIR/SystemAudioCapture"
    
    # Test basic functionality
    echo "Testing binary..."
    if "$OUTPUT_DIR/SystemAudioCapture" status > /dev/null 2>&1; then
        echo "✅ Binary test passed"
    else
        echo "⚠️  Binary test failed (this may be normal if permissions not granted)"
    fi
else
    echo "❌ Build failed: binary not found"
    exit 1
fi

echo "Build completed successfully!"