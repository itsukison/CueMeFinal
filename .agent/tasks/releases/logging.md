

[2025-10-25 14:28:09.604] [info]  [SystemInfo] {
  "timestamp": "2025-10-25T05:28:09.599Z",
  "platform": "darwin",
  "arch": "arm64",
  "nodeVersion": "20.18.0",
  "electronVersion": "33.2.0",
  "chromeVersion": "130.0.6723.118",
  "appVersion": "1.0.75",
  "isPackaged": true,
  "execPath": "/Applications/CueMe.app/Contents/MacOS/CueMe",
  "resourcesPath": "/Applications/CueMe.app/Contents/Resources",
  "cwd": "/",
  "env": {}
}
[2025-10-25 14:28:09.615] [info]  ================================================================================
[2025-10-25 14:28:09.616] [info]  CueMe v1.0.75 - 2025-10-25T05:28:09.616Z
[2025-10-25 14:28:09.616] [info]  Platform: darwin arm64
[2025-10-25 14:28:09.616] [info]  Node: v20.18.0
[2025-10-25 14:28:09.616] [info]  Electron: 33.2.0
[2025-10-25 14:28:09.616] [info]  Packaged: true
[2025-10-25 14:28:09.616] [info]  CWD: /
[2025-10-25 14:28:09.616] [info]  Resources: /Applications/CueMe.app/Contents/Resources
[2025-10-25 14:28:09.616] [info]  Log File: /Users/itsukison/Library/Logs/CueMe/main.log
[2025-10-25 14:28:09.616] [info]  ================================================================================
[2025-10-25 14:28:09.617] [info]  [Main] === CueMe Application Starting ===
[2025-10-25 14:28:09.617] [info]  [Main] Environment check {
  "isProduction": false,
  "hasOpenAI": true,
  "hasGemini": true,
  "hasSupabaseUrl": true,
  "hasSupabaseKey": true
}
[2025-10-25 14:28:09.617] [info]  🚨 [PRODUCTION DEBUG] Environment check:
[2025-10-25 14:28:09.617] [info]    NODE_ENV: undefined
[2025-10-25 14:28:09.617] [info]    OPENAI_API_KEY present: true
[2025-10-25 14:28:09.617] [info]    GEMINI_API_KEY present: true
[2025-10-25 14:28:09.617] [info]    Process info: {
  cwd: '/',
  resourcesPath: '/Applications/CueMe.app/Contents/Resources',
  platform: 'darwin'
}
[2025-10-25 14:28:09.738] [info]  [SystemAudioCapture] Initialized with config {
  "sampleRate": 16000,
  "channelCount": 1,
  "bufferSize": 4096
}
[2025-10-25 14:28:09.872] [info]  [SystemAudioCapture] Initialized with config {
  "sampleRate": 16000,
  "channelCount": 1,
  "bufferSize": 4096
}
[2025-10-25 14:28:09.873] [info]  [DiagnosticsHandlers] Registering diagnostics IPC handlers
[2025-10-25 14:28:09.873] [info]  [DiagnosticsHandlers] ✅ Diagnostics IPC handlers registered
[2025-10-25 14:28:13.314] [info]  [IPC audioHandlers] 🎙️  Received dual-audio-start request (AUTOMATIC dual capture)
[2025-10-25 14:28:13.560] [info]  [SystemAudioCapture] System audio available (Core Audio Taps via audiotee) {
  "osVersion": {
    "major": 15,
    "minor": 4,
    "patch": 1
  }
:
[2025-10-25 14:28:13.561] [info]  [SystemAudioCapture] ✅ Found audiotee binary {
  "path": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee",
  "size": 657792,
  "mode": "100755",
  "isExecutable": true,
  "isFile": true
}
[2025-10-25 14:28:13.561] [info]  [SystemAudioCapture] Spawning audiotee process {
  "binaryPath": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee",
  "args": [
    "--sample-rate",
    "16000",
    "--chunk-duration",
    "0.2"
  ],
  "cwd": "/"
}
[2025-10-25 14:28:13.563] [info]  [SystemAudioCapture] audiotee process spawned {
  "pid": 54249,
  "killed": false
}
[2025-10-25 14:28:13.563] [info]  [SystemAudioCapture] ✅ macOS system audio capture started successfully
[2025-10-25 14:28:13.563] [info]  [IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)
[2025-10-25 14:28:13.661] [info]  [SystemAudioCapture] ✅ AudioTee capture started
[2025-10-25 14:28:29.364] [info]  [IPC audioHandlers] 🛑 Received dual-audio-stop request
[2025-10-25 14:28:29.366] [info]  [SystemAudioCapture] AudioTee capture stopped
[2025-10-25 14:28:29.367] [info]  [AudioHandlers] IPC: audio-stream-stop called
[2025-10-25 14:28:29.368] [info]  [IPC audioHandlers] 🛑 Received audio-stream-stop request
:


[QueueCommands] Starting audio listening...
index-DlktDSSt.js:254 [QueueCommands] Set isListening to true
index-DlktDSSt.js:254 [QueueCommands] Starting audio capture (Gemini Live system)...
index-DlktDSSt.js:254 [QueueCommands] Setting up microphone capture...
index-DlktDSSt.js:254 [QueueCommands] Microphone permission granted
index-DlktDSSt.js:254 [QueueCommands] Got media stream, creating AudioContext...
index-DlktDSSt.js:254 [QueueCommands] AudioContext created, state: running
index-DlktDSSt.js:254 [QueueCommands] Media stream source created
index-DlktDSSt.js:254 [QueueCommands] Audio track info: Object
index-DlktDSSt.js:254 [QueueCommands] About to attempt AudioWorklet setup...
index-DlktDSSt.js:254 [QueueCommands] Set frontendListening to true (before AudioWorklet connection)
index-DlktDSSt.js:254 [QueueCommands] Loading AudioWorklet module from /audio-worklet-processor.js
index-DlktDSSt.js:254 [QueueCommands] ❌ AudioWorklet failed: AbortError: The user aborted a request.
oe @ index-DlktDSSt.js:254
index-DlktDSSt.js:254 [QueueCommands] Falling back to ScriptProcessor (deprecated but more compatible)
oe @ index-DlktDSSt.js:254
index-DlktDSSt.js:254 [Deprecation] The ScriptProcessorNode is deprecated. Use AudioWorkletNode instead. (https://bit.ly/audio-worklet)
oe @ index-DlktDSSt.js:254
index-DlktDSSt.js:254 [QueueCommands] ✅ ScriptProcessor created as fallback
index-DlktDSSt.js:254 [QueueCommands] ScriptProcessor fallback setup completed
index-DlktDSSt.js:254 [QueueCommands] Audio capture setup completed successfully
index-DlktDSSt.js:254 [QueueCommands] Audio capture initialized
index-DlktDSSt.js:254 [QueueCommands] Starting AUTOMATIC dual audio capture (microphone + system audio)...
index-DlktDSSt.js:254 [QueueCommands] ✅ Dual audio listening started successfully (Gemini Live)
index-DlktDSSt.js:254 [QueueCommands] 🎤 Microphone → user source
index-DlktDSSt.js:254 [QueueCommands] 🔊 System audio → opponent source
index-DlktDSSt.js:254 [QueueCommands] Audio process event 1, frontendListeningRef: true
index-DlktDSSt.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: false
index-DlktDSSt.js:254 [QueueCommands] Audio process event 2, frontendListeningRef: true
index-DlktDSSt.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: false
index-DlktDSSt.js:254 [QueueCommands] Audio process event 3, frontendListeningRef: true
index-DlktDSSt.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-DlktDSSt.js:254 [QueueCommands] Sending audio chunk to main process...
index-DlktDSSt.js:254 [QueueCommands] Audio chunk sent successfully
index-DlktDSSt.js:254 [QueueCommands] Testing ScriptProcessor after 1 second...
index-DlktDSSt.js:254 [QueueCommands] Audio process event 4, frontendListeningRef: true
index-DlktDSSt.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-DlktDSSt.js:254 [QueueCommands] Sending audio chunk to main process...
index-DlktDSSt.js:254 [QueueCommands] Audio chunk sent successfully
index-DlktDSSt.js:254 [QueueCommands] Audio process event 5, frontendListeningRef: true
index-DlktDSSt.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true