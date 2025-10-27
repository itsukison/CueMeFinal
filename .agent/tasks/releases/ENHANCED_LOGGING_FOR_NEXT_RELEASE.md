# 🔍 Enhanced Logging for System Audio Diagnosis

**Date:** 2025-10-26  
**Purpose:** Pinpoint exact location where system audio buffers become all-zeros  
**Status:** ✅ LOGGING ENHANCED - Ready for next release

---

## 🎯 **Objective**

The current production logs show:

- ✅ `audiotee` binary runs and sends 6400-byte chunks
- ✅ Events flow through the pipeline
- ❌ **But buffers contain ONLY zeros!**

**We need to answer:**

1. Are buffers zeros **when `audiotee` produces them**?
2. Or do they become zeros **during event emission/handling**?

---

## 📊 **Enhanced Logging Added**

### **1. SystemAudioCapture.ts - audiotee stdout handler**

**Location:** Line ~481-520

**What's Logged:**

#### **🔬 RAW BUFFER ANALYSIS (First Chunk)**

```typescript
logger.info("🎵 FIRST audio chunk from audiotee (RAW BUFFER ANALYSIS)", {
  bytes: data.length, // Should be 6400
  hexPreview: hexPreview, // First 32 bytes in hex
  isAllZeros: isAllZeros, // TRUE = problem at source!
  rms: rms.toFixed(2), // Audio level
  normalizedRMS: normalizedRMS.toFixed(4), // 0-1 range
  isSilent: normalizedRMS < 0.01, // Is it silent?
  listenerCount: this.listenerCount("audio-data"),
  hasListeners: this.listenerCount("audio-data") > 0,
});
```

**If all zeros at source:**

```typescript
logger.error("❌ CRITICAL: audiotee produced ALL-ZERO buffer!", {
  message: "The binary is running but producing silent audio",
  possibleCauses: [
    "1. macOS Screen Recording permission conflict",
    "2. Core Audio Taps access denied",
    "3. Binary lacks proper entitlements",
    "4. No audio playing on system",
  ],
});
```

#### **📋 BUFFER COPY VERIFICATION (First Chunk)**

```typescript
logger.info("📋 Buffer copy verification", {
  originalLength: data.length,
  copyLength: bufferCopy.length,
  copyHexPreview: copyHexPreview, // Hex of copied buffer
  copyIsAllZeros: copyIsAllZeros, // Did copy operation preserve zeros?
  copiedSuccessfully: data.length === bufferCopy.length,
});
```

**Purpose:** Verify that `Buffer.from(data)` actually created a proper copy.

---

### **2. SystemAudioCapture.ts - audiotee stderr handler**

**Location:** Line ~557-588

**What's Logged:**

#### **All Non-Debug Messages**

```typescript
// Previously: Only logged stream_start/stop/error
// Now: ALL info, metadata, and other message types

logger.info(`AudioTee [${logMessage.message_type}]`, logMessage.data);
```

#### **Raw Output**

```typescript
// Previously: Debug level
// Now: Info level for visibility

logger.info("AudioTee raw output:", line);
```

**Purpose:** Capture ALL output from `audiotee` binary, including:

- `stream_start` (confirms Core Audio Taps access)
- `metadata` (audio format info)
- Any error messages or warnings
- Configuration details

---

### **3. DualAudioCaptureManager.ts - audio-data event handler**

**Location:** Line ~86-130

**What's Logged:**

#### **🔊 BUFFER STATE AT RECEIVER (First Event)**

```typescript
logger.info("🔊 FIRST audio-data event received (DualAudioCaptureManager)", {
  bufferSize: audioData.length,
  hexPreview: hexPreview, // First 32 bytes in hex
  isAllZeros: isAllZeros, // TRUE = became zeros during emit!
  rms: rms.toFixed(2), // Audio level
  isCapturing: this.isCapturing,
  timestamp: now,
});
```

**If zeros when received:**

```typescript
logger.error(
  "❌ Buffer is ALL ZEROS when received by DualAudioCaptureManager!",
  {
    message:
      "Buffer became zeros between SystemAudioCapture emit and DualAudioCaptureManager receive",
    implication:
      "This indicates buffer was overwritten during async event handling",
  }
);
```

**Purpose:** Determine if buffer was fine when emitted but became zeros during event propagation.

---

## 🧪 **Diagnostic Scenarios**

### **Scenario A: Zeros at Source**

```
✅ audiotee process spawned { pid: 12345 }
❌ AudioTee [info] { message: "Audio device started successfully" } ← MISSING!
🎵 FIRST audio chunk (RAW) { isAllZeros: true, rms: 0.00 } ← ZEROS FROM START!
❌ CRITICAL: audiotee produced ALL-ZERO buffer!
📋 Buffer copy verification { copyIsAllZeros: true } ← Copy preserved zeros
🔊 FIRST audio-data event (DualAudioCaptureManager) { isAllZeros: true }
```

**Diagnosis:** `audiotee` binary cannot access Core Audio Taps.

**Root Cause Options:**

1. macOS Screen Recording permission conflict
2. Binary lacks entitlements
3. Permission denied by macOS

---

### **Scenario B: Zeros During Event Propagation**

```
✅ audiotee process spawned { pid: 12345 }
✅ AudioTee [stream_start] ← Binary working!
🎵 FIRST audio chunk (RAW) { isAllZeros: false, rms: 1234.56, hexPreview: "a3 4f 12..." } ← REAL DATA!
📋 Buffer copy verification { copyIsAllZeros: false, copyHexPreview: "a3 4f 12..." } ← Copy OK!
❌ 🔊 FIRST audio-data event (DualAudioCaptureManager) { isAllZeros: true, hexPreview: "00 00 00..." } ← BECAME ZEROS!
❌ Buffer is ALL ZEROS when received by DualAudioCaptureManager!
```

**Diagnosis:** Buffer was overwritten between emit and receive (async issue).

**Root Cause:** Buffer reuse by `audiotee` despite `Buffer.from()` copy.

---

### **Scenario C: Working Correctly**

```
✅ audiotee process spawned { pid: 12345 }
✅ AudioTee [stream_start]
🎵 FIRST audio chunk (RAW) { isAllZeros: false, rms: 1234.56, hexPreview: "a3 4f 12..." } ← REAL DATA!
📋 Buffer copy verification { copyIsAllZeros: false, copyHexPreview: "a3 4f 12..." } ← Copy OK!
✅ 🔊 FIRST audio-data event (DualAudioCaptureManager) { isAllZeros: false, hexPreview: "a3 4f 12..." } ← STILL REAL DATA!
📤 FIRST audio chunk sent to Gemini (opponent) { hexPreview: "a3 4f 12..." } ← SUCCESS!
```

**Diagnosis:** Everything works! 🎉

---

## 📝 **What the Next Logs Will Tell Us**

### **Key Questions Answered:**

1. **Is `audiotee` accessing Core Audio Taps?**
   - Look for: `AudioTee [stream_start]` message
   - If missing → Permission denied

2. **Is the buffer all zeros at source?**
   - Look for: `FIRST audio chunk (RAW) { isAllZeros: true }`
   - If true → `audiotee` not capturing audio

3. **Does buffer copy work?**
   - Look for: `Buffer copy verification { copyIsAllZeros: false }`
   - If false → Copy worked correctly

4. **Does buffer survive event emission?**
   - Compare hex previews:
     - `RAW BUFFER ANALYSIS: hexPreview: "a3 4f 12..."`
     - `DualAudioCaptureManager: hexPreview: "a3 4f 12..."` (should match!)
   - If different → Buffer corruption during event handling

5. **Are all audiotee messages being logged?**
   - Look for: `AudioTee [info]`, `AudioTee [metadata]`, etc.
   - This tells us what the binary is actually doing

---

## 🚀 **Next Steps**

1. **Build new release:**

   ```bash
   cd /Users/itsukison/Desktop/CueMe/CueMeFinal
   npm run build
   npm run app:build:mac
   ```

2. **Test and collect logs:**
   - Install the new build
   - Play YouTube audio with system audio permission
   - Check: `~/Library/Logs/CueMe/main.log`

3. **Analyze new logs:**
   - Follow the diagnostic scenarios above
   - Identify which scenario matches
   - Root cause will be clear!

---

## ✅ **Files Modified**

1. `/Users/itsukison/Desktop/CueMe/CueMeFinal/electron/SystemAudioCapture.ts`
   - Enhanced stdout handler (lines 481-520)
   - Enhanced stderr handler (lines 557-588)

2. `/Users/itsukison/Desktop/CueMe/CueMeFinal/electron/audio/DualAudioCaptureManager.ts`
   - Enhanced audio-data event handler (lines 86-130)

---

## 📊 **Expected Log Output (Next Release)**

```
[SystemAudioCapture] 🎵 FIRST audio chunk from audiotee (RAW BUFFER ANALYSIS) {
  "bytes": 6400,
  "hexPreview": "????????????????",  ← KEY: Will tell us if zeros or real data!
  "isAllZeros": ????,                ← KEY: True = problem at source
  "rms": "????",
  "normalizedRMS": "????",
  "isSilent": ????
}

[SystemAudioCapture] 📋 Buffer copy verification {
  "copyHexPreview": "????????????????", ← KEY: Should match original!
  "copyIsAllZeros": ????                ← KEY: Should match original!
}

[DualAudioCaptureManager] 🔊 FIRST audio-data event received {
  "hexPreview": "????????????????",  ← KEY: Compare with RAW BUFFER!
  "isAllZeros": ????                ← KEY: Should match RAW BUFFER!
}
```

**These three log entries will definitively tell us where the zeros appear!**

---

**Status:** Ready to build and test  
**Priority:** P0 - Critical for production system audio  
**Expected Resolution:** Next release logs will reveal root cause
