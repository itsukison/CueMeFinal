#!/bin/bash

# Emergency System Audio Fix Script
# This script will reset Screen Recording permissions and guide you through re-granting them

echo "🔧 Emergency System Audio Fix"
echo "=============================="
echo ""

# Step 1: Stop any running CueMe processes
echo "1. Stopping any running CueMe processes..."
pkill -f "CueMe" 2>/dev/null || true
pkill -f "Electron" 2>/dev/null || true
pkill -f "SystemAudioCapture" 2>/dev/null || true
sleep 2
echo "   ✅ Processes stopped"
echo ""

# Step 2: Reset Screen Recording permission
echo "2. Resetting Screen Recording permissions..."
if command -v tccutil &> /dev/null; then
    echo "   Attempting to reset Screen Recording permission..."
    if tccutil reset ScreenCapture 2>/dev/null; then
        echo "   ✅ Screen Recording permission reset successfully"
    else
        echo "   ⚠️  Permission reset failed (requires Full Disk Access)"
        echo "   Manual reset required - we'll guide you through it"
    fi
else
    echo "   ⚠️  tccutil not available, manual reset required"
fi
echo ""

# Step 3: Check current permissions
echo "3. Checking current permission status..."
echo "   Opening System Settings to Screen Recording..."
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
echo "   ✅ System Settings opened"
echo ""

# Step 4: Instructions
echo "🎯 MANUAL STEPS REQUIRED:"
echo "========================"
echo ""
echo "1. In the System Settings window that just opened:"
echo "   → Privacy & Security → Screen Recording"
echo ""
echo "2. REMOVE any existing entries for:"
echo "   • CueMe"
echo "   • Electron" 
echo "   • Any development versions"
echo ""
echo "3. Click the (+) button to add a new app"
echo ""
echo "4. Navigate to and select ONE of these apps:"
echo "   OPTION A (Development): /Users/kotan/CueMeFinal-1/node_modules/electron/dist/Electron.app"
echo "   OPTION B (Production):  /Applications/CueMe.app"
echo "   (Choose based on which version you're using)"
echo ""
echo "5. Enable the toggle next to the app"
echo ""
echo "6. COMPLETELY QUIT CueMe (Cmd+Q, don't just close window)"
echo ""
echo "7. Re-launch CueMe"
echo ""
echo "8. Try system audio - it should work immediately!"
echo ""

# Step 5: Wait for user confirmation
echo "Press ENTER when you've completed the manual steps above..."
read -r

# Step 6: Test system audio
echo ""
echo "🧪 Testing system audio..."
echo "=========================="

if [ -f "./dist-native/SystemAudioCapture" ]; then
    echo "Testing SystemAudioCapture binary..."
    timeout 3s ./dist-native/SystemAudioCapture permissions 2>&1 | head -5
    echo ""
    
    echo "Testing stream start (3 second test)..."
    timeout 3s ./dist-native/SystemAudioCapture start-stream 2>&1 | head -10
    echo ""
else
    echo "⚠️  SystemAudioCapture binary not found"
    echo "   You may need to build the project first: npm run build:swift"
fi

echo ""
echo "🎉 NEXT STEPS:"
echo "=============="
echo "1. Launch CueMe"
echo "2. Click 'System Audio' button"
echo "3. If it works: 🎉 SUCCESS!"
echo "4. If it still fails: Try SOLUTION 2 (Production Build)"
echo ""
echo "📞 If you need help: Check the console logs and report back!"
echo ""