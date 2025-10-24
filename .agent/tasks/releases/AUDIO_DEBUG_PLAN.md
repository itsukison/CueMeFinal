# Audio Pipeline Production Debugging Plan

**Status:** 🔍 INVESTIGATION IN PROGRESS  
**Created:** 2025-10-24  
**Priority:** P0 - Blocks production usage

---

## Problem Statement

Both microphone and system audio work perfectly in development (`npm run dev`) but **completely fail** when the app is built and distributed via GitHub releases. Users download the app and neither audio feature works.

**Critical Finding:** Both features failing suggests a **common root cause**, not separate issues.

---

## Potential Root Causes (Ranked by Likelihood)

### 🔴 HIGH PROBABILITY

1. **Permissions Not Requested at Runtime**
   - macOS requires explicit permission prompts via system dialogs
   - Entitlements alone don't grant permissions - user must approve
   - Permission requests might be failing silently
   - **Test:** Check if permission dialogs appear at all

2. **Entitlements Not Applied During Code Signing**
   - entitlements.mac.plist exists but might not be embedded in signed app
   - electron-builder might not be applying entitlements correctly
   - **Test:** `codesign -dv --entitlements - /path/to/CueMe.app`

3. **Web Audio API Blocked in Production Context**
   - Electron's security policies might block getUserMedia() in production
   - File protocol restrictions
   - Content Security Policy blocking audio access
   - **Test:** Try getUserMedia() in production and log exact error

4. **IPC Communication Broken**
   - Renderer can't communicate with main process
   - Preload script not loading correctly
   - Context isolation issues
   - **Test:** Simple IPC ping/pong test

### 🟡 MEDIUM PROBABILITY

5. **Binary Packaging Issues (audiotee)**
   - Binary not included in app bundle
   - Binary path resolution fails in production
   - Binary lacks execution permissions
   - Binary not code-signed (Gatekeeper blocks it)
   - **Test:** Check if binary exists and is executable in packaged app

6. **Native Module Compilation Issues**
   - Native modules (bufferutil, utf-8-validate, sharp) not built for production
   - Wrong architecture (x64 vs arm64)
   - **Test:** Check if native modules load correctly

7. **Electron Security Policies**
   - nodeIntegration disabled
   - contextIsolation blocking access
   - sandbox mode restrictions
   - **Test:** Log Electron security settings

### 🟢 LOW PROBABILITY

8. **Missing Dependencies in Bundle**
   - Required system libraries not available
   - Dynamic linking issues
   - **Test:** Check for missing dylib errors in Console.app

9. **Process Context Wrong**
   - Code running in wrong process despite fixes
   - **Test:** Log process.type in each file

---

## Phase 1: Add Comprehensive Logging

### Goal
Instrument every step of the audio pipeline to capture exactly what's happening (or not happening) in production.

### Files to Instrument

#### 1. `src/services/MicrophoneCapture.ts`
Add logging to:
- Constructor
- `requestPermission()` - before and after getUserMedia()
- `checkPermission()` - device enumeration results
- `startCapture()` - config, stream creation, audio context setup
- `stopCapture()` - cleanup steps
- Error handlers - full error objects with stack traces

#### 2. `electron/SystemAudioCapture.ts`
Add logging to:
- `getAvailableSources()` - detected sources and availability
- `startCapture()` - source selection
- `startMacOSSystemAudioCapture()` - binary path resolution, spawn events
- `findAudioTeeBinary()` - all paths checked, which one succeeded
- Binary stdout/stderr - all output from audiotee process
- Binary exit events - exit codes and signals
- Error handlers - full error details

#### 3. `electron/ipc/audioHandlers.ts`
Add logging to:
- All IPC handler entries - log when called with what parameters
- All IPC handler exits - log return values
- `audio-process-microphone-chunk` - chunk size, frequency
- Error handlers - full error context

#### 4. `electron/preload.ts`
Add logging to:
- IPC method calls - log when renderer calls main
- Verify electronAPI is exposed correctly
- Log any errors in IPC bridge

#### 5. `electron/main.ts`
Add logging to:
- App startup - environment info
- Window creation - security settings
- Permission requests - results
- Electron version and platform info

### Logging Implementation

```typescript
// Use electron-log for persistent file logging
import log from 'electron-log';

// Configure log file location (already done, but verify)
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

// Log format
log.info('[Component] Event: details', { data });
log.error('[Component] Error:', error, { context });

// For production debugging
if (process.env.NODE_ENV === 'production') {
  log.transports.file.level = 'debug'; // Keep debug logs in production
}
```

### Log File Location
- macOS: `~/Library/Logs/CueMe/main.log`
- Windows: `%USERPROFILE%\AppData\Roaming\CueMe\logs\main.log`
- Linux: `~/.config/CueMe/logs/main.log`

---

## Phase 2: Create Diagnostic Tools

### 1. System Diagnostics Panel (UI)

Create a new component: `src/components/SystemDiagnostics.tsx`

**Features:**
- Show current permissions status (microphone, screen recording)
- Show available audio devices
- Show Electron environment info
- Show log file location with "Open Logs" button
- Test IPC connectivity
- Test audio device access
- Manual permission request buttons
- Copy diagnostics to clipboard

**UI Location:** Add a "Diagnostics" button in settings or dev menu

### 2. IPC Connectivity Test

Add new IPC handler: `system-diagnostics-test`

```typescript
// Test that IPC is working
ipcMain.handle('system-diagnostics-test', async () => {
  return {
    success: true,
    timestamp: Date.now(),
    process: 'main',
    platform: process.platform,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome
  };
});
```

### 3. Permission Status Checker

Add detailed permission checking:

```typescript
// Check actual permission status from macOS
import { systemPreferences } from 'electron';

async function checkPermissions() {
  const micStatus = systemPreferences.getMediaAccessStatus('microphone');
  const screenStatus = systemPreferences.getMediaAccessStatus('screen');
  
  return {
    microphone: micStatus, // 'not-determined' | 'granted' | 'denied' | 'restricted'
    screenCapture: screenStatus,
    canRequestMic: micStatus === 'not-determined',
    canRequestScreen: screenStatus === 'not-determined'
  };
}
```

### 4. Audio Device Enumeration Test

Test if we can enumerate devices:

```typescript
// In renderer
async function testDeviceEnumeration() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    
    return {
      success: true,
      totalDevices: devices.length,
      audioInputs: audioInputs.length,
      hasLabels: audioInputs.some(d => d.label !== ''),
      devices: audioInputs.map(d => ({
        id: d.deviceId,
        label: d.label || '(no label - permission needed)',
        groupId: d.groupId
      }))
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      errorName: error.name
    };
  }
}
```

### 5. Binary Verification Tool

Check if audiotee binary is accessible:

```typescript
// In main process
async function verifyAudioTeeBinary() {
  const possiblePaths = [
    path.join(__dirname, '..', 'node_modules', 'audiotee', 'bin', 'audiotee'),
    path.join(process.cwd(), 'node_modules', 'audiotee', 'bin', 'audiotee'),
    path.join(process.resourcesPath, 'node_modules', 'audiotee', 'bin', 'audiotee'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'audiotee', 'bin', 'audiotee'),
  ];

  const results = [];
  for (const binaryPath of possiblePaths) {
    const exists = fs.existsSync(binaryPath);
    let isExecutable = false;
    let fileInfo = null;

    if (exists) {
      try {
        await fs.promises.access(binaryPath, fs.constants.X_OK);
        isExecutable = true;
        const stats = await fs.promises.stat(binaryPath);
        fileInfo = {
          size: stats.size,
          mode: stats.mode.toString(8),
          isFile: stats.isFile()
        };
      } catch (error) {
        // Not executable
      }
    }

    results.push({
      path: binaryPath,
      exists,
      isExecutable,
      fileInfo
    });
  }

  return results;
}
```

---

## Phase 3: Manual Testing Protocol

### Test Environment Setup

1. **Clean Build**
   ```bash
   cd CueMeFinal
   npm run clean
   npm install
   npm run build
   npm run app:build:mac
   ```

2. **Install Locally**
   ```bash
   open release/CueMe-*.dmg
   # Drag to Applications
   # Launch from Applications folder (not from DMG)
   ```

3. **Fresh User Test** (Optional but recommended)
   - Create new macOS user account
   - Test app with no cached permissions
   - Simulates first-time user experience

### Testing Checklist

#### Test 1: Basic App Launch
- [ ] App launches without crashing
- [ ] UI loads correctly
- [ ] No errors in Console.app (filter by "CueMe")
- [ ] Check log file exists and has content

#### Test 2: IPC Connectivity
- [ ] Open Diagnostics panel
- [ ] Run IPC connectivity test
- [ ] Verify test passes
- [ ] If fails: IPC is broken (critical issue)

#### Test 3: Permission Status
- [ ] Check current permission status in Diagnostics
- [ ] Should show "not-determined" on first launch
- [ ] Note: Permissions should NOT be "granted" without user action

#### Test 4: Microphone Permission Request
- [ ] Click "Request Microphone Permission" button
- [ ] System dialog should appear
- [ ] Grant permission
- [ ] Verify status changes to "granted"
- [ ] Check logs for permission request flow
- [ ] If dialog doesn't appear: Entitlements issue

#### Test 5: Microphone Capture
- [ ] Try to start microphone capture
- [ ] Check if getUserMedia() is called (logs)
- [ ] Check if stream is created (logs)
- [ ] Check if audio chunks are sent to main (logs)
- [ ] Check if main receives chunks (logs)
- [ ] Note exact error if it fails

#### Test 6: Screen Recording Permission
- [ ] Click "Request Screen Recording Permission" button
- [ ] System dialog should appear (or redirect to System Preferences)
- [ ] Grant permission
- [ ] **App must restart** for screen recording permission to take effect
- [ ] Verify status changes to "granted" after restart

#### Test 7: System Audio Capture
- [ ] Try to start system audio capture
- [ ] Check if audiotee binary is found (logs)
- [ ] Check if binary spawns successfully (logs)
- [ ] Check if audio data is received (logs)
- [ ] Note exact error if it fails

#### Test 8: Code Signing Verification
```bash
# Check if app is signed
codesign -dv /Applications/CueMe.app

# Check entitlements
codesign -dv --entitlements - /Applications/CueMe.app

# Verify signature
codesign --verify --deep --strict --verbose=2 /Applications/CueMe.app

# Check Gatekeeper status
spctl -a -vv /Applications/CueMe.app
```

Expected entitlements output should include:
```xml
<key>com.apple.security.device.microphone</key>
<true/>
<key>com.apple.security.device.audio-input</key>
<true/>
<key>com.apple.security.device.screen-capture</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>
```

#### Test 9: macOS Console.app Logs
```bash
# Open Console.app
# Filter by "CueMe" process
# Look for:
# - Permission errors
# - Code signing errors
# - Entitlement errors
# - Gatekeeper errors
# - Binary execution errors
```

Common error patterns:
- `"CueMe" would like to access the microphone` - Good! Permission dialog
- `Code signature invalid` - Code signing issue
- `Operation not permitted` - Permission/entitlement issue
- `No such file or directory` - Binary packaging issue
- `Permission denied` - Execution permission issue

#### Test 10: Binary Verification
```bash
# Check if binary is in the app bundle
ls -la /Applications/CueMe.app/Contents/Resources/node_modules/audiotee/bin/audiotee

# Or in app.asar.unpacked
ls -la /Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee

# Check if executable
file /path/to/audiotee

# Try to run it manually
/path/to/audiotee --help
```

---

## Phase 4: Hypothesis Testing

Based on test results, systematically test each hypothesis:

### Hypothesis 1: Entitlements Not Applied
**Test:** Check code signing output from Test 8
**If true:** Fix electron-builder configuration
**Evidence:** Entitlements missing from `codesign` output

### Hypothesis 2: Permissions Not Requested
**Test:** Check if permission dialogs appear in Tests 4 & 6
**If true:** Add explicit permission request code
**Evidence:** No system dialog appears

### Hypothesis 3: IPC Broken
**Test:** IPC connectivity test from Test 2
**If true:** Fix preload script or context isolation
**Evidence:** IPC test fails

### Hypothesis 4: Web Audio API Blocked
**Test:** Device enumeration test, getUserMedia() logs
**If true:** Fix Electron security settings
**Evidence:** getUserMedia() throws SecurityError or NotAllowedError

### Hypothesis 5: Binary Not Packaged
**Test:** Binary verification from Test 10
**If true:** Fix electron-builder files configuration
**Evidence:** Binary not found in app bundle

### Hypothesis 6: Binary Not Executable
**Test:** Binary permissions from Test 10
**If true:** Fix file permissions in packaging
**Evidence:** Binary exists but can't execute

### Hypothesis 7: Binary Not Code-Signed
**Test:** Try to run binary manually, check Gatekeeper
**If true:** Add binary to code signing process
**Evidence:** "unidentified developer" error

---

## Phase 5: Implementation - Add Logging

### Files to Modify

1. **Create:** `electron/utils/DiagnosticLogger.ts`
2. **Modify:** `src/services/MicrophoneCapture.ts`
3. **Modify:** `electron/SystemAudioCapture.ts`
4. **Modify:** `electron/ipc/audioHandlers.ts`
5. **Modify:** `electron/preload.ts`
6. **Modify:** `electron/main.ts`
7. **Create:** `src/components/SystemDiagnostics.tsx`
8. **Create:** `electron/ipc/diagnosticsHandlers.ts`

### Priority Order

1. ✅ **CRITICAL:** Add logging to all audio files (Phase 1) - COMPLETE
2. ⏭️ **HIGH:** Create diagnostics panel (Phase 2) - NEXT
3. ⏭️ **HIGH:** Manual testing protocol (Phase 3)
4. ⏭️ **MEDIUM:** Hypothesis testing (Phase 4)

---

## Expected Outcomes

After implementing logging and diagnostics:

1. **Clear Error Messages** - Know exactly what's failing
2. **Permission Status** - Know if permissions are the issue
3. **IPC Status** - Know if communication works
4. **Binary Status** - Know if audiotee is accessible
5. **Root Cause Identified** - Can proceed with targeted fix

---

## Next Steps

1. ✅ Create this debugging plan
2. ⏭️ Implement comprehensive logging (Phase 1)
3. ⏭️ Create diagnostics panel (Phase 2)
4. ⏭️ Build and test locally (Phase 3)
5. ⏭️ Analyze logs and test results
6. ⏭️ Identify root cause (Phase 4)
7. ⏭️ Implement fix
8. ⏭️ Test fix in production build
9. ⏭️ Deploy to GitHub releases

---

## Notes

- **Don't assume anything** - Let the logs tell us what's happening
- **Test systematically** - One hypothesis at a time
- **Document everything** - Record exact error messages
- **Compare dev vs prod** - Note differences in behavior
- **Check macOS Console.app** - System-level errors appear there

---

**Last Updated:** 2025-10-24  
**Status:** Ready to implement Phase 1 (Logging)
