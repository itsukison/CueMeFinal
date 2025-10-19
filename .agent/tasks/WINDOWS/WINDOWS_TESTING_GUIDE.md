# Windows System Audio Testing Guide

**Date**: 2025-10-19  
**Status**: Ready for Testing  
**Implementation**: Complete

---

## Prerequisites

### System Requirements
- **OS**: Windows 10 (version 1809+) or Windows 11
- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Audio**: Any audio output device

### Build Requirements
- Git (to clone/pull latest code)
- Visual Studio Build Tools (for native modules)
- ~2GB free disk space

---

## Setup Instructions

### 1. Get Latest Code

```bash
# If you haven't cloned yet
git clone <repository-url>
cd CueMeFinal

# If you already have the repo
git pull origin main
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Application

```bash
# Full build (includes native binaries)
npm run build

# Or just compile TypeScript for testing
npx tsc -p electron/tsconfig.json
```

### 4. Start Development Mode

```bash
npm start
```

The app should launch with both Vite dev server and Electron.

---

## Testing Checklist

### Phase 1: Basic Functionality ✅

#### Test 1.1: Audio Source Detection
**Goal**: Verify Windows system audio appears as an option

**Steps**:
1. Launch CueMe on Windows
2. Open Settings or Audio Source selector
3. Look for available audio sources

**Expected Result**:
```
✅ "Microphone" appears
✅ "System Audio (Native Loopback)" appears
✅ Both sources show as "available"
```

**Console Output to Check**:
```
[SystemAudioCapture] Enumerating available audio sources...
[SystemAudioCapture] System audio available (Native Electron Loopback)
[SystemAudioCapture] Available sources: [...]
```

**Pass Criteria**: Both sources visible and available

---

#### Test 1.2: System Audio Capture Start
**Goal**: Verify system audio capture can start without errors

**Steps**:
1. Select "System Audio (Native Loopback)" source
2. Click "Start Listening" or equivalent button
3. Watch console for logs

**Expected Result**:
```
✅ No errors in console
✅ Capture starts successfully
✅ Audio tracks detected
```

**Console Output to Check**:
```
[SystemAudioCapture] Starting capture from source: system-audio
[SystemAudioCapture] Starting Windows system audio capture with native loopback...
[DisplayMedia] Granting access to screen with loopback audio
[SystemAudioCapture] Windows loopback audio tracks: 1
[SystemAudioCapture] Audio track: { label: '...', enabled: true, ... }
[SystemAudioCapture] Setting up audio processing...
[SystemAudioCapture] ✅ Windows system audio capture started successfully
```

**Pass Criteria**: Capture starts without errors, audio track detected

---

#### Test 1.3: Audio Data Flow
**Goal**: Verify audio data is being captured and processed

**Steps**:
1. With system audio capture running
2. Play audio from any source (YouTube, Spotify, system sounds)
3. Watch console for audio data logs

**Expected Result**:
```
✅ Audio data events appear in console
✅ RMS values show non-zero when audio plays
✅ No errors during processing
```

**Console Output to Check**:
```
[AudioStreamProcessor] 🎵 Received audio data: 4096 samples
[AudioStreamProcessor] 📊 Audio levels: RMS=0.0234, Max=0.1234
[AudioStreamProcessor] 🎤 Speech started (RMS: 0.0234)
```

**Pass Criteria**: Audio data flows when audio is playing

---

### Phase 2: Transcription Quality 🎯

#### Test 2.1: Speech Recognition
**Goal**: Verify transcription works with system audio

**Steps**:
1. Start system audio capture
2. Play a YouTube video with clear speech (e.g., interview, podcast)
3. Wait for transcription to appear

**Test Audio Sources**:
- YouTube interview video
- Podcast with clear speech
- Mock interview questions
- System text-to-speech

**Expected Result**:
```
✅ Transcriptions appear in UI
✅ Text is accurate (>80% word accuracy)
✅ Timing is reasonable (<5 second delay)
```

**Pass Criteria**: Transcriptions appear with acceptable accuracy

---

#### Test 2.2: Question Detection
**Goal**: Verify question detection works with system audio

**Steps**:
1. Start system audio capture
2. Play audio containing questions (e.g., "What is your experience with Python?")
3. Check if questions are detected and highlighted

**Test Questions**:
- "What is your experience with JavaScript?"
- "Can you explain how async/await works?"
- "Tell me about a challenging project you worked on"
- "How would you implement a binary search tree?"

**Expected Result**:
```
✅ Questions are detected
✅ Questions are highlighted/marked in UI
✅ Detection accuracy is good (>70%)
```

**Pass Criteria**: Questions are detected and marked

---

#### Test 2.3: Transcription Comparison
**Goal**: Compare system audio vs microphone quality

**Steps**:
1. Record same audio with microphone
2. Record same audio with system audio
3. Compare transcription accuracy

**Expected Result**:
```
✅ System audio quality similar to microphone
✅ No significant degradation
✅ Both produce usable transcriptions
```

**Pass Criteria**: System audio quality comparable to microphone

---

### Phase 3: Reliability & Performance 🔧

#### Test 3.1: Start/Stop Cycles
**Goal**: Verify capture can be started and stopped reliably

**Steps**:
1. Start system audio capture
2. Wait 10 seconds
3. Stop capture
4. Repeat 5 times

**Expected Result**:
```
✅ All starts succeed
✅ All stops succeed
✅ No errors or crashes
✅ No resource leaks
```

**Console Output to Check**:
```
[SystemAudioCapture] Starting capture...
[SystemAudioCapture] ✅ Windows system audio capture started successfully
[SystemAudioCapture] Stopping audio capture...
[SystemAudioCapture] Successfully stopped capture
```

**Pass Criteria**: 5/5 cycles complete without errors

---

#### Test 3.2: Source Switching
**Goal**: Verify switching between microphone and system audio

**Steps**:
1. Start with microphone
2. Switch to system audio
3. Switch back to microphone
4. Repeat 3 times

**Expected Result**:
```
✅ All switches succeed
✅ Audio continues flowing after switch
✅ No errors during transitions
```

**Pass Criteria**: Smooth transitions between sources

---

#### Test 3.3: Memory Leak Test
**Goal**: Verify no memory leaks during extended use

**Steps**:
1. Open Windows Task Manager
2. Note initial memory usage
3. Start system audio capture
4. Let run for 5 minutes with audio playing
5. Stop capture
6. Note final memory usage

**Expected Result**:
```
✅ Memory usage stable during capture
✅ Memory released after stop
✅ No continuous memory growth
```

**Acceptable Memory Usage**:
- Initial: ~100-200 MB
- During capture: ~150-300 MB
- After stop: Returns to ~100-200 MB

**Pass Criteria**: Memory usage stable, no leaks

---

#### Test 3.4: CPU Usage Test
**Goal**: Verify reasonable CPU usage

**Steps**:
1. Open Windows Task Manager
2. Start system audio capture
3. Monitor CPU usage for 2 minutes
4. Note average CPU usage

**Expected Result**:
```
✅ CPU usage reasonable (<20% on modern CPU)
✅ No CPU spikes or freezes
✅ App remains responsive
```

**Pass Criteria**: CPU usage acceptable, app responsive

---

### Phase 4: Error Handling 🛡️

#### Test 4.1: No Audio Playing
**Goal**: Verify capture works even with silence

**Steps**:
1. Mute all system audio
2. Start system audio capture
3. Verify no errors

**Expected Result**:
```
✅ Capture starts successfully
✅ No errors in console
✅ App remains stable
```

**Console Output to Check**:
```
[AudioStreamProcessor] ⚠️ Audio below threshold (RMS 0.0000 < 0.01)
```

**Pass Criteria**: Handles silence gracefully

---

#### Test 4.2: Multiple Stop Attempts
**Goal**: Verify stopping multiple times doesn't cause errors

**Steps**:
1. Start system audio capture
2. Stop capture
3. Try stopping again (should be no-op)
4. Try stopping a third time

**Expected Result**:
```
✅ First stop succeeds
✅ Subsequent stops are no-ops
✅ No errors or crashes
```

**Console Output to Check**:
```
[SystemAudioCapture] Stopping audio capture...
[SystemAudioCapture] Successfully stopped capture
[SystemAudioCapture] Not currently capturing
```

**Pass Criteria**: Handles multiple stops gracefully

---

#### Test 4.3: Permission Denial (if applicable)
**Goal**: Verify graceful handling if permission denied

**Steps**:
1. If Windows shows permission dialog, deny it
2. Check error message

**Expected Result**:
```
✅ Clear error message shown
✅ App doesn't crash
✅ Can retry after granting permission
```

**Pass Criteria**: Graceful error handling

---

### Phase 5: Real-World Scenarios 🌍

#### Test 5.1: Zoom/Teams Meeting
**Goal**: Verify works with video conferencing apps

**Steps**:
1. Join a Zoom or Teams meeting
2. Start system audio capture
3. Verify interviewer's questions are captured

**Expected Result**:
```
✅ Questions from interviewer are transcribed
✅ Audio quality is good
✅ No interference with meeting audio
```

**Pass Criteria**: Works with video conferencing

---

#### Test 5.2: Multiple Audio Sources
**Goal**: Verify works with multiple apps playing audio

**Steps**:
1. Open YouTube in browser
2. Open Spotify
3. Start system audio capture
4. Play audio from both

**Expected Result**:
```
✅ Captures mixed audio
✅ Transcription works (may be mixed)
✅ No errors or crashes
```

**Pass Criteria**: Handles multiple audio sources

---

#### Test 5.3: Long Session
**Goal**: Verify stability during extended use

**Steps**:
1. Start system audio capture
2. Play audio continuously for 30 minutes
3. Monitor for issues

**Expected Result**:
```
✅ Capture remains stable
✅ Transcriptions continue working
✅ No memory leaks
✅ No performance degradation
```

**Pass Criteria**: Stable for 30+ minutes

---

## Troubleshooting

### Issue: "No audio track in native loopback stream"

**Possible Causes**:
- Display media handler not set up correctly
- Electron version too old
- Windows audio system issue

**Solutions**:
1. Verify Electron version: `npm list electron` (should be 30.5.1+)
2. Check main.ts has `setDisplayMediaRequestHandler`
3. Restart Windows audio service
4. Try different audio output device

---

### Issue: Audio data all zeros (silence)

**Possible Causes**:
- No audio playing
- Audio output muted
- Wrong audio device selected

**Solutions**:
1. Verify audio is playing (check Windows volume mixer)
2. Unmute system audio
3. Try playing test audio (YouTube video)
4. Check Windows audio settings

---

### Issue: Transcriptions not appearing

**Possible Causes**:
- Audio too quiet
- Transcription service issue
- API key missing/invalid

**Solutions**:
1. Check audio levels in console (RMS values)
2. Increase system volume
3. Verify API keys in .env file
4. Check network connectivity

---

### Issue: High CPU usage

**Possible Causes**:
- Audio processing too intensive
- Memory leak
- Other apps using CPU

**Solutions**:
1. Close other applications
2. Check Task Manager for other processes
3. Restart the app
4. Check for memory leaks (see Test 3.3)

---

## Success Criteria Summary

### Must Pass (Critical)
- [ ] Audio source detection works
- [ ] System audio capture starts without errors
- [ ] Audio data flows correctly
- [ ] Transcriptions appear
- [ ] Start/stop cycles work reliably
- [ ] No memory leaks

### Should Pass (Important)
- [ ] Question detection works
- [ ] Transcription quality good (>80%)
- [ ] Source switching works
- [ ] CPU usage reasonable (<20%)
- [ ] Works with video conferencing

### Nice to Have (Optional)
- [ ] Works with multiple audio sources
- [ ] Stable for 30+ minutes
- [ ] Handles edge cases gracefully

---

## Reporting Issues

If you find issues during testing, please report with:

1. **Environment**:
   - Windows version (10/11)
   - Electron version
   - Node.js version

2. **Steps to Reproduce**:
   - Exact steps taken
   - Audio source used
   - Any error messages

3. **Console Logs**:
   - Copy relevant console output
   - Include timestamps if possible

4. **Expected vs Actual**:
   - What you expected to happen
   - What actually happened

5. **Screenshots/Videos**:
   - If applicable, include screenshots
   - Screen recording of the issue

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Update documentation with Windows support
2. Create user guide for Windows setup
3. Update README.md
4. Mark task as DONE
5. Archive implementation plan

### If Issues Found ⚠️
1. Document all issues found
2. Prioritize by severity
3. Create fix plan
4. Implement fixes
5. Re-test

### If Critical Issues Found ❌
1. Consider rollback
2. Analyze root cause
3. Consult with glass project implementation
4. Create detailed fix plan
5. Re-implement if necessary

---

## Testing Completion Checklist

- [ ] All Phase 1 tests passed (Basic Functionality)
- [ ] All Phase 2 tests passed (Transcription Quality)
- [ ] All Phase 3 tests passed (Reliability & Performance)
- [ ] All Phase 4 tests passed (Error Handling)
- [ ] All Phase 5 tests passed (Real-World Scenarios)
- [ ] Issues documented (if any)
- [ ] Test results reported
- [ ] Next steps determined

---

**Testing Guide Version**: 1.0  
**Created**: 2025-10-19  
**For**: Windows System Audio Implementation  
**Status**: Ready for Use
