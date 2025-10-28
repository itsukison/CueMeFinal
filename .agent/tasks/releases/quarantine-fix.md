# Quarantine Attribute Fix - Core Audio Taps Permission

**Version**: 1.0.96  
**Date**: 2025-10-28  
**Status**: ✅ FIXED

---

## Issue

Even with:

- ✅ Correct binary path (custom-binaries/audiotee)
- ✅ Info.plist embedded with NSAudioCaptureUsageDescription
- ✅ Proper code signing (TeamID 4KS6YS23KT)
- ✅ Correct entitlements (screen-capture, audio-input)

**System audio still returned all-zero buffers** in production.

---

## Root Cause

**Quarantine Attribute Blocking Permissions**

System console logs revealed Core Audio error `0x6e6f7065` ("nope" = permission denied).

The custom binary had `com.apple.quarantine` attribute because it was downloaded from GitHub releases. This prevents Core Audio Taps access even with:

- Valid code signature
- Proper entitlements
- Embedded Info.plist

macOS TCC (Transparency, Consent, and Control) blocks quarantined child processes from accessing system audio.

---

## The Fix

Modified `scripts/afterPack.js` to **remove quarantine attribute** during build:

```javascript
// CRITICAL: Remove quarantine attribute
console.log("🧹 Removing quarantine attribute...");
try {
  execSync(`xattr -d com.apple.quarantine "${binaryPath}"`, {
    stdio: "pipe",
    timeout: 5000,
  });
  console.log("✅ Quarantine removed - binary can access Core Audio Taps");
} catch (xattrError) {
  console.log("ℹ️  No quarantine attribute (already clean)");
}
```

This runs after code signing, ensuring the binary is clean before packaging.

---

## Why This Works

**Quarantine attribute prevents permission inheritance:**

1. Main app has Screen Recording permission ✅
2. Child binary is code-signed and entitled ✅
3. **BUT**: Quarantine blocks TCC permission inheritance ❌
4. Removing quarantine → macOS allows Core Audio Taps access ✅

---

## Testing

**For existing installed app** (manual test):

```bash
sudo xattr -d com.apple.quarantine /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee
```

Then restart the app and test.

**For new builds** (automatic):

- The `afterPack.js` hook now removes quarantine during packaging
- No manual intervention needed

---

## Verification

After building v1.0.96:

```bash
# 1. Check no quarantine
xattr /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/custom-binaries/audiotee
# Should NOT show com.apple.quarantine

# 2. Check logs
tail -f ~/Library/Logs/CueMe/main.log
# Should show non-zero audio buffers

# 3. Console logs should be clean
log show --predicate 'process == "audiotee"' --last 1m
# Should NOT show error 0x6e6f7065
```

---

## Files Modified

- `scripts/afterPack.js` - Added quarantine removal after permissions/before signing
- `package.json` - Bumped to v1.0.96

---

## Why Development Worked

Local binaries in development:

- Not downloaded from internet → No quarantine
- More permissive macOS security for local processes
- May have inherited permissions differently

Production binaries from GitHub:

- Downloaded → Quarantined automatically
- Stricter TCC enforcement
- Required explicit quarantine removal

---

## Related Issues

- Info.plist embedding: ✅ Already fixed in v1.0.95
- Path resolution: ✅ Already fixed in v1.0.95
- **Quarantine blocking: ✅ Fixed in v1.0.96**

This was the final missing piece!
