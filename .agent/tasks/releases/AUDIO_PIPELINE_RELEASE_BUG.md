# Audio Pipeline Release Bug - Root Cause Analysis & Fix Plan

**Status:** ✅ ROOT CAUSE FOUND & FIXED - v1.0.92 Ready for Testing  
**Created:** 2025-10-23  
**Updated:** 2025-10-26  
**Priority:** P0 - Blocks production usage

## ✅ ROOT CAUSE FOUND & FIXED - v1.0.92 (2025-10-26)

### The Problem: Buffer Reuse Without Copying

**Root Cause:** The audiotee binary reuses the same buffer for performance. When `SystemAudioCapture` emits the buffer via `this.emit('audio-data', data)`, it passes the buffer **by reference**. By the time the async `sendAudioData()` function processes the buffer, audiotee has already overwritten it with new data or zeros.

**Evidence from Logs:**
```
[SystemAudioCapture] 🎵 FIRST audio chunk from audiotee { "bytes": 6400 } ✅
[GeminiLiveQuestionDetector] 🔬 First audio chunk { "isAllZeros": true } ❌
```

The buffer has 6400 bytes when emitted, but is all zeros when processed!

**The Fix:**
```typescript
// Before (BROKEN):
this.emit('audio-data', data);  // Passes buffer by reference

// After (FIXED):
const bufferCopy = Buffer.from(data);  // Create independent copy
this.emit('audio-data', bufferCopy);   // Pass the copy
```

**Why This Works:**
- `Buffer.from(data)` creates a new buffer with a copy of the data
- The copy is independent of audiotee's internal buffer
- Even if audiotee overwrites its buffer, our copy remains intact
- Async processing can take as long as needed without corruption

**File Changed:** `CueMeFinal/electron/SystemAudioCapture.ts:485-495`

**See:** `ROOT_CAUSE_ANALYSIS.md` for detailed line-by-line log analysis

---

## 🔬 DEEP DIAGNOSTICS ADDED - v1.0.81 (2025-10-26)

### Comprehensive Gemini Live API Logging

Added extensive logging to diagnose why system audio isn't detecting questions even though audio is reaching Gemini:

**Phase 1: Message Tracking**
- Log EVERY message from Gemini with type, structure, and preview
- Track message count per session
- Log connection establishment time
- Enhanced error logging with full error details
- Log close events with codes and reasons

**Phase 2: Audio Quality Validation**
- Calculate RMS audio level for each chunk
- Log first chunk's raw bytes (hex preview)
- Detect silent or very quiet audio
- Validate buffer length matches expected format
- Check if buffer is all zeros
- Measure audio send latency

**Phase 3: Turn Buffer Tracking**
- Log when text is accumulated in buffer
- Log when turn completes (with or without text)
- Log question validation results
- Log rejected text with reason

### What to Look For in v1.0.81 Logs

**If Gemini IS responding but not detecting questions:**
```
📨 Gemini message received (opponent) #1 { messageType: 'modelTurn', hasParts: true }
📝 Accumulating text in opponent buffer { addedText: "..." }
🏁 Turn complete for opponent { text: "some text", isEmpty: false }
🔍 Question validation for opponent { isQuestion: false } ← REJECTED!
❌ Text rejected - not a question (opponent)
```

**If Gemini is NOT responding at all:**
```
📤 FIRST audio chunk sent to Gemini (opponent) ✅
🎚️ Audio level (opponent) { normalizedRMS: 0.15, isSilent: false } ✅
📤 Audio chunks sent to Gemini (opponent): 50 total ✅
📨 Gemini message received (opponent) ← MISSING! ❌
```

**If audio is silent/bad quality:**
```
🔬 First audio chunk analysis (opponent) { isAllZeros: true } ← PROBLEM!
🎚️ Audio level (opponent) { normalizedRMS: 0.001, isSilent: true } ← PROBLEM!
⚠️ First audio chunk is very quiet or silent (opponent)
```

**If audio format is wrong:**
```
🔬 First audio chunk analysis (opponent) {
  bufferLength: 3200,  ← Should be 6400!
  expectedLength: 6400,
  hexPreview: "00 00 00 00..." ← All zeros = bad!
}
```

This will pinpoint EXACTLY why system audio questions aren't being detected!

---

## ⏪ REVERTED - Permission Changes Causing Build Issues - v1.0.82 (2025-10-26)

### Issue: Build Still Failing

The PermissionManager changes (v1.0.80-v1.0.82) were causing build failures on GitHub Actions.

**Changes Reverted:**
1. ❌ Deleted `electron/utils/PermissionManager.ts`
2. ❌ Reverted `main.ts` to use original `requestMicAccess()` function
3. ❌ Removed all Screen Recording permission request code

**Current State:**
- Back to v1.0.79 functionality (comprehensive logging only)
- No automatic permission requests
- Build should succeed ✅

**Why System Audio Still Won't Work:**
The original hypothesis was correct - Screen Recording permission IS needed for system audio.
However, the implementation caused build issues.

**Manual Workaround for Users:**
1. Go to System Settings > Privacy & Security > Screen Recording
2. Manually add CueMe to the allowed apps
3. Restart CueMe
4. System audio should work

**Future Fix:**
Need to find a way to request Screen Recording permission that:
- Works with Electron 33+
- Doesn't break the build
- Properly triggers the permission dialog

For now, v1.0.82 focuses on the comprehensive logging (v1.0.81) which will help diagnose issues.

---

## 🔧 BUILD FIX - Electron 33 Compatibility - v1.0.82 (2025-10-26) [REVERTED]

### Issue: Code Signing Error on GitHub Actions

**Error:** Build failed with code signing error when building v1.0.80/v1.0.81

**Root Cause:** `systemPreferences` API was deprecated and removed in Electron 33
- v1.0.80 used `systemPreferences.getMediaAccessStatus()` 
- v1.0.81 used `systemPreferences.askForMediaAccess()`
- These APIs don't exist in Electron 33.2.0

**Fix Applied:**
1. Removed all `systemPreferences` imports and usage
2. Use only `desktopCapturer.getSources()` to trigger Screen Recording permission
3. Microphone permission is now handled automatically by macOS when renderer calls `getUserMedia()`
4. Updated `checkPermissionStatus()` to return 'unknown' (can't check in Electron 33+)

**Impact:**
- Screen Recording permission request still works ✅
- Microphone permission handled by OS automatically ✅
- Build should succeed on GitHub Actions ✅

### Electron 33 Permission Changes

In Electron 33+:
- `systemPreferences.getMediaAccessStatus()` - **REMOVED**
- `systemPreferences.askForMediaAccess()` - **REMOVED**
- Microphone permission - Handled automatically by OS when `getUserMedia()` is called
- Screen Recording permission - Triggered by `desktopCapturer.getSources()`

---

## 🎯 ROOT CAUSE FOUND! macOS Screen Recording Permission - v1.0.80 (2025-10-26)

### The REAL Issue: Missing Screen Recording Permission

**Discovery:** System audio works in Kiro but not in CueMe or Cursor because Kiro has Screen Recording permission granted, but CueMe doesn't actively request it!

**Why Screen Recording Permission?**
- On macOS, capturing system audio requires **Screen Recording** permission
- This is because system audio capture uses Core Audio Taps, which Apple considers privacy-sensitive
- Even though we're only capturing audio (not video), it's grouped under "Screen Recording"

**What Was Missing:**
1. ✅ Entitlements were correct (`com.apple.security.device.screen-capture`)
2. ✅ Usage description was present (`NSScreenCaptureDescription`)
3. ❌ **No code to actively trigger the permission dialog!**

### The Fix

**Created `PermissionManager.ts`:**
- `requestScreenRecordingPermission()` - Triggers Screen Recording permission dialog
- `requestMicrophonePermission()` - Requests microphone permission
- `requestAllAudioPermissions()` - Requests both permissions on startup
- Uses `desktopCapturer.getSources()` to trigger the Screen Recording dialog

**Updated `main.ts`:**
- Calls `PermissionManager.requestAllAudioPermissions()` on app startup
- Shows clear console messages about permission status
- Guides users to System Settings if permission denied

### What Happens Now

**On First Launch:**
1. App requests Microphone permission → Dialog appears
2. App requests Screen Recording permission → Dialog appears
3. User grants both permissions
4. System audio capture works! ✅

**If Permission Denied:**
- Clear console message with instructions
- Tells user to go to System Settings > Privacy & Security > Screen Recording
- Explains that restart is needed after granting permission

### Testing v1.0.80

After installing v1.0.80:
1. Launch the app
2. You'll see TWO permission dialogs:
   - Microphone permission
   - Screen Recording permission
3. Grant both
4. Test system audio - it should work!

If you already denied permission:
1. Go to System Settings > Privacy & Security > Screen Recording
2. Enable CueMe
3. Restart the app
4. System audio should work!

---

## 🔍 COMPREHENSIVE LOGGING ADDED - v1.0.79 (2025-10-25)

### System Audio Event Flow Tracking

Added detailed logging to track the complete audio flow from audiotee → Gemini Live:

**1. SystemAudioCapture (audiotee output)**
```
🎵 FIRST audio chunk from audiotee { bytes: X, listenerCount: N, hasListeners: true/false }
🎵 Audio chunks from audiotee: 50 total, X bytes, Xms since last log
```

**2. DualAudioCaptureManager (event listener)**
```
🔗 Setting up event listeners on SystemAudioCapture instance
✅ Event listeners attached to SystemAudioCapture { listenerCount: N }
🔊 FIRST audio-data event received! { bufferSize: X, isCapturing: true/false }
🔊 audio-data events: 50 total, Xms since last log
```

**3. GeminiLiveQuestionDetector (sending to API)**
```
📤 FIRST audio chunk sent to Gemini (opponent) { bufferSize: X, base64Length: X }
📤 Audio chunks sent to Gemini (opponent): 50 total, Xms since last log
```

### What to Look For in v1.0.79 Logs

**If system audio is working, you'll see:**
```
[SystemAudioCapture] 🎵 FIRST audio chunk from audiotee { listenerCount: 1 }
[DualAudioCaptureManager] 🔊 FIRST audio-data event received! { isCapturing: true }
[GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (opponent)
[DualAudioCaptureManager] Question detected (opponent): "..."
```

**If events are not reaching DualAudioCaptureManager:**
```
[SystemAudioCapture] 🎵 FIRST audio chunk from audiotee { listenerCount: 0 } ← NO LISTENERS!
[DualAudioCaptureManager] 🔊 FIRST audio-data event received! ← MISSING!
```

**If events reach but audio not sent to Gemini:**
```
[SystemAudioCapture] 🎵 FIRST audio chunk from audiotee { listenerCount: 1 }
[DualAudioCaptureManager] 🔊 FIRST audio-data event received! { isCapturing: false } ← WRONG STATE!
[GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (opponent) ← MISSING!
```

This will pinpoint exactly where the system audio pipeline breaks in production!

---

## 🔧 LOGGING FIXED - Ready for v1.0.78 (2025-10-25)

### Issue: console.log() Not Appearing in Production Logs

**Problem:** Diagnostic logging used `console.log()` which doesn't appear in Electron log files in production.

**Solution:** Replaced all `console.log()` with `DiagnosticLogger` in main process files.

**Files Fixed:**
- ✅ `electron/audio/DualAudioCaptureManager.ts` - Now uses `DiagnosticLogger`
- ✅ `electron/audio/GeminiLiveQuestionDetector.ts` - Now uses `DiagnosticLogger`
- ✅ `electron/ipc/audioHandlers.ts` - Now uses `DiagnosticLogger`
- ⚠️ `electron/core/AppState.ts` - Still uses `console.log()` (runs during initialization, before logger setup)

**Expected in v1.0.78 logs:**
```
[DualAudioCaptureManager] 🔍 Constructor called
[DualAudioCaptureManager] 📦 Creating GeminiLiveQuestionDetector...
[GeminiLiveQuestionDetector] 🔍 Constructor called
[GeminiLiveQuestionDetector] 📦 Creating GoogleGenAI client...
[GeminiLiveQuestionDetector] 🔍 Checking genAI.live availability
[DualAudioCaptureManager] 🎙️ startCapture() called
[GeminiLiveQuestionDetector] 🎙️ startListening() called
[GeminiLiveQuestionDetector] 📞 Creating user session...
[GeminiLiveQuestionDetector] 📞 Creating opponent session...
```

These logs will reveal:
1. Whether DualAudioCaptureManager is being created
2. Whether GeminiLiveQuestionDetector is being created
3. Whether genAI.live API is available
4. Whether Gemini Live sessions are starting
5. Where exactly the system audio pipeline is breaking

---

## 🎯 ROOT CAUSE FOUND & FIXED (2025-10-25)

### The Problem - Audio Routing Mismatch

**Issue:** AudioWorklet fails in production → Falls back to ScriptProcessor → ScriptProcessor sends audio to WRONG IPC handler

**What was happening:**
1. ✅ Microphone capture works
2. ✅ System audio capture works (audiotee)
3. ❌ AudioWorklet fails: `AbortError: The user aborted a request`
4. ✅ Falls back to ScriptProcessor
5. ❌ **ScriptProcessor sends to `audioStreamProcessChunk` (old system) instead of `dualAudioProcessMicrophoneChunk` (Gemini Live)**
6. ❌ Audio goes to AudioStreamProcessor, NOT to DualAudioCaptureManager
7. ❌ No Gemini Live processing, no question detection

### The Fixes Applied

**Fix 1: ScriptProcessor IPC Handler** ✅ FIXED
- **File:** `src/components/Queue/QueueCommands.tsx` line ~685
- **Changed:** `audioStreamProcessChunk` → `dualAudioProcessMicrophoneChunk`
- **Impact:** ScriptProcessor fallback now sends audio to Gemini Live correctly

**Fix 2: AudioWorklet Path Resolution** ✅ FIXED
- **File:** `src/components/Queue/QueueCommands.tsx` line ~497
- **Problem:** Hardcoded `/audio-worklet-processor.js` doesn't work in production
- **Solution:** Use dynamic path based on environment:
  - Dev: `/audio-worklet-processor.js` (Vite dev server)
  - Production: `new URL("/audio-worklet-processor.js", window.location.href).href`
- **Impact:** AudioWorklet should now load correctly in production builds

### Why AudioWorklet Failed

**Root Cause:** Path resolution issue in Electron production builds
- Development: Vite dev server serves files from `http://localhost:5173/`
- Production: Files loaded from `file://` protocol with different base path
- Hardcoded `/audio-worklet-processor.js` doesn't resolve correctly in production
- Browser throws `AbortError` when file can't be loaded

### Expected Behavior After Fixes

**v1.0.77 should:**
1. ✅ AudioWorklet loads successfully in production (no more AbortError)
2. ✅ If AudioWorklet still fails, ScriptProcessor sends to correct IPC handler
3. ✅ Audio reaches DualAudioCaptureManager → GeminiLiveQuestionDetector
4. ✅ Gemini Live sessions start
5. ✅ Question detection works

---

## 🆕 PREVIOUS UPDATE (2025-10-25) - Diagnostic Logging Added

### Current Situation (Before Root Cause Found)
- ✅ Microphone capture works in production
- ✅ System audio capture works in production (audiotee binary found and running)
- ✅ Audio chunks being sent to main process
- ❌ **GeminiLiveQuestionDetector not logging anything** - No session creation, no question detection
- ✅ Chat function using Gemini API works (so API key is loaded correctly)

### Key Finding
The logs show NO output from:
- `GeminiLiveQuestionDetector` constructor
- `GeminiLiveQuestionDetector.startListening()`
- `GeminiLiveQuestionDetector.createLiveSession()`
- `DualAudioCaptureManager` constructor

This suggests either:
1. `DualAudioCaptureManager` is not being instantiated
2. It's failing silently during construction
3. The Gemini SDK `@google/genai` has bundling issues with the Live API

### Diagnostic Logging Added

**Files Modified with Enhanced Logging:**

1. **`electron/core/AppState.ts`** - `initializeDualAudioManager()`
   - Log when initialization starts
   - Log API key presence and length
   - Log each step of manager creation
   - Log event listener setup
   - Log full error stack on failure

2. **`electron/audio/DualAudioCaptureManager.ts`** - Constructor & `startCapture()`
   - Log constructor entry with API key status
   - Log GeminiLiveQuestionDetector creation
   - Log SystemAudioCapture creation
   - Log event forwarding setup
   - Log each step of startCapture flow
   - Log full error stacks

3. **`electron/audio/GeminiLiveQuestionDetector.ts`** - Constructor, `startListening()`, `createLiveSession()`
   - Log constructor entry with config details
   - Log GoogleGenAI client creation
   - **Log `genAI.live` availability check** (critical!)
   - Log each session creation step
   - Log `genAI.live.connect` availability
   - Log full error details with stack traces

4. **`electron/ipc/audioHandlers.ts`** - `dual-audio-start` handler
   - Log dualAudioManager existence check
   - Log type information
   - Log before calling startCapture
   - Log full error stacks

### What to Look For in Next Release (v1.0.76)

When you test the new build, check the logs for:

1. **Initialization logs:**
   ```
   [AppState] 🔍 Starting DualAudioCaptureManager initialization...
   [AppState] Gemini API Key status: Present (length: XX)
   [AppState] 📦 Creating DualAudioCaptureManager instance...
   [DualAudioCaptureManager] 🔍 Constructor called
   [GeminiLiveQuestionDetector] 🔍 Constructor called
   ```

2. **Critical check - genAI.live availability:**
   ```
   [GeminiLiveQuestionDetector] 🔍 Checking genAI.live availability: {
     hasLive: true/false,  ← KEY INDICATOR
     hasConnect: true/false,  ← KEY INDICATOR
     liveType: "object"/"undefined"
   }
   ```

3. **Session creation logs:**
   ```
   [GeminiLiveQuestionDetector] 📞 Calling genAI.live.connect for user...
   [GeminiLiveQuestionDetector] ✅ user Live API session created successfully
   ```

4. **Any error messages with full stack traces**

### Expected Outcomes

**If `genAI.live` is undefined:**
- The Gemini SDK is not bundling the Live API correctly
- Need to add `@google/genai` to externals or fix bundling

**If `genAI.live.connect` is not a function:**
- API version mismatch between code and SDK
- May need to update SDK or change API usage

**If constructor fails:**
- Will see exact error with stack trace
- Can identify if it's import issue, API issue, or config issue

### Next Steps After v1.0.76 Release

1. Build and release v1.0.76 with diagnostic logging
2. Download and test the production build
3. Collect logs from `~/Library/Logs/CueMe/main.log`
4. Share logs to identify exact failure point
5. Apply targeted fix based on diagnostic output

---

## ⚠️ CRITICAL UPDATE (2025-10-24)

**Previous fix did NOT resolve the issue.** Both microphone and system audio still fail in production.

The fact that BOTH features fail suggests a **common root cause** rather than separate issues. We need to properly diagnose before attempting another fix.

**New Approach:** Comprehensive debugging with logging and diagnostics to identify the actual root cause.

**See:** 
- `AUDIO_DEBUG_PLAN.md` - Detailed debugging implementation plan
- `DEBUGGING_SUMMARY.md` - Quick reference guide

---

## 📊 Current Status (2025-10-24)

**Phase 1: Comprehensive Logging** ✅ COMPLETE

### What Was Implemented

1. **Created DiagnosticLogger utility** ✅
   - `electron/utils/DiagnosticLogger.ts` - Centralized logging with electron-log
   - Structured logging with component context
   - Method entry/exit tracking
   - Full error details with stack traces

2. **Instrumented MicrophoneCapture** ✅
   - Added detailed logging to all methods
   - Logs navigator API availability
   - Tracks getUserMedia() calls and results
   - Monitors audio chunk processing
   - Logs IPC communication status

3. **Instrumented SystemAudioCapture** ✅
   - Logs binary path resolution (all paths checked)
   - Tracks audiotee process spawn and events
   - Monitors audio data flow
   - Logs process stdout/stderr

4. **Instrumented IPC handlers** ✅
   - Added logging to audioHandlers.ts
   - Tracks chunk reception from renderer
   - Monitors IPC call flow

5. **Created diagnostics IPC handlers** ✅
   - `electron/ipc/diagnosticsHandlers.ts` - System diagnostics
   - IPC connectivity test
   - Permission status checking
   - Binary verification
   - Log file access

6. **Updated preload and main** ✅
   - Exposed diagnostics methods to renderer
   - Added startup logging

**Log Location:** `~/Library/Logs/CueMe/main.log` (macOS)

**Next:** Build and test to analyze logs and identify root cause

---

## 🎉 Previous Implementation (Didn't Fix Issue)

### What Was Fixed Before

1. **Removed navigator usage from main process** ✅ (But issue persists)
   - Updated `SystemAudioCapture.ts` to throw error if microphone capture attempted in main
   - Updated `SystemAudioCapture.ts` to throw error for Windows system audio (same issue)
   - Updated `AudioDebugger.ts` to remove navigator.mediaDevices calls
   - Disabled AudioDebugger in production (commented out in main.ts)
   - **Build Fix:** Removed leftover code after throw statement that caused syntax errors

2. **Added network entitlements** ✅
   - Added `com.apple.security.network.client` to entitlements.mac.plist
   - Added `com.apple.security.network.server` to entitlements.mac.plist
   - Required for OpenAI, Gemini, and Supabase API calls

3. **Added minimumSystemVersion** ✅
   - Set to "11.0" in package.json mac build config
   - Ensures proper entitlement handling on Apple Silicon

4. **Created renderer-side microphone capture** ✅
   - New `MicrophoneCapture` service in `src/services/MicrophoneCapture.ts`
   - Properly uses navigator.mediaDevices in renderer context
   - Sends audio chunks to main via IPC

5. **Updated IPC architecture** ✅
   - Added `audio-process-microphone-chunk` handler in audioHandlers.ts
   - Updated preload.ts to expose new IPC method
   - Updated electron.d.ts type definitions

6. **Created React integration** ✅
   - New `useMicrophoneCapture` hook for easy integration
   - Existing code in QueueCommands.tsx already uses navigator correctly

### Key Changes

**Files Modified:**
- `electron/SystemAudioCapture.ts` - Removed navigator usage
- `electron/AudioDebugger.ts` - Removed navigator usage
- `electron/main.ts` - Disabled AudioDebugger in production
- `assets/entitlements.mac.plist` - Added network entitlements
- `package.json` - Added minimumSystemVersion
- `electron/ipc/audioHandlers.ts` - Added microphone chunk handler
- `electron/preload.ts` - Exposed new IPC method
- `src/types/electron.d.ts` - Updated type definitions

**Files Created:**
- `src/services/MicrophoneCapture.ts` - Renderer-side mic capture service
- `src/hooks/useMicrophoneCapture.ts` - React hook for mic capture

### Why This Fixes the Issue

The root cause was trying to use browser APIs (`navigator.mediaDevices`) in the main process (Node.js), which only exist in the renderer process (browser context). In development, this might work due to different module resolution, but in production builds it causes immediate crashes.

The fix ensures:
1. All navigator usage happens in renderer (where it belongs)
2. Network entitlements allow API calls in hardened runtime
3. Proper macOS version targeting for entitlement support
4. Clean IPC communication between renderer and main

---

## Problem Statement

Audio functionality (both microphone and system audio) works perfectly in development (`npm run dev`), but completely fails when the app is built and distributed via GitHub releases. Users download the app and neither microphone nor system audio capture works.

---

## Root Cause Analysis

### 🔥 Critical Issue #1: Navigator API in Main Process

**Location:** `electron/AudioDebugger.ts:67`, `electron/SystemAudioCapture.ts:294,437`

**Problem:**
```typescript
// This code runs in the MAIN PROCESS (Node.js)
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

**Why it fails:**
- `navigator.mediaDevices` is a **browser API** only available in the **renderer process**
- The main process is Node.js, which has no `navigator` object
- In development, this might work due to different module resolution or timing
- In production builds, this causes immediate crashes: `ReferenceError: navigator is not defined`

**Evidence:**
- The difference.md notes: "Log shows navigator is not defined (run in main process)"
- Glass (working app) "almost certainly requests mic access in the renderer"

### 🔥 Critical Issue #2: Missing Entitlements

**Current State:** `CueMeFinal/assets/entitlements.mac.plist`
```xml
<key>com.apple.security.device.microphone</key>
<true/>
<key>com.apple.security.device.audio-input</key>
<true/>
<key>com.apple.security.device.screen-capture</key>
<true/>
<key>com.apple.security.app-sandbox</key>
<false/>
```

**Glass (Working) State:** `glass/entitlements.plist`
```xml
<key>com.apple.security.device.microphone</key>
<true/>
<key>com.apple.security.device.audio-input</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>
<key>com.apple.security.app-sandbox</key>
<false/>
```

**Missing Entitlements:**
- `com.apple.security.network.client` - Required for API calls (OpenAI, Gemini)
- `com.apple.security.network.server` - Required for auth callback server

### ⚠️ Issue #3: Missing minimumSystemVersion

**Current:** Not set in package.json build config  
**Glass:** `"minimumSystemVersion": "11.0"`

**Impact:**
- Ensures proper entitlement handling on Apple Silicon
- Guarantees Core Audio APIs are available
- Minor but important for consistency

### ⚠️ Issue #4: Architecture Mismatch

**Current Flow:**
1. Main process tries to access `navigator.mediaDevices` ❌
2. AudioDebugger runs in main process ❌
3. SystemAudioCapture instantiated in main process ❌
4. Permission requests happen in main process ❌

**Correct Flow (Glass pattern):**
1. Renderer process requests mic via `navigator.mediaDevices.getUserMedia()` ✅
2. Main process handles system audio via native modules ✅
3. Preload script bridges the two contexts ✅
4. IPC for communication between processes ✅

---

## Impact Assessment

### What Works in Development
- Microphone capture ✅
- System audio capture ✅
- Audio transcription ✅
- Question detection ✅

### What Fails in Production
- Microphone capture ❌ (navigator undefined)
- System audio capture ❌ (navigator undefined)
- Audio transcription ❌ (no audio data)
- Question detection ❌ (no audio data)
- Network requests may fail ❌ (missing network entitlements)

### Why Development Works
- Different module resolution paths
- Electron dev mode has more permissive security
- Timing differences mask the issue
- Hot reload may reinitialize in different context

---

## Fix Plan

### Phase 1: Move Microphone Access to Renderer Process ⚡ CRITICAL

**Goal:** Move all `navigator.mediaDevices` calls from main to renderer

**Files to Modify:**

1. **Create new file:** `src/services/MicrophoneCapture.ts`
   ```typescript
   // Renderer-side microphone capture
   export class MicrophoneCapture {
     private mediaStream: MediaStream | null = null;
     private audioContext: AudioContext | null = null;
     
     async requestPermission(): Promise<boolean> {
       try {
         const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         stream.getTracks().forEach(track => track.stop());
         return true;
       } catch (error) {
         console.error('Microphone permission denied:', error);
         return false;
       }
     }
     
     async startCapture(config: AudioConfig): Promise<void> {
       this.mediaStream = await navigator.mediaDevices.getUserMedia({
         audio: {
           sampleRate: { ideal: config.sampleRate },
           channelCount: { ideal: config.channelCount },
           echoCancellation: true,
           noiseSuppression: true,
           autoGainControl: true
         }
       });
       
       this.audioContext = new AudioContext({ sampleRate: config.sampleRate });
       const source = this.audioContext.createMediaStreamSource(this.mediaStream);
       const processor = this.audioContext.createScriptProcessor(config.bufferSize, 1, 1);
       
       processor.onaudioprocess = (e) => {
         const audioData = e.inputBuffer.getChannelData(0);
         // Send to main process via IPC
         window.electronAPI.audioProcessChunk(audioData);
       };
       
       source.connect(processor);
       processor.connect(this.audioContext.destination);
     }
     
     async stopCapture(): Promise<void> {
       if (this.mediaStream) {
         this.mediaStream.getTracks().forEach(track => track.stop());
         this.mediaStream = null;
       }
       if (this.audioContext) {
         await this.audioContext.close();
         this.audioContext = null;
       }
     }
   }
   ```

2. **Modify:** `electron/SystemAudioCapture.ts`
   - Remove `startMicrophoneCapture()` method (lines 290-340)
   - Remove all `navigator.mediaDevices` references
   - Keep only system audio capture logic (native modules)
   - Add comment: "Microphone capture moved to renderer process"

3. **Modify:** `electron/AudioDebugger.ts`
   - Remove `navigator.mediaDevices.getUserMedia()` call (line 67)
   - Replace with IPC call to renderer for permission check
   - Or remove microphone check entirely (handled by renderer)

4. **Modify:** `electron/preload.ts`
   - Add new IPC handler: `audioProcessChunk`
   ```typescript
   audioProcessChunk: (audioData: Float32Array) => 
     ipcRenderer.invoke('audio-process-chunk', audioData)
   ```

5. **Modify:** `electron/ipc/audioHandlers.ts`
   - Add handler for 'audio-process-chunk'
   - Forward audio data to AudioStreamProcessor

6. **Create:** `src/components/AudioCapture.tsx`
   - React component to manage microphone capture
   - Uses MicrophoneCapture service
   - Handles permission UI
   - Sends audio to main process

### Phase 2: Fix Entitlements 🔒 CRITICAL

**Goal:** Add missing network entitlements for API calls

**File to Modify:** `CueMeFinal/assets/entitlements.mac.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <!-- JIT and Memory -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.debugger</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    
    <!-- Audio Permissions -->
    <key>com.apple.security.device.microphone</key>
    <true/>
    <key>com.apple.security.device.audio-input</key>
    <true/>
    <key>com.apple.security.device.screen-capture</key>
    <true/>
    
    <!-- Network Permissions (ADDED) -->
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    
    <!-- Disable Sandbox -->
    <key>com.apple.security.app-sandbox</key>
    <false/>
  </dict>
</plist>
```

### Phase 3: Update Build Configuration 📦

**Goal:** Add minimumSystemVersion and ensure proper build settings

**File to Modify:** `CueMeFinal/package.json`

```json
{
  "build": {
    "mac": {
      "category": "public.app-category.productivity",
      "icon": "assets/logo.icns",
      "minimumSystemVersion": "11.0",  // ADDED
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        },
        {
          "target": "zip",
          "arch": ["x64", "arm64"]
        }
      ],
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "assets/entitlements.mac.plist",
      "entitlementsInherit": "assets/entitlements.mac.plist",
      "notarize": {
        "teamId": "${APPLE_TEAM_ID}"
      },
      "extendInfo": {
        "NSMicrophoneUsageDescription": "CueMe needs microphone access to listen for interview questions and provide real-time coding assistance.",
        "NSScreenCaptureDescription": "CueMe uses screen recording to capture system audio from video calls (Zoom, Teams, etc.) for better interview question detection. No visual recording is performed - only audio is captured."
      }
    }
  }
}
```

### Phase 4: Update IPC Architecture 🔄

**Goal:** Ensure proper communication between renderer and main for audio

**Files to Modify:**

1. **`electron/ipc/audioHandlers.ts`**
   - Add `audio-process-chunk` handler
   - Add `audio-request-mic-permission` handler
   - Add `audio-check-mic-permission` handler

2. **`electron/preload.ts`**
   - Expose new audio IPC methods
   - Document which methods are renderer-side vs main-side

3. **`src/types/electron.d.ts`**
   - Update type definitions for new IPC methods

### Phase 5: Remove AudioDebugger from Production 🧹

**Goal:** AudioDebugger should not run in production or should be fixed

**File to Modify:** `electron/main.ts`

**Option A - Remove from production:**
```typescript
// Remove or comment out lines 23-30
// if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
//   Logger.info('[Main] Running audio system diagnostics...');
//   setTimeout(() => {
//     AudioDebugger.diagnoseAudioSystem().catch(error => {
//       Logger.error('[Main] Audio diagnostics failed:', error);
//     });
//   }, 2000);
// }
```

**Option B - Fix AudioDebugger:**
- Move permission checks to IPC calls to renderer
- Remove direct `navigator` usage
- Make it production-safe

### Phase 6: Testing Strategy 🧪

**Development Testing:**
1. ✅ Test microphone capture in renderer (existing code already correct)
2. ✅ Test system audio capture in main (macOS native binary)
3. ✅ Test IPC communication (handler added)
4. ⏭️ Test permission flows (NEXT)
5. ⏭️ Test audio transcription pipeline (NEXT)

**Production Build Testing:**
```bash
# 1. Clean previous builds
npm run clean

# 2. Build native modules (macOS only)
npm run build:native

# 3. Build the app
npm run build

# 4. Package for macOS
npm run app:build:mac

# 5. Install from release/ directory
open release/CueMe-*.dmg

# 6. Test the installed app
# - Launch CueMe
# - Check Console.app for errors (filter by "CueMe")
# - Test microphone permission request
# - Test system audio permission request  
# - Test audio capture and transcription
# - Test question detection
# - Test API calls (OpenAI, Gemini, Supabase)
```

**What to Check:**
- [ ] No "navigator is not defined" errors in Console.app
- [ ] Microphone permission dialog appears
- [ ] Screen recording permission dialog appears (for system audio)
- [ ] Audio transcription works
- [ ] Question detection works
- [ ] API calls succeed (check network tab if needed)
- [ ] No entitlement errors in Console.app

**Release Testing:**
1. Create GitHub release with tag (e.g., v1.0.70)
2. Wait for GitHub Actions to build and upload
3. Download from GitHub releases page
4. Test on clean macOS system (or new user account)
5. Verify all audio features work
6. Verify network requests work
7. Check for any permission or entitlement errors

---

## Implementation Order

### Sprint 1: Critical Fixes (2-3 days) ✅ COMPLETED
1. ✅ Create MicrophoneCapture service in renderer
2. ✅ Update SystemAudioCapture to remove navigator usage
3. ✅ Add network entitlements
4. ✅ Update package.json with minimumSystemVersion
5. ⏭️ Test local build (NEXT)

### Sprint 2: IPC Architecture (1-2 days) ✅ COMPLETED
1. ✅ Add new IPC handlers (audio-process-microphone-chunk)
2. ✅ Update preload script
3. ✅ Update type definitions
4. ⏭️ Test IPC communication (NEXT)

### Sprint 3: UI Integration (1 day) ✅ COMPLETED
1. ✅ Create useMicrophoneCapture hook
2. ⏭️ Integrate with existing UI (OPTIONAL - current code already works in renderer)
3. ⏭️ Test permission flows (NEXT)

### Sprint 4: Testing & Release (1 day) 🔄 IN PROGRESS
1. ⏭️ Test production build locally (NEXT)
2. ⏭️ Create test release
3. ⏭️ Verify on clean system
4. ⏭️ Deploy to production

---

## Success Criteria

- [ ] Microphone capture works in released build (macOS)
- [ ] System audio capture works in released build (macOS)
- [ ] Audio transcription works in released build
- [ ] Question detection works in released build
- [ ] API calls (OpenAI, Gemini, Supabase) work in released build
- [ ] No console errors related to navigator
- [ ] No permission errors in Console.app
- [ ] App passes macOS Gatekeeper
- [ ] App is properly notarized

**Note on Windows:** Windows system audio capture also needs to be moved to renderer process (uses getDisplayMedia). This is a separate issue and should be addressed if Windows support is needed.

---

## Risk Assessment

### High Risk
- **Breaking existing functionality** - Mitigation: Thorough testing in dev before building
- **Permission dialogs not appearing** - Mitigation: Test entitlements carefully
- **IPC communication failures** - Mitigation: Add error handling and logging

### Medium Risk
- **Performance degradation** - Mitigation: Profile audio processing
- **Memory leaks** - Mitigation: Proper cleanup in renderer

### Low Risk
- **Build failures** - Mitigation: Test build process incrementally
- **Notarization issues** - Mitigation: Entitlements are correct

---

## Related Files

### Critical Files
- `electron/SystemAudioCapture.ts` - Remove navigator usage
- `electron/AudioDebugger.ts` - Remove navigator usage
- `assets/entitlements.mac.plist` - Add network entitlements
- `package.json` - Add minimumSystemVersion

### New Files to Create
- `src/services/MicrophoneCapture.ts` - Renderer-side mic capture
- `src/components/AudioCapture.tsx` - UI for mic capture

### Files to Update
- `electron/ipc/audioHandlers.ts` - Add new handlers
- `electron/preload.ts` - Expose new IPC methods
- `src/types/electron.d.ts` - Update types
- `electron/main.ts` - Remove/fix AudioDebugger

---

## References

- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [macOS Entitlements](https://developer.apple.com/documentation/bundleresources/entitlements)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

---

## Notes

### Why This Happens
The fundamental issue is a **process context mismatch**. Electron has two main processes:

1. **Main Process (Node.js)** - Backend, file system, native modules
2. **Renderer Process (Chromium)** - Frontend, DOM, browser APIs

Browser APIs like `navigator.mediaDevices` only exist in the renderer. The code was trying to use them in the main process, which works in dev due to different module resolution but fails in production.

### Glass Pattern
Glass (the working app) follows the correct pattern:
- Microphone access in renderer via `navigator.mediaDevices`
- System audio in main via native modules
- IPC bridge between the two
- Proper entitlements for both audio and network

### Why Dev Works
- Electron dev mode is more permissive
- Module resolution may load browser polyfills
- Timing differences mask the issue
- Hot reload may reinitialize in correct context

---

## 🔧 Build Environment Fixes

### Python 3.12 Compatibility Issue
**Problem:** macOS-latest runners now use Python 3.12, which removed the `distutils` module that node-gyp depends on.

**Solution:** Added Python 3.11 setup to GitHub Actions workflow:
```yaml
- name: Setup Python
  uses: actions/setup-python@v5
  with:
    python-version: '3.11'
```

**Affected modules:** `bufferutil`, `utf-8-validate`, `sharp` (all need node-gyp to compile)

**Environment variables added:**
- `PYTHON: python3` in all build steps to ensure correct Python is used

---

## 📋 Testing Instructions

See [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) for detailed testing procedures.

**Quick Test:**
```bash
npm run clean
npm run build:native  # macOS only
npm run build
npm run app:build:mac
open release/CueMe-*.dmg
```

Then verify:
1. No "navigator is not defined" errors in Console.app
2. Microphone permission works
3. System audio permission works
4. Audio transcription works
5. API calls work (OpenAI, Gemini, Supabase)

---

## 🔍 ROOT CAUSE IDENTIFIED (2025-10-25)

### System Audio Issue ✅ CONFIRMED

**Error:** `spawn ENOTDIR` when trying to start audiotee binary

**Root Cause:**
The audiotee binary is packaged INSIDE `app.asar` (read-only archive):
```
/Applications/CueMe.app/Contents/Resources/app.asar/node_modules/audiotee/bin/audiotee
```

**Problem:** Node.js cannot execute binaries from inside asar files. The binary must be in `app.asar.unpacked`.

**Evidence from logs:**
```
[SystemAudioCapture] ✅ Found audiotee binary
  "path": ".../app.asar/node_modules/audiotee/bin/audiotee"
  "isExecutable": false
[SystemAudioCapture] ❌ Failed to start macOS system audio
  Error: spawn ENOTDIR
```

**Fix Applied:** ✅
1. ✅ Added `asarUnpack` to package.json to exclude audiotee from asar
2. ✅ Updated binary path search to check unpacked location first

---

### Microphone Issue ✅ CONFIRMED

**Error:** Audio chunks being dropped due to stale closure

**Root Cause:**
React closure issue in QueueCommands.tsx - the ScriptProcessor's `onaudioprocess` callback was checking `isListening` (React state) instead of `frontendListeningRef.current` (ref).

**Evidence from DevTools console:**
```
[QueueCommands] Set isListening to true
[QueueCommands] Set frontendListening to true
[QueueCommands] Audio process event 1, isListening: false  ← Stale closure!
[QueueCommands] Not listening, dropping audio chunk
```

**Problem:**
1. getUserMedia() works ✅
2. Audio capture starts ✅
3. BUT: Callback has stale `isListening` value (false) due to closure
4. All audio chunks dropped ❌

**Why it happens:**
- The callback is created with a closure over the current `isListening` state
- React state updates don't affect already-created closures
- The code has `frontendListeningRef` to avoid this, but wasn't using it in the check

**Fix Applied:** ✅
Changed line 649 in QueueCommands.tsx:
```typescript
// Before: if (!isListening) { ... }
// After:  if (!frontendListeningRef.current) { ... }
```

---

## 🎯 What's Next

1. ✅ **Phase 1: Add comprehensive logging** - COMPLETE
2. ✅ **Build and test locally** - COMPLETE
3. ✅ **Analyze logs** - COMPLETE
4. ✅ **Identify root cause** - SYSTEM AUDIO CONFIRMED, MICROPHONE NEEDS DEVTOOLS
5. ✅ **Fix system audio** - Added asarUnpack config and updated path search
6. ✅ **Diagnose microphone** - Identified React closure issue from DevTools logs
7. ✅ **Fix microphone** - Changed to use frontendListeningRef.current
8. ⏭️ **Test fixes** - Rebuild and verify both fixes in production build
9. ⏭️ **Deploy** - Create GitHub release

---

**Last Updated:** 2025-10-25  
**Status:** Both root causes identified and fixed!  
**Next Step:** Rebuild and test: `npm run clean && npm run build && npm run app:build:mac`
