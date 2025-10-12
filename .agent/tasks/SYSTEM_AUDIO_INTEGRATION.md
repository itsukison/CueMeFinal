# System Audio Integration - ScreenCaptureKit Integration

## Overview

Integrate the proven electron-system-audio-recorder's ScreenCaptureKit implementation into CueMe to enable reliable system audio capture for real-time transcription and question detection.

## Problem Statement

CueMe currently has a broken/incomplete ScreenCaptureKit implementation in `SystemAudioCapture.ts`. The existing system audio capture relies on Electron's `desktopCapturer` API which is unreliable and doesn't provide true system audio. Meanwhile, the electron-system-audio-recorder project has a proven, working ScreenCaptureKit implementation using native Swift that provides excellent system audio capture.

## Requirements

### Functional Requirements
- ✅ Reliable system audio capture on macOS 13+
- ✅ Real-time audio streaming (not file-based recording)
- ✅ Integration with existing AudioStreamProcessor pipeline
- ✅ Seamless permission handling for ScreenCaptureKit
- ✅ Graceful fallback to microphone on any failure
- ✅ Maintain existing audio transcription and question detection functionality
- ✅ No regression in current CueMe functionality

### Technical Requirements
- ✅ Native Swift binary using ScreenCaptureKit API
- ✅ JSON-based streaming protocol for real-time audio data
- ✅ Integration into existing `SystemAudioCapture.ts`
- ✅ Build process integration for Swift compilation
- ✅ Cross-platform compatibility (macOS native, fallback on others)
- ✅ Performance target: maintain ~1.1-1.2s audio processing latency

## Solution Architecture

### Strategy: Modified Swift Streaming Binary
Instead of file-based recording, modify electron-system-audio-recorder's Swift code to stream audio data in real-time to CueMe's audio processing pipeline.

### Key Components

1. **New Swift Binary**: `SystemAudioCapture` (modified from `Recorder.swift`)
   - Real-time audio streaming via stdout
   - JSON protocol for audio data and status messages
   - Robust permission handling
   - Command-based interface (`status`, `permissions`, `start-stream`, `stop-stream`)

2. **Updated SystemAudioCapture.ts**
   - Replace broken ScreenCaptureKit implementation
   - Integrate with new Swift streaming binary
   - Audio format conversion (Float32 PCM → Int16 Buffer)
   - Enhanced error handling and fallbacks

3. **Build Process Updates**
   - Add Swift compilation to `build-native.sh`
   - Copy Swift binary to `dist-native/`
   - Include in electron-builder packaging

## Implementation Plan

### Phase 1: Swift Streaming Binary (Days 1-3)

#### 1.1 Setup Swift Module Structure
```
native-modules/
├── system-audio/
│   ├── SystemAudioCapture.swift    # Modified streaming version
│   ├── build.sh                    # Swift build script
│   └── README.md                   # Build instructions
```

#### 1.2 Create Streaming Swift Binary
- **Input**: Copy `electron-system-audio-recorder/src/swift/Recorder.swift`
- **Modify**: Replace file recording with stdout streaming
- **Output**: JSON messages for audio data, status, and errors

**New Command Interface**:
```bash
./SystemAudioCapture status          # Check ScreenCaptureKit availability
./SystemAudioCapture permissions     # Request screen recording permissions
./SystemAudioCapture start-stream    # Begin audio streaming to stdout
./SystemAudioCapture stop-stream     # Stop streaming (via stdin)
```

**Streaming Protocol**:
```json
{"type": "status", "message": "READY"}
{"type": "audio", "data": "base64-pcm", "sampleRate": 48000, "channels": 2, "timestamp": 1234567890}
{"type": "error", "message": "Permission denied"}
```

#### 1.3 Test Swift Binary Independently
- Test permission flow
- Verify audio streaming output
- Test command interface

### Phase 2: CueMe Integration (Days 4-6)

#### 2.1 Update SystemAudioCapture.ts
Replace the current broken ScreenCaptureKit implementation:

```typescript
// Current broken implementation ~lines 100-200
private async startScreenCaptureKitCapture(): Promise<void> {
  // Replace with new Swift binary integration
}

private async checkScreenCaptureKitStatus(): Promise<boolean> {
  // Use new Swift binary status command
}

private async requestScreenCaptureKitPermissions(): Promise<{granted: boolean; error?: string}> {
  // Use new Swift binary permission command
}
```

**Key Integration Points**:
1. **Process Management**: Spawn Swift binary with proper cleanup
2. **Audio Data Processing**: Convert Base64 JSON to Buffer for existing pipeline  
3. **Error Handling**: Robust fallback to microphone
4. **Permission Flow**: Use Swift binary's proven permission system

#### 2.2 Update Build Process
Modify `scripts/build-native.sh`:
```bash
# Add Swift compilation
echo "Building Swift SystemAudioCapture binary..."
cd native-modules/system-audio
./build.sh
cp SystemAudioCapture ../../dist-native/
```

#### 2.3 Update Package Configuration
Ensure Swift binary included in builds:
```json
"extraResources": [
  ".env",
  {
    "from": "dist-native/",
    "to": "dist-native/",
    "filter": ["**/*"]
  }
]
```

### Phase 3: Testing & Integration (Days 7-8)

#### 3.1 Unit Testing
- [ ] Swift binary command interface
- [ ] Permission flow testing  
- [ ] Audio streaming reliability
- [ ] Format conversion accuracy
- [ ] Error handling and fallbacks

#### 3.2 Integration Testing
- [ ] End-to-end audio capture → transcription → question detection
- [ ] Performance benchmarking (maintain ~1.1s latency)
- [ ] Permission state management
- [ ] Source switching (microphone ↔ system audio)
- [ ] Error recovery and user experience

#### 3.3 Cross-Platform Testing
- [ ] macOS 13+ with ScreenCaptureKit
- [ ] macOS < 13 graceful fallback
- [ ] Windows/Linux fallback to microphone
- [ ] Build process on different platforms

## Technical Details

### Audio Format Conversion
```typescript
// Swift outputs Float32 PCM at 48kHz/2ch
// Convert to CueMe's expected Int16 Buffer at 16kHz/1ch
private convertSwiftAudioToCueMeFormat(base64Data: string): Buffer {
  const float32Data = Buffer.from(base64Data, 'base64');
  // Convert Float32 → Int16, resample 48kHz → 16kHz, stereo → mono
  return processedBuffer;
}
```

### Error Handling Strategy
```typescript
private async handleSystemAudioError(error: Error): Promise<void> {
  // Log specific error
  console.error('[SystemAudioCapture] ScreenCaptureKit error:', error);
  
  // Fallback to microphone
  await this.switchToMicrophoneFallback();
  
  // Emit user-friendly error message
  this.emit('error', new Error(this.getSystemAudioErrorMessage(error)));
}
```

### Permission Flow Integration
```typescript
public async requestPermissions(): Promise<{granted: boolean; error?: string}> {
  if (this.useScreenCaptureKit) {
    return await this.requestScreenCaptureKitPermissions();
  } else {
    return await this.requestLegacyPermissions();
  }
}
```

## Risk Mitigation

### Identified Risks & Solutions

1. **Audio Latency**: Streaming via JSON might add latency
   - **Mitigation**: Efficient Base64 encoding, minimal JSON overhead
   - **Monitoring**: Add performance metrics

2. **Permission Edge Cases**: ScreenCaptureKit permission denied after granted
   - **Mitigation**: Robust fallback to microphone with clear user messaging
   - **Testing**: Comprehensive permission state testing

3. **Build Complexity**: Adding Swift to build process
   - **Mitigation**: Keep Swift build isolated, include pre-compiled fallback
   - **Documentation**: Clear build setup instructions

4. **Cross-Platform Compatibility**: ScreenCaptureKit macOS-only
   - **Mitigation**: Platform detection, graceful fallback
   - **Future**: Plan Windows/Linux system audio solutions

### Success Criteria
- ✅ System audio capture reliability >95% on supported macOS versions
- ✅ Zero regression in existing functionality  
- ✅ Permission flow success rate >90%
- ✅ Audio processing latency ≤1.2s (current target)
- ✅ Graceful fallback rate 100% on errors

## Files to Modify

### New Files
- `native-modules/system-audio/SystemAudioCapture.swift`
- `native-modules/system-audio/build.sh`
- `native-modules/system-audio/README.md`

### Modified Files
- `electron/SystemAudioCapture.ts` (replace ScreenCaptureKit implementation)
- `scripts/build-native.sh` (add Swift compilation)
- `package.json` (ensure binary packaging)
- `.agent/README.md` (update documentation)

### Files to Reference (Don't Modify)
- `electron-system-audio-recorder/src/swift/Recorder.swift` (source reference)
- `electron-system-audio-recorder/src/electron/utils/permission.js` (permission patterns)
- `electron/AudioStreamProcessor.ts` (integration target)

## Validation Steps

### Pre-Integration Checklist
- [ ] Swift binary compiles successfully
- [ ] Audio streaming protocol works
- [ ] Permission flow tested independently
- [ ] Format conversion validated

### Post-Integration Checklist  
- [ ] System audio capture functional
- [ ] Microphone fallback works
- [ ] No regression in existing features
- [ ] Performance metrics within targets
- [ ] Error handling user-friendly
- [ ] Build process reliable

## Success Metrics
- **Functionality**: System audio capture works reliably
- **Reliability**: <5% failure rate on supported platforms
- **Performance**: Maintain <1.2s audio processing latency
- **User Experience**: Clear error messages and fallback behavior
- **Integration**: Zero breaking changes to existing CueMe functionality

---

## Implementation Log

### Status: PHASE 2 IN PROGRESS
**Created**: 2025-10-12  
**Current Phase**: Phase 2 - CueMe Integration (Days 4-6)  
**Confidence**: 99%

### Progress Tracking
- [x] Phase 1: Swift Streaming Binary (Days 1-3) - ✅ **COMPLETED**
- [x] Phase 2: CueMe Integration (Days 4-6) - ✅ **COMPLETED**
- [ ] Phase 3: Testing & Integration (Days 7-8)
- [ ] Documentation and .agent updates

### Phase 1 Achievements ✅
- **Swift Binary Created**: Successfully created `SystemAudioCapture.swift` with streaming capabilities
- **Command Interface**: Implemented `status`, `permissions`, `start-stream` commands
- **JSON Protocol**: Real-time audio streaming via stdout as Base64-encoded Float32 PCM
- **Build Process**: Integrated into CueMe's `build-native.sh` script
- **Testing**: Binary tests pass, all commands work correctly

### Phase 2 Achievements ✅
- **SystemAudioCapture.ts Updated**: Successfully integrated new Swift binary
  - Updated `checkScreenCaptureKitStatus()` for new JSON protocol
  - Updated `startScreenCaptureKitCapture()` for streaming mode
  - Updated `requestScreenCaptureKitPermissions()` for new permission flow
  - Added `convertFloat32StereoToInt16Mono()` for audio format conversion
- **Build Integration**: Updated `scripts/build-native.sh` to use new Swift module
- **Successful Build**: CueMe builds successfully with new system audio integration

### Technical Implementation Details

#### Swift Binary Features
```bash
# Status check
./SystemAudioCapture status
# Output: {"type":"status","data":{"isAvailable":true,"displayCount":1,...}}

# Permission request
./SystemAudioCapture permissions
# Output: {"type":"permission","granted":true,"message":"..."}

# Audio streaming (real-time)
./SystemAudioCapture start-stream
# Output: {"type":"audio","data":"base64-pcm","sampleRate":48000,...}
```

#### Integration Points
1. **Audio Format Conversion**: Swift outputs Float32 stereo 48kHz → CueMe expects Int16 mono 16kHz
2. **JSON Protocol**: Clean, structured communication via stdout/stdin
3. **Error Handling**: Graceful fallback to microphone on any system audio failure
4. **Permission Flow**: Native macOS permission dialogs via Swift binary

### Next Steps: Phase 3 Testing
1. **End-to-End Testing**: Test complete audio pipeline (capture → transcription → question detection)
2. **Permission Flow Testing**: Test initial setup and permission recovery
3. **Error Handling Testing**: Test various failure scenarios and fallbacks
4. **Performance Testing**: Verify ~1.1s latency target maintained