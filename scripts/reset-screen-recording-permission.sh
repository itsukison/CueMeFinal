#!/bin/bash

# Script to reset and re-grant Screen Recording permissions for CueMe
# Run this after rebuilding the Swift binary with new entitlements

echo "🔄 Resetting Screen Recording permissions..."
echo ""

# Reset Screen Recording permission for Electron
echo "Step 1: Resetting TCC database for Screen Recording..."
tccutil reset ScreenCapture

echo ""
echo "✅ Permission reset complete!"
echo ""
echo "📋 NEXT STEPS - Please follow these manually:"
echo ""
echo "1. Open System Settings"
echo "   Command: open 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'"
echo ""
echo "2. Click the '+' button to add an application"
echo ""
echo "3. Navigate to and select:"
echo "   /Users/kotan/CueMeFinal-1/node_modules/electron/dist/Electron.app"
echo ""
echo "4. Enable the checkbox next to 'Electron'"
echo ""
echo "5. IMPORTANT: Completely quit and restart the CueMe app"
echo "   - Don't just close the window"
echo "   - Quit from menu bar or use Cmd+Q"
echo ""
echo "Press Enter to open System Settings now..."
read

open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"

echo ""
echo "⏰ Waiting for you to grant permission..."
echo "Press Enter after you've enabled the permission..."
read

echo ""
echo "✅ Setup complete! Now restart the CueMe app to test."
