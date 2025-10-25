import { EventEmitter } from 'events';
import { SystemAudioCapture } from '../SystemAudioCapture';
import { GeminiLiveQuestionDetector } from './GeminiLiveQuestionDetector';
import { DetectedQuestion } from '../../src/types/audio-stream';

/**
 * Manages dual audio capture (microphone + system audio)
 * Streams audio directly to Gemini Live API for real-time question detection
 * NO transcription step - pure audio streaming to Gemini
 */
export class DualAudioCaptureManager extends EventEmitter {
  private geminiDetector: GeminiLiveQuestionDetector;
  private systemAudioCapture: SystemAudioCapture;
  private isCapturing: boolean = false;
  private readonly sampleRate: number;

  constructor(geminiApiKey: string, sampleRate: number = 16000) {
    super();
    
    console.log('[DualAudioCaptureManager] 🔍 Constructor called', {
      apiKeyPresent: !!geminiApiKey,
      apiKeyLength: geminiApiKey?.length,
      sampleRate
    });
    
    this.sampleRate = sampleRate;
    
    try {
      console.log('[DualAudioCaptureManager] 📦 Creating GeminiLiveQuestionDetector...');
      // Initialize Gemini Live detector with callbacks (not EventEmitter)
      this.geminiDetector = new GeminiLiveQuestionDetector(
        {
          apiKey: geminiApiKey,
          model: 'gemini-live-2.5-flash-preview', // Official Live API model
          language: 'ja-JP',
          systemPrompt: ''
        },
        {
          // Callback-based event handling
          onQuestionDetected: (question: DetectedQuestion) => {
            console.log(`[DualAudioCaptureManager] Question detected (${question.source}): "${question.text}"`);
            this.emit('question-detected', question);
          },
          onStateChanged: (state) => {
            this.emit('state-changed', state);
          },
          onError: (error) => {
            console.error('[DualAudioCaptureManager] Gemini error:', error);
            this.emit('error', error);
          }
        }
      );
      console.log('[DualAudioCaptureManager] ✅ GeminiLiveQuestionDetector created');
    } catch (error) {
      console.error('[DualAudioCaptureManager] ❌ Failed to create GeminiLiveQuestionDetector:', error);
      throw error;
    }
    
    try {
      console.log('[DualAudioCaptureManager] 📦 Creating SystemAudioCapture...');
      // Initialize system audio capture
      this.systemAudioCapture = new SystemAudioCapture({
        sampleRate: sampleRate,
        channelCount: 1,
        bufferSize: 4096
      });
      console.log('[DualAudioCaptureManager] ✅ SystemAudioCapture created');
    } catch (error) {
      console.error('[DualAudioCaptureManager] ❌ Failed to create SystemAudioCapture:', error);
      throw error;
    }
    
    console.log('[DualAudioCaptureManager] 🔗 Setting up event forwarding...');
    this.setupEventForwarding();
    console.log('[DualAudioCaptureManager] ✅ Constructor completed successfully');
  }

  private setupEventForwarding(): void {
    // Handle system audio data - stream directly to Gemini Live
    this.systemAudioCapture.on('audio-data', (audioData: Buffer) => {
      if (this.isCapturing) {
        // Send audio directly to Gemini Live (opponent source)
        this.geminiDetector.sendAudioData(audioData, 'opponent').catch(error => {
          console.error('[DualAudioCaptureManager] Error sending system audio:', error);
        });
      }
    });
    
    this.systemAudioCapture.on('error', (error) => {
      console.error('[DualAudioCaptureManager] System audio error:', error);
      this.emit('error', { source: 'opponent', error });
    });
  }

  /**
   * Process microphone audio - stream directly to Gemini Live
   * NO transcription - direct audio streaming
   */
  public async processMicrophoneAudio(audioData: Buffer): Promise<void> {
    if (!this.isCapturing) return;

    try {
      // Send audio directly to Gemini Live (user source)
      await this.geminiDetector.sendAudioData(audioData, 'user');
    } catch (error) {
      console.error('[DualAudioCaptureManager] Error processing microphone audio:', error);
    }
  }

  /**
   * Start capturing both audio sources with direct Gemini Live streaming
   * AUTOMATIC: Both microphone and system audio are captured simultaneously
   * No user selection needed - dual capture is the default behavior
   */
  public async startCapture(): Promise<void> {
    console.log('[DualAudioCaptureManager] 🎙️ startCapture() called');
    
    if (this.isCapturing) {
      console.log('[DualAudioCaptureManager] ⚠️ Already capturing, skipping');
      return;
    }

    try {
      console.log('[DualAudioCaptureManager] 🚀 Starting AUTOMATIC dual audio capture (microphone + system audio)...');
      
      // Start Gemini Live sessions (opens WebSocket connections for both sources)
      console.log('[DualAudioCaptureManager] 📞 Starting Gemini Live sessions...');
      await this.geminiDetector.startListening();
      console.log('[DualAudioCaptureManager] ✅ Gemini Live sessions started');
      
      // AUTOMATIC: Always try to start system audio capture
      // Use default system audio source (will auto-detect best available)
      try {
        console.log('[DualAudioCaptureManager] 🔊 Starting system audio capture...');
        await this.systemAudioCapture.startCapture('system-audio');
        console.log('[DualAudioCaptureManager] ✅ System audio capture started (opponent source)');
      } catch (systemAudioError) {
        console.warn('[DualAudioCaptureManager] ⚠️ System audio not available, continuing with microphone only:', systemAudioError);
        // Continue with microphone only - don't fail the entire capture
      }
      
      this.isCapturing = true;
      
      console.log('[DualAudioCaptureManager] ✅ Dual audio capture started - streaming to Gemini Live');
      console.log('[DualAudioCaptureManager] 🎤 Microphone → user source');
      console.log('[DualAudioCaptureManager] 🔊 System audio → opponent source');
      
    } catch (error) {
      console.error('[DualAudioCaptureManager] ❌ Failed to start capture:', error);
      console.error('[DualAudioCaptureManager] Error stack:', (error as Error).stack);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop capturing both audio sources and close Gemini Live sessions
   */
  public async stopCapture(): Promise<void> {
    if (!this.isCapturing) return;

    try {
      console.log('[DualAudioCaptureManager] Stopping dual audio capture...');
      
      // Stop Gemini Live sessions (closes WebSocket connections)
      await this.geminiDetector.stopListening();
      
      // Stop system audio
      await this.systemAudioCapture.stopCapture();
      
      this.isCapturing = false;
      console.log('[DualAudioCaptureManager] ✅ Dual audio capture stopped');
      
    } catch (error) {
      console.error('[DualAudioCaptureManager] Error stopping capture:', error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Get current state
   */
  public getState() {
    return {
      isCapturing: this.isCapturing,
      geminiState: this.geminiDetector.getState()
    };
  }

  /**
   * Get detected questions
   */
  public getQuestions(): DetectedQuestion[] {
    return this.geminiDetector.getQuestions();
  }

  /**
   * Clear questions
   */
  public clearQuestions(): void {
    this.geminiDetector.clearQuestions();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopCapture();
    this.geminiDetector.destroy();
    this.removeAllListeners();
  }
}
