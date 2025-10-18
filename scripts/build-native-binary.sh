#!/bin/bash

# Build native Swift binary for system audio capture
# This script compiles the SystemAudioCapture Swift binary and places it in dist-native/

set -e  # Exit on error

echo "🔨 Building native Swift binary for system audio capture..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NATIVE_DIR="$PROJECT_ROOT/native"
OUTPUT_DIR="$PROJECT_ROOT/dist-native"

echo "📂 Project root: $PROJECT_ROOT"
echo "📂 Native source: $NATIVE_DIR"
echo "📂 Output directory: $OUTPUT_DIR"

# Check if Swift is available
if ! command -v swift &> /dev/null; then
    echo "❌ Error: Swift compiler not found"
    echo "   Please install Xcode Command Line Tools:"
    echo "   xcode-select --install"
    exit 1
fi

echo "✅ Swift compiler found: $(swift --version | head -n 1)"

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo "✅ Created output directory: $OUTPUT_DIR"

# Build the Swift binary using swiftc directly
echo "🔨 Compiling Swift binary with swiftc..."

# Create temp directory for architecture-specific builds
TEMP_DIR="$OUTPUT_DIR/temp"
mkdir -p "$TEMP_DIR"

# Build for ARM64
echo "  Building for arm64..."
swiftc \
    -O \
    -target arm64-apple-macos13.0 \
    -framework Foundation \
    -framework ScreenCaptureKit \
    -framework AVFoundation \
    -framework CoreAudio \
    "$NATIVE_DIR/SystemAudioCapture.swift" \
    -o "$TEMP_DIR/SystemAudioCapture-arm64"

if [ ! -f "$TEMP_DIR/SystemAudioCapture-arm64" ]; then
    echo "❌ Error: ARM64 binary build failed"
    exit 1
fi
echo "  ✅ ARM64 binary built"

# Build for x86_64
echo "  Building for x86_64..."
swiftc \
    -O \
    -target x86_64-apple-macos13.0 \
    -framework Foundation \
    -framework ScreenCaptureKit \
    -framework AVFoundation \
    -framework CoreAudio \
    "$NATIVE_DIR/SystemAudioCapture.swift" \
    -o "$TEMP_DIR/SystemAudioCapture-x86_64"

if [ ! -f "$TEMP_DIR/SystemAudioCapture-x86_64" ]; then
    echo "❌ Error: x86_64 binary build failed"
    exit 1
fi
echo "  ✅ x86_64 binary built"

# Create universal binary using lipo
echo "  Creating universal binary..."
lipo -create \
    "$TEMP_DIR/SystemAudioCapture-arm64" \
    "$TEMP_DIR/SystemAudioCapture-x86_64" \
    -output "$OUTPUT_DIR/SystemAudioCapture"

if [ ! -f "$OUTPUT_DIR/SystemAudioCapture" ]; then
    echo "❌ Error: Failed to create universal binary"
    exit 1
fi

echo "✅ Universal binary created successfully"

# Clean up temp files
rm -rf "$TEMP_DIR"

# Make executable
chmod +x "$OUTPUT_DIR/SystemAudioCapture"

echo "✅ Binary copied to: $OUTPUT_DIR/SystemAudioCapture"

# Verify the binary
if [ -f "$OUTPUT_DIR/SystemAudioCapture" ]; then
    BINARY_SIZE=$(du -h "$OUTPUT_DIR/SystemAudioCapture" | cut -f1)
    echo "✅ Binary size: $BINARY_SIZE"
    echo "✅ Binary permissions: $(ls -l "$OUTPUT_DIR/SystemAudioCapture" | awk '{print $1}')"
    
    # Check architectures
    echo "🔍 Binary architectures:"
    lipo -info "$OUTPUT_DIR/SystemAudioCapture" || echo "   (lipo not available)"
    
    echo ""
    echo "✅ Native binary build complete!"
else
    echo "❌ Error: Binary not found in output directory"
    exit 1
fi
