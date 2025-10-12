#!/bin/bash

# System Audio Permission Diagnostic Tool
# Comprehensive analysis of CueMe system audio permission status

echo "🔍 CueMe System Audio Permission Diagnostic"
echo "==========================================="
echo ""

# Function to check command availability
check_command() {
    if command -v "$1" &> /dev/null; then
        echo "✅ $1 available"
        return 0
    else
        echo "❌ $1 not available"
        return 1
    fi
}

# Function to safe execute with timeout
safe_exec() {
    local timeout_duration="$1"
    shift
    timeout "$timeout_duration" "$@" 2>/dev/null || echo "Command timed out or failed"
}

# 1. System Information
echo "1. System Information"
echo "====================="
echo "macOS Version: $(sw_vers -productVersion)"
echo "Hardware: $(uname -m)"
echo "User: $(whoami)"
echo "Current Directory: $(pwd)"
echo ""

# 2. Application Status
echo "2. Application Status"
echo "==================="

# Check if CueMe is running
if pgrep -f "CueMe" > /dev/null; then
    echo "✅ CueMe process is running"
    echo "   PIDs: $(pgrep -f "CueMe" | tr '\n' ' ')"
else
    echo "❌ CueMe process not running"
fi

# Check for Electron processes
if pgrep -f "Electron" > /dev/null; then
    echo "✅ Electron process is running"
    echo "   PIDs: $(pgrep -f "Electron" | tr '\n' ' ')"
else
    echo "❌ Electron process not running"
fi

# Check for SystemAudioCapture
if pgrep -f "SystemAudioCapture" > /dev/null; then
    echo "✅ SystemAudioCapture process is running"
    echo "   PIDs: $(pgrep -f "SystemAudioCapture" | tr '\n' ' ')"
else
    echo "❌ SystemAudioCapture process not running"
fi
echo ""

# 3. Binary Status
echo "3. Binary Status"
echo "================"

# Check development binary
DEV_BINARY="./dist-native/SystemAudioCapture"
if [ -f "$DEV_BINARY" ]; then
    echo "✅ Development binary exists: $DEV_BINARY"
    echo "   Size: $(ls -lh "$DEV_BINARY" | awk '{print $5}')"
    echo "   Permissions: $(ls -l "$DEV_BINARY" | awk '{print $1}')"
    
    # Check signature
    echo "   Signature:"
    safe_exec 3s codesign -dv "$DEV_BINARY" 2>&1 | head -3 | sed 's/^/     /'
    
    # Test execution
    echo "   Execution test:"
    if safe_exec 3s "$DEV_BINARY" --help >/dev/null 2>&1; then
        echo "     ✅ Binary is executable"
    else
        echo "     ❌ Binary execution failed"
    fi
else
    echo "❌ Development binary not found: $DEV_BINARY"
fi

# Check production app binary
PROD_APP="/Applications/CueMe.app"
PROD_BINARY="$PROD_APP/Contents/Resources/dist-native/SystemAudioCapture"
if [ -f "$PROD_BINARY" ]; then
    echo "✅ Production binary exists: $PROD_BINARY"
    echo "   Size: $(ls -lh "$PROD_BINARY" | awk '{print $5}')"
    echo "   Signature:"
    safe_exec 3s codesign -dv "$PROD_BINARY" 2>&1 | head -3 | sed 's/^/     /'
elif [ -d "$PROD_APP" ]; then
    echo "⚠️  Production app exists but binary not found: $PROD_BINARY"
else
    echo "❌ Production app not installed: $PROD_APP"
fi

# Check build binary
BUILD_BINARY="./dist/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture"
if [ -f "$BUILD_BINARY" ]; then
    echo "✅ Build binary exists: $BUILD_BINARY"
    echo "   Size: $(ls -lh "$BUILD_BINARY" | awk '{print $5}')"
    echo "   Signature:"
    safe_exec 3s codesign -dv "$BUILD_BINARY" 2>&1 | head -3 | sed 's/^/     /'
else
    echo "❌ Build binary not found: $BUILD_BINARY"
fi
echo ""

# 4. TCC Permission Status
echo "4. TCC Permission Status"
echo "========================"

# Check if tccutil is available
if check_command tccutil; then
    # Try to query TCC database (requires Full Disk Access)
    echo "Attempting to query TCC database..."
    if tccutil list 2>/dev/null | grep -q "ScreenCapture"; then
        echo "✅ Can query TCC database"
        echo "Screen Recording permissions:"
        tccutil list | grep "ScreenCapture" | head -5 | sed 's/^/   /'
    else
        echo "❌ Cannot query TCC database (requires Full Disk Access)"
    fi
else
    echo "❌ tccutil not available"
fi

# Check system preferences access
echo ""
echo "Testing System Preferences access..."
if open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture" 2>/dev/null; then
    echo "✅ Can open System Preferences"
    sleep 1
    osascript -e 'tell application "System Preferences" to quit' 2>/dev/null
else
    echo "❌ Cannot open System Preferences"
fi
echo ""

# 5. Process Analysis
echo "5. Process Analysis"
echo "=================="

# Check tccd daemon
if pgrep tccd > /dev/null; then
    echo "✅ TCC daemon (tccd) is running"
    echo "   PID: $(pgrep tccd)"
else
    echo "❌ TCC daemon (tccd) not running"
fi

# Check for permission dialogs
if pgrep -f "UserNotificationCenter" > /dev/null; then
    echo "⚠️  UserNotificationCenter running (may have pending dialogs)"
else
    echo "✅ No UserNotificationCenter processes"
fi

# Check for System Preferences
if pgrep -f "System Preferences" > /dev/null; then
    echo "⚠️  System Preferences is running"
else
    echo "✅ System Preferences not running"
fi
echo ""

# 6. Console Log Analysis
echo "6. Recent Console Log Analysis"
echo "============================="
echo "Checking for recent TCC and ScreenCaptureKit errors..."

# Check last 50 system log entries for relevant errors
log show --last 5m --predicate 'process == "tccd" OR process == "CueMe" OR process == "SystemAudioCapture"' --style compact 2>/dev/null | tail -10 | sed 's/^/   /' || echo "   No recent relevant log entries found"
echo ""

# 7. Recommendations
echo "7. Diagnostic Summary & Recommendations"
echo "======================================"

ISSUES_FOUND=0

# Check for common issues
if [ ! -f "$DEV_BINARY" ] && [ ! -f "$PROD_BINARY" ]; then
    echo "❌ CRITICAL: No SystemAudioCapture binary found"
    echo "   → Run: npm run build:swift"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if ! pgrep tccd > /dev/null; then
    echo "❌ CRITICAL: TCC daemon not running"
    echo "   → Restart macOS"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if pgrep -f "CueMe" > /dev/null && pgrep -f "SystemAudioCapture" > /dev/null; then
    echo "⚠️  WARNING: Both CueMe and SystemAudioCapture running"
    echo "   → This might indicate permission issues"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo "✅ No critical issues detected"
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "1. Run: ./scripts/fix-system-audio-now.sh"
    echo "2. Or try: ./scripts/build-production-fix.sh"
    echo "3. Check CueMe app for system audio button status"
else
    echo ""
    echo "🚨 $ISSUES_FOUND critical issues found - fix these first!"
fi

echo ""
echo "📊 Full diagnostic complete. Save this output if you need support!"
echo ""