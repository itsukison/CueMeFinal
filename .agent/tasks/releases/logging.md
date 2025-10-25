# TERMINAL
[2025-10-25 15:54:32.307] [info]  🚨 [PRODUCTION DEBUG] Environment check:
[2025-10-25 15:54:32.307] [info]    NODE_ENV: undefined
[2025-10-25 15:54:32.307] [info]    OPENAI_API_KEY present: true
[2025-10-25 15:54:32.307] [info]    GEMINI_API_KEY present: true
[2025-10-25 15:54:32.307] [info]    Process info: {
  cwd: '/',
  resourcesPath: '/Applications/CueMe.app/Contents/Resources',
  platform: 'darwin'
}
[2025-10-25 15:54:32.405] [info]  [SystemAudioCapture] Initialized with config {
  "sampleRate": 16000,
  "channelCount": 1,
  "bufferSize": 4096
}
[2025-10-25 15:54:32.542] [info]  [SystemAudioCapture] Initialized with config {
  "sampleRate": 16000,
  "channelCount": 1,
  "bufferSize": 4096
}
[2025-10-25 15:54:32.543] [info]  [DiagnosticsHandlers] Registering diagnostics IPC handlers
[2025-10-25 15:54:32.543] [info]  [DiagnosticsHandlers] ✅ Diagnostics IPC handlers registered
[2025-10-25 15:54:37.452] [info]  [IPC audioHandlers] 🎙️  Received dual-audio-start request (AUTOMATIC dual capture)
[2025-10-25 15:54:37.452] [info]  [AudioHandlers] IPC: dual-audio-start called
[2025-10-25 15:54:37.701] [info]  [SystemAudioCapture] System audio available (Core Audio Taps via audiotee) {
  "osVersion": {
    "major": 15,
    "minor": 4,
    "patch": 1
  }
}

[2025-10-25 15:54:37.701] [info]  [SystemAudioCapture] ✅ Found audiotee binary {
  "path": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee",
  "size": 657792,
  "mode": "100755",
  "isExecutable": true,
  "isFile": true
}
[2025-10-25 15:54:37.701] [info]  [SystemAudioCapture] Spawning audiotee process {
  "binaryPath": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee",
  "args": [
    "--sample-rate",
    "16000",
    "--chunk-duration",
    "0.2"
  ],
  "cwd": "/"
}
[2025-10-25 15:54:37.705] [info]  [SystemAudioCapture] audiotee process spawned {
  "pid": 46242,
  "killed": false
}
[2025-10-25 15:54:37.705] [info]  [SystemAudioCapture] ✅ macOS system audio capture started successfully
[2025-10-25 15:54:37.705] [info]  [IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)
[2025-10-25 15:54:37.705] [info]  [AudioHandlers] ✅ Dual audio capture started successfully
[2025-10-25 15:54:37.799] [info]  [SystemAudioCapture] ✅ AudioTee capture started
[2025-10-25 15:54:46.846] [info]  [IPC audioHandlers] 🛑 Received dual-audio-stop request
[2025-10-25 15:54:46.847] [info]  [AudioHandlers] IPC: audio-stream-stop called
[2025-10-25 15:54:46.848] [info]  [IPC audioHandlers] 🛑 Received audio-stream-stop request
[2025-10-25 15:54:46.848] [info]  [AudioHandlers] ✅ Audio stream stopped successfully
[2025-10-25 15:54:46.848] [info]  [IPC audioHandlers] ✅ Audio stream stopped successfully
[2025-10-25 15:54:46.849] [info]  [SystemAudioCapture] AudioTee capture stopped
[2025-10-25 15:54:46.853] [info]  [SystemAudioCapture] AudioTee process exited {
  "code": 0,
  "signal": null,
  "audioDataCount": 45
}
[2025-10-25 15:54:46.854] [info]  [IPC audioHandlers] ✅ Dual audio capture stopped successfully
(END)






# CONSOLE LOG
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
index-DlktDSSt.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-DlktDSSt.js:254 [QueueCommands] Sending audio chunk to main process...
index-DlktDSSt.js:254 [QueueCommands] Audio chunk sent successfully
index-DlktDSSt.js:254 [QueueCommands] Audio process event 2, frontendListeningRef: true
index-DlktDSSt.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-DlktDSSt.js:254 [QueueCommands] Sending audio chunk to main process...