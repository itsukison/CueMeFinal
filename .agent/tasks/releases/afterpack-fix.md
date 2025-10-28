# AfterPack Script Fix - Processing Wrong Binary

**Version**: 1.0.98  
**Date**: 2025-10-28  
**Status**: ✅ FIXED

---

## Issue

After building v1.0.96 and v1.0.97:

- ✅ Custom binary with Info.plist was packaged
- ✅ Quarantine removal code was added to afterPack.js
- ❌ **Quarantine was NOT removed** from custom binary
- ❌ System audio still returned all-zero buffers

---

## Root Cause

**The afterPack.js script was processing the WRONG binary!**

### What Was Happening:

```javascript
// OLD CODE - Checked npm binary FIRST
const binaryPath = path.join(
  resourcesPath,
  "app.asar.unpacked",
  "node_modules",
  "audiotee",
  "bin",
  "audiotee"
);

// Only checked custom binary if npm binary didn't exist
if (!fs.existsSync(binaryPath)) {
  const customBinaryPath = path.join(
    resourcesPath,
    "custom-binaries",
    "audiotee"
  );
  // ...
}
```

**The Problem**:

1. Both binaries were packaged in the build
   - npm package: `node_modules/audiotee/bin/audiotee` (657KB, **no Info.plist**)
   - Custom binary: `custom-binaries/audiotee` (676KB, **has Info.plist**)

2. Script found npm binary first → Processed it ✅
3. Never reached custom binary → **Stayed quarantined** ❌
4. App used custom binary (via `SystemAudioCapture.ts` path priority) → **Quarantined** ❌
5. Core Audio Taps blocked → Zero buffers ❌

---

## The Fix

**Reversed the priority** - Check custom binary FIRST:

```javascript
// NEW CODE - Check custom binary FIRST
const customBinaryPath = path.join(
  resourcesPath,
  "app.asar.unpacked",
  "custom-binaries",
  "audiotee"
);

const npmBinaryPath = path.join(
  resourcesPath,
  "app.asar.unpacked",
  "node_modules",
  "audiotee",
  "bin",
  "audiotee"
);

// Process custom binary FIRST (has Info.plist)
if (fs.existsSync(customBinaryPath)) {
  console.log(`✅ Found custom audiotee binary (with Info.plist)`);
  return processAudioteeBinary(customBinaryPath);
}

// Fallback to npm binary only if custom not found
if (fs.existsSync(npmBinaryPath)) {
  console.warn(`⚠️  Custom binary not found, using npm package`);
  return processAudioteeBinary(npmBinaryPath);
}
```

---

## What This Fixes

### Before (v1.0.97):

1. afterPack.js processes npm binary ✅
2. afterPack.js removes quarantine from npm binary ✅
3. afterPack.js signs npm binary ✅
4. **Custom binary remains quarantined** ❌
5. App uses custom binary (quarantined) → Fails ❌

### After (v1.0.98):

1. afterPack.js processes **custom binary** ✅
2. afterPack.js removes quarantine from **custom binary** ✅
3. afterPack.js signs **custom binary** ✅
4. App uses custom binary (clean) → **Works!** ✅

---

## Build Output Changes

### v1.0.97 (Wrong):

```
📦 App path: .../CueMe.app
📂 Resources path: .../Resources
🔨 Audiotee binary path: .../node_modules/audiotee/bin/audiotee
✅ Found binary
🧹 Removing quarantine...
✅ Quarantine removed
🔏 Code signing...
```

_But custom binary was never touched!_

### v1.0.98 (Correct):

```
📦 App path: .../CueMe.app
📂 Resources path: .../Resources
✅ Found custom audiotee binary (with Info.plist): .../custom-binaries/audiotee
🧹 Removing quarantine...
✅ Quarantine removed
🔏 Code signing...
✅ Info.plist embedded - macOS 14.2+ support confirmed!
```

---

## Verification

After installing v1.0.98:

```bash
# 1. Check quarantine is gone
xattr /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee
# Should show: (nothing) or no com.apple.quarantine

# 2. Check Info.plist
otool -l .../custom-binaries/audiotee | grep -c __info_plist
# Should show: 2

# 3. Check logs
tail -f ~/Library/Logs/CueMe/main.log
# Should show: "🎉 Using binary with embedded Info.plist"
# Should show: Non-zero audio buffers
```

---

## Files Modified

- `scripts/afterPack.js` - Reversed binary priority (custom first, npm fallback)
- `package.json` - Bumped to v1.0.98

---

## Why This Happened

The script was originally written to process the npm package binary. When we added the custom binary, we only added it as a "fallback" case without changing the priority. This created a situation where:

1. Development worked (uses custom binary, local = no quarantine)
2. Build script processed wrong binary (npm one)
3. Production failed (custom binary still quarantined)

**The fix**: Simply reverse the priority to match what the app actually uses.

---

## Related Fixes

This completes the trilogy of fixes:

1. **v1.0.95**: Path resolution - Make app use custom binary ✅
2. **v1.0.96**: Quarantine removal - Add removal code to afterPack ✅
3. **v1.0.98**: Binary priority - **Process the right binary!** ✅

All three were needed for system audio to work in production.
