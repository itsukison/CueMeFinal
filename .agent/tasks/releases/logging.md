  "chromeVersion": "130.0.6723.118",
  "appVersion": "1.0.74",
  "isPackaged": true,
  "execPath": "/Applications/CueMe.app/Contents/MacOS/CueMe",
  "resourcesPath": "/Applications/CueMe.app/Contents/Resources",
  "cwd": "/",
  "env": {}
}
[2025-10-25 12:24:22.922] [info]  ================================================================================
[2025-10-25 12:24:22.922] [info]  CueMe v1.0.74 - 2025-10-25T03:24:22.922Z
[2025-10-25 12:24:22.922] [info]  Platform: darwin arm64
[2025-10-25 12:24:22.922] [info]  Node: v20.18.0
[2025-10-25 12:24:22.922] [info]  Electron: 33.2.0
[2025-10-25 12:24:22.922] [info]  Packaged: true
[2025-10-25 12:24:22.922] [info]  CWD: /
[2025-10-25 12:24:22.922] [info]  Resources: /Applications/CueMe.app/Contents/Resources
[2025-10-25 12:24:22.923] [info]  Log File: /Users/itsukison/Library/Logs/CueMe/main.log
[2025-10-25 12:24:22.923] [info]  ================================================================================
[2025-10-25 12:24:22.923] [info]  [Main] === CueMe Application Starting ===
[2025-10-25 12:24:22.923] [info]  [Main] Environment check {
  "isProduction": false,
  "hasOpenAI": true,
  "hasGemini": true,
  "hasSupabaseUrl": true,
  "hasSupabaseKey": true
}
[2025-10-25 12:24:22.923] [info]  🚨 [PRODUCTION DEBUG] Environment check:
[2025-10-25 12:24:22.923] [info]    NODE_ENV: undefined
[2025-10-25 12:24:22.923] [info]    OPENAI_API_KEY present: true
[2025-10-25 12:24:22.923] [info]    GEMINI_API_KEY present: true
[2025-10-25 12:24:22.923] [info]    Process info: {
  cwd: '/',
  resourcesPath: '/Applications/CueMe.app/Contents/Resources',
  platform: 'darwin'
}
[2025-10-25 12:24:23.033] [info]  [SystemAudioCapture] Initialized with config {
  "sampleRate": 16000,
  "channelCount": 1,
  "bufferSize": 4096
}
[2025-10-25 12:24:23.200] [info]  [SystemAudioCapture] Initialized with config {
  "sampleRate": 16000,
  "channelCount": 1,
  "bufferSize": 4096
}
[2025-10-25 12:24:23.201] [info]  [DiagnosticsHandlers] Registering diagnostics IPC handlers
[2025-10-25 12:24:23.201] [info]  [DiagnosticsHandlers] ✅ Diagnostics IPC handlers registered
[2025-10-25 12:24:27.528] [info]  [IPC audioHandlers] 🎙️  Received dual-audio-start request (AUTOMATIC dual capture)
[2025-10-25 12:24:27.769] [info]  [SystemAudioCapture] System audio available (Core Audio Taps via audiotee) {
  "osVersion": {
    "major": 15,
    "minor": 4,
    "patch": 1
  }
}
[2025-10-25 12:24:27.769] [info]  [SystemAudioCapture] ✅ Found audiotee binary {
  "path": "/Applications/CueMe.app/Contents/Resources/app.asar/node_modules/audiotee/bin/audiotee",
  "size": 604760,
  "mode": "100644",
  "isExecutable": false,
:

[2025-10-25 12:24:27.769] [warn]  [SystemAudioCapture] Binary found but not executable! Attempting to use anyway...
[2025-10-25 12:24:27.769] [info]  [SystemAudioCapture] Spawning audiotee process {
  "binaryPath": "/Applications/CueMe.app/Contents/Resources/app.asar/node_modules/audiotee/bin/audiotee",
  "args": [
    "--sample-rate",
    "16000",
    "--chunk-duration",
    "0.2"
  ],
  "cwd": "/"
}
[2025-10-25 12:24:27.772] [error] [SystemAudioCapture] ❌ Failed to start macOS system audio {
  "message": "❌ Failed to start macOS system audio",
  "timestamp": "2025-10-25T03:24:27.770Z",
  "component": "SystemAudioCapture",
  "error": {
    "name": "Error",
    "message": "spawn ENOTDIR",
    "stack": "Error: spawn ENOTDIR\n    at ChildProcess.spawn (node:internal/child_process:421:11)\n    at Object.spawn (node:child_process:777:9)\n    at N6.startMacOSSystemAudioCapture (/Applications/CueMe.app/Contents/Resources/app.asar/dist-electron/main.js:589:12484)\n    at N6.startSystemAudioCapture (/Applications/CueMe.app/Contents/Resources/app.asar/dist-electron/main.js:589:12008)\n    at N6.startCapture (/Applications/CueMe.app/Contents/Resources/app.asar/dist-electron/main.js:589:8846)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at async vI.startCapture (/Applications/CueMe.app/Contents/Resources/app.asar/dist-electron/main.js:777:4495)\n    at async /Applications/CueMe.app/Contents/Resources/app.asar/dist-electron/main.js:9:30319\n    at async WebContents.<anonymous> (node:electron/js2c/browser_init:2:86542)",
    "code": "ENOTDIR",
    "errno": -20,
    "syscall": "spawn"
  }
}
[2025-10-25 12:24:27.772] [info]  [IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)
[2025-10-25 12:24:35.825] [info]  [IPC audioHandlers] 🛑 Received dual-audio-stop request
[2025-10-25 12:24:35.827] [info]  [IPC audioHandlers] ✅ Dual audio capture stopped successfully
[2025-10-25 12:24:35.828] [info]  [AudioHandlers] IPC: audio-stream-stop called
[2025-10-25 12:24:35.828] [info]  [IPC audioHandlers] 🛑 Received audio-stream-stop request
[2025-10-25 12:24:35.829] [info]  [AudioHandlers] ✅ Audio stream stopped successfully
[2025-10-25 12:24:35.829] [info]  [IPC audioHandlers] ✅ Audio stream stopped successfully
(END)


microphone console log
[QueueCommands] Starting audio listening...
index-DvRqUAL9.js:254 [QueueCommands] Set isListening to true
index-DvRqUAL9.js:254 [QueueCommands] Starting audio capture (Gemini Live system)...
index-DvRqUAL9.js:254 [QueueCommands] Setting up microphone capture...
index-DvRqUAL9.js:254 [QueueCommands] Microphone permission granted
index-DvRqUAL9.js:254 [QueueCommands] Got media stream, creating AudioContext...
index-DvRqUAL9.js:254 [QueueCommands] AudioContext created, state: running
index-DvRqUAL9.js:254 [QueueCommands] Media stream source created
index-DvRqUAL9.js:254 [QueueCommands] Audio track info: Object
index-DvRqUAL9.js:254 [QueueCommands] About to attempt AudioWorklet setup...
index-DvRqUAL9.js:254 [QueueCommands] Set frontendListening to true (before AudioWorklet connection)
index-DvRqUAL9.js:254 [QueueCommands] Loading AudioWorklet module from /audio-worklet-processor.js
index-DvRqUAL9.js:254 [QueueCommands] ❌ AudioWorklet failed: AbortError: The user aborted a request.
oe @ index-DvRqUAL9.js:254
index-DvRqUAL9.js:254 [QueueCommands] Falling back to ScriptProcessor (deprecated but more compatible)
oe @ index-DvRqUAL9.js:254
index-DvRqUAL9.js:254 [Deprecation] The ScriptProcessorNode is deprecated. Use AudioWorkletNode instead. (https://bit.ly/audio-worklet)
oe @ index-DvRqUAL9.js:254
index-DvRqUAL9.js:254 [QueueCommands] ✅ ScriptProcessor created as fallback
index-DvRqUAL9.js:254 [QueueCommands] ScriptProcessor fallback setup completed
index-DvRqUAL9.js:254 [QueueCommands] Audio capture setup completed successfully
index-DvRqUAL9.js:254 [QueueCommands] Audio capture initialized
index-DvRqUAL9.js:254 [QueueCommands] Starting AUTOMATIC dual audio capture (microphone + system audio)...
index-DvRqUAL9.js:254 [QueueCommands] Audio process event 1, isListening: false
index-DvRqUAL9.js:254 [QueueCommands] Not listening, dropping audio chunk
index-DvRqUAL9.js:254 [QueueCommands] ✅ Dual audio listening started successfully (Gemini Live)
index-DvRqUAL9.js:254 [QueueCommands] 🎤 Microphone → user source
index-DvRqUAL9.js:254 [QueueCommands] 🔊 System audio → opponent source
index-DvRqUAL9.js:254 [QueueCommands] Audio process event 2, isListening: false
index-DvRqUAL9.js:254 [QueueCommands] Not listening, dropping audio chunk
index-DvRqUAL9.js:254 [QueueCommands] Audio process event 3, isListening: false
index-DvRqUAL9.js:254 [QueueCommands] Not listening, dropping audio chunk
index-DvRqUAL9.js:254 [QueueCommands] Testing ScriptProcessor after 1 second...
index-DvRqUAL9.js:254 [QueueCommands] Audio process event 4, isListening: false
index-DvRqUAL9.js:254 