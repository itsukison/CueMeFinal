[2025-10-28 11:00:08.266] [info]  [SystemAudioCapture] ✅ AudioTee capture started
[2025-10-28 11:00:08.300] [info]  [SystemAudioCapture] AudioTee [info] {
  "message": "Audio device started successfully"
}
[2025-10-28 11:00:08.486] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (user) {
  "bufferSize": 8192,
  "base64Length": 10923
}
[2025-10-28 11:00:08.487] [info]  [GeminiLiveQuestionDetector] 🔬 First audio chunk analysis (user) {
  "bufferLength": 8192,
  "expectedLength": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": false
}
[2025-10-28 11:00:08.487] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (user) {
  "rms": "123.85",
  "normalizedRMS": "0.0038",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 4096
}
[2025-10-28 11:00:08.487] [warn]  [GeminiLiveQuestionDetector] ⚠️ First audio chunk is very quiet or silent (user) {
  "normalizedRMS": "0.0038",
  "suggestion": "Check if audio source is active and volume is sufficient"
}
[2025-10-28 11:00:08.488] [info]  [GeminiLiveQuestionDetector] ⏱️ First audio send latency (user): 0ms
[2025-10-28 11:00:08.513] [info]  [SystemAudioCapture] 🎵 FIRST audio chunk from audiotee (RAW BUFFER ANALYSIS) {
  "bytes": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true,
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "listenerCount": 1,
  "hasListeners": true
}
[2025-10-28 11:00:08.514] [error] [SystemAudioCapture] ❌ CRITICAL: audiotee produced ALL-ZERO buffer! {
  "message": "❌ CRITICAL: audiotee produced ALL-ZERO buffer!",
  "timestamp": "2025-10-28T02:00:08.513Z",
  "component": "SystemAudioCapture",
  "error": {
    "message": "The binary is running but producing silent audio",
    "possibleCauses": [
      "1. macOS Screen Recording permission conflict",
      "2. Core Audio Taps access denied",
      "3. Binary lacks proper entitlements",
      "4. No audio playing on system"
    ]
  }
}
[2025-10-28 11:00:08.514] [info]  [SystemAudioCapture] 📋 Buffer copy verification {
  "originalLength": 6400,
  "copyLength": 6400,
  "copyHexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "copyIsAllZeros": true,
  "copiedSuccessfully": true
:
[2025-10-28 11:00:08.515] [info]  [DualAudioCaptureManager] 🔊 FIRST audio-data event received (DualAudioCaptureManager) {
  "bufferSize": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true,
  "rms": "0.00",
  "isCapturing": true,
  "timestamp": 1761616808515
}
[2025-10-28 11:00:08.515] [error] [DualAudioCaptureManager] ❌ Buffer is ALL ZEROS when received by DualAudioCaptureManager! {
  "message": "❌ Buffer is ALL ZEROS when received by DualAudioCaptureManager!",
  "timestamp": "2025-10-28T02:00:08.515Z",
  "component": "DualAudioCaptureManager",
  "error": {
    "message": "Buffer became zeros between SystemAudioCapture emit and DualAudioCaptureManager receive",
    "implication": "This indicates buffer was overwritten during async event handling"
  }
}
[2025-10-28 11:00:08.515] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (opponent) {
  "bufferSize": 6400,
  "base64Length": 8534
}
[2025-10-28 11:00:08.516] [info]  [GeminiLiveQuestionDetector] 🔬 First audio chunk analysis (opponent) {
  "bufferLength": 6400,
  "expectedLength": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true
}
[2025-10-28 11:00:08.516] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (opponent) {
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 3200
}
[2025-10-28 11:00:08.516] [warn]  [GeminiLiveQuestionDetector] ⚠️ First audio chunk is very quiet or silent (opponent) {
  "normalizedRMS": "0.0000",
  "suggestion": "Check if audio source is active and volume is sufficient"
}
[2025-10-28 11:00:08.516] [info]  [GeminiLiveQuestionDetector] ⏱️ First audio send latency (opponent): 0ms
[2025-10-28 11:00:18.303] [info]  [SystemAudioCapture] 🎵 Audio chunks from audiotee: 50 total, 6400 bytes, 10145ms since last log {
  "listenerCount": 1
}
[2025-10-28 11:00:18.305] [info]  [DualAudioCaptureManager] 🔊 audio-data events: 50 total, 29387ms since last log {
  "bufferSize": 6400,
  "isCapturing": true
}
[2025-10-28 11:00:18.305] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (opponent): 50 total, 29388ms since last log
[2025-10-28 11:00:18.306] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (opponent) {
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 3200
}
[2025-10-28 11:00:28.308] [info]  [SystemAudioCapture] 🎵 Audio chunks from audiotee: 100 total, 6400 bytes, 10005ms since last log {
  "listenerCount": 1
}
[2025-10-28 11:00:28.310] [info]  [DualAudioCaptureManager] 🔊 audio-data events: 100 total, 10005ms since last log {
  "bufferSize": 6400,
  "isCapturing": true
:
