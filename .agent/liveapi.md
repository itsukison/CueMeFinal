# Gemini Live API Guide (Condensed)

This guide focuses on using the **Gemini Live API** with the `gemini-2.5-flash-native-audio-preview-12-2025` model in a Node.js/Electron environment.

## Core Concepts

- **Model**: `gemini-2.5-flash-native-audio-preview-12-2025`
- **Modality**: Native Audio requires `responseModalities: [Modality.AUDIO]`.
- **Audio Format**:
    - **Input**: Raw 16-bit PCM, 16kHz (Little Endian).
    - **Output**: Raw 16-bit PCM, 24kHz (Little Endian).

## Establishing a Connection (JavaScript/TypeScript)

```typescript
import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'YOUR_API_KEY' });
const model = 'gemini-2.5-flash-native-audio-preview-12-2025';

const config = {
  responseModalities: [Modality.AUDIO], 
  systemInstruction: "Your system prompt here..."
};

const session = await ai.live.connect({
  model: model,
  config: config,
  callbacks: {
    onopen: () => console.log('Session opened'),
    onmessage: (message) => handleMessage(message),
    onclose: (e) => console.log('Session closed', e),
    onerror: (e) => console.error('Session error', e),
  },
});
```

## Streaming Audio Input

Send audio chunks using `sendRealtimeInput`. The chunks must be base64-encoded raw PCM data.

```typescript
// Assuming 'audioBuffer' is a raw 16-bit PCM buffer at 16kHz
const base64Audio = audioBuffer.toString('base64');

session.sendRealtimeInput({
  audio: {
    data: base64Audio,
    mimeType: "audio/pcm;rate=16000"
  }
});
```

## Handling Responses

Responses arrive via the `onmessage` callback. Features of interest:

- **Audio Output**: `message.serverContent.modelTurn.parts[].inlineData`
- **Text Generation**: `message.serverContent.modelTurn.parts[].text` (if prompt requests text/JSON)
- **Turn Completion**: `message.serverContent.turnComplete` indicates the model has finished the current turn.
- **Interruption**: `message.serverContent.interrupted` indicates the model stopped because user spoke.

```typescript
function handleMessage(message: any) {
  // 1. Handle Audio (if present)
  if (message.serverContent?.modelTurn?.parts) {
    for (const part of message.serverContent.modelTurn.parts) {
      if (part.inlineData) {
        // Play audio data (base64)
        playAudio(part.inlineData.data);
      }
      if (part.text) {
        // Handle text/JSON output
        console.log("Model Text:", part.text);
      }
    }
  }

  // 2. Handle Turn Completion
  if (message.serverContent?.turnComplete) {
    console.log("Turn received completely.");
  }

  // 3. Handle Interruptions
  if (message.serverContent?.interrupted) {
    console.log("Model was interrupted by user.");
    clearAudioQueue();
  }
}
```

## Voice Activity Detection (VAD)

The API automatically detects when the user starts/stops speaking.
- **Interruption**: If the user speaks while the model is responding, the server sends `interrupted: true`.
- **Config**: You can tune VAD sensitivity in `realtimeInputConfig` if needed (default is usually sufficient).

## Token Usage

Token usage is returned in `message.usageMetadata`.

```typescript
if (message.usageMetadata) {
  console.log("Input Tokens:", message.usageMetadata.promptTokenCount);
  console.log("Output Tokens:", message.usageMetadata.candidatesTokenCount);
}
```