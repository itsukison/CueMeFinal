import { EventEmitter } from "events";
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'system';
  available: boolean;
}

export interface SystemAudioCaptureConfig {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
}

export interface SystemAudioCaptureEvents {
  'audio-data': (audioData: Buffer) => void;
  'source-changed': (source: AudioSource) => void;
  'error': (error: Error) => void;
  'state-changed': (state: { isCapturing: boolean; currentSource?: AudioSource }) => void;
}

export class SystemAudioCapture extends EventEmitter {
  private isCapturing: boolean = false;
  private currentSource: AudioSource | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private config: SystemAudioCaptureConfig;
  
  // audioteejs integration (custom implementation)
  private audioTeeProcess: ChildProcess | null = null;

  constructor(config?: Partial<SystemAudioCaptureConfig>) {
    super();
    
    this.config = {
      sampleRate: 16000,
      channelCount: 1,
      bufferSize: 4096,
      ...config
    };

    console.log('[SystemAudioCapture] Initialized with config:', this.config);
  }

  /**
   * Get macOS version
   */
  private async getMacOSVersion(): Promise<{ major: number; minor: number; patch: number }> {
    return new Promise((resolve) => {
      const proc = spawn('sw_vers', ['-productVersion']);
      let output = '';
      
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', () => {
        const parts = output.trim().split('.');
        resolve({
          major: parseInt(parts[0] || '0', 10),
          minor: parseInt(parts[1] || '0', 10),
          patch: parseInt(parts[2] || '0', 10)
        });
      });
      
      proc.on('error', () => {
        resolve({ major: 0, minor: 0, patch: 0 });
      });
    });
  }

  /**
   * Get available audio sources including system audio and microphone
   */
  public async getAvailableSources(): Promise<AudioSource[]> {
    try {
      console.log('[SystemAudioCapture] Enumerating available audio sources...');
      
      const sources: AudioSource[] = [];
      
      // Add microphone as a source (always available)
      sources.push({
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      });

      // Add system audio source - platform specific
      if (process.platform === 'darwin') {
        // macOS: Core Audio Taps (14.2+)
        const osVersion = await this.getMacOSVersion();
        
        if (osVersion.major >= 14 && osVersion.minor >= 2) {
          sources.push({
            id: 'system-audio',
            name: 'System Audio (Core Audio Taps)',
            type: 'system',
            available: true
          });
          console.log('[SystemAudioCapture] System audio available (Core Audio Taps via audioteejs)');
        } else {
          sources.push({
            id: 'system-audio',
            name: `System Audio (Requires macOS 14.2+)`,
            type: 'system',
            available: false
          });
          console.log(`[SystemAudioCapture] System audio unavailable - macOS ${osVersion.major}.${osVersion.minor} detected, 14.2+ required`);
        }
      } else if (process.platform === 'win32') {
        // Windows: Native Electron Loopback (Electron 30.5.1+)
        sources.push({
          id: 'system-audio',
          name: 'System Audio (Native Loopback)',
          type: 'system',
          available: true
        });
        console.log('[SystemAudioCapture] System audio available (Native Electron Loopback)');
      }

      console.log('[SystemAudioCapture] Available sources:', sources);
      return sources;
      
    } catch (error) {
      console.error('[SystemAudioCapture] Error enumerating sources:', error);
      // Return at least microphone as fallback
      return [{
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      }];
    }
  }



  /**
   * Start capturing audio from the specified source
   */
  public async startCapture(sourceId: string): Promise<void> {
    if (this.isCapturing) {
      console.log('[SystemAudioCapture] Already capturing, stopping current capture first');
      await this.stopCapture();
    }

    try {
      console.log('[SystemAudioCapture] Starting capture from source:', sourceId);
      
      const sources = await this.getAvailableSources();
      const targetSource = sources.find(s => s.id === sourceId);
      
      if (!targetSource) {
        throw new Error(`Audio source not found: ${sourceId}`);
      }
      
      if (!targetSource.available) {
        throw new Error(`Audio source not available: ${targetSource.name}`);
      }

      this.currentSource = targetSource;
      
      if (sourceId === 'microphone') {
        await this.startMicrophoneCapture();
      } else if (sourceId === 'system-audio') {
        await this.startSystemAudioCapture();
      } else {
        throw new Error(`Unsupported audio source: ${sourceId}`);
      }

      this.isCapturing = true;
      this.emit('source-changed', targetSource);
      this.emit('state-changed', { isCapturing: true, currentSource: targetSource });
      
      console.log('[SystemAudioCapture] Successfully started capture from:', targetSource.name);
    } catch (error) {
      console.error('[SystemAudioCapture] Failed to start capture:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
  public async stopCapture(): Promise<void> {
    if (!this.isCapturing) {
      console.log('[SystemAudioCapture] Not currently capturing');
      return;
    }

    try {
      console.log('[SystemAudioCapture] Stopping audio capture...');
      
      // Stop audioteejs if running
      if (this.audioTeeProcess) {
        console.log('[SystemAudioCapture] Stopping audioteejs...');
        
        // Send SIGTERM to gracefully stop
        this.audioTeeProcess.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Force kill if still running
            if (this.audioTeeProcess && !this.audioTeeProcess.killed) {
              this.audioTeeProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);
          
          this.audioTeeProcess?.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        
        this.audioTeeProcess = null;
      }
      
      // Clean up audio processing
      if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
      }
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      // Stop media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => {
          track.stop();
          console.log('[SystemAudioCapture] Stopped track:', track.kind, track.label);
        });
        this.mediaStream = null;
      }

      this.isCapturing = false;
      this.currentSource = null;
      
      this.emit('state-changed', { isCapturing: false });
      console.log('[SystemAudioCapture] Successfully stopped capture');
      
    } catch (error) {
      console.error('[SystemAudioCapture] Error stopping capture:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Switch to a different audio source
   */
  public async switchSource(sourceId: string): Promise<void> {
    console.log('[SystemAudioCapture] Switching to source:', sourceId);
    
    const wasCapturing = this.isCapturing;
    
    if (wasCapturing) {
      await this.stopCapture();
    }
    
    if (wasCapturing) {
      await this.startCapture(sourceId);
    }
  }

  /**
   * Get current capture state
   */
  public getState(): { isCapturing: boolean; currentSource: AudioSource | null } {
    return {
      isCapturing: this.isCapturing,
      currentSource: this.currentSource
    };
  }

  /**
   * Start microphone capture using getUserMedia
   */
  private async startMicrophoneCapture(): Promise<void> {
    console.log('[SystemAudioCapture] Starting microphone capture...');
    
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: this.config.sampleRate },
          channelCount: { ideal: this.config.channelCount },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      await this.setupAudioProcessing();
      console.log('[SystemAudioCapture] Microphone capture started successfully');
      
    } catch (error) {
      console.error('[SystemAudioCapture] Microphone capture failed:', error);
      throw new Error(`Microphone access failed: ${(error as Error).message}`);
    }
  }



  /**
   * Find the audiotee binary path
   */
  private findAudioTeeBinary(): string {
    // Try multiple possible locations
    const possiblePaths = [
      // Development: node_modules
      path.join(__dirname, '..', 'node_modules', 'audiotee', 'bin', 'audiotee'),
      path.join(process.cwd(), 'node_modules', 'audiotee', 'bin', 'audiotee'),
      // Production: bundled with app
      path.join(process.resourcesPath, 'node_modules', 'audiotee', 'bin', 'audiotee'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'audiotee', 'bin', 'audiotee'),
    ];

    for (const binaryPath of possiblePaths) {
      if (fs.existsSync(binaryPath)) {
        console.log('[SystemAudioCapture] Found audiotee binary at:', binaryPath);
        return binaryPath;
      }
    }

    throw new Error('audiotee binary not found. Tried paths: ' + possiblePaths.join(', '));
  }

  /**
   * Start system audio capture - routes to platform-specific implementation
   */
  private async startSystemAudioCapture(): Promise<void> {
    if (process.platform === 'darwin') {
      // macOS: Use audioteejs
      await this.startMacOSSystemAudioCapture();
    } else if (process.platform === 'win32') {
      // Windows: Use native loopback
      await this.startWindowsSystemAudioCapture();
    } else {
      throw new Error(`System audio capture not supported on ${process.platform}`);
    }
  }

  /**
   * Start macOS system audio capture using audioteejs (Core Audio Taps)
   */
  private async startMacOSSystemAudioCapture(): Promise<void> {
    console.log('[SystemAudioCapture] Starting macOS system audio capture with audioteejs...');
    
    try {
      const binaryPath = this.findAudioTeeBinary();
      
      // Build arguments for audiotee binary
      const args = [
        '--sample-rate', '16000',
        '--chunk-duration', '0.2'  // 200ms = 0.2 seconds
      ];

      console.log('[SystemAudioCapture] Spawning audiotee:', binaryPath, args);
      
      // Spawn the audiotee process
      this.audioTeeProcess = spawn(binaryPath, args);

      // Handle stdout (audio data)
      this.audioTeeProcess.stdout?.on('data', (data: Buffer) => {
        // Emit audio data directly - already in correct format (Int16, mono, 16kHz)!
        this.emit('audio-data', data);
      });

      // Handle stderr (logs and events)
      this.audioTeeProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf8');
        const lines = text.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const logMessage = JSON.parse(line);
            
            if (logMessage.message_type === 'stream_start') {
              console.log('[SystemAudioCapture] ✅ AudioTee capture started');
            } else if (logMessage.message_type === 'stream_stop') {
              console.log('[SystemAudioCapture] AudioTee capture stopped');
            } else if (logMessage.message_type === 'error') {
              console.error('[SystemAudioCapture] AudioTee error:', logMessage.data);
              this.emit('error', new Error(logMessage.data.message));
            } else if (logMessage.message_type !== 'debug') {
              console.log(`[SystemAudioCapture] [${logMessage.message_type}]`, logMessage.data);
            }
          } catch (parseError) {
            // Not JSON, just log it
            console.log('[SystemAudioCapture] AudioTee:', line);
          }
        }
      });

      // Handle process errors
      this.audioTeeProcess.on('error', (error) => {
        console.error('[SystemAudioCapture] AudioTee process error:', error);
        this.emit('error', error);
      });

      // Handle process exit
      this.audioTeeProcess.on('exit', (code, signal) => {
        console.log('[SystemAudioCapture] AudioTee process exited:', { code, signal });
        if (code !== 0 && code !== null) {
          this.emit('error', new Error(`AudioTee process exited with code ${code}`));
        }
      });

      console.log('[SystemAudioCapture] ✅ macOS system audio capture started successfully');
      
    } catch (error) {
      console.error('[SystemAudioCapture] Failed to start macOS system audio:', error);
      throw error;
    }
  }

  /**
   * Start Windows system audio capture using native Electron loopback
   */
  private async startWindowsSystemAudioCapture(): Promise<void> {
    console.log('[SystemAudioCapture] Starting Windows system audio capture with native loopback...');
    
    try {
      // Request display media with audio loopback
      // The handler in main.ts will automatically grant access with loopback audio
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,  // Required for loopback to work (handler provides screen source)
        audio: true   // This will use native loopback from setDisplayMediaRequestHandler
      });
      
      // Verify we got audio tracks
      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track in native loopback stream');
      }
      
      console.log('[SystemAudioCapture] Windows loopback audio tracks:', audioTracks.length);
      audioTracks.forEach(track => {
        console.log('[SystemAudioCapture] Audio track:', {
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
      });
      
      // Setup audio processing pipeline
      await this.setupAudioProcessing();
      
      console.log('[SystemAudioCapture] ✅ Windows system audio capture started successfully');
      
    } catch (error) {
      console.error('[SystemAudioCapture] Failed to start Windows system audio:', error);
      throw new Error(`Windows system audio capture failed: ${(error as Error).message}`);
    }
  }

  /**
   * Setup audio processing pipeline for the current media stream
   */
  private async setupAudioProcessing(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error('No media stream available for audio processing');
    }

    console.log('[SystemAudioCapture] Setting up audio processing...');
    
    try {
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate
      });

      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create media stream source
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create script processor for audio data extraction
      this.processor = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channelCount,
        this.config.channelCount
      );

      // Setup audio processing callback
      this.processor.onaudioprocess = (event) => {
        try {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Check for actual audio data
          const hasAudio = inputData.some(sample => Math.abs(sample) > 0.001);
          
          if (hasAudio) {
            // Convert Float32Array to Buffer for compatibility with existing AudioStreamProcessor
            const buffer = Buffer.alloc(inputData.length * 2);
            for (let i = 0; i < inputData.length; i++) {
              const sample = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              buffer.writeInt16LE(sample, i * 2);
            }
            
            this.emit('audio-data', buffer);
          }
        } catch (error) {
          console.error('[SystemAudioCapture] Audio processing error:', error);
          this.emit('error', error as Error);
        }
      };

      // Connect the audio pipeline
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      console.log('[SystemAudioCapture] Audio processing pipeline established');
      
    } catch (error) {
      console.error('[SystemAudioCapture] Failed to setup audio processing:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    console.log('[SystemAudioCapture] Destroying instance...');
    
    this.stopCapture().catch(error => {
      console.error('[SystemAudioCapture] Error during cleanup:', error);
    });
    
    this.removeAllListeners();
  }
}