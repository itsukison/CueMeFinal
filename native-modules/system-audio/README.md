# SystemAudioCapture - Native macOS System Audio Streaming

This module provides native macOS system audio capture using ScreenCaptureKit for real-time audio streaming to CueMe's audio processing pipeline.

## Overview

Based on the proven electron-system-audio-recorder implementation, this Swift binary captures system audio and streams it in real-time as JSON messages via stdout, enabling CueMe to transcribe audio from applications like Zoom, Teams, etc.

## Requirements

- macOS 13.0+ (for ScreenCaptureKit support)
- Xcode Command Line Tools (for Swift compiler)
- Screen Recording permission granted to CueMe

## Commands

### Status Check
```bash
./SystemAudioCapture status
```
Returns JSON with ScreenCaptureKit availability and system information.

### Permission Request
```bash
./SystemAudioCapture permissions
```
Requests Screen Recording permission from the user.

### Start Streaming
```bash
./SystemAudioCapture start-stream
```
Starts real-time audio streaming. Send "stop" or "quit" to stdin to stop.

## Output Format

All output is JSON via stdout:

### Status Response
```json
{
  "type": "status",
  "data": {
    "isAvailable": true,
    "displayCount": 1,
    "macOSVersion": "13.0+",
    "screenCaptureKitSupported": true
  }
}
```

### Permission Response
```json
{
  "type": "permission",
  "granted": true,
  "message": "Screen recording permission granted"
}
```

### Audio Data
```json
{
  "type": "audio",
  "data": "base64-encoded-float32-pcm-data",
  "sampleRate": 48000,
  "channels": 2,
  "frameLength": 1024,
  "timestamp": 1697123456789
}
```

### Error Response
```json
{
  "type": "error",
  "message": "Error description"
}
```

## Audio Format

- **Sample Rate**: 48 kHz
- **Channels**: 2 (stereo)
- **Format**: Float32 PCM, interleaved
- **Encoding**: Base64 for transmission

## Integration with CueMe

The SystemAudioCapture.ts module in CueMe spawns this binary and:

1. **Process Management**: Handles process lifecycle and cleanup
2. **Audio Conversion**: Converts Float32 PCM to Int16 Buffer for existing pipeline
3. **Error Handling**: Robust fallback to microphone on any failure
4. **Permission Flow**: Uses this binary's proven permission system

## Build Process

The binary is built automatically by CueMe's build process via:

```bash
./build.sh
```

This script:
- Checks Swift compiler availability
- Verifies macOS version compatibility
- Compiles the Swift source to native binary
- Copies to `../../dist-native/SystemAudioCapture`
- Sets executable permissions

## Troubleshooting

### Permission Issues
- Ensure Screen Recording permission granted in System Preferences → Security & Privacy
- Restart CueMe after granting permissions

### Build Issues
- Install Xcode Command Line Tools: `xcode-select --install`
- Verify Swift compiler: `swift --version`

### Runtime Issues
- Check macOS version: `sw_vers -productVersion`
- Test binary independently: `./SystemAudioCapture status`

## Development Notes

This implementation maintains the proven ScreenCaptureKit setup from electron-system-audio-recorder while adapting it for real-time streaming instead of file recording. The audio processing pipeline remains robust and efficient.

Key modifications from the original:
- Streaming via stdout instead of file writing
- Command-based interface (status, permissions, start-stream)
- Real-time audio data encoding as Base64 JSON
- Stdin monitoring for stop commands
- Enhanced error handling and status reporting