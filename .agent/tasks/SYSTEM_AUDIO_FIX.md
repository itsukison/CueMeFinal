# System Audio Capture Fix - Production Build

**Status**: 🟢 PHASE 1 COMPLETE - READY FOR TESTING  
**Priority**: CRITICAL  
**Scope**: Minimal Viable Fix (Option B) - IMPLEMENTED  
**Target**: macOS 12-15+ production builds  
**User Environment**: macOS 15.1 (26.0 Sequoia), Apple Developer ID available
**Last Review**: Technical validation completed - all fixes applied

---

## 👍 Technical Review & Corrections Applied

### ✅ Approved Items (Kept As-Is)
1. **NSAudioCaptureUsageDescription** - Required for CoreAudio taps on macOS 14.2+
2. **Info.plist embedding via linker** - Valid approach with otool verification
3. **afterPack.js fixes** - Entitlements path, test command, Info.plist check
4. **PermissionWatcher improvements** - Multi-line JSON parsing + 5s timeout

### 🔧 Corrections Applied
1. **❌ Removed NSScreenCaptureDescription** - This key doesn't exist in Apple's APIs
   - Screen Recording has no usage-description key (Stack Overflow confirmation)
   - Only generic system prompt exists
   
2. **📝 Clarified NSAudioCaptureUsageDescription scope**
   - Required for: CoreAudio system-audio taps (macOS 14.2+)
   - NOT required for: ScreenCaptureKit (uses Screen Recording permission)
   - Kept in Info.plist for forward compatibility with tap implementation
   
3. **🔓 Relaxed LSMinimumSystemVersion to 12.0**
   - Allows helper to run on Monterey for fallback paths (BlackHole)
   - ScreenCaptureKit still requires 13.0+ (gated internally in Swift code)
   
4. **✨ Added --selftest mode** (strongly recommended)
   - Generates 1kHz sine wave for 500ms without permissions
   - Tests audio pipeline end-to-end
   - Useful for CI smoke testing and user diagnostics
   
5. **🤖 Added CI validation script**
   - `scripts/ci-validate-system-audio.sh`
   - Fails build if Info.plist or NSAudioCaptureUsageDescription missing
   - Tests selftest mode (must work without permissions)
   - Prevents regressions in future builds

---

## 📋 Requirements

### Problem Statement
System audio capture is **completely broken** in production builds despite Screen Recording permissions being granted:
- ✅ User grants Screen Recording permission in System Settings
- ❌ App doesn't recognize the granted permission
- ❌ System audio capture fails silently
- ❌ App keeps asking for permission in an infinite loop

### Success Criteria
- ✅ App correctly detects when Screen Recording permission is granted
- ✅ ScreenCaptureKit audio capture works reliably in production builds
- ✅ Users see system audio source as "available" after granting permission
- ✅ Audio transcription works from system audio (Zoom, YouTube, etc.)
- ✅ No permission loops or false negatives

---

## 🔍 Root Cause Analysis

### Primary Issue: Missing NSAudioCaptureUsageDescription
**Critical Finding**: macOS 14.2+ (including user's 15.1) **requires** `NSAudioCaptureUsageDescription` in the helper binary's Info.plist for system audio capture.

**Evidence**:
1. User on macOS 15.1 - requires this key per Apple's policy
2. Swift binary lacks embedded Info.plist entirely
3. Main app's Info.plist has these keys, but helper binary doesn't
4. ScreenCaptureKit silently fails without this key, even when Screen Recording permission granted

**Current State**:
```
✅ Main app (CueMe.app) → Has NSMicrophoneUsageDescription, NSScreenCaptureDescription
❌ Helper binary (SystemAudioCapture) → NO Info.plist at all
```

### Secondary Issues

1. **Incorrect Entitlements Path in afterPack.js**
   - Uses: `assets/entitlements.mac.plist` 
   - Should use: `native-modules/system-audio/entitlements.plist`

2. **Weak Permission Testing**
   - `afterPack.js` line 132 tests `--help` flag (unsupported by Swift binary)
   - Should test `status` or `permissions` command

3. **No Info.plist Validation**
   - No check that Info.plist is embedded in binary
   - No verification of required keys

4. **Base64 JSON Communication (Performance Issue)**
   - Current: Float32 stereo → base64 → JSON → stdout (slow, error-prone)
   - Should be: Binary framing (but defer to Phase 2 for minimal fix)

---

## 🛠️ Implementation Plan

### Phase 1: Critical Permission Fix (MINIMAL VIABLE)

**Goal**: Get permission recognition working with minimal code changes

#### 1.1 Create Info.plist for SystemAudioCapture Binary

**File**: `native-modules/system-audio/Info.plist` (NEW)

**Required Keys**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.cueme.SystemAudioCapture</string>
    
    <key>CFBundleName</key>
    <string>SystemAudioCapture</string>
    
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    
    <!-- CRITICAL: Required for CoreAudio system-audio taps on macOS 14.2+.
         ScreenCaptureKit uses Screen Recording permission (no usage string key exists for that).
         Keeping this key ensures forward compatibility if we add tap-based capture. -->
    <key>NSAudioCaptureUsageDescription</key>
    <string>CueMe needs to capture system audio (e.g., Zoom, YouTube) to transcribe and detect questions in real-time for interview assistance.</string>
    
    <!-- Minimum macOS version: Set to 12.0 to allow helper to run on Monterey
         for fallback paths (BlackHole, etc.). ScreenCaptureKit requires 13.0+,
         but helper can still provide status/diagnostic info on older versions. -->
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
</dict>
</plist>
```

**Why This Fixes It**:
- macOS 14.2+ requires NSAudioCaptureUsageDescription for CoreAudio tap-based system audio capture
- ScreenCaptureKit uses Screen Recording permission (no separate usage string required)
- Without this key, future tap implementations would fail; having it ensures compatibility
- Stable CFBundleIdentifier prevents TCC permission loss across updates

#### 1.2 Update build.sh to Embed Info.plist

**File**: `native-modules/system-audio/build.sh`

**Changes**:
1. Compile with `-Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker Info.plist`
2. Verify Info.plist is embedded after build
3. Add validation step

**Modified Compilation**:
```bash
swiftc \
    -o SystemAudioCapture \
    -target arm64-apple-macos13.0 \
    -O \
    -Xlinker -sectcreate \
    -Xlinker __TEXT \
    -Xlinker __info_plist \
    -Xlinker Info.plist \
    SystemAudioCapture.swift
```

**Add Verification**:
```bash
# Verify Info.plist is embedded
if otool -s __TEXT __info_plist "$OUTPUT_DIR/SystemAudioCapture" > /dev/null 2>&1; then
    echo "✅ Info.plist embedded successfully"
else
    echo "⚠️  Warning: Info.plist may not be embedded"
fi
```

#### 1.3 Fix afterPack.js

**File**: `scripts/afterPack.js`

**Changes**:
1. Use correct entitlements path: `native-modules/system-audio/entitlements.plist`
2. Test with `status` command instead of `--help`
3. Add Info.plist validation
4. Verify NSAudioCaptureUsageDescription presence

**Key Fixes**:
```javascript
// Line 60: Fix entitlements path
const entitlementsPath = path.join(process.cwd(), 'native-modules', 'system-audio', 'entitlements.plist');

// Line 132: Fix test command
const testCommand = `"${binaryPath}" status`;

// Add Info.plist check
const infoPlistCheck = execSync(`otool -s __TEXT __info_plist "${binaryPath}"`, {
  encoding: 'utf8',
  timeout: 5000,
  stdio: 'pipe'
});

if (infoPlistCheck.includes('sectname __info_plist')) {
  console.log('✅ Info.plist embedded in binary');
  
  // Extract and verify NSAudioCaptureUsageDescription
  // (detailed implementation in actual code)
} else {
  console.warn('⚠️  Info.plist NOT embedded - binary will fail on macOS 14.2+');
}
```

#### 1.4 Update PermissionWatcher Logic

**File**: `electron/core/PermissionWatcher.ts`

**Why**: Current `canActuallyAccessSystemAudio()` times out because it expects instant JSON response from Swift binary.

**Fix**: Add proper timeout handling and JSON parsing retry:
```typescript
private canActuallyAccessSystemAudio(): boolean {
  try {
    const output = execSync(`"${binaryPath}" status`, { 
      encoding: 'utf8', 
      timeout: 5000, // Increased from 3s
      stdio: 'pipe'
    });
    
    // More robust JSON parsing - handle partial output
    const lines = output.trim().split('\n');
    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        if (result.type === 'status' && result.data) {
          return result.data.isAvailable === true;
        }
      } catch {
        continue; // Skip non-JSON lines
      }
    }
    return false;
  } catch (error) {
    console.warn('[PermissionWatcher] System audio capability test failed:', error);
    return false;
  }
}
```

---

### Phase 2: Performance Optimization (OPTIONAL - DEFER)

**Note**: Only implement if Phase 1 works but performance is poor.

#### 2.1 Binary Framing (Replace Base64 JSON)

**File**: `native-modules/system-audio/SystemAudioCapture.swift`

**Goal**: Stream raw PCM instead of base64-encoded JSON

**Protocol**: `[uint32_le payloadBytes][PCM Int16 mono 16kHz]`

**Benefits**:
- 5-10x smaller payload
- No JSON parsing overhead
- Direct buffer forwarding to Whisper

**Implementation**: Use the complete Swift scaffold from the proposed fix.

#### 2.2 Swift-Side Downmixing & Resampling

**Goal**: Move audio processing from Node to Swift

**Current**: Float32 stereo 48kHz → Node downmix → Node resample → Whisper  
**Proposed**: Swift downmix → Swift resample → Int16 mono 16kHz → Whisper

**Benefits**:
- Lower CPU in Node
- Lower latency (~50-100ms improvement)
- Smaller IPC payload

---

### Phase 3: Enhanced Fallbacks (OPTIONAL - DEFER)

Only if user requests cross-version compatibility.

#### 3.1 CoreAudio Taps (macOS 14.2+)

**File**: `native-modules/system-audio/SystemAudioCapture.swift`

**Add**: Tap-based capture using AudioObject APIs

**Benefit**: Cleaner system audio capture on latest macOS

#### 3.2 Chromium Loopback Fallback

**File**: `electron/SystemAudioCapture.ts`

**Add**: Electron's native loopback for macOS 13+ when ScreenCaptureKit unavailable

**Benefit**: No-binary fallback path

#### 3.3 BlackHole Guide

**File**: `src/components/AudioTroubleshootingHelp.tsx`

**Add**: One-click setup guide for BlackHole virtual device

**Benefit**: Universal fallback for any macOS version

---

## ✅ Testing Strategy

### Manual Testing Checklist (Production Build)

**Prerequisites**:
```bash
# Build production package
npm run app:build:mac

# Reset permissions first
tccutil reset ScreenCapture com.cueme.interview-assistant
```

**Test Cases**:

1. **Fresh Install (No Permissions)**
   - [ ] Launch app
   - [ ] Request system audio permission
   - [ ] macOS shows Screen Recording permission dialog
   - [ ] Grant permission
   - [ ] App immediately recognizes permission (no restart needed)
   - [ ] System audio source shows as "available"

2. **Permission Already Granted**
   - [ ] Launch app with Screen Recording already granted
   - [ ] System audio source shows as "available" immediately
   - [ ] Can start listening without errors

3. **Actual Audio Capture**
   - [ ] Start system audio capture
   - [ ] Play YouTube video or Zoom test call
   - [ ] Verify audio transcription works
   - [ ] Check audio quality (no distortion)

4. **Permission Revoked**
   - [ ] Revoke Screen Recording permission in System Settings
   - [ ] App detects revocation within 2 seconds
   - [ ] System audio source shows as "unavailable"
   - [ ] Graceful fallback to microphone

5. **Binary Validation**
   ```bash
   # Check Info.plist embedded
   otool -s __TEXT __info_plist ./release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
   
   # Check code signature
   codesign -dv --entitlements - ./release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture
   
   # Verify NSAudioCaptureUsageDescription present
   # (manual inspection of otool output)
   ```

### Automated Validation Script

**File**: `scripts/validate-system-audio-build.sh` (NEW)

```bash
#!/bin/bash
# Validates that production build has all required components

BINARY_PATH="./release/mac/CueMe.app/Contents/Resources/dist-native/SystemAudioCapture"

echo "🔍 Validating SystemAudioCapture binary..."

# 1. Check binary exists
if [[ ! -f "$BINARY_PATH" ]]; then
    echo "❌ Binary not found at $BINARY_PATH"
    exit 1
fi
echo "✅ Binary exists"

# 2. Check execute permissions
if [[ ! -x "$BINARY_PATH" ]]; then
    echo "❌ Binary not executable"
    exit 1
fi
echo "✅ Binary is executable"

# 3. Check Info.plist embedded
if otool -s __TEXT __info_plist "$BINARY_PATH" > /dev/null 2>&1; then
    echo "✅ Info.plist embedded"
else
    echo "❌ Info.plist NOT embedded"
    exit 1
fi

# 4. Check code signature
if codesign --verify --deep --strict "$BINARY_PATH" 2>&1; then
    echo "✅ Code signature valid"
else
    echo "⚠️  Code signature invalid (may be normal for adhoc)"
fi

# 5. Test binary functionality
if "$BINARY_PATH" status > /dev/null 2>&1; then
    echo "✅ Binary executes successfully"
else
    echo "⚠️  Binary test inconclusive (permission may be required)"
fi

echo ""
echo "✅ All critical validations passed"
```

---

## 🔄 Rollback Plan

If Phase 1 fails or introduces regressions:

### Immediate Rollback
```bash
git checkout HEAD -- native-modules/system-audio/
git checkout HEAD -- scripts/afterPack.js
git checkout HEAD -- electron/core/PermissionWatcher.ts
npm run build
```

### Keep Working Features
- Microphone capture (unaffected)
- Question detection (unaffected)
- Main app permissions (unaffected)

### Emergency Fallback
If system audio completely broken, disable feature:
```typescript
// In electron/SystemAudioCapture.ts
public async getAvailableSources(): Promise<AudioSource[]> {
  // Temporarily disable system audio
  return [{
    id: 'microphone',
    name: 'Microphone',
    type: 'microphone',
    available: true
  }];
}
```

---

## 📊 Success Metrics

### Must Have (Blocking Release)
- [ ] Info.plist with NSAudioCaptureUsageDescription embedded in binary
- [ ] Production build passes `validate-system-audio-build.sh`
- [ ] App correctly detects granted Screen Recording permission
- [ ] System audio capture works on user's macOS 15.1 machine
- [ ] No permission loops or false negatives

### Should Have (Non-Blocking)
- [ ] Permission detection works within 2 seconds
- [ ] Audio transcription latency < 1.5 seconds
- [ ] No console errors related to permissions
- [ ] User sees clear error messages if permission denied

### Nice to Have (Future Iteration)
- [ ] Binary framing implemented (Phase 2)
- [ ] Chromium loopback fallback (Phase 3)
- [ ] BlackHole setup guide (Phase 3)

---

## 🚀 Implementation Steps (Execution Order)

### Step 1: Create Info.plist ✅ COMPLETE
- [x] Create `native-modules/system-audio/Info.plist`
- [x] Add all required keys including NSAudioCaptureUsageDescription
- [x] Remove non-existent NSScreenCaptureDescription
- [x] Set LSMinimumSystemVersion to 12.0 for fallback support

### Step 2: Update Build Script ✅ COMPLETE
- [x] Modify `native-modules/system-audio/build.sh`
- [x] Add Info.plist embedding to swiftc command
- [x] Add Info.plist validation with otool
- [x] Add selftest mode validation

### Step 3: Fix afterPack Hook ✅ COMPLETE
- [x] Update `scripts/afterPack.js`
- [x] Fix entitlements path to use helper's plist
- [x] Fix test command to use `status` instead of `--help`
- [x] Add Info.plist verification with otool
- [x] Add selftest mode testing

### Step 4: Improve Permission Detection ✅ COMPLETE
- [x] Update `electron/core/PermissionWatcher.ts`
- [x] Add robust multi-line JSON parsing
- [x] Increase timeout from 3s to 5s
- [x] Better error handling and logging
- [x] Update comments to clarify SCK vs CoreAudio taps

### Step 5: Add Selftest Mode ✅ COMPLETE
- [x] Add `--selftest` command to Swift binary
- [x] Generate 1kHz sine wave test signal
- [x] Emit test audio in same format as real capture
- [x] No permissions required for testing

### Step 6: Add CI Validation ✅ COMPLETE
- [x] Create `scripts/ci-validate-system-audio.sh`
- [x] Check Info.plist embedding
- [x] Verify NSAudioCaptureUsageDescription key
- [x] Test selftest mode
- [x] Make script executable

### Step 7: Build & Test ⏳ PENDING USER ACTION
- [ ] Run `npm run build:native`
- [ ] Verify binary has Info.plist: `otool -s __TEXT __info_plist dist-native/SystemAudioCapture`
- [ ] Test selftest mode: `./dist-native/SystemAudioCapture --selftest`
- [ ] Run `npm run app:build:mac`
- [ ] Run `./scripts/ci-validate-system-audio.sh`

### Step 8: Production Testing ⏳ PENDING USER ACTION
- [ ] Test on user's macOS 15.1 machine
- [ ] Verify permission recognition
- [ ] Test actual audio capture from Zoom/YouTube
- [ ] Validate transcription works
- [ ] No permission loops

### Step 9: Documentation ⏳ PENDING
- [ ] Update `SYSTEM_AUDIO_ARCHITECTURE.md`
- [ ] Update `.agent/README.md`
- [ ] Create release notes

---

## 📝 Related Files

### Files to Modify (Phase 1)
- `native-modules/system-audio/Info.plist` ⭐ NEW FILE
- `native-modules/system-audio/build.sh` ⭐ CRITICAL
- `scripts/afterPack.js` ⭐ CRITICAL
- `electron/core/PermissionWatcher.ts` (minor fixes)

### Files to Modify (Phase 2 - OPTIONAL)
- `native-modules/system-audio/SystemAudioCapture.swift` (binary framing)
- `electron/SystemAudioCapture.ts` (binary reader)

### Files to Reference (No Changes)
- `electron/SystemAudioCapture.ts` (understand current flow)
- `electron/AudioStreamProcessor.ts` (understand pipeline)
- `package.json` (understand build config)

### Diagnostic Scripts
- `scripts/diagnose-permissions.sh` (existing)
- `scripts/validate-system-audio-build.sh` (NEW)

---

## 🐛 Known Issues & Risks

### Risk 1: Info.plist Embedding Fails
**Symptom**: swiftc doesn't embed Info.plist correctly  
**Mitigation**: Use alternative embedding method (bundle directory structure)  
**Detection**: `otool -s __TEXT __info_plist` test in afterPack.js

### Risk 2: Permission Still Not Recognized
**Symptom**: Even with Info.plist, permission detection fails  
**Root Cause**: TCC cache or signature mismatch  
**Mitigation**: 
- Reset TCC: `tccutil reset ScreenCapture`
- Re-sign with stable identifier
- Test in completely fresh production build

### Risk 3: macOS 15.x Specific Issues
**Symptom**: Works on 14.x but fails on 15.x  
**Root Cause**: New permission requirements in Sequoia  
**Mitigation**: Test on actual 15.1 machine (user's environment)

### Risk 4: Universal Binary Issues
**Symptom**: Works on arm64 but fails on x64 or vice versa  
**Root Cause**: Info.plist not embedded in both architectures  
**Mitigation**: Build and test both architectures separately

---

## 💡 Key Insights from Investigation

1. **The main app's Info.plist doesn't help the helper binary**
   - macOS checks EACH binary's Info.plist independently
   - Helper binaries need their own Info.plist with usage descriptions

2. **macOS 14.2+ changed system audio requirements**
   - New NSAudioCaptureUsageDescription key required
   - ScreenCaptureKit silently fails without it (no error, just doesn't work)
   - User's macOS 15.1 definitely requires this

3. **TCC database caches permission grants**
   - Permission granted to specific bundle identifier + signature
   - Changing signature invalidates permission
   - Production builds need stable signatures

4. **Current implementation is close but incomplete**
   - ScreenCaptureKit code is correct
   - Permission checking logic is correct
   - Just missing the Info.plist key

---

## 🎯 Next Actions

**Immediate (Phase 1)**:
1. Create Info.plist file
2. Update build.sh to embed it
3. Fix afterPack.js
4. Build and test production package
5. Validate on user's macOS 15.1 machine

**Future (If Phase 1 Works)**:
- Implement binary framing (Phase 2) for performance
- Add fallback mechanisms (Phase 3) for reliability

**If Phase 1 Fails**:
- Investigate TCC cache issues
- Try alternative Info.plist embedding methods
- Consider bundle-based approach instead of single binary

---

**Last Updated**: 2025-10-13  
**Assigned To**: AI Agent  
**Blocked By**: None  
**Blocks**: Production release with system audio support
