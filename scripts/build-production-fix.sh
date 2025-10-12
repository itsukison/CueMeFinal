#!/bin/bash

# Production Build Solution for System Audio
# This creates a properly signed production build that will have stable permissions

echo "🏭 Building Production Version for Stable System Audio"
echo "======================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the CueMe project root directory"
    exit 1
fi

# Step 1: Clean previous builds
echo "1. Cleaning previous builds..."
rm -rf dist/
rm -rf release/
echo "   ✅ Build directories cleaned"
echo ""

# Step 2: Build the production version
echo "2. Building production version..."
echo "   This may take 2-3 minutes..."
echo ""

if npm run app:build:mac; then
    echo ""
    echo "   ✅ Production build completed successfully!"
else
    echo ""
    echo "   ❌ Build failed. Check the output above for errors."
    exit 1
fi

# Step 3: Show build results
echo ""
echo "3. Build results:"
echo "=================="

if [ -d "release" ]; then
    echo "   Built files:"
    ls -la release/*.dmg 2>/dev/null || echo "   No DMG files found"
    ls -la release/*.zip 2>/dev/null || echo "   No ZIP files found"
    echo ""
    
    # Check for the app
    if [ -d "dist/mac/CueMe.app" ]; then
        echo "   ✅ CueMe.app created at: dist/mac/CueMe.app"
        
        # Check signature
        echo "   Checking code signature..."
        codesign -dv "dist/mac/CueMe.app" 2>&1 | head -3
        echo ""
        
        # Check SystemAudioCapture binary
        if [ -f "dist/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture" ]; then
            echo "   ✅ SystemAudioCapture binary included"
            
            # Check binary signature
            echo "   Checking binary signature..."
            codesign -dv "dist/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture" 2>&1 | head -3
        else
            echo "   ⚠️  SystemAudioCapture binary not found in app bundle"
        fi
    else
        echo "   ❌ CueMe.app not found in dist/mac/"
    fi
else
    echo "   ❌ Release directory not found"
fi

echo ""
echo "🎯 NEXT STEPS:"
echo "=============="
echo ""
echo "1. **Install the production version:**"
if [ -f "release/CueMe-"*.dmg ]; then
    DMG_FILE=$(ls release/CueMe-*.dmg | head -1)
    echo "   • Open: $DMG_FILE"
    echo "   • Drag CueMe to Applications folder"
else
    echo "   • No DMG found - check dist/mac/CueMe.app"
fi
echo ""
echo "2. **Remove development permissions:**"
echo "   • System Settings → Privacy & Security → Screen Recording"
echo "   • Remove any 'Electron' entries"
echo ""
echo "3. **Launch production CueMe:**"
echo "   • Open from Applications folder"
echo "   • Grant Screen Recording permission when prompted"
echo "   • Permission will be stable (won't reset on rebuilds)"
echo ""
echo "4. **Test system audio:**"
echo "   • Click 'System Audio' in CueMe"
echo "   • Should work immediately and persistently!"
echo ""
echo "📊 WHY THIS WORKS:"
echo "==================="
echo "• Production builds have proper code signatures"
echo "• macOS TCC trusts stable signatures"
echo "• Permissions persist across app launches"
echo "• No more permission resets during development"
echo ""
echo "🔄 FOR FUTURE DEVELOPMENT:"
echo "=========================="
echo "• Use production build for system audio testing"
echo "• Development build is fine for other features"
echo "• Only rebuild production when needed"
echo ""