/**
 * AudioWorklet processor code as a string for inline loading via Blob URL
 * This avoids file loading issues in Electron production builds
 */
export const AUDIO_WORKLET_PROCESSOR_CODE = `
// Audio Worklet Processor for REAL-TIME streaming to Gemini Live API
// NO BUFFERING - Send audio immediately as it's captured
// Gemini Live's built-in VAD handles speech detection
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkCount = 0;
    this.lastLogTime = 0;
    
    // Minimal buffering for efficient chunk sizes
    // Send every 128ms (2048 samples at 16kHz) for optimal real-time performance
    this.audioBuffer = [];
    this.sampleRate = 16000; // 16kHz sample rate
    this.chunkSize = 2048; // 128ms chunks (2048 samples / 16000 Hz = 0.128s)
    
    // Log processor initialization
    this.port.postMessage({
      type: 'log',
      message: 'AudioCaptureProcessor initialized for REAL-TIME streaming (128ms chunks, no silence detection)'
    });
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const currentTime = Date.now();
    
    // Log every 5 seconds to show we're processing
    if (currentTime - this.lastLogTime > 5000) {
      this.port.postMessage({
        type: 'log', 
        message: \`AudioWorklet streaming - buffer: \${this.audioBuffer.length} samples, sent: \${this.chunkCount} chunks\`
      });
      this.lastLogTime = currentTime;
    }
    
    if (input && input.length > 0) {
      const inputChannel = input[0];
      
      if (inputChannel && inputChannel.length > 0) {
        // Add samples to buffer
        for (let i = 0; i < inputChannel.length; i++) {
          this.audioBuffer.push(inputChannel[i]);
        }
        
        // Send chunk immediately when we reach target size
        // NO SILENCE DETECTION - Gemini Live's VAD handles this!
        if (this.audioBuffer.length >= this.chunkSize) {
          this.chunkCount++;
          
          // Create chunk from buffer
          const chunkData = new Float32Array(this.audioBuffer.splice(0, this.chunkSize));
          
          // Calculate RMS for debugging silence
          let sumSquares = 0;
          for (let i = 0; i < chunkData.length; i++) {
            sumSquares += chunkData[i] * chunkData[i];
          }
          const rms = Math.sqrt(sumSquares / chunkData.length);

          // Send audio chunk to main thread immediately
          this.port.postMessage({
            type: 'audio-chunk',
            data: chunkData,
            chunkNumber: this.chunkCount,
            length: chunkData.length,
            durationMs: (chunkData.length / this.sampleRate) * 1000,
            triggerReason: 'continuous-stream',
            rms: rms // Send RMS to main thread
          });
          
          // Log every 50 chunks to avoid spam
          if (this.chunkCount % 50 === 0) {
            this.port.postMessage({
              type: 'log',
              message: \`Streaming: sent \${this.chunkCount} chunks (\${(this.chunkCount * 128 / 1000).toFixed(1)}s of audio)\`
            });
          }
        }
      }
    }
    
    return true; // Keep processor alive
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
`;

/**
 * Create a Blob URL for the AudioWorklet processor
 * This works reliably in both dev and production Electron builds
 */
export function createAudioWorkletBlobURL(): string {
  const blob = new Blob([AUDIO_WORKLET_PROCESSOR_CODE], {
    type: 'application/javascript',
  });
  return URL.createObjectURL(blob);
}
