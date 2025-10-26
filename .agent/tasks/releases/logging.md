[2025-10-26 20:01:58.269] [info]  [SystemAudioCapture] audiotee process spawned {
  "pid": 80260,
  "killed": false
}
[2025-10-26 20:01:58.269] [info]  [SystemAudioCapture] ✅ macOS system audio capture started successfully
[2025-10-26 20:01:58.269] [info]  [DualAudioCaptureManager] ✅ System audio capture started (opponent source)
[2025-10-26 20:01:58.269] [info]  [DualAudioCaptureManager] ✅ Dual audio capture started - streaming to Gemini Live
[2025-10-26 20:01:58.269] [info]  [DualAudioCaptureManager] 🎤 Microphone → user source
[2025-10-26 20:01:58.269] [info]  [DualAudioCaptureManager] 🔊 System audio → opponent source
[2025-10-26 20:01:58.270] [info]  [IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)
[2025-10-26 20:01:58.270] [info]  [AudioHandlers] ✅ Dual audio capture started successfully
[2025-10-26 20:01:58.394] [info]  [GeminiLiveQuestionDetector] 📨 Gemini message received (opponent) #1 {
  "messageType": "other",
  "hasParts": false,
  "partCount": 0,
  "turnComplete": false,
  "interrupted": false,
  "preview": "{\"setupComplete\":{}}"
}
[2025-10-26 20:01:58.404] [info]  [SystemAudioCapture] ✅ AudioTee capture started
[2025-10-26 20:01:58.435] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (user) {
  "bufferSize": 8192,
  "base64Length": 10923
}
[2025-10-26 20:01:58.436] [info]  [GeminiLiveQuestionDetector] 🔬 First audio chunk analysis (user) {
  "bufferLength": 8192,
  "expectedLength": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": false
}
[2025-10-26 20:01:58.437] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (user) {
  "rms": "174.62",
  "normalizedRMS": "0.0053",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 4096
}
[2025-10-26 20:01:58.437] [warn]  [GeminiLiveQuestionDetector] ⚠️ First audio chunk is very quiet or silent (user) {
  "normalizedRMS": "0.0053",
  "suggestion": "Check if audio source is active and volume is sufficient"
}
[2025-10-26 20:01:58.437] [info]  [GeminiLiveQuestionDetector] ⏱️ First audio send latency (user): 0ms
[2025-10-26 20:01:58.655] [info]  [SystemAudioCapture] 🎵 FIRST audio chunk from audiotee {
  "bytes": 6400,
  "listenerCount": 1,
  "hasListeners": true
}
[2025-10-26 20:01:58.656] [info]  [DualAudioCaptureManager] 🔊 FIRST audio-data event received! {
  "bufferSize": 6400,
  "isCapturing": true,
  "timestamp": 1761476518656
}
[2025-10-26 20:01:58.656] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (opponent) {
  "bufferSize": 6400,
:
[2025-10-26 20:01:58.657] [info]  [GeminiLiveQuestionDetector] 🔬 First audio chunk analysis (opponent) {
  "bufferLength": 6400,
  "expectedLength": 6400,
  "hexPreview": "0000000000000000000000000000000000000000000000000000000000000000",
  "isAllZeros": true
}
[2025-10-26 20:01:58.657] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (opponent) {
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 3200
}
[2025-10-26 20:01:58.657] [warn]  [GeminiLiveQuestionDetector] ⚠️ First audio chunk is very quiet or silent (opponent) {
  "normalizedRMS": "0.0000",
  "suggestion": "Check if audio source is active and volume is sufficient"
}
[2025-10-26 20:01:58.658] [info]  [GeminiLiveQuestionDetector] ⏱️ First audio send latency (opponent): 0ms
[2025-10-26 20:02:08.445] [info]  [SystemAudioCapture] 🎵 Audio chunks from audiotee: 50 total, 6400 bytes, 10176ms since last log {
  "listenerCount": 1
}
[2025-10-26 20:02:08.448] [info]  [DualAudioCaptureManager] 🔊 audio-data events: 50 total, 23466ms since last log {
  "bufferSize": 6400,
  "isCapturing": true
}
[2025-10-26 20:02:08.448] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (opponent): 50 total, 23467ms since last log
[2025-10-26 20:02:08.449] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (opponent) {
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 3200
}
[2025-10-26 20:02:18.450] [info]  [SystemAudioCapture] 🎵 Audio chunks from audiotee: 100 total, 6400 bytes, 10005ms since last log {
  "listenerCount": 1
}
[2025-10-26 20:02:18.453] [info]  [DualAudioCaptureManager] 🔊 audio-data events: 100 total, 10005ms since last log {
  "bufferSize": 6400,
  "isCapturing": true
}
[2025-10-26 20:02:18.453] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (opponent): 100 total, 10005ms since last log
[2025-10-26 20:02:18.453] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (opponent) {
  "rms": "0.00",
  "normalizedRMS": "0.0000",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 3200
}
[2025-10-26 20:02:23.002] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (user): 50 total, 38021ms since last log
[2025-10-26 20:02:23.002] [info]  [GeminiLiveQuestionDetector] 🎚️ Audio level (user) {
  "rms": "37.42",
  "normalizedRMS": "0.0011",
  "isSilent": true,
  "isQuiet": true,
  "sampleCount": 4096
:
[2025-10-26 20:02:26.101] [info]  [IPC audioHandlers] 🛑 Received dual-audio-stop request
[2025-10-26 20:02:26.102] [info]  [DualAudioCaptureManager] Stopping dual audio capture...
[2025-10-26 20:02:26.106] [info]  [SystemAudioCapture] AudioTee capture stopped
[2025-10-26 20:02:26.111] [info]  [AudioHandlers] IPC: audio-stream-stop called
[2025-10-26 20:02:26.111] [info]  [IPC audioHandlers] 🛑 Received audio-stream-stop request
[2025-10-26 20:02:26.112] [info]  [AudioHandlers] ✅ Audio stream stopped successfully
[2025-10-26 20:02:26.112] [info]  [IPC audioHandlers] ✅ Audio stream stopped successfully
[2025-10-26 20:02:26.124] [info]  [SystemAudioCapture] AudioTee process exited {
  "code": 0,
  "signal": null,
  "audioDataCount": 138
}
