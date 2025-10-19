import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { SystemAudioCapture, AudioSource } from "./SystemAudioCapture";
import { AudioTranscriber } from "./audio/AudioTranscriber";
import { QuestionRefiner } from "./audio/QuestionRefiner";
import { StreamingQuestionDetector } from "./audio/StreamingQuestionDetector";
import { PermissionWatcher } from "./core/PermissionWatcher";
import { ProcessSupervisor } from "./core/ProcessSupervisor";
import { Logger } from "./utils/Logger";
import {
  AudioChunk,
  AudioStreamState,
  AudioStreamConfig,
  AudioStreamEvents,
  TranscriptionResult,
  DetectedQuestion
} from "../src/types/audio-stream";

export class AudioStreamProcessor extends EventEmitter {
  private state: AudioStreamState;
  private config: AudioStreamConfig;
  private systemAudioCapture: SystemAudioCapture;
  private audioTranscriber: AudioTranscriber;
  private questionRefiner: QuestionRefiner;
  private streamingDetector: StreamingQuestionDetector;
  private permissionWatcher: PermissionWatcher;
  private processSupervisor: ProcessSupervisor;
  
  // Audio processing
  private currentAudioData: Float32Array[] = [];
  private lastSilenceTime: number = 0;
  private wordCount: number = 0;
  private tempBuffer: Float32Array | null = null;
  private lastChunkTime: number = 0;
  private accumulatedSamples: number = 0;
  
  // Silence detection for better chunking
  private isSpeaking: boolean = false;
  private silenceStartTime: number = 0;
  private speechStartTime: number = 0;
  
  // Permission retry state
  private pendingSystemAudioSource: string | null = null;

  constructor(openaiApiKey: string, config?: Partial<AudioStreamConfig>) {
    super();
    
    // Validate OpenAI API key
    if (!openaiApiKey || openaiApiKey.trim() === '') {
      throw new Error('OpenAI API key is required for AudioStreamProcessor');
    }
    
    // Initialize modules
    this.audioTranscriber = new AudioTranscriber(openaiApiKey, config?.sampleRate || 16000);
    this.questionRefiner = new QuestionRefiner();
    this.streamingDetector = new StreamingQuestionDetector();
    
    // Optimized configuration for complete question capture
    this.config = {
      sampleRate: 16000,
      chunkDuration: 2000, // Minimum 2 seconds before considering transcription
      silenceThreshold: 500, // Wait 500ms of silence before transcribing
      maxWords: 40,
      questionDetectionEnabled: true,
      batchInterval: 0, // Not used anymore
      maxBatchSize: 0, // Not used anymore
      maxChunkDuration: 6000, // Maximum 6 seconds, force transcribe
      silenceEnergyThreshold: 0.01, // RMS threshold for silence detection
      ...config
    };

    // Simplified state - removed batch processor
    this.state = {
      isListening: false,
      isProcessing: false,
      lastActivityTime: 0,
      questionBuffer: [],
      batchProcessor: {
        lastBatchTime: 0,
        isProcessing: false,
        pendingQuestions: []
      },
      currentAudioSource: null
    };

    // Initialize SystemAudioCapture
    this.systemAudioCapture = new SystemAudioCapture({
      sampleRate: this.config.sampleRate,
      channelCount: 1,
      bufferSize: 4096
    });

    // Initialize PermissionWatcher for seamless system audio retry
    this.permissionWatcher = new PermissionWatcher();
    this.setupPermissionWatcher();

    // Initialize ProcessSupervisor to prevent permission conflicts
    this.processSupervisor = new ProcessSupervisor();
    this.setupProcessSupervisor();

    // Setup system audio capture event listeners
    this.setupSystemAudioEvents();
  }

  /**
   * Start always-on audio listening with specified audio source
   */
  public async startListening(audioSourceId?: string): Promise<void> {
    Logger.info(`[AudioStreamProcessor] 🎙️  startListening called with sourceId: ${audioSourceId || 'microphone (default)'}`);
    
    if (this.state.isListening) {
      Logger.info('[AudioStreamProcessor] Already listening, ignoring request');
      return;
    }

    try {
      // If audio source is specified and it's system audio, start system capture
      if (audioSourceId && audioSourceId !== 'microphone') {
        Logger.info(`[AudioStreamProcessor] Starting system audio capture for source: ${audioSourceId}`);
        try {
          await this.systemAudioCapture.startCapture(audioSourceId);
          const captureState = this.systemAudioCapture.getState();
          this.state.currentAudioSource = captureState.currentSource;
          Logger.info(`[AudioStreamProcessor] ✅ System audio capture started successfully:`, captureState.currentSource);
          
          // Register the current main process to track audio usage
          this.processSupervisor.registerAudioProcess(process.pid);
          Logger.info(`[AudioStreamProcessor] Registered process ${process.pid} with supervisor`);
          
        } catch (systemError) {
          Logger.error(`[AudioStreamProcessor] ❌ System audio capture failed:`, systemError);
          // Store the requested system audio source for automatic retry
          this.pendingSystemAudioSource = audioSourceId;
          
          // Enhanced fallback strategy
          Logger.info('[AudioStreamProcessor] Attempting fallback to microphone...');
          let fallbackSucceeded = false;
          const fallbackAttempts = [
            {
              id: 'microphone',
              name: 'Microphone (Auto-Fallback)',
              description: 'System audio unavailable, using microphone'
            }
          ];
          
          for (const fallback of fallbackAttempts) {
            try {
              Logger.info(`[AudioStreamProcessor] Trying fallback: ${fallback.name}`);
              this.state.currentAudioSource = {
                id: fallback.id,
                name: fallback.name,
                type: 'microphone',
                available: true
              };
              
              fallbackSucceeded = true;
              Logger.info(`[AudioStreamProcessor] ✅ Fallback successful: ${fallback.name}`);
              break;
            } catch (fallbackError) {
              Logger.error(`[AudioStreamProcessor] Fallback failed for ${fallback.name}:`, fallbackError);
            }
          }
          
          if (fallbackSucceeded) {
            const errorMessage = this.getSystemAudioErrorMessage(systemError as Error);
            Logger.warn(`[AudioStreamProcessor] Using fallback due to: ${errorMessage}`);
            this.emit('error', new Error(errorMessage));
          } else {
            Logger.error('[AudioStreamProcessor] ❌ All fallback attempts failed');
            throw new Error('All audio capture methods failed. Please check your audio permissions.');
          }
        }
      } else {
        // Default to microphone (existing behavior)
        Logger.info('[AudioStreamProcessor] Using default microphone source');
        this.state.currentAudioSource = {
          id: 'microphone',
          name: 'Microphone',
          type: 'microphone',
          available: true
        };
      }

      this.state.isListening = true;
      this.state.lastActivityTime = Date.now();
      Logger.info(`[AudioStreamProcessor] ✅ Listening started successfully with source: ${this.state.currentAudioSource?.name}`);
      this.emit('state-changed', { ...this.state });
      
    } catch (error) {
      this.state.isListening = false;
      this.state.currentAudioSource = null;
      Logger.error('[AudioStreamProcessor] ❌ Failed to start listening:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop audio listening
   */
  public async stopListening(): Promise<void> {
    if (!this.state.isListening) return;

    try {
      // Stop system audio capture if active
      if (this.state.currentAudioSource?.type === 'system') {
        await this.systemAudioCapture.stopCapture();
        // Unregister from process supervisor
        this.processSupervisor.unregisterAudioProcess(process.pid);
      }

      this.state.isListening = false;
      this.state.isProcessing = false;
      this.state.currentAudioSource = null;
      
      // Clear any pending audio data
      this.currentAudioData = [];
      this.wordCount = 0;
      
      // Clear the question buffer to ensure fresh start for next recording session
      this.clearQuestions();
      
      this.emit('state-changed', { ...this.state });
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Error stopping listening:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Process audio data chunk received from renderer
   */
  public async processAudioChunk(audioData: Buffer): Promise<void> {
    if (!this.state.isListening) {
      return;
    }

    try {
      // Convert Buffer to Float32Array
      const float32Array = new Float32Array(audioData.length / 2);
      let maxSample = 0;
      for (let i = 0; i < float32Array.length; i++) {
        const sample = audioData.readInt16LE(i * 2);
        float32Array[i] = sample / 32768.0;
        maxSample = Math.max(maxSample, Math.abs(float32Array[i]));
      }
      
      // Calculate RMS (Root Mean Square) energy for silence detection
      const rms = this.calculateRMS(float32Array);
      const now = Date.now();
      const wasSpeaking = this.isSpeaking;
      
      // Update speaking state based on RMS threshold
      this.isSpeaking = rms > (this.config.silenceEnergyThreshold || 0.01);
      
      // Track silence/speech transitions
      if (this.isSpeaking && !wasSpeaking) {
        // Transition: silence → speech
        this.speechStartTime = now;
        if (this.currentAudioData.length === 0) {
          console.log(`[AudioStreamProcessor] 🎤 Speech started (RMS: ${rms.toFixed(4)})`);
        }
      } else if (!this.isSpeaking && wasSpeaking) {
        // Transition: speech → silence
        this.silenceStartTime = now;
        const speechDuration = (this.accumulatedSamples / this.config.sampleRate) * 1000;
        console.log(`[AudioStreamProcessor] 🔇 Silence detected after ${speechDuration.toFixed(0)}ms of speech (RMS: ${rms.toFixed(4)})`);
      }
      
      // Add to current audio accumulation
      this.currentAudioData.push(float32Array);
      this.accumulatedSamples += float32Array.length;
      this.state.lastActivityTime = Date.now();
      
      // Initialize last chunk time if not set
      if (this.lastChunkTime === 0) {
        this.lastChunkTime = Date.now();
        this.speechStartTime = now;
        console.log(`[AudioStreamProcessor] 🎬 Started accumulating audio data (RMS: ${rms.toFixed(4)})`);
      }
      
      // Check if we should create a chunk based on silence detection
      if (await this.shouldCreateChunk()) {
        const accumulatedDuration = (this.accumulatedSamples / this.config.sampleRate) * 1000;
        const silenceDuration = this.silenceStartTime > 0 ? now - this.silenceStartTime : 0;
        console.log(`[AudioStreamProcessor] 🎯 Creating transcription chunk (${accumulatedDuration.toFixed(0)}ms audio, ${silenceDuration.toFixed(0)}ms silence)`);
        await this.createAndProcessChunk();
      }
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Error processing audio chunk:', error);
      this.emit('error', error as Error);
      this.state.isListening = false;
      this.emit('state-changed', { ...this.state });
    }
  }

  /**
   * Determine if we should create a new chunk - SILENCE-AWARE for complete questions
   */
  private async shouldCreateChunk(): Promise<boolean> {
    const now = Date.now();
    const accumulatedDuration = (this.accumulatedSamples / this.config.sampleRate) * 1000;
    const silenceDuration = this.silenceStartTime > 0 ? now - this.silenceStartTime : 0;
    
    // Don't transcribe if we haven't accumulated minimum duration (2 seconds)
    if (accumulatedDuration < this.config.chunkDuration) {
      return false;
    }
    
    // Force transcribe if we've exceeded maximum duration (6 seconds) - safety cap
    const maxDuration = this.config.maxChunkDuration || 6000;
    if (accumulatedDuration >= maxDuration) {
      console.log(`[AudioStreamProcessor] ⏱️  Max duration reached (${accumulatedDuration.toFixed(0)}ms), forcing transcription`);
      return true;
    }
    
    // Force transcribe if word count exceeds limit
    if (this.wordCount >= this.config.maxWords) {
      console.log(`[AudioStreamProcessor] 📝 Word count limit reached (${this.wordCount}), forcing transcription`);
      return true;
    }
    
    // If currently speaking, don't transcribe yet (wait for natural pause)
    if (this.isSpeaking) {
      return false;
    }
    
    // If in silence for long enough (500ms), transcribe the accumulated audio
    if (silenceDuration >= this.config.silenceThreshold) {
      console.log(`[AudioStreamProcessor] ✅ Natural pause detected (${silenceDuration.toFixed(0)}ms silence), ready to transcribe`);
      return true;
    }
    
    // Check for question hints as additional trigger (but still respect minimum duration)
    if (this.streamingDetector.hasRecentQuestionActivity() && accumulatedDuration >= 1500) {
      console.log(`[AudioStreamProcessor] ❓ Question pattern detected, ready to transcribe`);
      return true;
    }
    
    return false;
  }

  /**
   * Create chunk from accumulated audio data and process it
   */
  private async createAndProcessChunk(): Promise<void> {
    if (this.currentAudioData.length === 0) return;

    try {
      // Combine all Float32Arrays
      const totalLength = this.currentAudioData.reduce((acc, arr) => acc + arr.length, 0);
      const combinedArray = new Float32Array(totalLength);
      let offset = 0;
      
      for (const array of this.currentAudioData) {
        combinedArray.set(array, offset);
        offset += array.length;
      }
      
      const chunk: AudioChunk = {
        id: uuidv4(),
        data: combinedArray,
        timestamp: Date.now(),
        duration: this.calculateDuration(combinedArray.length),
        wordCount: this.wordCount
      };

      // Reset accumulation and silence tracking
      this.currentAudioData = [];
      this.wordCount = 0;
      this.accumulatedSamples = 0;
      this.lastChunkTime = Date.now();
      this.silenceStartTime = 0;
      this.speechStartTime = 0;
      this.isSpeaking = false;
      
      this.emit('chunk-recorded', chunk);
      
      // Process chunk for transcription
      await this.transcribeChunk(chunk);
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Error creating chunk:', error);
      this.emit('error', error as Error);
      this.state.isListening = false;
      this.emit('state-changed', { ...this.state });
    }
  }

  /**
   * Transcribe audio chunk using OpenAI Whisper
   */
  private async transcribeChunk(chunk: AudioChunk): Promise<void> {
    if (!this.config.questionDetectionEnabled) {
      return;
    }

    try {
      this.state.isProcessing = true;
      this.emit('state-changed', { ...this.state });

      // Use AudioTranscriber module
      const result = await this.audioTranscriber.transcribe(chunk);
      
      if (result.text) {
        console.log(`[AudioStreamProcessor] 📝 Transcription: "${result.text}"`);
      }

      this.emit('transcription-completed', result);

      // Update streaming detector
      this.streamingDetector.updateRecentAudioBuffer(result.text);

      // Check for streaming question detection
      const hasStreamingQuestion = this.streamingDetector.checkForStreamingQuestion(result.text);
      if (hasStreamingQuestion && this.currentAudioData.length > 0) {
        this.createAndProcessChunk().catch(error => {
          console.error('[AudioStreamProcessor] Error in streaming-triggered chunk processing:', error);
        });
      }

      // Detect and immediately refine questions
      if (result.text.trim()) {
        await this.detectAndRefineQuestions(result);
      }

    } catch (error) {
      console.error('[AudioStreamProcessor] Transcription error:', error);
      this.emit('error', error as Error);
    } finally {
      this.state.isProcessing = false;
      this.emit('state-changed', { ...this.state });
    }
  }

  /**
   * Detect questions and immediately refine them algorithmically
   */
  private async detectAndRefineQuestions(transcription: TranscriptionResult): Promise<void> {
    try {
      console.log(`[AudioStreamProcessor] 🔍 Checking for questions in: "${transcription.text}"`);
      
      // Use QuestionRefiner module
      const refinedQuestions = await this.questionRefiner.detectAndRefineQuestions(transcription);
      
      console.log(`[AudioStreamProcessor] Found ${refinedQuestions.length} questions`);
      
      // Add valid questions to state and emit immediately
      for (const question of refinedQuestions) {
        console.log(`[AudioStreamProcessor] ❓ Question detected: "${question.text}" (confidence: ${question.confidence})`);
        this.state.questionBuffer.push(question);
        this.emit('question-detected', question);
      }

      // Emit state change if we added any questions
      if (refinedQuestions.length > 0) {
        this.emit('state-changed', { ...this.state });
      }
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Question detection error:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Get current state
   */
  public getState(): AudioStreamState {
    return { ...this.state };
  }

  /**
   * Get all detected questions
   */
  public getQuestions(): DetectedQuestion[] {
    return [...this.state.questionBuffer];
  }

  /**
   * Clear question buffer
   */
  public clearQuestions(): void {
    this.state.questionBuffer = [];
    this.streamingDetector.clear();
    this.emit('state-changed', { ...this.state });
  }

  /**
   * Helper methods for audio processing
   */
  private calculateDuration(sampleCount: number): number {
    return (sampleCount / this.config.sampleRate) * 1000;
  }

  /**
   * Calculate RMS (Root Mean Square) energy of audio data for silence detection
   */
  private calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Get available audio sources
   */
  public async getAvailableAudioSources(): Promise<AudioSource[]> {
    try {
      return await this.systemAudioCapture.getAvailableSources();
    } catch (error) {
      console.error('[AudioStreamProcessor] Error getting audio sources:', error);
      // Return fallback microphone source
      return [{
        id: 'microphone',
        name: 'Microphone',
        type: 'microphone',
        available: true
      }];
    }
  }

  /**
   * Switch to a different audio source
   */
  public async switchAudioSource(sourceId: string): Promise<void> {
    const wasListening = this.state.isListening;
    const previousSource = this.state.currentAudioSource;
    
    try {
      // Stop current listening if active
      if (wasListening) {
        await this.stopListening();
      }
      
      // Start with new source if we were previously listening
      if (wasListening) {
        try {
          await this.startListening(sourceId);
        } catch (switchError) {
          // Try to restore previous source
          if (previousSource && previousSource.id !== sourceId) {
            try {
              await this.startListening(previousSource.id);
              this.emit('error', new Error(`Failed to switch to ${sourceId}, restored ${previousSource.name}: ${(switchError as Error).message}`));
            } catch (restoreError) {
              // Final fallback to microphone
              try {
                await this.startListening('microphone');
                this.emit('error', new Error(`Audio source switch failed, using microphone fallback: ${(switchError as Error).message}`));
              } catch (micError) {
                throw new Error(`All audio sources failed: ${(micError as Error).message}`);
              }
            }
          } else {
            throw switchError;
          }
        }
      } else {
        // Just update the current source without starting capture
        const sources = await this.getAvailableAudioSources();
        const targetSource = sources.find(s => s.id === sourceId);
        
        if (targetSource && targetSource.available) {
          this.state.currentAudioSource = targetSource;
          this.emit('state-changed', { ...this.state });
        } else {
          throw new Error(`Audio source not available: ${sourceId}`);
        }
      }
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Failed to switch audio source:', error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Request permissions for audio capture with enhanced recovery
   */
  public async requestAudioPermissions(): Promise<{ 
    granted: boolean; 
    error?: string;
    analysis?: any;
    recoveryAttempted?: boolean;
  }> {
    try {
      console.log('[AudioStreamProcessor] Requesting audio permissions...');
      
      // audioteejs handles permissions automatically when starting capture
      // Permissions will be requested when user tries to start system audio capture
      // For now, we just return success - actual permission check happens on capture start
      
      console.log('[AudioStreamProcessor] Permission check delegated to audioteejs');
      return { 
        granted: true,
        error: undefined
      };
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Permission request failed:', error);
      
      return { 
        granted: false, 
        error: `Permission request failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get user-friendly error message for system audio failures
   */
  private getSystemAudioErrorMessage(error: Error): string {
    const errorMsg = error.message.toLowerCase();
    
    if (errorMsg.includes('screencapturekit') && errorMsg.includes('permission')) {
      return 'System audio restored to microphone. For better Zoom compatibility, grant Screen Recording permission in System Preferences → Security & Privacy → Screen Recording, then restart the app.';
    } else if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
      return 'System audio restored to microphone. Screen recording permission required for system audio capture.';
    } else if (errorMsg.includes('macos') || errorMsg.includes('version')) {
      return 'System audio restored to microphone. macOS 13.0+ required for enhanced system audio capture.';
    } else if (errorMsg.includes('binary') || errorMsg.includes('not found')) {
      return 'System audio restored to microphone. Enhanced system audio components not available.';
    } else {
      return `System audio restored to microphone. ${error.message}`;
    }
  }
  private setupSystemAudioEvents(): void {
    let audioDataCount = 0;
    let totalBytesReceived = 0;
    
    this.systemAudioCapture.on('audio-data', (audioData: Buffer) => {
      audioDataCount++;
      totalBytesReceived += audioData.length;
      
      // Log every 50th audio data event
      if (audioDataCount % 50 === 0) {
        console.log(`[AudioStreamProcessor] 🎵 Received audio data: ${audioDataCount} chunks, ${totalBytesReceived} bytes total`);
        console.log(`[AudioStreamProcessor] Current state: listening=${this.state.isListening}, source=${this.state.currentAudioSource?.name}`);
      }
      
      // Forward system audio data to existing processing pipeline
      if (this.state.isListening && this.state.currentAudioSource?.type === 'system') {
        this.processAudioChunk(audioData).catch(error => {
          console.error('[AudioStreamProcessor] Error processing system audio chunk:', error);
        });
      } else if (audioDataCount === 1) {
        // Log why we're not processing on first chunk
        console.log(`[AudioStreamProcessor] ⚠️ Not processing audio: listening=${this.state.isListening}, source type=${this.state.currentAudioSource?.type}`);
      }
    });

    this.systemAudioCapture.on('source-changed', (source: AudioSource) => {
      console.log(`[AudioStreamProcessor] Audio source changed: ${source.name}`);
      this.state.currentAudioSource = source;
      this.emit('state-changed', { ...this.state });
    });

    this.systemAudioCapture.on('error', (error: Error) => {
      console.error('[AudioStreamProcessor] System audio error:', error);
      this.emit('error', error);
    });

    this.systemAudioCapture.on('state-changed', (captureState) => {
      // Update our state based on system audio capture state
      if (!captureState.isCapturing && this.state.currentAudioSource?.type === 'system') {
        this.state.currentAudioSource = null;
        this.emit('state-changed', { ...this.state });
      }
    });
  }

  /**
   * Setup process supervisor for automatic conflict resolution
   */
  private setupProcessSupervisor(): void {
    // Start supervision immediately to prevent conflicts
    this.processSupervisor.startSupervision();

    this.processSupervisor.on('conflict-resolved', (info) => {
      console.log('[AudioStreamProcessor] ✅ Process conflict resolved automatically');
      console.log(`[AudioStreamProcessor] Kept: ${info.kept.name} (${info.kept.pid})`);
      console.log(`[AudioStreamProcessor] Terminated: ${info.terminated.length} conflicting processes`);
      
      // Emit notification about conflict resolution
      this.emit('process-conflict-resolved', {
        message: 'Multiple audio processes detected and resolved automatically',
        details: info
      });
    });

    this.processSupervisor.on('cleanup-completed', () => {
      console.log('[AudioStreamProcessor] ✅ Initial process cleanup completed');
    });

    this.processSupervisor.on('cleanup-incomplete', (remaining) => {
      console.warn(`[AudioStreamProcessor] ⚠️  ${remaining.length} processes still running after cleanup`);
      this.emit('process-cleanup-warning', {
        message: 'Some audio processes could not be cleaned up automatically',
        remainingProcesses: remaining
      });
    });

    console.log('[AudioStreamProcessor] ✅ Process supervisor configured');
  }

  /**
   * Setup permission watcher for automatic system audio retry
   */
  private setupPermissionWatcher(): void {
    this.permissionWatcher.on('screen-recording-granted', async () => {
      console.log('[AudioStreamProcessor] Screen Recording permission granted - attempting system audio retry...');
      
      // Get detailed permission analysis
      const analysis = this.permissionWatcher.getPermissionAnalysis();
      console.log('[AudioStreamProcessor] Permission analysis:', analysis);
      
      // If we have a pending system audio source, retry it
      if (this.pendingSystemAudioSource && this.state.isListening) {
        await this.retrySystemAudio(this.pendingSystemAudioSource);
      }
      
      // Emit enhanced status update
      this.emit('permission-status-changed', {
        type: 'granted',
        analysis,
        autoRetryAttempted: !!this.pendingSystemAudioSource
      });
    });

    this.permissionWatcher.on('screen-recording-revoked', () => {
      console.log('[AudioStreamProcessor] Screen Recording permission revoked - falling back to microphone...');
      
      // Get detailed permission analysis
      const analysis = this.permissionWatcher.getPermissionAnalysis();
      console.log('[AudioStreamProcessor] Permission analysis:', analysis);
      
      // If currently using system audio, fall back to microphone
      if (this.state.currentAudioSource?.type === 'system') {
        this.handleSystemAudioFallback();
      }
      
      // Emit enhanced status update
      this.emit('permission-status-changed', {
        type: 'revoked',
        analysis,
        fallbackActivated: this.state.currentAudioSource?.type === 'microphone'
      });
    });

    // Start watching for permission changes
    this.permissionWatcher.startWatching();
  }

  /**
   * Retry system audio capture after permission is granted
   */
  private async retrySystemAudio(sourceId: string): Promise<void> {
    try {
      console.log('[AudioStreamProcessor] Retrying system audio capture...');
      
      await this.systemAudioCapture.startCapture(sourceId);
      const captureState = this.systemAudioCapture.getState();
      
      if (captureState.currentSource) {
        this.state.currentAudioSource = captureState.currentSource;
        this.pendingSystemAudioSource = null; // Clear pending state
        
        this.emit('state-changed', { ...this.state });
        this.emit('system-audio-ready', captureState.currentSource);
        
        console.log('[AudioStreamProcessor] ✅ System audio automatically restored!');
      }
    } catch (error) {
      console.error('[AudioStreamProcessor] Automatic system audio retry failed:', error);
      // Keep the pending state for future retries
    }
  }

  /**
   * Handle fallback from system audio to microphone
   */
  private handleSystemAudioFallback(): void {
    console.log('[AudioStreamProcessor] Falling back to microphone...');
    
    // Switch to microphone source
    this.state.currentAudioSource = {
      id: 'microphone',
      name: 'Microphone (Fallback)',
      type: 'microphone',
      available: true
    };
    
    this.emit('state-changed', { ...this.state });
    this.emit('audio-source-fallback', 'microphone');
  }

  /**
   * Get comprehensive permission diagnostics
   */
  public getPermissionDiagnostics(): {
    status: 'working' | 'needs_permission' | 'signature_issue' | 'system_issue';
    message: string;
    actionRequired: string[];
    technicalDetails: {
      currentPermissions: any;
      isProductionBuild: boolean;
      hasSystemAudioBinary: boolean;
      systemInfo: string;
    };
  } {
    const analysis = this.permissionWatcher.getPermissionAnalysis();
    const current = this.permissionWatcher.getCurrentStatus();
    
    // Check if SystemAudioCapture binary exists
    const fs = require('fs');
    const path = require('path');
    const binaryPath = path.join(process.resourcesPath || process.cwd(), 'dist-native', 'SystemAudioCapture');
    const hasSystemAudioBinary = fs.existsSync(binaryPath);
    
    // Check if this is a production build
    const isProductionBuild = process.env.NODE_ENV === 'production' || 
                              process.resourcesPath !== undefined ||
                              !process.execPath.includes('node_modules');
    
    return {
      status: analysis.status,
      message: analysis.message,
      actionRequired: analysis.actionRequired,
      technicalDetails: {
        currentPermissions: current,
        isProductionBuild,
        hasSystemAudioBinary,
        systemInfo: `macOS ${process.platform}, Node ${process.version}`
      }
    };
  }

  /**
   * Attempt comprehensive permission fix
   */
  public async attemptPermissionFix(): Promise<{
    success: boolean;
    message: string;
    stepsCompleted: string[];
    nextActions: string[];
  }> {
    const stepsCompleted: string[] = [];
    const nextActions: string[] = [];
    
    try {
      console.log('[AudioStreamProcessor] Starting comprehensive permission fix...');
      
      // Step 1: Get current diagnostics
      const diagnostics = this.getPermissionDiagnostics();
      stepsCompleted.push('Analyzed current system state');
      
      // Step 2: Check if binary exists
      if (!diagnostics.technicalDetails.hasSystemAudioBinary) {
        nextActions.push('Build SystemAudioCapture binary: npm run build:swift');
        return {
          success: false,
          message: 'SystemAudioCapture binary missing',
          stepsCompleted,
          nextActions
        };
      }
      stepsCompleted.push('Verified SystemAudioCapture binary exists');
      
      // Step 3: Handle development vs production
      if (!diagnostics.technicalDetails.isProductionBuild) {
        nextActions.push('Use production build for stable permissions: npm run app:build:mac');
        nextActions.push('Or re-grant permission manually for development build');
      }
      
      // Step 4: Attempt automatic recovery
      const recovery = await this.permissionWatcher.attemptPermissionRecovery();
      stepsCompleted.push(...recovery.actionsAttempted);
      
      if (recovery.success) {
        return {
          success: true,
          message: 'Permission fix completed successfully',
          stepsCompleted,
          nextActions: ['Test system audio in the app']
        };
      }
      
      // Step 5: Provide manual instructions
      nextActions.push(...diagnostics.actionRequired);
      
      return {
        success: false,
        message: recovery.message,
        stepsCompleted,
        nextActions
      };
      
    } catch (error) {
      console.error('[AudioStreamProcessor] Permission fix failed:', error);
      return {
        success: false,
        message: `Permission fix failed: ${(error as Error).message}`,
        stepsCompleted,
        nextActions: ['Check console for detailed error information']
      };
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.removeAllListeners();
    this.currentAudioData = [];
    this.state.questionBuffer = [];
    
    // Cleanup permission watcher
    if (this.permissionWatcher) {
      this.permissionWatcher.destroy();
    }
    
    // Cleanup process supervisor
    if (this.processSupervisor) {
      this.processSupervisor.destroy();
    }
    
    // Cleanup system audio capture
    if (this.systemAudioCapture) {
      this.systemAudioCapture.destroy();
    }
  }
}