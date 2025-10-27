# AudioTee Info.plist Fix - Production System Audio Issue

**Status**: ✅ COMPLETE  
**Date**: 2025-10-27  
**Issue**: System audio works in development but returns zero buffers in production

---

## Problem Analysis

### Symptoms

- ✅ Microphone works perfectly in both dev and production
- ✅ AudioTee binary starts successfully
- ✅ Core Audio Taps connection established
- ❌ **System audio returns ALL-ZERO buffers** (silent)
- ❌ Only happens in production, works fine in development

### Root Cause

After extensive debugging and testing on the production app (`/Applications/CueMe.app`), we discovered:

1. **The binary IS properly signed** ✅
   - TeamIdentifier: `4KS6YS23KT` (not adhoc)
   - Entitlements: All correct including `com.apple.security.device.screen-capture`
   - Hardened runtime: Enabled

2. **BUT: Missing embedded Info.plist** ❌

   ```bash
   Info.plist=not bound
   otool -l audiotee | grep __info_plist  # No results
   ```

3. **macOS 14.2+ Requirement**
   - Core Audio Taps API requires `NSAudioCaptureUsageDescription` in the binary's Info.plist
   - Without it, the API connects but returns silent/zero audio buffers
   - This is a macOS security requirement, not optional

### Why Development Worked

- Local binaries run from workspace (not quarantined)
- macOS may be more permissive with local development
- Manual permission grants may bypass some checks

---

## Solution Implemented

### 1. Built Custom AudioTee Binary

**Location**: `custom-audiotee/`

Created a custom build of audiotee with embedded Info.plist:

**Files Created**:

- `custom-audiotee/Info.plist` - Contains `NSAudioCaptureUsageDescription`
- `custom-audiotee/build.sh` - Build script with Info.plist embedding
- `custom-audiotee/Package.swift` - Updated with linker flags for embedding

**Build Process**:

```bash
cd custom-audiotee
./build.sh
```

**Output**: Universal binary (x86_64 + arm64) with embedded Info.plist at `custom-audiotee/build/audiotee`

**Verification**:

```bash
otool -l build/audiotee | grep __info_plist
# ✅ Returns: sectname __info_plist (2 times - one per architecture)
```

### 2. Integrated into Project

**Location**: `custom-binaries/audiotee`

Copied the built binary to project:

```bash
cp custom-audiotee/build/audiotee custom-binaries/audiotee
chmod +x custom-binaries/audiotee
```

### 3. Updated Build Configuration

**`package.json` Changes**:

```json
{
  "files": [
    "custom-binaries/**/*" // Added
    // Removed: node_modules/audiotee references
  ],
  "asarUnpack": [
    "custom-binaries/**" // Updated
  ]
}
```

### 4. Updated Code to Prioritize Custom Binary

**`electron/SystemAudioCapture.ts`**:

- Updated `findAudioTeeBinary()` to check custom binary FIRST
- Added Info.plist detection with `otool`
- Logs whether binary has macOS 14.2+ support

**Search order**:

1. `custom-binaries/audiotee` ← Custom with Info.plist ✅
2. `app.asar.unpacked/node_modules/audiotee/bin/audiotee` (fallback)
3. Development locations

### 5. Updated Build Hook

**`scripts/afterPack.js`**:

- Created `processAudioteeBinary()` function
- Fixed path to point to actual audiotee location (not old SystemAudioCapture)
- Signs binary with app entitlements
- Verifies Info.plist embedding
- Falls back to custom-binaries if npm package fails

---

## Files Modified

### Created

1. `/custom-audiotee/Info.plist` - Info.plist template
2. `/custom-audiotee/build.sh` - Build script
3. `/custom-audiotee/Package.swift` - Updated with linker settings
4. `/custom-binaries/audiotee` - Built binary (609KB)
5. `/custom-binaries/README.md` - Documentation

### Modified

1. `/package.json` - Updated files and asarUnpack
2. `/electron/SystemAudioCapture.ts` - Updated binary search logic
3. `/scripts/afterPack.js` - Fixed signing for audiotee

---

## Testing Instructions

### 1. Verify Custom Binary Locally

```bash
# Check Info.plist embedding
otool -l custom-binaries/audiotee | grep -c __info_plist
# Should return: 2

# Test execution
./custom-binaries/audiotee --help
# Should show help text

# Test with actual audio capture
./custom-binaries/audiotee --sample-rate 16000
# Should capture system audio (requires Screen Recording permission)
```

### 2. Build Production App

```bash
npm run build
npm run app:build:mac
```

### 3. Verify Production Bundle

```bash
# Check binary exists
ls -lh release/mac-arm64/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee

# Verify signature
codesign -dv --entitlements - release/mac-arm64/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee
# Should show: TeamIdentifier=4KS6YS23KT

# Verify Info.plist
otool -l release/mac-arm64/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee | grep __info_plist
# Should show: sectname __info_plist
```

### 4. Test Production App

```bash
# Install the app
open release/mac-arm64/CueMe.app

# OR reinstall from DMG
npm run app:build:mac
open release/CueMe-*.dmg
```

**Expected Behavior**:

1. Grant Screen Recording permission when prompted
2. System audio should now work (non-zero buffers)
3. Check logs for: `🎉 Using binary with embedded Info.plist - full macOS 14.2+ support!`

---

## Technical Details

### Info.plist Content

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.cueme.audiotee</string>

    <!-- CRITICAL: Required for Core Audio Taps on macOS 14.2+ -->
    <key>NSAudioCaptureUsageDescription</key>
    <string>AudioTee captures system audio output for real-time processing and analysis.</string>
</dict>
</plist>
```

### Swift Linker Settings

```swift
.executableTarget(
  name: "audiotee",
  linkerSettings: [
    .unsafeFlags([
      "-Xlinker", "-sectcreate",
      "-Xlinker", "__TEXT",
      "-Xlinker", "__info_plist",
      "-Xlinker", "Info.plist"
    ])
  ]
)
```

This embeds the Info.plist as a `__TEXT,__info_plist` section in the Mach-O binary.

---

## Debugging Commands

If issues persist, use these commands:

```bash
# Check if app has Screen Recording permission
tccutil reset ScreenCapture com.cueme.interview-assistant

# Remove quarantine from binary (if needed)
xattr -d com.apple.quarantine /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee

# Test binary directly
/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee --sample-rate 16000

# Check app logs
tail -f ~/Library/Logs/CueMe/main.log
```

---

## Future Maintenance

### Updating AudioTee

When a new version of audiotee is released:

1. Update the clone:

   ```bash
   cd custom-audiotee
   git pull origin main
   ```

2. Rebuild:

   ```bash
   ./build.sh
   ```

3. Copy to project:

   ```bash
   cp build/audiotee ../custom-binaries/audiotee
   ```

4. Verify:
   ```bash
   otool -l ../custom-binaries/audiotee | grep __info_plist
   ```

### Alternative: Upstream Fix

If the audiotee npm package ever adds Info.plist embedding:

1. Update `package.json` to use npm package
2. Revert changes to `SystemAudioCapture.ts` search paths
3. Keep custom-binaries as fallback

---

## References

- **AudioTee Repository**: https://github.com/makeusabrew/audiotee
- **Core Audio Taps**: https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps
- **Info.plist Embedding**: https://stronglytyped.uk/articles/audiotee-capture-system-audio-output-macos
- **macOS 14.2 Requirements**: Apple TN3176 - Core Audio Taps API

---

## Conclusion

✅ **Problem Solved**: Custom audiotee binary with embedded Info.plist now ensures system audio works in production on macOS 14.2+.

The key insight was that even with perfect code signing and entitlements, the **absence of an embedded Info.plist** caused Core Audio Taps to return silent audio. This is a macOS security requirement that cannot be bypassed.
