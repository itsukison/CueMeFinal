#!/bin/bash

# Development Mode System Audio Fix
# This script works around the ScreenCaptureKit hanging issue in development

echo "🔧 CueMe Development Mode - System Audio Fix"
echo "=============================================="
echo ""

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: Run this script from the CueMe project root directory"
    exit 1
fi

# Check if production build exists
if [[ ! -d "release/mac/CueMe.app" ]]; then
    echo "📦 Production build not found. Building now..."
    echo "   This may take a few minutes..."
    echo ""
    npm run build
    
    if [[ $? -ne 0 ]]; then
        echo "❌ Build failed. Please check the build errors above."
        exit 1
    fi
    
    echo ""
    echo "✅ Build completed successfully!"
    echo ""
fi

echo "🚀 Starting CueMe Production Build (for reliable system audio)"
echo ""
echo "📋 Instructions:"
echo "1. The production app will open"
echo "2. macOS may prompt for Screen Recording permission - GRANT IT"
echo "3. Test system audio capture with a YouTube video"
echo "4. System audio should work perfectly!"
echo ""
echo "Press Enter to continue..."
read

# Open the production app
open release/mac/CueMe.app

echo ""
echo "✅ Production CueMe launched!"
echo ""
echo "💡 Tips:"
echo "   • Production builds have proper code signatures"
echo "   • Permissions are handled correctly by macOS"
echo "   • System audio capture works reliably"
echo ""
echo "🔄 For future development:"
echo "   • Use 'npm run dev' for UI/feature development"
echo "   • Use this production build to test system audio features"
echo "   • Or continue using microphone in development mode"
echo ""