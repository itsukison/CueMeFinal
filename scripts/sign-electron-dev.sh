#!/bin/bash

# Sign Electron development binary with stable identifier for consistent permissions
# This prevents TCC from treating each rebuild as a "new app"

set -e

echo "🔐 Signing Electron development binary with stable identifier..."

# Check if we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "⚠️  Code signing only available on macOS"
    exit 0
fi

# Get paths
PROJECT_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
ELECTRON_APP="$PROJECT_DIR/node_modules/electron/dist/Electron.app"

# Check if Electron app exists
if [[ ! -d "$ELECTRON_APP" ]]; then
    echo "❌ Electron.app not found at: $ELECTRON_APP"
    echo "   Please run 'npm install' first"
    exit 1
fi

echo "📍 Electron app location: $ELECTRON_APP"

# Sign with stable identifier
echo "🔏 Applying stable development signature..."

codesign --force --deep --sign - \
    --identifier "com.cueme.electron.dev" \
    --options runtime \
    "$ELECTRON_APP"

if [[ $? -eq 0 ]]; then
    echo "✅ Electron development binary signed with stable identifier"
    echo "   Identifier: com.cueme.electron.dev"
    echo "   This will prevent permission loss between development builds"
    
    # Verify the signature
    echo "🔍 Verifying signature..."
    codesign -dv "$ELECTRON_APP" 2>&1 | grep -E "(Identifier|Signature)"
    
    echo ""
    echo "📋 Next steps:"
    echo "   1. Grant Screen Recording permission if prompted"
    echo "   2. The permission should persist across development builds"
    echo "   3. Run this script again if permissions are lost"
    
else
    echo "❌ Failed to sign Electron binary"
    echo "   Development permissions may be unstable"
    exit 1
fi

echo ""
echo "✅ Development signature fix complete!"