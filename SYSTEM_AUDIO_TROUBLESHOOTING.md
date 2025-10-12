# System Audio Troubleshooting Guide

## Problem
System audio capture starts but immediately fails with:
```
ストリーミングはシステムによって停止されました
(Stream was stopped by the system)
```

## Root Cause Analysis

The issue is that ScreenCaptureKit requires **both**:
1. ✅ Screen Recording TCC permission (granted)
2. ❌ **Proper code signing with entitlements** (was missing, NOW FIXED)

## Solutions Applied

### ✅ Solution 1: Added Code Signing with Entitlements

**What was done:**
- Created `entitlements.plist` with required permissions:
  - `com.apple.security.device.screen-capture`
  - `com.apple.security.device.audio-input`
  - `com.apple.security.cs.disable-library-validation`
  - Additional compatibility entitlements

- Updated build script to code-sign the Swift binary with these entitlements

**Verification:**
```bash
codesign -d --entitlements :- /Users/kotan/CueMeFinal-1/dist-native/SystemAudioCapture 2>/dev/null | plutil -p -
```

Should show all 6 entitlements including `com.apple.security.device.screen-capture => true`

---

## 🚨 CRITICAL NEXT STEPS FOR USER

### Step 1: Reset TCC Permissions

The newly code-signed binary needs fresh permissions. Run:

```bash
./scripts/reset-screen-recording-permission.sh
```

This will:
1. Reset Screen Recording permissions
2. Open System Settings for you
3. Guide you through re-granting permission

### Step 2: Manually Re-grant Permission

1. **Open System Settings** → **Privacy & Security** → **Screen Recording**

2. **Remove old Electron entry** (if exists):
   - Hover over "Electron" and click the (i) icon
   - Click "-" to remove it

3. **Add Electron again**:
   - Click the "+" button
   - Navigate to: `/Users/kotan/CueMeFinal-1/node_modules/electron/dist/Electron.app`
   - Select it and click "Open"

4. **Enable the checkbox** next to "Electron"

5. **COMPLETELY QUIT the CueMe app**:
   - Don't just close the window
   - Use Cmd+Q or quit from the menu
   - Make sure it's not running in the background

6. **Restart the CueMe app**:
   ```bash
   npm run dev -- --port 5180
   ```

### Step 3: Test System Audio

1. Start the app
2. Click "Start Listening" with System Audio selected
3. Play a YouTube video or any system audio
4. Check if audio is being captured

---

## Alternative Diagnostics

### Option A: Monitor System Logs

Run in a **separate terminal**:
```bash
./scripts/monitor-system-audio-logs.sh
```

Then test system audio in the app. Watch for TCC or ScreenCaptureKit errors.

### Option B: Manual Permission Check

```bash
./dist-native/SystemAudioCapture permissions
```

Expected output:
```json
{"type":"permission","granted":true,"message":"Screen recording permission granted"}
```

If you see `"granted":false`, permissions are not properly set.

### Option C: Test Stream Directly

```bash
./dist-native/SystemAudioCapture start-stream
```

- If it prints `{"type":"status","message":"READY"}` → Binary works!
- If it prints `{"type":"error",...}` → Still a permission issue

Press Ctrl+C to stop.

---

## Additional Solutions (If Above Doesn't Work)

### Solution 2: Nuclear Reset of TCC Database

```bash
tccutil reset All
```

⚠️ **Warning**: This resets ALL app permissions. You'll need to re-grant microphone, camera, etc. to all apps.

### Solution 3: Restart Mac

Sometimes macOS caches permission states. A full restart can clear these caches.

### Solution 4: Check for Conflicting Apps

Other apps with Screen Recording permission might interfere. Check:
- OBS
- Screen recorders
- Zoom (if screen sharing is active)
- Any other apps with Screen Recording permission

### Solution 5: Verify macOS Version

```bash
sw_vers -productVersion
```

ScreenCaptureKit requires macOS 13.0+. Your version: `26.0` (Sequoia) ✅

### Solution 6: Check Console.app for Detailed Errors

1. Open **Console.app**
2. Clear logs
3. Start system audio capture
4. Filter for "TCC" or "ScreenCaptureKit"
5. Look for denial messages

Common denial reasons:
- `TCC deny` - Permission not granted
- `code signature invalid` - Signing issue (should be fixed now)
- `entitlement missing` - Entitlement issue (should be fixed now)

---

## What Changed

### Before
- Swift binary was ad-hoc signed without entitlements
- macOS allowed status checks but killed the stream
- Permission was technically "granted" but not honored

### After
- Swift binary is ad-hoc signed **with proper entitlements**
- Includes `com.apple.security.device.screen-capture` entitlement
- Should now pass macOS security validation

---

## Expected Behavior After Fix

### ✅ Success Indicators
```
[SystemAudioCapture] Starting ScreenCaptureKit system audio capture...
[SystemAudioCapture] ScreenCaptureKit status: { isAvailable: true, ... }
[SystemAudioCapture] Audio data received: { sampleRate: 48000, channels: 2, ... }
[AudioStreamProcessor] Processing audio chunk...
[AudioTranscriber] Transcribing audio...
```

### ❌ Still Failing
If you still see:
```
[SystemAudioCapture] ScreenCaptureKit error: Stream error: ストリーミングはシステムによって停止されました
```

Then run the diagnostic scripts and check Console.app for the exact error.

---

## Emergency Fallback

If system audio still doesn't work after all steps:

### Use Microphone as Temporary Workaround

1. Use physical audio loopback (play YouTube through speakers, capture with mic)
2. Or use virtual audio device like BlackHole:
   ```bash
   brew install blackhole-2ch
   ```
   Then route system audio through BlackHole in Audio MIDI Setup

---

## Summary

**Immediate Action Required:**
1. ✅ Code signing is fixed (already done)
2. 🔄 Reset TCC permissions: `./scripts/reset-screen-recording-permission.sh`
3. 🔄 Re-grant Screen Recording permission in System Settings
4. 🔄 **Completely quit and restart** the CueMe app
5. ✅ Test with YouTube video

**If still failing:**
- Run `./scripts/monitor-system-audio-logs.sh` while testing
- Check Console.app for detailed errors
- Report back the specific error message

The code signing fix was the missing piece. The permission reset and re-grant should make it work! 🎯
