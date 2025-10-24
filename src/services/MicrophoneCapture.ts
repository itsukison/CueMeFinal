/**
 * MicrophoneCapture - Renderer-side microphone capture service
 * 
 * This service runs in the renderer process (browser context) where
 * navigator.mediaDevices is available. It captures microphone audio
 * and sends it to the main process via IPC.
 * 
 * IMPORTANT: This must run in renderer, not main process!
 */

// Renderer-side logging (console logs are visible in DevTools)
const LOG_PREFIX = '[MicrophoneCapture]';

function logInfo(message: string, data?: any) {
  if (data) {
    console.log(`${LOG_PREFIX} ${message}`, data);
  } else {
    console.log(`${LOG_PREFIX} ${message}`);
  }
}

function logError(message: string, error?: any, context?: any) {
  const errorDetails: any = {
    message,
    timestamp: new Date().toISOString(),
  };
  
  if (error) {
    errorDetails.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...error
    };
  }
  
  if (context) {
    errorDetails.context = context;
  }
  
  console.error(`${LOG_PREFIX} ${message}`, errorDetails);
}

function logDebug(message: string, data?: any) {
  if (data) {
    console.debug(`${LOG_PREFIX} ${message}`, data);
  } else {
    console.debug(`${LOG_PREFIX} ${message}`);
  }
}

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
    logInfo('→ requestPermission() called');
    
    try {
      logDebug('Checking if navigator.mediaDevices is available', {
        hasNavigator: typeof navigator !== 'undefined',
        hasMediaDevices: typeof navigator?.mediaDevices !== 'undefined',
        hasGetUserMedia: typeof navigator?.mediaDevices?.getUserMedia !== 'undefined'
      });
      
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not available. This might indicate the code is running in the wrong context (main process instead of renderer).');
      }
      
      logInfo('Calling getUserMedia() to request permission...');
      
      // Request access and immediately stop to just check permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      logInfo('getUserMedia() succeeded, got stream', {
        streamId: stream.id,
        trackCount: stream.getTracks().length,
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState
        }))
      });
      
      stream.getTracks().forEach(track => {
        logDebug(`Stopping track: ${track.label}`);
        track.stop();
      });
      
      this.state.hasPermission = true;
      logInfo('✅ Microphone permission granted');
      return true;
    } catch (error) {
      logError('❌ Microphone permission denied or failed', error, {
        stateBeforeError: { ...this.state }
      });
      this.state.hasPermission = false;
      this.state.error = (error as Error).message;
      return false;
    }
  }

  /**
   * Check if microphone permission is already granted
   */
  async checkPermission(): Promise<boolean> {
    logInfo('→ checkPermission() called');
    
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) {
        logError('navigator.mediaDevices.enumerateDevices not available');
        return false;
      }
      
      // Try to enumerate devices - if we can see labels, we have permission
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      
      logDebug('Enumerated devices', {
        totalDevices: devices.length,
        audioInputDevices: audioDevices.length,
        devices: audioDevices.map(d => ({
          deviceId: d.deviceId,
          label: d.label || '(no label)',
          groupId: d.groupId
        }))
      });
      
      // If we can see device labels, permission is granted
      const hasPermission = audioDevices.some(d => d.label !== '');
      this.state.hasPermission = hasPermission;
      
      logInfo(`Permission check result: ${hasPermission ? 'GRANTED' : 'NOT GRANTED'}`);
      return hasPermission;
    } catch (error) {
      logError('Error checking permission', error);
      return false;
    }
  }

  /**
   * Start capturing microphone audio
   * Audio data will be sent to main process via IPC
   */
  async startCapture(config: AudioConfig): Promise<void> {
    logInfo('→ startCapture() called', { config });
    
    if (this.state.isCapturing) {
      logInfo('Already capturing, stopping first...');
      await this.stopCapture();
    }

    try {
      logInfo('Requesting microphone access with constraints...');
      
      const constraints = {
        audio: {
          sampleRate: { ideal: config.sampleRate },
          channelCount: { ideal: config.channelCount },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      logDebug('getUserMedia constraints', constraints);

      // Request microphone access with specific constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      logInfo('✅ Got media stream', {
        streamId: this.mediaStream.id,
        tracks: this.mediaStream.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          settings: t.getSettings()
        }))
      });

      // Create audio context
      logDebug('Creating AudioContext...');
      this.audioContext = new AudioContext({ 
        sampleRate: config.sampleRate 
      });
      
      logInfo('AudioContext created', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate,
        baseLatency: this.audioContext.baseLatency
      });

      // Create source from media stream
      logDebug('Creating MediaStreamSource...');
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for audio data
      logDebug('Creating ScriptProcessor...', {
        bufferSize: config.bufferSize,
        inputChannels: config.channelCount,
        outputChannels: config.channelCount
      });
      
      this.processor = this.audioContext.createScriptProcessor(
        config.bufferSize,
        config.channelCount,
        config.channelCount
      );

      let chunkCount = 0;
      let lastLogTime = Date.now();

      // Process audio data and send to main process
      this.processor.onaudioprocess = (e) => {
        const audioData = e.inputBuffer.getChannelData(0);
        chunkCount++;
        
        // Log every 100 chunks (about every 2-3 seconds at 4096 buffer size)
        if (chunkCount % 100 === 0) {
          const now = Date.now();
          const elapsed = now - lastLogTime;
          logDebug(`Audio processing: ${chunkCount} chunks, ${audioData.length} samples, ${elapsed}ms since last log`);
          lastLogTime = now;
        }
        
        // Send to main process via IPC
        if (window.electronAPI?.audioProcessMicrophoneChunk) {
          window.electronAPI.audioProcessMicrophoneChunk(audioData)
            .catch(error => {
              logError('Error sending audio chunk to main process', error, {
                chunkNumber: chunkCount,
                sampleCount: audioData.length
              });
            });
        } else {
          if (chunkCount === 1) {
            logError('window.electronAPI.audioProcessMicrophoneChunk is not available!', null, {
              hasWindow: typeof window !== 'undefined',
              hasElectronAPI: typeof window.electronAPI !== 'undefined',
              electronAPIKeys: window.electronAPI ? Object.keys(window.electronAPI) : []
            });
          }
        }
      };

      // Connect audio nodes
      logDebug('Connecting audio nodes...');
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.state.isCapturing = true;
      this.state.hasPermission = true;
      this.state.error = undefined;

      logInfo('✅ Capture started successfully', {
        state: this.state,
        audioContextState: this.audioContext.state
      });
    } catch (error) {
      logError('❌ Failed to start capture', error, {
        config,
        stateBeforeError: { ...this.state }
      });
      this.state.error = (error as Error).message;
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop capturing microphone audio
   */
  async stopCapture(): Promise<void> {
    logInfo('→ stopCapture() called');
    await this.cleanup();
    this.state.isCapturing = false;
    logInfo('✅ Capture stopped');
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
    logDebug('→ cleanup() called');
    
    // Disconnect and clean up processor
    if (this.processor) {
      logDebug('Disconnecting processor...');
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    // Disconnect source
    if (this.source) {
      logDebug('Disconnecting source...');
      this.source.disconnect();
      this.source = null;
    }

    // Stop all media stream tracks
    if (this.mediaStream) {
      const tracks = this.mediaStream.getTracks();
      logDebug(`Stopping ${tracks.length} media stream tracks...`);
      tracks.forEach(track => {
        logDebug(`Stopping track: ${track.label} (${track.kind})`);
        track.stop();
      });
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      logDebug('Closing audio context...', { state: this.audioContext.state });
      await this.audioContext.close();
      this.audioContext = null;
    }
    
    logDebug('✅ Cleanup complete');
  }

  /**
   * Get available microphone devices
   */
  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    logInfo('→ getAvailableDevices() called');
    
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      
      logInfo(`Found ${audioInputs.length} audio input devices`, {
        devices: audioInputs.map(d => ({
          deviceId: d.deviceId,
          label: d.label || '(no label)',
          groupId: d.groupId
        }))
      });
      
      return audioInputs;
    } catch (error) {
      logError('Error enumerating devices', error);
      return [];
    }
  }

  /**
   * Destroy the capture instance and clean up all resources
   */
  async destroy(): Promise<void> {
    logInfo('→ destroy() called');
    await this.cleanup();
    this.state = {
      isCapturing: false,
      hasPermission: false
    };
    logInfo('✅ Instance destroyed');
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
