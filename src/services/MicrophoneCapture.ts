/**
 * MicrophoneCapture - Renderer-side microphone capture service
 * 
 * This service runs in the renderer process (browser context) where
 * navigator.mediaDevices is available. It captures microphone audio
 * and sends it to the main process via IPC.
 * 
 * IMPORTANT: This must run in renderer, not main process!
 */

export interface AudioConfig {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
}

export interface MicrophoneCaptureState {
  isCapturing: boolean;
  hasPermission: boolean;
  error?: string;
}

export class MicrophoneCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private state: MicrophoneCaptureState = {
    isCapturing: false,
    hasPermission: false
  };

  /**
   * Request microphone permission from the browser
   * This will trigger the system permission dialog if not already granted
   */
  async requestPermission(): Promise<boolean> {
    try {
      console.log('[MicrophoneCapture] Requesting microphone permission...');
      
      // Request access and immediately stop to just check permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      this.state.hasPermission = true;
      console.log('[MicrophoneCapture] ✅ Microphone permission granted');
      return true;
    } catch (error) {
      console.error('[MicrophoneCapture] ❌ Microphone permission denied:', error);
      this.state.hasPermission = false;
      this.state.error = (error as Error).message;
      return false;
    }
  }

  /**
   * Check if microphone permission is already granted
   */
  async checkPermission(): Promise<boolean> {
    try {
      // Try to enumerate devices - if we can see labels, we have permission
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      
      // If we can see device labels, permission is granted
      const hasPermission = audioDevices.some(d => d.label !== '');
      this.state.hasPermission = hasPermission;
      
      return hasPermission;
    } catch (error) {
      console.error('[MicrophoneCapture] Error checking permission:', error);
      return false;
    }
  }

  /**
   * Start capturing microphone audio
   * Audio data will be sent to main process via IPC
   */
  async startCapture(config: AudioConfig): Promise<void> {
    if (this.state.isCapturing) {
      console.warn('[MicrophoneCapture] Already capturing, stopping first...');
      await this.stopCapture();
    }

    try {
      console.log('[MicrophoneCapture] Starting capture with config:', config);

      // Request microphone access with specific constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: config.sampleRate },
          channelCount: { ideal: config.channelCount },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio context
      this.audioContext = new AudioContext({ 
        sampleRate: config.sampleRate 
      });

      // Create source from media stream
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for audio data
      this.processor = this.audioContext.createScriptProcessor(
        config.bufferSize,
        config.channelCount,
        config.channelCount
      );

      // Process audio data and send to main process
      this.processor.onaudioprocess = (e) => {
        const audioData = e.inputBuffer.getChannelData(0);
        
        // Send to main process via IPC
        if (window.electronAPI?.audioProcessMicrophoneChunk) {
          window.electronAPI.audioProcessMicrophoneChunk(audioData)
            .catch(error => {
              console.error('[MicrophoneCapture] Error sending audio chunk:', error);
            });
        }
      };

      // Connect audio nodes
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.state.isCapturing = true;
      this.state.hasPermission = true;
      this.state.error = undefined;

      console.log('[MicrophoneCapture] ✅ Capture started successfully');
    } catch (error) {
      console.error('[MicrophoneCapture] ❌ Failed to start capture:', error);
      this.state.error = (error as Error).message;
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop capturing microphone audio
   */
  async stopCapture(): Promise<void> {
    console.log('[MicrophoneCapture] Stopping capture...');
    await this.cleanup();
    this.state.isCapturing = false;
    console.log('[MicrophoneCapture] ✅ Capture stopped');
  }

  /**
   * Get current capture state
   */
  getState(): MicrophoneCaptureState {
    return { ...this.state };
  }

  /**
   * Clean up all audio resources
   */
  private async cleanup(): Promise<void> {
    // Disconnect and clean up processor
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    // Disconnect source
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    // Stop all media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log('[MicrophoneCapture] Stopped track:', track.label);
      });
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Get available microphone devices
   */
  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'audioinput');
    } catch (error) {
      console.error('[MicrophoneCapture] Error enumerating devices:', error);
      return [];
    }
  }

  /**
   * Destroy the capture instance and clean up all resources
   */
  async destroy(): Promise<void> {
    console.log('[MicrophoneCapture] Destroying instance...');
    await this.cleanup();
    this.state = {
      isCapturing: false,
      hasPermission: false
    };
  }
}

// Singleton instance for easy access
let microphoneCaptureInstance: MicrophoneCapture | null = null;

export function getMicrophoneCapture(): MicrophoneCapture {
  if (!microphoneCaptureInstance) {
    microphoneCaptureInstance = new MicrophoneCapture();
  }
  return microphoneCaptureInstance;
}
