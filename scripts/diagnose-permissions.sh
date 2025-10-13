#!/bin/bash

# Comprehensive CueMe Permission Diagnostic Tool
# Analyzes and fixes common permission issues

set -e

echo "🔍 CueMe Permission Diagnostic Tool"
echo "===================================="
echo ""

# Check if we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "❌ This diagnostic tool is only for macOS"
    exit 1
fi

# Get project directory
PROJECT_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
BINARY_PATH="$PROJECT_DIR/dist-native/SystemAudioCapture"
ELECTRON_APP="$PROJECT_DIR/node_modules/electron/dist/Electron.app"

echo "📋 System Information"
echo "-------------------"
echo "macOS Version: $(sw_vers -productVersion)"
echo "Architecture: $(uname -m)"
echo "User: $(whoami)"
echo ""

echo "🔍 Binary Analysis"
echo "-----------------"

# Check if SystemAudioCapture binary exists
if [[ -f "$BINARY_PATH" ]]; then
    echo "✅ SystemAudioCapture binary found"
    echo "   Location: $BINARY_PATH"
    echo "   Size: $(ls -lh "$BINARY_PATH" | awk '{print $5}')"
    echo "   Permissions: $(ls -l "$BINARY_PATH" | awk '{print $1}')"
    
    # Check binary signature
    echo ""
    echo "🔏 Binary Signature:"
    if codesign -dv "$BINARY_PATH" 2>&1; then
        echo ""
        
        # Test binary functionality
        echo "🧪 Binary Functionality Test:"
        if timeout 5s "$BINARY_PATH" status > /tmp/cueme_status.json 2>&1; then
            echo "✅ Binary executes successfully"
            if cat /tmp/cueme_status.json | grep -q '"isAvailable":true'; then
                echo "✅ System audio capability detected"
            else
                echo "⚠️  System audio capability limited"
                echo "   Output: $(cat /tmp/cueme_status.json)"
            fi
        else
            echo "❌ Binary execution failed"
            echo "   This may indicate permission or signature issues"
        fi
        rm -f /tmp/cueme_status.json
    else
        echo "❌ Binary signature verification failed"
    fi
else
    echo "❌ SystemAudioCapture binary NOT found"
    echo "   Expected location: $BINARY_PATH"
    echo "   📝 Solution: Run 'npm run build:native' to build the binary"
fi

echo ""
echo "🔐 Electron Signature Analysis"
echo "-----------------------------"

if [[ -d "$ELECTRON_APP" ]]; then
    echo "✅ Electron app found: $ELECTRON_APP"
    echo ""
    echo "🔏 Electron Signature:"
    if codesign -dv "$ELECTRON_APP" 2>&1; then
        echo ""
        
        # Check if signature is stable
        ELECTRON_ID=$(codesign -dr- "$ELECTRON_APP" 2>&1 | grep "identifier" | cut -d'"' -f2)
        if [[ "$ELECTRON_ID" == "com.cueme.electron.dev" ]]; then
            echo "✅ Stable development signature detected"
            echo "   Identifier: $ELECTRON_ID"
        elif [[ "$ELECTRON_ID" == *"com.github.Electron"* ]]; then
            echo "⚠️  Default Electron signature (unstable for permissions)"
            echo "   Identifier: $ELECTRON_ID"
            echo "   📝 Solution: Run './scripts/sign-electron-dev.sh' for stable signature"
        else
            echo "❓ Custom signature detected"
            echo "   Identifier: $ELECTRON_ID"
        fi
    else
        echo "❌ Electron signature verification failed"
    fi
else
    echo "❌ Electron app NOT found"
    echo "   Expected location: $ELECTRON_APP"
    echo "   📝 Solution: Run 'npm install' to install Electron"
fi

echo ""
echo "🔒 macOS Permission Status"
echo "-------------------------"

# Check TCC database for screen recording permissions
echo "Screen Recording Permission:"
if command -v sqlite3 > /dev/null; then
    # Query TCC database for screen recording permissions
    TCC_DB="/Library/Application Support/com.apple.TCC/TCC.db"
    USER_TCC_DB="$HOME/Library/Application Support/com.apple.TCC/TCC.db"
    
    GRANTED_APPS=""
    
    # Check system TCC database
    if [[ -r "$TCC_DB" ]]; then
        GRANTED_APPS=$(sqlite3 "$TCC_DB" "SELECT client FROM access WHERE service='kTCCServiceScreenCapture' AND allowed=1;" 2>/dev/null || echo "")
    fi
    
    # Check user TCC database
    if [[ -r "$USER_TCC_DB" ]]; then
        USER_GRANTED=$(sqlite3 "$USER_TCC_DB" "SELECT client FROM access WHERE service='kTCCServiceScreenCapture' AND allowed=1;" 2>/dev/null || echo "")
        GRANTED_APPS="$GRANTED_APPS $USER_GRANTED"
    fi
    
    if [[ -n "$GRANTED_APPS" ]]; then
        echo "✅ Apps with Screen Recording permission:"
        for app in $GRANTED_APPS; do
            echo "   - $app"
        done
        
        # Check if our identifiers are present
        if echo "$GRANTED_APPS" | grep -q "com.cueme.electron.dev"; then
            echo "✅ CueMe development identifier found in TCC database"
        elif echo "$GRANTED_APPS" | grep -q "Electron"; then
            echo "⚠️  Electron found in TCC database (but may be unstable identifier)"
        else
            echo "❌ CueMe/Electron not found in TCC database"
        fi
    else
        echo "❌ No apps found with Screen Recording permission"
    fi
else
    echo "⚠️  Cannot check TCC database (sqlite3 not available)"
fi

# Check using system preferences API
echo ""
echo "System Preferences API Check:"
PERM_STATUS=$(osascript -e 'tell application "System Events" to get the authorization status of "screen recording"' 2>/dev/null || echo "unknown")
echo "Authorization status: $PERM_STATUS"

echo ""
echo "📊 Diagnostic Summary"
echo "-------------------"

ISSUES_FOUND=0
RECOMMENDATIONS=()

# Analyze findings and provide recommendations
if [[ ! -f "$BINARY_PATH" ]]; then
    echo "❌ Issue: SystemAudioCapture binary missing"
    RECOMMENDATIONS+=("Run: npm run build:native")
    ((ISSUES_FOUND++))
fi

if [[ ! -d "$ELECTRON_APP" ]]; then
    echo "❌ Issue: Electron not installed"
    RECOMMENDATIONS+=("Run: npm install")
    ((ISSUES_FOUND++))
fi

if [[ "$ELECTRON_ID" != "com.cueme.electron.dev" ]] && [[ -d "$ELECTRON_APP" ]]; then
    echo "⚠️  Issue: Electron has unstable signature"
    RECOMMENDATIONS+=("Run: ./scripts/sign-electron-dev.sh")
    ((ISSUES_FOUND++))
fi

if [[ -z "$GRANTED_APPS" ]] || ! echo "$GRANTED_APPS" | grep -q -E "(cueme|Electron)"; then
    echo "❌ Issue: Screen Recording permission not granted"
    RECOMMENDATIONS+=("Grant Screen Recording permission in System Settings")
    RECOMMENDATIONS+=("Look for 'CueMe', 'Electron', or 'com.cueme.electron.dev'")
    ((ISSUES_FOUND++))
fi

echo ""
if [[ $ISSUES_FOUND -eq 0 ]]; then
    echo "✅ No major issues detected!"
    echo "   If system audio still doesn't work:"
    echo "   1. Restart the CueMe app"
    echo "   2. Try toggling the permission off/on in System Settings"
    echo "   3. Use production build: ./scripts/run-production-for-audio.sh"
else
    echo "📝 Recommended Actions (in order):"
    for i in "${!RECOMMENDATIONS[@]}"; do
        echo "   $((i+1)). ${RECOMMENDATIONS[$i]}"
    done
    echo ""
    echo "🔄 After applying fixes, restart CueMe and test system audio"
fi

echo ""
echo "🛠️  Additional Tools:"
echo "   • Fix development signatures: ./scripts/sign-electron-dev.sh"
echo "   • Reset all permissions: ./scripts/nuclear-permission-reset.sh"
echo "   • Test with production build: ./scripts/run-production-for-audio.sh"
echo ""
echo "✅ Diagnostic complete!"