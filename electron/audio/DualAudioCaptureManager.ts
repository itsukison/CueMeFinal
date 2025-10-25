import { EventEmitter } from 'events';
import { SystemAudioCapture } from '../SystemAudioCapture';
import { GeminiLiveQuestionDetector } from './GeminiLiveQuestionDetector';
import { DetectedQuestion } from '../../src/types/audio-stream';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';

const logger = new DiagnosticLogger('DualAudioCaptureManager');

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
    
    logger.info('🔍 Constructor called', {
      apiKeyPresent: !!geminiApiKey,
      apiKeyLength: geminiApiKey?.length,
      sampleRate
    });
    
    this.sampleRate = sampleRate;
    
    try {
      logger.info('📦 Creating GeminiLiveQuestionDetector...');
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
            logger.info(`Question detected (${question.source}): "${question.text}"`);
            this.emit('question-detected', question);
          },
          onStateChanged: (state) => {
            this.emit('state-changed', state);
          },
          onError: (error) => {
            logger.error('Gemini error', error);
            this.emit('error', error);
          }
        }
      );
      logger.info('✅ GeminiLiveQuestionDetector created');
    } catch (error) {
      logger.error('❌ Failed to create GeminiLiveQuestionDetector', error as Error);
      throw error;
    }
    
    try {
      logger.info('📦 Creating SystemAudioCapture...');
      // Initialize system audio capture
      this.systemAudioCapture = new SystemAudioCapture({
        sampleRate: sampleRate,
        channelCount: 1,
        bufferSize: 4096
      });
      logger.info('✅ SystemAudioCapture created');
    } catch (error) {
      logger.error('❌ Failed to create SystemAudioCapture', error as Error);
      throw error;
    }
    
    logger.info('🔗 Setting up event forwarding...');
    this.setupEventForwarding();
    logger.info('✅ Constructor completed successfully');
  }

  private setupEventForwarding(): void {
    // Handle system audio data - stream directly to Gemini Live
    this.systemAudioCapture.on('audio-data', (audioData: Buffer) => {
      if (this.isCapturing) {
        // Send audio directly to Gemini Live (opponent source)
        this.geminiDetector.sendAudioData(audioData, 'opponent').catch(error => {
          logger.error('Error sending system audio', error);
        });
      }
    });
    
    this.systemAudioCapture.on('error', (error) => {
      logger.error('System audio error', error);
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
      logger.error('Error processing microphone audio', error as Error);
    }
  }

  /**
   * Start capturing both audio sources with direct Gemini Live streaming
   * AUTOMATIC: Both microphone and system audio are captured simultaneously
   * No user selection needed - dual capture is the default behavior
   */
  public async startCapture(): Promise<void> {
    logger.info('🎙️ startCapture() called');
    
    if (this.isCapturing) {
      logger.info('⚠️ Already capturing, skipping');
      return;
    }

    try {
      logger.info('🚀 Starting AUTOMATIC dual audio capture (microphone + system audio)...');
      
      // Start Gemini Live sessions (opens WebSocket connections for both sources)
      logger.info('📞 Starting Gemini Live sessions...');
      await this.geminiDetector.startListening();
      logger.info('✅ Gemini Live sessions started');
      
      // AUTOMATIC: Always try to start system audio capture
      // Use default system audio source (will auto-detect best available)
      try {
        logger.info('🔊 Starting system audio capture...');
        await this.systemAudioCapture.startCapture('system-audio');
        logger.info('✅ System audio capture started (opponent source)');
      } catch (systemAudioError) {
        logger.warn('⚠️ System audio not available, continuing with microphone only', systemAudioError as Error);
        // Continue with microphone only - don't fail the entire capture
      }
      
      this.isCapturing = true;
      
      logger.info('✅ Dual audio capture started - streaming to Gemini Live');
      logger.info('🎤 Microphone → user source');
      logger.info('🔊 System audio → opponent source');
      
    } catch (error) {
      logger.error('❌ Failed to start capture', error as Error);
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
      logger.info('Stopping dual audio capture...');
      
      // Stop Gemini Live sessions (closes WebSocket connections)
      await this.geminiDetector.stopListening();
      
      // Stop system audio
      await this.systemAudioCapture.stopCapture();
      
      this.isCapturing = false;
      logger.info('✅ Dual audio capture stopped');
      
    } catch (error) {
      logger.error('Error stopping capture', error as Error);
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
