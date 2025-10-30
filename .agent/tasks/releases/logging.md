[2025-10-30 23:31:30.443] [warn]  [GeminiLiveQuestionDetector] ⚠️ First audio chunk is very quiet or silent (user) {
  "normalizedRMS": "0.0007",
  "suggestion": "Check if audio source is active and volume is sufficient"
}
[2025-10-30 23:31:30.444] [info]  [GeminiLiveQuestionDetector] ⏱️ First audio send latency (user): 1ms
[2025-10-30 23:31:30.447] [info]  [SystemAudioCapture] AudioTee [info] {
  "message": "Audio device started successfully"
}
[2025-10-30 23:31:30.595] [info]  [SystemAudioCapture] 🎵 FIRST audio chunk from audiotee (RAW BUFFER ANALYSIS) {
  "bytes": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true,
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "listenerCount": 1,
  "hasListeners": true
}
[2025-10-30 23:31:30.595] [error] [SystemAudioCapture] ❌ CRITICAL: audiotee produced ALL-ZERO buffer! {
  "message": "❌ CRITICAL: audiotee produced ALL-ZERO buffer!",
  "timestamp": "2025-10-30T14:31:30.595Z",
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
[2025-10-30 23:31:30.596] [info]  [SystemAudioCapture] 📋 Buffer copy verification {
  "originalLength": 6400,
  "copyLength": 6400,
  "copyHexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "copyIsAllZeros": true,
  "copiedSuccessfully": true
}
[2025-10-30 23:31:30.596] [info]  [DualAudioCaptureManager] 🔊 FIRST audio-data event received (DualAudioCaptureManager) {
  "bufferSize": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true,
  "rms": "0.00",
  "isCapturing": true,
  "timestamp": 1761834690596
}
[2025-10-30 23:31:30.596] [error] [DualAudioCaptureManager] ❌ Buffer is ALL ZEROS when received by DualAudioCaptureManager! {
  "message": "❌ Buffer is ALL ZEROS when received by DualAudioCaptureManager!",
  "timestamp": "2025-10-30T14:31:30.596Z",
  "component": "DualAudioCaptureManager",
  "error": {
    "message": "Buffer became zeros between SystemAudioCapture emit and DualAudioCaptureManager receive",
    "implication": "This indicates buffer was overwritten during async event handling"
  }
:
[2025-10-30 23:31:30.597] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (opponent) {
  "bufferSize": 6400,
  "base64Length": 8534
}
[2025-10-30 23:31:30.597] [info]  [GeminiLiveQuestionDetector] 🔬 First audio chunk analysis (opponent) {
  "bufferLength": 6400,
  "expectedLength": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true
}
[2025-10-30 23:31:30.597] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (opponent) {
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 3200
}
[2025-10-30 23:31:30.597] [warn]  [GeminiLiveQuestionDetector] ⚠️ First audio chunk is very quiet or silent (opponent) {
  "normalizedRMS": "0.0000",
  "suggestion": "Check if audio source is active and volume is sufficient"
}
[2025-10-30 23:31:30.598] [info]  [GeminiLiveQuestionDetector] ⏱️ First audio send latency (opponent): 1ms
[2025-10-30 23:31:40.394] [info]  [SystemAudioCapture] 🎵 Audio chunks from audiotee: 50 total, 6400 bytes, 10152ms since last log {
  "listenerCount": 1
}
[2025-10-30 23:31:40.396] [info]  [DualAudioCaptureManager] 🔊 audio-data events: 50 total, 20028ms since last log {
  "bufferSize": 6400,
  "isCapturing": true
}
