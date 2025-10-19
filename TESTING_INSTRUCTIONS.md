# Testing Instructions for Audio Recording Fix

## What Was Fixed

Added comprehensive logging to the audio recording system to diagnose why recording doesn't work in production.

### Files Modified:
1. `electron/AudioStreamProcessor.ts` - Added Logger import and logging to `startListening()` method
2. `electron/ipc/audioHandlers.ts` - Added Logger import and logging to IPC handlers

## How to Test

### Step 1: Build the App
```bash
cd CueMeFinal
npm run app:build:mac
```

### Step 2: Clear Old Logs
```bash
> ~/Library/Logs/CueMe/main.log
```

### Step 3: Run the App
```bash
open release/mac/CueMe.app
```

### Step 4: Watch Logs in Real-Time
In a separate terminal:
```bash
tail -f ~/Library/Logs/CueMe/main.log
```

### Step 5: Try Recording

**Test Microphone:**
1. Click the microphone button in the app
2. Watch the logs - you should see:
   ```
   [IPC audioHandlers] 🎙️  Received audio-stream-start request with sourceId: microphone
   [AudioStreamProcessor] 🎙️  startListening called with sourceId: microphone
   [AudioStreamProcessor] Using default microphone source
   [AudioStreamProcessor] ✅ Listening started successfully with source: Microphone
   [IPC audioHandlers] ✅ Audio stream started successfully
   ```

**Test System Audio:**
1. Click the system audio button in the app
2. Watch the logs - you should see:
   ```
   [IPC audioHandlers] 🎙️  Received audio-stream-start request with sourceId: system
   [AudioStreamProcessor] 🎙️  startListening called with sourceId: system
   [AudioStreamProcessor] Starting system audio capture for source: system
   ```
   
   Then either:
   - Success: `[AudioStreamProcessor] ✅ System audio capture started successfully`
   - Or Error: `[AudioStreamProcessor] ❌ System audio capture failed:` (with error details)

## What to Look For

### If Recording Works:
- You'll see the "✅ Listening started successfully" message
- Audio chunks will be logged as they're processed
- Transcriptions will appear

### If Recording Fails:
- You'll see "❌" error messages explaining WHY it failed
- Common issues:
  - Permission denied
  - Binary not executable
  - System audio source not available
  - Fallback to microphone

## Share the Logs

After testing, share the complete log output:
```bash
cat ~/Library/Logs/CueMe/main.log
```

This will show exactly where the recording process is failing.

## Quick Release Test

If you want to test the GitHub release build:

```bash
# Commit changes
git add .
git commit -m "fix: Add comprehensive logging to audio recording system"

# Create tag
git tag v1.0.68
git push origin main
git push origin v1.0.68
```

Then download the released .dmg and test the same way.
