  "hasLive": true,
  "hasConnect": true,
  "liveType": "object"
}
[2025-10-26 12:39:59.087] [info]  [GeminiLiveQuestionDetector] ✅ Initialized with Gemini Live model: gemini-live-2.5-flash-preview
[2025-10-26 12:39:59.087] [info]  [DualAudioCaptureManager] ✅ GeminiLiveQuestionDetector created
[2025-10-26 12:39:59.087] [info]  [DualAudioCaptureManager] 📦 Creating SystemAudioCapture...
[2025-10-26 12:39:59.088] [info]  [SystemAudioCapture] Initialized with config {
  "sampleRate": 16000,
  "channelCount": 1,
  "bufferSize": 4096
}
[2025-10-26 12:39:59.089] [info]  [DualAudioCaptureManager] ✅ SystemAudioCapture created
[2025-10-26 12:39:59.089] [info]  [DualAudioCaptureManager] 🔗 Setting up event forwarding...
[2025-10-26 12:39:59.089] [info]  [DualAudioCaptureManager] 🔗 Setting up event listeners on SystemAudioCapture instance
[2025-10-26 12:39:59.089] [info]  [DualAudioCaptureManager] ✅ Event listeners attached to SystemAudioCapture {
  "listenerCount": 1
}
[2025-10-26 12:39:59.089] [info]  [DualAudioCaptureManager] ✅ Constructor completed successfully
[2025-10-26 12:39:59.089] [info]  [DiagnosticsHandlers] Registering diagnostics IPC handlers
[2025-10-26 12:39:59.089] [info]  [DiagnosticsHandlers] ✅ Diagnostics IPC handlers registered
[2025-10-26 12:40:22.750] [info]  [IPC audioHandlers] 🎙️  Received dual-audio-start request (AUTOMATIC dual capture)
[2025-10-26 12:40:22.752] [info]  [AudioHandlers] IPC: dual-audio-start called
[2025-10-26 12:40:22.752] [info]  [AudioHandlers] 🔍 Checking dualAudioManager {
  "exists": true,
  "type": "object"
}
[2025-10-26 12:40:22.752] [info]  [AudioHandlers] ✅ dualAudioManager exists, calling startCapture()...
[2025-10-26 12:40:22.752] [info]  [DualAudioCaptureManager] 🎙️ startCapture() called
[2025-10-26 12:40:22.752] [info]  [DualAudioCaptureManager] 🚀 Starting AUTOMATIC dual audio capture (microphone + system audio)...
[2025-10-26 12:40:22.752] [info]  [DualAudioCaptureManager] 📞 Starting Gemini Live sessions...
[2025-10-26 12:40:22.752] [info]  [GeminiLiveQuestionDetector] 🎙️ startListening() called
[2025-10-26 12:40:22.752] [info]  [GeminiLiveQuestionDetector] 🚀 Starting dual Gemini Live sessions...
[2025-10-26 12:40:22.752] [info]  [GeminiLiveQuestionDetector] 🔍 genAI.live check {
  "hasLive": true,
  "hasConnect": true,
  "liveType": "object"
}
[2025-10-26 12:40:22.753] [info]  [GeminiLiveQuestionDetector] 📞 Creating user session...
[2025-10-26 12:40:22.753] [info]  [GeminiLiveQuestionDetector] 🔧 createLiveSession(user) called
[2025-10-26 12:40:22.753] [info]  [GeminiLiveQuestionDetector] 🔍 Checking genAI.live for user {
  "hasLive": true,
  "liveType": "object",
  "hasConnect": "function"
}

 }
[2025-10-26 12:40:22.753] [info]  [GeminiLiveQuestionDetector] 📞 Calling genAI.live.connect for user...
[2025-10-26 12:40:22.914] [info]  [GeminiLiveQuestionDetector] ✅ user session opened
[2025-10-26 12:40:22.916] [info]  [GeminiLiveQuestionDetector] ✅ user Live API session created successfully
[2025-10-26 12:40:22.916] [info]  [GeminiLiveQuestionDetector] ✅ User session created
[2025-10-26 12:40:22.916] [info]  [GeminiLiveQuestionDetector] 📞 Creating opponent session...
[2025-10-26 12:40:22.916] [info]  [GeminiLiveQuestionDetector] 🔧 createLiveSession(opponent) called
[2025-10-26 12:40:22.917] [info]  [GeminiLiveQuestionDetector] 🔍 Checking genAI.live for opponent {
  "hasLive": true,
  "liveType": "object",
  "hasConnect": "function"
}
[2025-10-26 12:40:22.917] [info]  [GeminiLiveQuestionDetector] 📞 Calling genAI.live.connect for opponent...
[2025-10-26 12:40:23.048] [info]  [GeminiLiveQuestionDetector] ✅ opponent session opened
[2025-10-26 12:40:23.048] [info]  [GeminiLiveQuestionDetector] ✅ opponent Live API session created successfully
[2025-10-26 12:40:23.049] [info]  [GeminiLiveQuestionDetector] ✅ Opponent session created
[2025-10-26 12:40:23.049] [info]  [GeminiLiveQuestionDetector] ✅ Both Live API sessions started successfully
[2025-10-26 12:40:23.049] [info]  [DualAudioCaptureManager] ✅ Gemini Live sessions started
[2025-10-26 12:40:23.049] [info]  [DualAudioCaptureManager] 🔊 Starting system audio capture...
[2025-10-26 12:40:23.077] [info]  [SystemAudioCapture] System audio available (Core Audio Taps via audiotee) {
  "osVersion": {
    "major": 15,
    "minor": 4,
    "patch": 1
  }
}
[2025-10-26 12:40:23.080] [info]  [SystemAudioCapture] ✅ Found audiotee binary {
  "path": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee",
  "size": 657792,
  "mode": "100755",
  "isExecutable": true,
  "isFile": true
}
[2025-10-26 12:40:23.080] [info]  [SystemAudioCapture] Spawning audiotee process {
  "binaryPath": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee", 
  "args": [
    "--sample-rate",
    "16000",
    "--chunk-duration",
    "0.2"
  ],
  "cwd": "/"
}
[2025-10-26 12:40:23.088] [info]  [SystemAudioCapture] audiotee process spawned {
  "pid": 8636,
  "killed": false
}
[2025-10-26 12:40:23.088] [info]  [SystemAudioCapture] ✅ macOS system audio capture started successfully
[2025-10-26 12:40:23.088] [info]  [DualAudioCaptureManager] ✅ System audio capture started (opponent source)
[2025-10-26 12:40:23.088] [info]  [DualAudioCaptureManager] ✅ Dual audio capture started - streaming to Gemini Live
[2025-10-26 12:40:23.088] [info]  [DualAudioCaptureManager] 🎤 Microphone → user source
[2025-10-26 12:40:23.088] [info]  [DualAudioCaptureManager] 🔊 System audio → opponent source
[2025-10-26 12:40:23.088] [info]  [IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)
[2025-10-26 12:40:23.089] [info]  [AudioHandlers] ✅ Dual audio capture started successfully
[2025-10-26 12:40:23.217] [info]  [SystemAudioCapture] ✅ AudioTee capture started
[2025-10-26 12:40:23.438] [info]  [SystemAudioCapture] 🎵 FIRST audio chunk from audiotee {
  "bytes": 6400,
  "listenerCount": 1,
  "hasListeners": true
}
[2025-10-26 12:40:23.438] [info]  [DualAudioCaptureManager] 🔊 FIRST audio-data event received! {
  "bufferSize": 6400,
  "isCapturing": true,
  "timestamp": 1761450023438
}
[2025-10-26 12:40:23.439] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (opponent) {
  "bufferSize": 6400,
  "base64Length": 8534
}
[2025-10-26 12:40:26.068] [info]  [GeminiLiveQuestionDetector] 📤 FIRST audio chunk sent to Gemini (user) {
  "bufferSize": 8192,
  "base64Length": 10923
}
[2025-10-26 12:40:33.247] [info]  [SystemAudioCapture] 🎵 Audio chunks from audiotee: 50 total, 6400 bytes, 10159ms since last log {
  "listenerCount": 1
}
[2025-10-26 12:40:33.248] [info]  [DualAudioCaptureManager] 🔊 audio-data events: 50 total, 34159ms since last log {
  "bufferSize": 6400,
  "isCapturing": true
}
[2025-10-26 12:40:33.248] [info]  [GeminiLiveQuestionDetector] 📤 Audio chunks sent to Gemini (opponent): 50 total, 34161ms since last log
[2025-10-26 12:40:42.558] [info]  [IPC audioHandlers] 🛑 Received dual-audio-stop request
[2025-10-26 12:40:42.559] [info]  [DualAudioCaptureManager] Stopping dual audio capture...
[2025-10-26 12:40:42.607] [info]  [AudioHandlers] IPC: audio-stream-stop called
[2025-10-26 12:40:42.607] [info]  [IPC audioHandlers] 🛑 Received audio-stream-stop request
[2025-10-26 12:40:42.607] [info]  [AudioHandlers] ✅ Audio stream stopped successfully
[2025-10-26 12:40:42.608] [info]  [IPC audioHandlers] ✅ Audio stream stopped successfully
[2025-10-26 12:40:42.609] [info]  [SystemAudioCapture] AudioTee capture stopped
[2025-10-26 12:40:42.610] [info]  [SystemAudioCapture] AudioTee process exited {
  "code": 0,
  "signal": null,
  "audioDataCount": 96
}
[2025-10-26 12:40:42.610] [info]  [DualAudioCaptureManager] ✅ Dual audio capture stopped
[2025-10-26 12:40:42.611] [info]  [IPC audioHandlers] ✅ Dual audio capture stopped successfully
[2025-10-26 12:40:42.613] [info]  [GeminiLiveQuestionDetector] 🔌 opponent session closed: 
[2025-10-26 12:40:42.613] [info]  [GeminiLiveQuestionDetector] 🔌 user session closed: 
