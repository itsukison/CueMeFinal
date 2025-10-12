#!/bin/bash

# Nuclear Permission Reset - Use only if other solutions fail
# This script will completely reset TCC permissions (requires Full Disk Access)

echo "🚨 NUCLEAR PERMISSION RESET"
echo "============================"
echo ""
echo "⚠️  WARNING: This will reset ALL app permissions!"
echo "⚠️  You'll need to re-grant microphone, camera, etc. to ALL apps"
echo ""
echo "Only use this if:"
echo "• Other solutions failed"
echo "• You have Full Disk Access permission for Terminal"
echo "• You're comfortable re-granting permissions to all apps"
echo ""

# Ask for confirmation
read -p "Are you sure you want to continue? Type 'YES' to proceed: " confirmation
if [ "$confirmation" != "YES" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Proceeding with nuclear reset..."
echo ""

# 1. Stop all related processes
echo "1. Stopping related processes..."
sudo pkill -f "CueMe" 2>/dev/null || true
sudo pkill -f "Electron" 2>/dev/null || true
sudo pkill -f "SystemAudioCapture" 2>/dev/null || true
sleep 2
echo "   ✅ Processes stopped"
echo ""

# 2. Reset TCC database completely
echo "2. Resetting TCC database..."
if command -v tccutil &> /dev/null; then
    echo "   Resetting Screen Recording permissions..."
    sudo tccutil reset ScreenCapture 2>/dev/null && echo "   ✅ ScreenCapture reset" || echo "   ❌ ScreenCapture reset failed"
    
    echo "   Resetting Camera permissions..."
    sudo tccutil reset Camera 2>/dev/null && echo "   ✅ Camera reset" || echo "   ❌ Camera reset failed"
    
    echo "   Resetting Microphone permissions..."
    sudo tccutil reset Microphone 2>/dev/null && echo "   ✅ Microphone reset" || echo "   ❌ Microphone reset failed"
    
    echo "   Resetting System Events permissions..."
    sudo tccutil reset SystemPolicyAllFiles 2>/dev/null && echo "   ✅ SystemPolicyAllFiles reset" || echo "   ❌ SystemPolicyAllFiles reset failed"
else
    echo "   ❌ tccutil not available"
fi
echo ""

# 3. Clear TCC cache
echo "3. Clearing TCC cache..."
sudo rm -rf "/Library/Application Support/com.apple.TCC/"* 2>/dev/null && echo "   ✅ System TCC cache cleared" || echo "   ❌ System TCC cache clear failed"
rm -rf "~/Library/Application Support/com.apple.TCC/"* 2>/dev/null && echo "   ✅ User TCC cache cleared" || echo "   ❌ User TCC cache clear failed"
echo ""

# 4. Restart TCC daemon
echo "4. Restarting TCC daemon..."
sudo launchctl unload /System/Library/LaunchDaemons/com.apple.tccd.system.plist 2>/dev/null || true
sudo launchctl load /System/Library/LaunchDaemons/com.apple.tccd.system.plist 2>/dev/null || true
launchctl unload /System/Library/LaunchAgents/com.apple.tccd.plist 2>/dev/null || true
launchctl load /System/Library/LaunchAgents/com.apple.tccd.plist 2>/dev/null || true
sleep 3
echo "   ✅ TCC daemon restarted"
echo ""

# 5. Clean app-specific caches
echo "5. Cleaning app-specific caches..."
rm -rf ~/Library/Caches/com.cueme.interview-assistant* 2>/dev/null && echo "   ✅ CueMe cache cleared" || echo "   ❌ CueMe cache clear failed"
rm -rf ~/Library/Preferences/com.cueme.interview-assistant* 2>/dev/null && echo "   ✅ CueMe preferences cleared" || echo "   ❌ CueMe preferences clear failed"
rm -rf ~/Library/Application\ Support/CueMe* 2>/dev/null && echo "   ✅ CueMe app support cleared" || echo "   ❌ CueMe app support clear failed"
echo ""

# 6. Wait and then open System Preferences
echo "6. Opening System Preferences..."
sleep 2
open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
echo "   ✅ System Preferences opened to Screen Recording"
echo ""

echo "🎯 MANUAL STEPS NOW REQUIRED:"
echo "============================="
echo ""
echo "1. In System Preferences → Privacy & Security → Screen Recording:"
echo "   • The list should now be empty"
echo "   • Click (+) to add an app"
echo "   • Choose CueMe or Electron"
echo "   • Enable the toggle"
echo ""
echo "2. Grant other permissions as apps request them"
echo ""
echo "3. Restart CueMe completely"
echo ""
echo "4. Test system audio"
echo ""
echo "⚠️  NOTE: You'll need to re-grant permissions to:"
echo "• Zoom (microphone, camera)"
echo "• Chrome/Safari (microphone, camera)"
echo "• Any other apps that had permissions"
echo ""
echo "🎉 If this worked, system audio should now be stable!"
echo ""