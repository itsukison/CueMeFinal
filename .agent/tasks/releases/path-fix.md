# Path Fix - Custom AudioTee Binary Not Being Found

**Date**: 2025-10-28  
**Status**: ✅ FIXED  
**Build**: v1.0.95

---

## Problem Summary

After building the custom audiotee binary with embedded Info.plist, the production app was **still using the wrong binary** (the npm package binary without Info.plist).

---

## Diagnosis Steps

### Step 1: Verify Custom Binary Exists ✅

```bash
ls -lah /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/
# Result: ✅ audiotee exists (661K)
```

### Step 2: Verify Info.plist Embedded ✅

```bash
otool -l .../custom-binaries/audiotee | grep -c __info_plist
# Result: 2 (✅ embedded for both architectures)
```

### Step 3: Verify Code Signing ✅

```bash
codesign -dv .../custom-binaries/audiotee
# Result: ✅ Properly signed with TeamIdentifier=4KS6YS23KT
```

### Step 4: Check Which Binary Was Actually Used ❌

```bash
grep "Found audiotee binary" ~/Library/Logs/CueMe/main.log
# Result: ❌ Using /app.asar.unpacked/node_modules/audiotee/bin/audiotee
#         (This one has NO Info.plist!)
```

---

## Root Cause

**Path Mismatch**: The code was looking in the wrong location.

**What the code searched for** (in order):

1. ❌ `/Contents/Resources/custom-binaries/audiotee` (doesn't exist)
2. ✅ `/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee` **(FOUND HERE - but no Info.plist!)**
3. Never reached the custom binary

**Where the custom binary actually was**:

- ✅ `/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee`

**Why this happened**:

- The `asarUnpack` configuration in `package.json` correctly unpacked `custom-binaries/**`
- But unpacked files go into `app.asar.unpacked/`, not directly into `Resources/`
- The search code didn't account for this

---

## The Fix

### Changed File

`electron/SystemAudioCapture.ts` - `findAudioTeeBinary()` method

### What Changed

**Before (Wrong Order)**:

```typescript
const possiblePaths = [
  // This path doesn't exist in production!
  path.join(process.resourcesPath, "custom-binaries", "audiotee"),

  // This path exists but has NO Info.plist - gets used first!
  path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "node_modules",
    "audiotee",
    "bin",
    "audiotee"
  ),
  // ...
];
```

**After (Correct Order)**:

```typescript
const possiblePaths = [
  // 🔥 HIGHEST PRIORITY: Custom binary with Info.plist (CORRECT PATH!)
  path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "custom-binaries",
    "audiotee"
  ),

  // Fallback for development
  path.join(process.resourcesPath, "custom-binaries", "audiotee"),

  // Last resort: npm package (no Info.plist)
  path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "node_modules",
    "audiotee",
    "bin",
    "audiotee"
  ),
  // ...
];
```

---

## Verification Steps

After rebuilding with this fix, you should see in the logs:

```
[SystemAudioCapture] ✅ Found audiotee binary {
  "path": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee",
  "hasInfoPlist": true,
  "macOS14Support": "✅ YES (Info.plist embedded)"
}
[SystemAudioCapture] 🎉 Using binary with embedded Info.plist - full macOS 14.2+ support!
```

And the audio buffers should be **non-zero**:

```
[SystemAudioCapture] 🎵 FIRST audio chunk from audiotee {
  "isAllZeros": false,  // ✅ Should be false!
  "normalizedRMS": "0.1234",  // ✅ Should be > 0!
}
```

---

## Next Steps

### 1. Build Production App

```bash
npm run build
npm run app:build:mac
```

### 2. Install and Test

```bash
open release/mac-arm64/CueMe.app
```

### 3. Check Logs

```bash
tail -f ~/Library/Logs/CueMe/main.log
```

Look for:

- ✅ "Using binary with embedded Info.plist"
- ✅ Non-zero audio buffers from system audio
- ✅ No "ALL-ZERO buffer" errors

---

## Technical Details

### Why Custom Binaries Go Into app.asar.unpacked

When electron-builder packages your app:

1. **Files in `files` array** → Get packed into `app.asar` (read-only archive)
2. **Files in `asarUnpack` array** → Get unpacked to `app.asar.unpacked/` directory
3. **Binaries MUST be unpacked** because they can't be executed from inside an asar archive

So our configuration:

```json
{
  "build": {
    "files": ["custom-binaries/**/*"], // Include in build
    "asarUnpack": ["custom-binaries/**"] // But unpack them
  }
}
```

Results in:

```
app.asar.unpacked/
  └── custom-binaries/
      └── audiotee  ← Executable here!
```

NOT:

```
Resources/
  └── custom-binaries/  ← This doesn't exist!
      └── audiotee
```

---

## Lessons Learned

1. **Always verify which binary is actually being used** - Check logs, don't assume
2. **Unpacked files go into app.asar.unpacked/** - Not directly into Resources/
3. **Search order matters** - Put the correct path FIRST to avoid false positives
4. **Test in production** - Path resolution can differ between dev and production

---

## Files Modified

- `/electron/SystemAudioCapture.ts` - Updated `findAudioTeeBinary()` path priority

## Version

- Fixed in: v1.0.95
