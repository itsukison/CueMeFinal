#!/bin/bash

# Build script for SystemAudioCapture Swift binary
# This script compiles the Swift binary that uses ScreenCaptureKit for system audio capture

set -e

echo "🚀 Building SystemAudioCapture Swift binary..."

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Build directory
BUILD_DIR="$PROJECT_DIR/dist-native"
NATIVE_DIR="$PROJECT_DIR/native-modules/system-audio"

# Create build directory
mkdir -p "$BUILD_DIR"

# Check if we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "⚠️  SystemAudioCapture can only be built on macOS"
    echo "   Creating placeholder binary for other platforms..."
    
    # Create a simple placeholder script
    cat > "$BUILD_DIR/SystemAudioCapture" << 'EOF'
#!/bin/bash
echo '{"type": "error", "message": "SystemAudioCapture is only supported on macOS"}'
exit 1
EOF
    chmod +x "$BUILD_DIR/SystemAudioCapture"
    echo "✅ Placeholder binary created"
    exit 0
fi

# Check if Swift source exists
if [[ ! -f "$NATIVE_DIR/SystemAudioCapture.swift" ]]; then
    echo "❌ Swift source not found at $NATIVE_DIR/SystemAudioCapture.swift"
    echo "   Please ensure the native module is properly set up"
    exit 1
fi

# Change to native directory and run the build script
cd "$NATIVE_DIR"

echo "📋 Using Swift source from: $NATIVE_DIR"
echo "📋 Output directory: $BUILD_DIR"

# Execute the native module's build script
if [[ -x "./build.sh" ]]; then
    echo "🔨 Running native module build script..."
    ./build.sh
else
    echo "❌ Build script not found or not executable at $NATIVE_DIR/build.sh"
    exit 1
fi

# Verify the binary was created
if [[ -f "$BUILD_DIR/SystemAudioCapture" ]]; then
    echo "✅ SystemAudioCapture binary built successfully"
    echo "   Binary location: $BUILD_DIR/SystemAudioCapture"
    
    # Test basic functionality
    echo "🧪 Testing binary..."
    if "$BUILD_DIR/SystemAudioCapture" status > /dev/null 2>&1; then
        echo "✅ Binary test passed"
    else
        echo "⚠️  Binary test failed (this may be normal if permissions not granted)"
    fi
else
    echo "❌ Build failed: SystemAudioCapture binary not found"
    exit 1
fi

echo "🎉 Build complete!"
echo "   Ready for Electron integration"