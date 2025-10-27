[2025-10-27 23:23:15.981] [info]  [SystemAudioCapture] ✅ AudioTee capture started
[2025-10-27 23:23:16.010] [info]  [SystemAudioCapture] AudioTee [info] {
  "message": "Audio device started successfully"
}
[2025-10-27 23:23:16.063] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (user) {
  "bufferSize": 8192,
  "base64Length": 10923
}
[2025-10-27 23:23:16.064] [info]  [GeminiLiveQuestionDetector] 🔬 First audio chunk analysis (user) {
  "bufferLength": 8192,
  "expectedLength": 6400,
  "hexPreview": "fffffafff5ffe7ffe6ffedfff0fff0fff2fff6fff2ffe3ffe4ffeffff4fffbff",
  "isAllZeros": false
}
[2025-10-27 23:23:16.064] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (user) {
  "rms": "69.80",
  "normalizedRMS": "0.0021",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 4096
}
[2025-10-27 23:23:16.065] [warn]  [GeminiLiveQuestionDetector] ⚠️ First audio chunk is very quiet or silent (user) {
  "normalizedRMS": "0.0021",
  "suggestion": "Check if audio source is active and volume is sufficient"
}
[2025-10-27 23:23:16.065] [info]  [GeminiLiveQuestionDetector] ⏱️ First audio send latency (user): 0ms
[2025-10-27 23:23:16.217] [info]  [SystemAudioCapture] 🎵 FIRST audio chunk from audiotee (RAW BUFFER ANALYSIS) {
  "bytes": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true,
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "listenerCount": 1,
  "hasListeners": true
}
[2025-10-27 23:23:16.218] [error] [SystemAudioCapture] ❌ CRITICAL: audiotee produced ALL-ZERO buffer! {
  "message": "❌ CRITICAL: audiotee produced ALL-ZERO buffer!",
  "timestamp": "2025-10-27T14:23:16.218Z",
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
[2025-10-27 23:23:16.218] [info]  [SystemAudioCapture] 📋 Buffer copy verification {
  "originalLength": 6400,
  "copyLength": 6400,
  "copyHexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "copyIsAllZeros": true,
  "copiedSuccessfully": true
}
[2025-10-27 23:23:16.218] [info]  [DualAudioCaptureManager] 🔊 FIRST audio-data event received (DualAudioCaptureManager) {
  "bufferSize": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true,
  "rms": "0.00",
  "isCapturing": true,
  "timestamp": 1761574996218
}
[2025-10-27 23:23:16.218] [error] [DualAudioCaptureManager] ❌ Buffer is ALL ZEROS when received by DualAudioCaptureManager! {
  "message": "❌ Buffer is ALL ZEROS when received by DualAudioCaptureManager!",
  "timestamp": "2025-10-27T14:23:16.218Z",
  "component": "DualAudioCaptureManager",
  "error": {
    "message": "Buffer became zeros between SystemAudioCapture emit and DualAudioCaptureManager receive",
    "implication": "This indicates buffer was overwritten during async event handling"
  }
}
[2025-10-27 23:23:16.219] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (opponent) {
  "bufferSize": 6400,
  "base64Length": 8534
}
[2025-10-27 23:23:16.219] [info]  [GeminiLiveQuestionDetector] 🔬 First audio chunk analysis (opponent) {
  "bufferLength": 6400,
  "expectedLength": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true
}
[2025-10-27 23:23:16.219] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (opponent) {
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 3200
}
[2025-10-27 23:23:16.219] [warn]  [GeminiLiveQuestionDetector] ⚠️ First audio chunk is very quiet or silent (opponent) {
  "normalizedRMS": "0.0000",
  "suggestion": "Check if audio source is active and volume is sufficient"
}
[2025-10-27 23:23:16.219] [info]  [GeminiLiveQuestionDetector] ⏱️ First audio send latency (opponent): 0ms
[2025-10-27 23:23:16.969] [info]  [IPC audioHandlers] 🎙️  Received dual-audio-start request (AUTOMATIC dual capture)
[2025-10-27 23:23:16.969] [info]  [AudioHandlers] IPC: dual-audio-start called
[2025-10-27 23:23:16.969] [info]  [AudioHandlers] 🔍 Checking dualAudioManager {
  "exists": true,
  "type": "object"
}
[2025-10-27 23:23:16.970] [info]  [AudioHandlers] ✅ dualAudioManager exists, calling startCapture()...
[2025-10-27 23:23:16.970] [info]  [DualAudioCaptureManager] 🎙️ startCapture() called
[2025-10-27 23:23:16.970] [info]  [DualAudioCaptureManager] ⚠️ Already capturing, skipping
[2025-10-27 23:23:16.970] [info]  [IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)
[2025-10-27 23:23:16.970] [info]  [AudioHandlers] ✅ Dual audio capture started successfully
[2025-10-27 23:23:22.834] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (user): 50 total, 15221ms since last log
[2025-10-27 23:23:22.836] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (user) {
  "rms": "47.69",
:

:
  "normalizedRMS": "0.0015",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 4096
}
[2025-10-27 23:23:26.015] [info]  [SystemAudioCapture] 🎵 Audio chunks from audiotee: 50 total, 6400 bytes, 10122ms since last log {
  "listenerCount": 1
}
[2025-10-27 23:23:26.016] [info]  [DualAudioCaptureManager] 🔊 audio-data events: 50 total, 18401ms since last log {
  "bufferSize": 6400,
  "isCapturing": true
}
[2025-10-27 23:23:26.016] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (opponent): 50 total, 18403ms since last log
[2025-10-27 23:23:26.017] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (opponent) {
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 3200
}
[2025-10-27 23:23:29.244] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (user): 100 total, 6410ms since last log
[2025-10-27 23:23:29.245] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (user) {
  "rms": "1022.03",
  "normalizedRMS": "0.0312",
  "isSilent": false,
  "isQuiet": true,
  "sampleCount": 4096
}
[2025-10-27 23:23:35.634] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (user): 150 total, 6390ms since last log
[2025-10-27 23:23:35.636] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (user) {
  "rms": "1153.05",
  "normalizedRMS": "0.0352",
  "isSilent": false,
  "isQuiet": true,
  "sampleCount": 4096
}
[2025-10-27 23:23:36.011] [info]  [SystemAudioCapture] 🎵 Audio chunks from audiotee: 100 total, 6400 bytes, 9996ms since last log {
  "listenerCount": 1
}
[2025-10-27 23:23:36.012] [info]  [DualAudioCaptureManager] 🔊 audio-data events: 100 total, 9996ms since last log {
  "bufferSize": 6400,
  "isCapturing": true
