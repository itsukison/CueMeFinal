import { EventEmitter } from 'events';
import { SystemAudioCapture } from './SystemAudioCapture';
import { GeminiLiveQuestionDetector } from './GeminiLiveQuestionDetector';
import { DeepgramTranscriptionService } from './DeepgramTranscriptionService';
import { StreamingQuestionDetector } from './StreamingQuestionDetector';
import { DetectedQuestion } from '../../src/types/audio-stream';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';

const logger = new DiagnosticLogger('DualAudioCaptureManager');

export type PipelineMode = 'gemini-live' | 'deepgram-streaming';

/**
 * Manages dual audio capture (microphone + system audio)
 * Supports two pipelines:
 * 1. 'gemini-live' (legacy): Audio → Gemini Live API (native audio model)
 * 2. 'deepgram-streaming' (new): Audio → Deepgram → Gemini Flash streaming
 */
export class DualAudioCaptureManager extends EventEmitter {
  // Legacy Gemini Live pipeline (preserved, not deleted)
  private geminiDetector: GeminiLiveQuestionDetector;

  // New Deepgram + Streaming pipeline
  private deepgramService: DeepgramTranscriptionService | null = null;
  private streamingDetector: StreamingQuestionDetector | null = null;

  private systemAudioCapture: SystemAudioCapture;
  private isCapturing: boolean = false;
  private readonly sampleRate: number;

  // Pipeline configuration
  private pipelineMode: PipelineMode = 'deepgram-streaming'; // Default to new pipeline
  private deepgramApiKey: string | null = null;
  private geminiApiKey: string;

  // Question buffer for new pipeline
  private questionBuffer: DetectedQuestion[] = [];

  // Deduplication: recent questions for similarity check
  private recentQuestions: { text: string; timestamp: number }[] = [];
  private readonly DEDUP_TIME_WINDOW_MS = 5000; // 5 seconds
  private readonly DEDUP_SIMILARITY_THRESHOLD = 0.7; // 70% similar = duplicate

  // Sentence buffering: accumulate text until complete sentence
  private sentenceBuffer: { user: string; opponent: string } = { user: '', opponent: '' };

  // Sentence timeout: if no pattern detected, send after 1000ms
  private sentenceTimeouts: { user: NodeJS.Timeout | null; opponent: NodeJS.Timeout | null } = { user: null, opponent: null };
  private readonly SENTENCE_TIMEOUT_MS = 1000;

  constructor(geminiApiKey: string, sampleRate: number = 16000, deepgramApiKey?: string) {
    super();

    this.geminiApiKey = geminiApiKey;
    this.deepgramApiKey = deepgramApiKey || process.env.DEEPGRAM_API_KEY || null;

    logger.info('🔍 Constructor called', {
      apiKeyPresent: !!geminiApiKey,
      apiKeyLength: geminiApiKey?.length,
      deepgramKeyPresent: !!this.deepgramApiKey,
      sampleRate,
      pipelineMode: this.pipelineMode
    });

    this.sampleRate = sampleRate;

    // Initialize legacy Gemini Live detector (preserved for fallback)
    try {
      logger.info('📦 Creating GeminiLiveQuestionDetector (legacy, preserved)...');
      this.geminiDetector = new GeminiLiveQuestionDetector(
        {
          apiKey: geminiApiKey,
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          language: 'ja-JP',
          systemPrompt: ''
        },
        {
          onQuestionDetected: (question: DetectedQuestion) => {
            if (this.pipelineMode === 'gemini-live') {
              logger.info(`Question detected via Gemini Live (${question.source}): "${question.text}"`);
              this.questionBuffer.push(question);
              this.emit('question-detected', question);
            }
          },
          onStateChanged: (state) => {
            if (this.pipelineMode === 'gemini-live') {
              this.emit('state-changed', state);
            }
          },
          onError: (error) => {
            logger.error('Gemini Live error', error);
            this.emit('error', error);
          }
        }
      );
      logger.info('✅ GeminiLiveQuestionDetector created (preserved)');
    } catch (error) {
      logger.error('❌ Failed to create GeminiLiveQuestionDetector', error as Error);
      throw error;
    }

    // Initialize new Deepgram + Streaming pipeline if API key available
    if (this.deepgramApiKey) {
      this.initializeStreamingPipeline();
    } else {
      logger.warn('⚠️ DEEPGRAM_API_KEY not set, falling back to Gemini Live pipeline');
      this.pipelineMode = 'gemini-live';
    }

    // Initialize system audio capture
    try {
      logger.info('📦 Creating SystemAudioCapture...');
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
    logger.info('✅ Constructor completed successfully', {
      activePipeline: this.pipelineMode
    });
  }

  /**
   * Initialize the new Deepgram + Streaming LLM pipeline
   */
  private initializeStreamingPipeline(): void {
    if (!this.deepgramApiKey) {
      logger.warn('Cannot initialize streaming pipeline without Deepgram API key');
      return;
    }

    try {
      logger.info('📦 Creating DeepgramTranscriptionService...');
      this.deepgramService = new DeepgramTranscriptionService({
        apiKey: this.deepgramApiKey,
        language: 'ja',
        model: 'nova-2',
        sampleRate: this.sampleRate,
      });
      logger.info('✅ DeepgramTranscriptionService created');

      logger.info('📦 Creating StreamingQuestionDetector...');
      this.streamingDetector = new StreamingQuestionDetector(
        {
          apiKey: this.geminiApiKey,
          model: 'gemini-2.0-flash', // Use standard text model, not native-audio
        },
        {
          onQuestionDetected: (question: DetectedQuestion) => {
            if (this.pipelineMode === 'deepgram-streaming') {
              logger.info(`Question detected via streaming (${question.source}): "${question.text}"`);
              this.questionBuffer.push(question);
              this.emit('question-detected', question);
            }
          },
          onError: (error) => {
            logger.error('StreamingQuestionDetector error', error);
            this.emit('error', error);
          }
        }
      );
      logger.info('✅ StreamingQuestionDetector created');

      // Wire up transcription → question detection
      this.setupDeepgramEventHandlers();

      logger.info('✅ Streaming pipeline initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize streaming pipeline', error as Error);
      logger.warn('Falling back to Gemini Live pipeline');
      this.pipelineMode = 'gemini-live';
    }
  }

  /**
   * Set up event handlers for Deepgram transcription service
   */
  private setupDeepgramEventHandlers(): void {
    if (!this.deepgramService || !this.streamingDetector) return;

    // Handle complete utterances - send to question detector
    this.deepgramService.on('utterance-complete', async (data: { text: string; source: 'user' | 'opponent'; timestamp: number }) => {
      if (this.pipelineMode !== 'deepgram-streaming') return;

      const { text, source } = data;

      // Flush buffer and process complete utterance
      const completeText = this.flushSentenceBuffer(source, text);
      if (completeText) {
        await this.processCompleteText(completeText, source);
      }
    });

    // Handle final transcriptions - accumulate in buffer until sentence complete or timeout
    this.deepgramService.on('transcription', async (result) => {
      if (this.pipelineMode !== 'deepgram-streaming') return;

      if (result.isFinal && result.text.length > 3) {
        logger.info(`📝 Deepgram transcription (${result.source}): "${result.text.substring(0, 50)}..."`);

        // Clear any existing timeout for this source
        this.clearSentenceTimeout(result.source);

        // Accumulate in sentence buffer
        this.sentenceBuffer[result.source] += result.text;

        // Check if buffer contains a complete sentence (ends with sentence-ending pattern)
        if (this.hasCompleteSentence(this.sentenceBuffer[result.source])) {
          // Sentence complete! Send immediately
          const completeText = this.sentenceBuffer[result.source].trim();
          this.sentenceBuffer[result.source] = '';
          logger.info(`⚡ Sentence complete (${result.source}), sending immediately`);
          await this.processCompleteText(completeText, result.source);
        } else {
          // No sentence-ending pattern yet - set timeout to send after 1000ms
          this.sentenceTimeouts[result.source] = setTimeout(async () => {
            const bufferedText = this.sentenceBuffer[result.source].trim();
            if (bufferedText.length > 5) {
              this.sentenceBuffer[result.source] = '';
              logger.info(`⏱️ Timeout reached (${result.source}), sending buffer: "${bufferedText.substring(0, 30)}..."`);
              await this.processCompleteText(bufferedText, result.source);
            }
          }, this.SENTENCE_TIMEOUT_MS);
        }
      }
    });

    this.deepgramService.on('error', (error) => {
      logger.error('Deepgram error', error);
      this.emit('error', error);
    });

    this.deepgramService.on('disconnected', (source) => {
      logger.warn(`Deepgram ${source} disconnected`);
    });
  }

  /**
   * Process complete text and send to Gemini for question detection
   */
  private async processCompleteText(text: string, source: 'user' | 'opponent'): Promise<void> {
    if (!this.streamingDetector) return;

    // Pre-filter: check if text might contain a question
    if (this.streamingDetector.mightContainQuestion(text)) {
      logger.info(`🔍 Processing potential question (${source}): "${text.substring(0, 50)}..."`);

      const question = await this.streamingDetector.detectQuestion(text, source);

      // Deduplicate: check if this question is too similar to a recent one
      if (question && !this.isDuplicateQuestion(question.text)) {
        // Not a duplicate - emit it
        this.recentQuestions.push({ text: question.text, timestamp: Date.now() });
        this.cleanupRecentQuestions();
      } else if (question) {
        logger.info(`🔄 Skipping duplicate question: "${question.text.substring(0, 30)}..."`);
      }
    }
  }

  /**
   * Clear sentence timeout for a source
   */
  private clearSentenceTimeout(source: 'user' | 'opponent'): void {
    if (this.sentenceTimeouts[source]) {
      clearTimeout(this.sentenceTimeouts[source]!);
      this.sentenceTimeouts[source] = null;
    }
  }

  /**
   * Check if buffer contains a complete Japanese sentence
   * Expanded patterns for comprehensive coverage
   */
  private hasCompleteSentence(text: string): boolean {
    const trimmed = text.trim();

    // Japanese sentence-ending patterns (comprehensive list)
    const sentenceEndPatterns = [
      // Punctuation endings
      /[。？！?!]$/,                   // Period, question mark, exclamation

      // Basic question patterns
      /ですか[。？]?$/,                // Polite question (です + か)
      /ますか[。？]?$/,                // Polite question (ます + か)
      /でしょうか[。？]?$/,            // Very polite question
      /ませんか[。？]?$/,              // Negative question (行きませんか)
      /ないですか[。？]?$/,            // Negative question (ないですか)
      /ないでしょうか[。？]?$/,        // Very polite negative

      // Explanatory questions
      /んですか[。？]?$/,              // Explanatory (なんですか, 行くんですか)
      /のですか[。？]?$/,              // Formal explanatory

      // Softer questions
      /かね[。？]?$/,                  // Softer question (そうかね)
      /ですかね[。？]?$/,              // Even softer
      /でしょうね[。？]?$/,            // Rhetorical/soft

      // Request patterns
      /ください[。]?$/,               // Please do (ください)
      /てください[。]?$/,             // Te-form request
      /お願いします[。]?$/,           // Request (お願い)
      /いただけますか[。？]?$/,        // Polite request (いただけますか)
      /くださいませんか[。？]?$/,      // Very polite request
      /もらえますか[。？]?$/,          // Can I get?

      // Common question endings
      /いかがでしょうか[。？]?$/,      // Polite inquiry (いかが)
      /いかがですか[。？]?$/,          // Polite inquiry
      /どうですか[。？]?$/,            // How is it?
      /どうでしょうか[。？]?$/,        // How about?
      /しますか[。？]?$/,              // Will you do?
      /ありますか[。？]?$/,            // Is there?
      /と思いますか[。？]?$/,          // What do you think?
      /でしょう[。？]?$/,              // Probably (rhetorical)

      // Statement endings
      /ですね[。]?$/,                 // Agreement seeking
      /ますね[。]?$/,                 // Agreement seeking (verb)
      /です[。]$/,                    // Polite statement with period
      /ます[。]$/,                    // Polite verb with period

      // Question particle with period
      /か[。]$/,                      // Question particle + period
    ];

    return sentenceEndPatterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Flush sentence buffer and combine with new text
   */
  private flushSentenceBuffer(source: 'user' | 'opponent', newText: string): string {
    const buffered = this.sentenceBuffer[source];
    this.sentenceBuffer[source] = '';
    return (buffered + newText).trim();
  }

  /**
   * Check if a question is too similar to a recent one (deduplication)
   */
  private isDuplicateQuestion(questionText: string): boolean {
    const now = Date.now();

    for (const recent of this.recentQuestions) {
      // Only check questions within the time window
      if (now - recent.timestamp > this.DEDUP_TIME_WINDOW_MS) continue;

      // Calculate similarity
      const similarity = this.calculateSimilarity(questionText, recent.text);
      if (similarity >= this.DEDUP_SIMILARITY_THRESHOLD) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate similarity between two strings (Jaccard similarity on character bigrams)
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;

    // Use character bigrams for Japanese text
    const getBigrams = (s: string): Set<string> => {
      const bigrams = new Set<string>();
      for (let i = 0; i < s.length - 1; i++) {
        bigrams.add(s.substring(i, i + 2));
      }
      return bigrams;
    };

    const bigramsA = getBigrams(a);
    const bigramsB = getBigrams(b);

    // Jaccard similarity: intersection / union
    let intersection = 0;
    for (const bigram of bigramsA) {
      if (bigramsB.has(bigram)) intersection++;
    }

    const union = bigramsA.size + bigramsB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * Clean up old questions from recent list
   */
  private cleanupRecentQuestions(): void {
    const now = Date.now();
    this.recentQuestions = this.recentQuestions.filter(
      q => now - q.timestamp < this.DEDUP_TIME_WINDOW_MS
    );
  }

  private setupEventForwarding(): void {
    logger.info('🔗 Setting up event listeners on SystemAudioCapture instance');

    let audioDataEventCount = 0;
    let lastLogTime = Date.now();

    // Handle system audio data - route to active pipeline
    this.systemAudioCapture.on('audio-data', (audioData: Buffer) => {
      audioDataEventCount++;
      const now = Date.now();

      // Log first event and then every 50 events
      if (audioDataEventCount === 1) {
        const hexPreview = audioData.slice(0, 32).toString('hex');
        const isAllZeros = audioData.every(byte => byte === 0);

        const samples = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i++) {
          sumSquares += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sumSquares / samples.length);

        logger.info('🔊 FIRST audio-data event received', {
          bufferSize: audioData.length,
          hexPreview: hexPreview,
          isAllZeros: isAllZeros,
          rms: rms.toFixed(2),
          isCapturing: this.isCapturing,
          pipeline: this.pipelineMode,
          timestamp: now
        });

        if (isAllZeros) {
          logger.error('❌ Buffer is ALL ZEROS!');
        }
      } else if (audioDataEventCount % 50 === 0) {
        const elapsed = now - lastLogTime;
        logger.info(`🔊 audio-data events: ${audioDataEventCount} total, ${elapsed}ms since last log`, {
          bufferSize: audioData.length,
          isCapturing: this.isCapturing,
          pipeline: this.pipelineMode
        });
        lastLogTime = now;
      }

      if (this.isCapturing) {
        // Route to active pipeline
        if (this.pipelineMode === 'deepgram-streaming' && this.deepgramService) {
          this.deepgramService.sendAudio(audioData, 'opponent');
        } else {
          // Legacy Gemini Live pipeline
          this.geminiDetector.sendAudioData(audioData, 'opponent').catch(error => {
            logger.error('Error sending system audio to Gemini', error);
          });
        }
      } else {
        if (audioDataEventCount === 1) {
          logger.warn('⚠️ Received audio-data but isCapturing is false, dropping chunk');
        }
      }
    });

    this.systemAudioCapture.on('error', (error) => {
      logger.error('System audio error', error);
      this.emit('error', { source: 'opponent', error });
    });

    logger.info('✅ Event listeners attached to SystemAudioCapture', {
      listenerCount: this.systemAudioCapture.listenerCount('audio-data')
    });
  }

  /**
   * Process microphone audio - route to active pipeline
   */
  public async processMicrophoneAudio(audioData: Buffer): Promise<void> {
    if (!this.isCapturing) return;

    try {
      if (this.pipelineMode === 'deepgram-streaming' && this.deepgramService) {
        this.deepgramService.sendAudio(audioData, 'user');
      } else {
        // Legacy Gemini Live pipeline
        await this.geminiDetector.sendAudioData(audioData, 'user');
      }
    } catch (error) {
      logger.error('Error processing microphone audio', error as Error);
    }
  }

  /**
   * Start capturing both audio sources
   */
  public async startCapture(): Promise<void> {
    logger.info('🎙️ startCapture() called', { pipeline: this.pipelineMode });

    if (this.isCapturing) {
      logger.info('⚠️ Already capturing, skipping');
      return;
    }

    try {
      logger.info(`🚀 Starting dual audio capture with ${this.pipelineMode} pipeline...`);

      // Start the appropriate pipeline
      if (this.pipelineMode === 'deepgram-streaming' && this.deepgramService) {
        logger.info('📞 Connecting to Deepgram...');
        await this.deepgramService.connect();
        logger.info('✅ Deepgram connected');
      } else {
        logger.info('📞 Starting Gemini Live sessions...');
        await this.geminiDetector.startListening();
        logger.info('✅ Gemini Live sessions started');
      }

      // Start system audio capture
      try {
        logger.info('🔊 Starting system audio capture...');
        await this.systemAudioCapture.startCapture('system-audio');
        logger.info('✅ System audio capture started (opponent source)');
      } catch (systemAudioError) {
        logger.warn('⚠️ System audio not available, continuing with microphone only', systemAudioError as Error);
      }

      this.isCapturing = true;

      logger.info(`✅ Dual audio capture started with ${this.pipelineMode} pipeline`);
      logger.info('🎤 Microphone → user source');
      logger.info('🔊 System audio → opponent source');

    } catch (error) {
      logger.error('❌ Failed to start capture', error as Error);
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Stop capturing both audio sources
   */
  public async stopCapture(): Promise<void> {
    if (!this.isCapturing) return;

    try {
      logger.info('Stopping dual audio capture...');

      // Stop the active pipeline
      if (this.pipelineMode === 'deepgram-streaming' && this.deepgramService) {
        this.deepgramService.disconnect();
      }

      // Always stop Gemini Live if it was used
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
   * Switch pipeline mode
   */
  public setPipelineMode(mode: PipelineMode): void {
    if (mode === 'deepgram-streaming' && !this.deepgramService) {
      logger.warn('Cannot switch to deepgram-streaming: Deepgram not initialized');
      return;
    }

    logger.info(`Switching pipeline mode: ${this.pipelineMode} → ${mode}`);
    this.pipelineMode = mode;
  }

  /**
   * Get current pipeline mode
   */
  public getPipelineMode(): PipelineMode {
    return this.pipelineMode;
  }

  /**
   * Get current state
   */
  public getState() {
    return {
      isCapturing: this.isCapturing,
      pipelineMode: this.pipelineMode,
      geminiState: this.geminiDetector.getState(),
      deepgramConnected: this.deepgramService?.isActive() || false
    };
  }

  /**
   * Get detected questions
   */
  public getQuestions(): DetectedQuestion[] {
    // Return from buffer for new pipeline, or from Gemini for legacy
    if (this.pipelineMode === 'deepgram-streaming') {
      return [...this.questionBuffer];
    }
    return this.geminiDetector.getQuestions();
  }

  /**
   * Clear questions
   */
  public clearQuestions(): void {
    this.questionBuffer = [];
    this.geminiDetector.clearQuestions();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopCapture();
    this.geminiDetector.destroy();
    this.deepgramService?.disconnect();
    this.removeAllListeners();
  }
}
