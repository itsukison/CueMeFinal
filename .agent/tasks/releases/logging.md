itsukison@itsukinoMacBook-Air ~ % less -f ~/Library/Logs/CueMe/main.log






















[2025-10-25 18:39:28.702] [info]  [SystemAudioCapture] ✅ macOS system audio capture started successfully
[2025-10-25 18:39:28.702] [info]  [IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)
[2025-10-25 18:39:28.702] [info]  [AudioHandlers] ✅ Dual audio capture started successfully
[2025-10-25 18:39:28.793] [info]  [SystemAudioCapture] ✅ AudioTee capture started
[2025-10-25 18:39:42.561] [info]  [IPC audioHandlers] 🛑 Received dual-audio-stop request
[2025-10-25 18:39:42.564] [info]  [AudioHandlers] IPC: audio-stream-stop called
[2025-10-25 18:39:42.565] [info]  [IPC audioHandlers] 🛑 Received audio-stream-stop request
[2025-10-25 18:39:42.566] [info]  [AudioHandlers] ✅ Audio stream stopped successfully
[2025-10-25 18:39:42.566] [info]  [IPC audioHandlers] ✅ Audio stream stopped successfully
[2025-10-25 18:39:42.570] [info]  [SystemAudioCapture] AudioTee capture stopped
[2025-10-25 18:39:42.573] [info]  [SystemAudioCapture] AudioTee process exited {
  "code": 0,
  "signal": null,
  "audioDataCount": 68
}
[2025-10-25 18:39:42.573] [info]  [IPC audioHandlers] ✅ Dual audio capture stopped successfully
[2025-10-25 18:40:10.595] [info]  [IPC audioHandlers] 🎙️  Received dual-audio-start request (AUTOMATIC dual capture)
[2025-10-25 18:40:10.597] [info]  [AudioHandlers] IPC: dual-audio-start called
[2025-10-25 18:40:10.838] [info]  [SystemAudioCapture] System audio available (Core Audio Taps via audiotee) {
  "osVersion": {
    "major": 15,
    "minor": 4,
    "patch": 1
  }
}
[2025-10-25 18:40:10.839] [info]  [SystemAudioCapture] ✅ Found audiotee binary {
  "path": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee",
  "size": 657792,
  "mode": "100755",
  "isExecutable": true,
  "isFile": true
}
[2025-10-25 18:40:10.839] [info]  [SystemAudioCapture] Spawning audiotee process {
  "binaryPath": "/Applications/CueMe.app/Contents/Resources/app.asar.unpacked/node_modules/audiotee/bin/audiotee",
  "args": [
    "--sample-rate",
    "16000",
    "--chunk-duration",
    "0.2"
  ],
  "cwd": "/"
}
[2025-10-25 18:40:10.841] [info]  [SystemAudioCapture] audiotee process spawned {
  "pid": 51649,
  "killed": false
}
[2025-10-25 18:40:10.841] [info]  [SystemAudioCapture] ✅ macOS system audio capture started successfully
[2025-10-25 18:40:10.841] [info]  [IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)
[2025-10-25 18:40:10.841] [info]  [AudioHandlers] ✅ Dual audio capture started successfully
[2025-10-25 18:40:10.965] [info]  [SystemAudioCapture] ✅ AudioTee capture started
[2025-10-25 18:40:45.393] [info]  [IPC audioHandlers] 🛑 Received dual-audio-stop request
[2025-10-25 18:40:45.394] [info]  [AudioHandlers] IPC: audio-stream-stop called
[2025-10-25 18:40:45.394] [info]  [IPC audioHandlers] 🛑 Received audio-stream-stop request
[2025-10-25 18:40:45.395] [info]  [AudioHandlers] ✅ Audio stream stopped successfully
[2025-10-25 18:40:45.395] [info]  [IPC audioHandlers] ✅ Audio stream stopped successfully
[2025-10-25 18:40:45.395] [info]  [SystemAudioCapture] AudioTee capture stopped
[2025-10-25 18:40:45.405] [info]  [SystemAudioCapture] AudioTee process exited {
  "code": 0,
  "signal": null,
  "audioDataCount": 172
}
[2025-10-25 18:40:45.406] [info]  [IPC audioHandlers] ✅ Dual audio capture stopped successfully
(END)






# CONSOLE LOG
[QueueCommands] Microphone permission granted
index-CjY9TtsY.js:254 [QueueCommands] Got media stream, creating AudioContext...
index-CjY9TtsY.js:254 [QueueCommands] AudioContext created, state: running
index-CjY9TtsY.js:254 [QueueCommands] Media stream source created
index-CjY9TtsY.js:254 [QueueCommands] Audio track info: Object
index-CjY9TtsY.js:254 [QueueCommands] About to attempt AudioWorklet setup...
index-CjY9TtsY.js:254 [QueueCommands] Set frontendListening to true (before AudioWorklet connection)
index-CjY9TtsY.js:254 [QueueCommands] Loading AudioWorklet module from: file:///audio-worklet-processor.js
index-CjY9TtsY.js:254 [QueueCommands] ❌ AudioWorklet failed: AbortError: The user aborted a request.
oe @ index-CjY9TtsY.js:254
index-CjY9TtsY.js:254 [QueueCommands] Falling back to ScriptProcessor (deprecated but more compatible)
oe @ index-CjY9TtsY.js:254
index-CjY9TtsY.js:254 [Deprecation] The ScriptProcessorNode is deprecated. Use AudioWorkletNode instead. (https://bit.ly/audio-worklet)
oe @ index-CjY9TtsY.js:254
index-CjY9TtsY.js:254 [QueueCommands] ✅ ScriptProcessor created as fallback
index-CjY9TtsY.js:254 [QueueCommands] ScriptProcessor fallback setup completed
index-CjY9TtsY.js:254 [QueueCommands] Audio capture setup completed successfully
index-CjY9TtsY.js:254 [QueueCommands] Audio capture initialized
index-CjY9TtsY.js:254 [QueueCommands] Starting AUTOMATIC dual audio capture (microphone + system audio)...
index-CjY9TtsY.js:254 [QueueCommands] ✅ Dual audio listening started successfully (Gemini Live)
index-CjY9TtsY.js:254 [QueueCommands] 🎤 Microphone → user source
index-CjY9TtsY.js:254 [QueueCommands] 🔊 System audio → opponent source
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 1, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: false
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 2, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: false
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 3, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: false
index-CjY9TtsY.js:254 [QueueCommands] Testing ScriptProcessor after 1 second...
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 4, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-CjY9TtsY.js:254 [QueueCommands] Sending audio chunk to main process (Gemini Live)...
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk sent successfully to Gemini Live
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 5, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-CjY9TtsY.js:254 [QueueCommands] Sending audio chunk to main process (Gemini Live)...
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk sent successfully to Gemini Live
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 6, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-CjY9TtsY.js:254 [QueueCommands] Sending audio chunk to main process (Gemini Live)...
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk sent successfully to Gemini Live
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 7, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-CjY9TtsY.js:254 [QueueCommands] Sending audio chunk to main process (Gemini Live)...
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk sent successfully to Gemini Live
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 8, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-CjY9TtsY.js:254 [QueueCommands] Sending audio chunk to main process (Gemini Live)...
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk sent successfully to Gemini Live
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 9, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-CjY9TtsY.js:254 [QueueCommands] Sending audio chunk to main process (Gemini Live)...
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk sent successfully to Gemini Live
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 10, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-CjY9TtsY.js:254 [QueueCommands] Sending audio chunk to main process (Gemini Live)...
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk sent successfully to Gemini Live
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 11, frontendListeningRef: true
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk - samples: 4096 hasAudio: true
index-CjY9TtsY.js:254 [QueueCommands] Sending audio chunk to main process (Gemini Live)...
index-CjY9TtsY.js:254 [QueueCommands] Audio chunk sent successfully to Gemini Live
index-CjY9TtsY.js:254 [QueueCommands] Audio process event 12, frontendListeningRef: true