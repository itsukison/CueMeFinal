Dual Audio Transcription System - Implementation & Debug Status
1. System Overview
The CueMeFinal application has moved to a Dual Audio Capture system using the Gemini Live API.

Goal: Capture Microphone (User) and System Audio (Opponent) simultaneously.
Method: Two independent Gemini Live sessions (user, opponent).
Processing: Real-time WebSocket streaming (no batching/Whisper).
Status: Architecture implemented, but Microphone input is currently SILENT.
2. Architecture
Frontend (
QueueCommands.tsx
)
Microphone Capture: Uses navigator.mediaDevices.getUserMedia.
Processing: AudioWorkletNode (via 
audioWorkletProcessor.ts
) streams raw PCM (Float32) chunks.
IPC: Sends chunks to main process via window.electronAPI.dualAudioProcessMicrophoneChunk(float32Array).
System Audio: Handled entirely by backend (User does not select "System Audio" in frontend anymore).
Backend (Electron Main Process)
IPC Handler (
audioHandlers.ts
):
Receives dual-audio-process-microphone-chunk.
Converts Float32Array to 16-bit PCM Buffer.
Calls DualAudioCaptureManager.processMicrophoneAudio.
Manager (
DualAudioCaptureManager.ts
):
Orchestrates both sessions.
Initializes 
GeminiLiveQuestionDetector
.
Captures System Audio via SystemAudioCapture (native Swift binary).
Detector (
GeminiLiveQuestionDetector.ts
):
Manages GoogleGenAI Live sessions (WebSocket).
model: gemini-2.5-flash-native-audio-preview-12-2025 (Gemini Developer API Live model).
sendAudioData(buffer, source)
: Sends Base64 PCM to Gemini.
onmessage
: Parses response for detected questions.
3. Data Flow
Microphone Path: Mic (Browser) -> 
AudioWorklet
 -> 
IPC
 -> 
DualAudioCaptureManager
 -> 
GeminiLiveQuestionDetector
 -> Gemini API (User Session)

System Audio Path: SystemAudioCapture (Native) -> 
DualAudioCaptureManager
 -> 
GeminiLiveQuestionDetector
 -> Gemini API (Opponent Session)

4. Current Status & Known Issues (READ CAREFULLY)
✅ Fixed Issues
Model Mismatch: Previously used gemini-2.5-flash (generic) which caused the API to ignore audio streams. Fixed: Updated to gemini-live-2.5-flash-native-audio in 
DualAudioCaptureManager.ts
 and 
GeminiLiveQuestionDetector.ts
.
IPC Event Names: Fixed mismatch between gemini-live-state-changed vs audio-stream-state-changed. Events now propagate correctly.
⚠️ Critical Issue: Microphone Silence (User Source)
Symptoms:

Logs show [GeminiLiveQuestionDetector] 🎚️ Audio level (user) { "rms": "1.28", "normalizedRMS": "0.0000", "isSilent": true }.
System Audio (opponent) shows healthy RMS levels (normalizedRMS: 0.0256).
Conclusion: The backend is receiving "empty" audio buffers from the frontend for the microphone.
🔍 Debugging Logic Applied
Verified IPC Conversion: checked 
audioHandlers.ts
. Float32 to Int16 conversion looks standard (sample * 32768).
Verified AudioWorklet: checked 
QueueCommands.tsx
 and 
audioWorkletProcessor.ts
.
Worklet is connected (AudioWorkletNode created successfully).
New instrumentation: Added RMS calculation inside 
audioWorkletProcessor.ts
 and logging it in 
QueueCommands.tsx
.
Reference: See 
QueueCommands.tsx
 line 564 for the logging logic.
🛠️ Next Steps for Resolution
Goal: Determine why 
AudioWorklet
 is processing silence.

Check Browser Logs: Ask user to look for [QueueCommands] Streaming: ... RMS: X.
If RMS is near 0 in browser console: The issue is getUserMedia stream or AudioContext.
If RMS is > 0 in browser console but 0 in Backend: The issue is IPC serialization or Float32Array transmission.
Inspect getUserMedia:
Current constraints: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }.
Hypothesis: Aggressive noise suppression might be gating all audio if gain is weird. Try { echoCancellation: false, noiseSuppression: false }.
Inspect AudioContext: Ensure ctx.resume() is actually working. (Code has a check for suspended state).
5. Relevant Code Snippets
QueueCommands.tsx
 (Audio Capture)
const stream = await navigator.mediaDevices.getUserMedia({ 
  audio: { sampleRate: { ideal: 16000 }, channelCount: { ideal: 1 } } 
});
const ctx = new AudioContext({ sampleRate: 16000 });
const source = ctx.createMediaStreamSource(stream);
await ctx.audioWorklet.addModule(workletBlobURL);
const workletNode = new AudioWorkletNode(ctx, "audio-capture-processor");
source.connect(workletNode);
workletNode.connect(ctx.destination); // Necessary for processing?
audioWorkletProcessor.ts
 (Processor)
process(inputs, outputs, parameters) {
  const input = inputs[0];
  if (input && input.length > 0) {
    const inputChannel = input[0]; // Channel 0
    // Buffers and sends via port.postMessage
    // Now calculates RMS and sends it too
  }
  return true;
}
GeminiLiveQuestionDetector.ts
 (Backend)
public async sendAudioData(audioData: Buffer, source: 'user' | 'opponent'): Promise<void> {
  const session = source === 'user' ? this.userSession : this.opponentSession;
  await session.sendRealtimeInput({
    mimeType: 'audio/pcm',
    data: audioData.toString('base64')
  });
}