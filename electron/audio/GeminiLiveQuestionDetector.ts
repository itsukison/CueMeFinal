import { GoogleGenAI, Modality } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { DetectedQuestion, GeminiLiveConfig, GeminiLiveState } from '../../src/types/audio-stream';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';

const logger = new DiagnosticLogger('GeminiLiveQuestionDetector');

/**
 * Gemini Live session for real-time question detection
 * Uses CALLBACK-BASED pattern (not EventEmitter)
 * Streams audio directly to Gemini Live API and receives questions in real-time
 * NO transcription step - direct audio → question detection
 */
export class GeminiLiveQuestionDetector {
  private genAI: GoogleGenAI;
  private userSession: any = null;
  private opponentSession: any = null;
  private state: GeminiLiveState;
  private config: GeminiLiveConfig;

  // Response queues for async message processing
  private userResponseQueue: any[] = [];
  private opponentResponseQueue: any[] = [];

  // Turn buffers to accumulate text until turn is complete
  private userTurnBuffer: string = '';
  private opponentTurnBuffer: string = '';

  // Callbacks for external event handling
  private onQuestionDetected?: (question: DetectedQuestion) => void;
  private onStateChanged?: (state: GeminiLiveState) => void;
  private onError?: (error: any) => void;

  constructor(config: GeminiLiveConfig, callbacks?: {
    onQuestionDetected?: (question: DetectedQuestion) => void;
    onStateChanged?: (state: GeminiLiveState) => void;
    onError?: (error: any) => void;
  }) {
    logger.info('🔍 Constructor called', {
      apiKeyPresent: !!config.apiKey,
      apiKeyLength: config.apiKey?.length,
      model: config.model,
      language: config.language
    });

    this.config = {
      model: 'gemini-live-2.5-flash-preview', // Official Live API model
      language: 'ja-JP',
      ...config
    };

    this.state = {
      isListening: false,
      userSessionActive: false,
      opponentSessionActive: false,
      questionBuffer: [],
      lastActivityTime: 0
    };

    try {
      logger.info('📦 Creating GoogleGenAI client...');
      // Initialize Gemini Live client
      this.genAI = new GoogleGenAI({ apiKey: this.config.apiKey });
      logger.info('✅ GoogleGenAI client created');
      
      // Check if live API is available
      logger.info('🔍 Checking genAI.live availability', {
        hasLive: !!this.genAI.live,
        hasConnect: !!(this.genAI.live as any)?.connect,
        liveType: typeof this.genAI.live
      });
    } catch (error) {
      logger.error('❌ Failed to create GoogleGenAI client', error as Error);
      throw error;
    }

    // Store callbacks
    this.onQuestionDetected = callbacks?.onQuestionDetected;
    this.onStateChanged = callbacks?.onStateChanged;
    this.onError = callbacks?.onError;

    logger.info('✅ Initialized with Gemini Live model: ' + this.config.model);
  }

  /**
   * Start listening with dual audio sources using Gemini Live API
   */
  public async startListening(): Promise<void> {
    logger.info('🎙️ startListening() called');
    
    if (this.state.isListening) {
      logger.info('⚠️ Already listening, skipping');
      return;
    }

    try {
      logger.info('🚀 Starting dual Gemini Live sessions...');
      logger.info('🔍 genAI.live check', {
        hasLive: !!this.genAI.live,
        hasConnect: !!(this.genAI.live as any)?.connect,
        liveType: typeof this.genAI.live
      });

      // Start user session (microphone) - direct audio streaming
      logger.info('📞 Creating user session...');
      this.userSession = await this.createLiveSession('user');
      this.state.userSessionActive = true;
      logger.info('✅ User session created');

      // Start opponent session (system audio) - direct audio streaming
      logger.info('📞 Creating opponent session...');
      this.opponentSession = await this.createLiveSession('opponent');
      this.state.opponentSessionActive = true;
      logger.info('✅ Opponent session created');

      this.state.isListening = true;
      this.state.lastActivityTime = Date.now();

      this.emitStateChanged();
      logger.info('✅ Both Live API sessions started successfully');

    } catch (error) {
      logger.error('❌ Failed to start listening', error as Error);
      this.emitError(error as Error);
      throw error;
    }
  }

  /**
   * Create a Gemini Live API session with CALLBACK pattern (not EventEmitter)
   */
  private async createLiveSession(source: 'user' | 'opponent'): Promise<any> {
    logger.info(`🔧 createLiveSession(${source}) called`);
    
    const systemPrompt = this.buildSystemPrompt(source);
    const responseQueue = source === 'user' ? this.userResponseQueue : this.opponentResponseQueue;

    try {
      logger.info(`🔍 Checking genAI.live for ${source}`, {
        hasLive: !!this.genAI.live,
        liveType: typeof this.genAI.live,
        hasConnect: typeof (this.genAI.live as any)?.connect
      });

      if (!this.genAI.live) {
        throw new Error('genAI.live is undefined - Gemini Live API not available');
      }

      if (typeof (this.genAI.live as any).connect !== 'function') {
        throw new Error('genAI.live.connect is not a function - API version mismatch?');
      }

      logger.info(`📞 Calling genAI.live.connect for ${source}...`);
      // ✅ CORRECT: Pass callbacks during connection (not session.on!)
      // Track messages for diagnostics
      let messageCount = 0;
      const connectionStartTime = Date.now();

      const session = await this.genAI.live.connect({
        model: this.config.model,
        callbacks: {
          onopen: () => {
            const connectionTime = Date.now() - connectionStartTime;
            logger.info(`✅ ${source} session opened`, {
              connectionTimeMs: connectionTime,
              timestamp: Date.now()
            });
          },
          onmessage: (message: any) => {
            messageCount++;
            
            // Log every message for diagnostics
            const messageStr = JSON.stringify(message);
            const preview = messageStr.length > 200 ? messageStr.substring(0, 200) + '...' : messageStr;
            
            logger.info(`📨 Gemini message received (${source}) #${messageCount}`, {
              messageType: message.serverContent?.modelTurn ? 'modelTurn' : 
                          message.serverContent?.turnComplete ? 'turnComplete' :
                          message.serverContent?.interrupted ? 'interrupted' : 'other',
              hasParts: !!message.serverContent?.modelTurn?.parts,
              partCount: message.serverContent?.modelTurn?.parts?.length || 0,
              turnComplete: !!message.serverContent?.turnComplete,
              interrupted: !!message.serverContent?.interrupted,
              preview: preview
            });
            
            // Push to queue for async processing
            responseQueue.push(message);
            // Process immediately for real-time detection
            this.handleLiveMessage(message, source);
          },
          onerror: (error: any) => {
            logger.error(`❌ ${source} session error`, error, {
              errorType: typeof error,
              errorCode: (error as any)?.code,
              errorMessage: (error as any)?.message,
              messageCount: messageCount
            });
            this.emitError({ source, error });
          },
          onclose: (event: any) => {
            logger.info(`🔌 ${source} session closed`, {
              reason: event.reason || 'No reason provided',
              code: event.code,
              wasClean: event.wasClean,
              messageCount: messageCount,
              unexpected: !event.wasClean
            });
          }
        },
        config: {
          responseModalities: [Modality.TEXT], // Only need text output (questions)
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.3, // Lower for more deterministic, less eager responses
            maxOutputTokens: 100, // Sufficient for most questions
            topP: 0.9, // Slightly lower for more focused responses
          }
          // Note: VAD sensitivity is controlled by the prompt instructions
          // The prompt explicitly tells Gemini to wait for complete questions
          // and ignore short pauses mid-sentence
          // No inputAudioTranscription - we only need questions, not transcriptions
        }
      });

      logger.info(`✅ ${source} Live API session created successfully`);
      return session;

    } catch (error) {
      logger.error(`❌ Failed to create ${source} Live session`, error as Error, {
        name: (error as Error).name,
        message: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Build system prompt for question detection
   * SIMPLIFIED for faster, more accurate responses
   */
  private buildSystemPrompt(source: 'user' | 'opponent'): string {
    const sourceLabel = source === 'user' ? 'ユーザー' : '相手';

    return `あなたは質問検出専用のAIです。${sourceLabel}の音声を聞いて、質問が発せられたら、その質問文だけを出力してください。

**重要な制約:**
- 質問に対する回答は絶対にしない
- 会話をしない
- 自分の意見を述べない
- 質問でない文には何も出力しない
- 質問が聞こえたら、その質問文のみを出力する

**出力ルール:**
- 質問が完全に終わるまで待つ
- フィラーワード（えー、あー、うーん）を除去
- 自然な日本語で返す（スペースなし）
- 一度に一つの完全な質問のみ返す

**質問形式:** 〜ですか、〜ますか、〜ください、〜もらえますか、どう/何/なぜ/誰/いつ/どこで始まる文

**例:**
入力: "えーと、それはどうやって実装するんですか？"
出力: "それはどうやって実装するんですか？"

入力: "今日はいい天気ですね"
出力: (何も出力しない - 質問ではないため)`;
  }

  // Track audio sending for logging
  private userAudioCount = 0;
  private opponentAudioCount = 0;
  private lastUserLogTime = Date.now();
  private lastOpponentLogTime = Date.now();

  /**
   * Send audio data directly to Gemini Live API (real-time streaming)
   * NO transcription step - audio goes directly to Gemini
   */
  public async sendAudioData(audioData: Buffer, source: 'user' | 'opponent'): Promise<void> {
    const session = source === 'user' ? this.userSession : this.opponentSession;

    if (!session) {
      logger.warn(`${source} session not active, cannot send audio`);
      return;
    }

    // Track audio chunks
    if (source === 'user') {
      this.userAudioCount++;
    } else {
      this.opponentAudioCount++;
    }

    const count = source === 'user' ? this.userAudioCount : this.opponentAudioCount;
    const lastLogTime = source === 'user' ? this.lastUserLogTime : this.lastOpponentLogTime;
    const now = Date.now();

    // Log first chunk and every 50 chunks
    if (count === 1) {
      logger.info(`📤 FIRST audio chunk sent to Gemini (${source})`, {
        bufferSize: audioData.length,
        base64Length: Math.ceil(audioData.length * 4 / 3)
      });
    } else if (count % 50 === 0) {
      const elapsed = now - lastLogTime;
      logger.info(`📤 Audio chunks sent to Gemini (${source}): ${count} total, ${elapsed}ms since last log`);
      if (source === 'user') {
        this.lastUserLogTime = now;
      } else {
        this.lastOpponentLogTime = now;
      }
    }

    try {
      // Validate audio quality before sending
      if (count === 1) {
        // Log first chunk's raw bytes for debugging
        const hexPreview = audioData.slice(0, 32).toString('hex');
        logger.info(`🔬 First audio chunk analysis (${source})`, {
          bufferLength: audioData.length,
          expectedLength: 6400, // 200ms at 16kHz, 16-bit = 16000 * 0.2 * 2 = 6400 bytes
          hexPreview: hexPreview,
          isAllZeros: audioData.every(byte => byte === 0)
        });
      }
      
      // Calculate audio level (RMS) to detect silence
      const samples = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i++) {
        sumSquares += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      const normalizedRMS = rms / 32768; // Normalize to 0-1 range
      
      // Log audio level for first chunk and every 50 chunks
      if (count === 1 || count % 50 === 0) {
        logger.info(`🎚️ Audio level (${source})`, {
          rms: rms.toFixed(2),
          normalizedRMS: normalizedRMS.toFixed(4),
          isSilent: normalizedRMS < 0.01,
          isQuiet: normalizedRMS < 0.05,
          sampleCount: samples.length
        });
      }
      
      // Warn if audio is suspiciously quiet
      if (count === 1 && normalizedRMS < 0.01) {
        logger.warn(`⚠️ First audio chunk is very quiet or silent (${source})`, {
          normalizedRMS: normalizedRMS.toFixed(4),
          suggestion: 'Check if audio source is active and volume is sufficient'
        });
      }

      // Convert Buffer to base64 for Gemini Live API
      const base64Audio = audioData.toString('base64');

      // Send audio directly to Gemini Live API
      // Audio format: 16-bit PCM, 16kHz, mono
      const sendStartTime = Date.now();
      await session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000'
        }
      });
      const sendDuration = Date.now() - sendStartTime;
      
      if (count === 1) {
        logger.info(`⏱️ First audio send latency (${source}): ${sendDuration}ms`);
      }

      this.state.lastActivityTime = Date.now();

    } catch (error) {
      logger.error(`Error sending audio to Gemini (${source})`, error as Error, {
        errorType: (error as any)?.constructor?.name,
        errorMessage: (error as any)?.message,
        chunkNumber: count
      });
      this.emitError({ source, error });
    }
  }

  /**
   * Handle messages from Gemini Live API
   * Buffers text until turn is complete, then validates and emits
   */
  private handleLiveMessage(message: any, source: 'user' | 'opponent'): void {
    try {
      const buffer = source === 'user' ? 'userTurnBuffer' : 'opponentTurnBuffer';

      // Accumulate text parts in buffer
      if (message.serverContent?.modelTurn?.parts) {
        let addedText = '';
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.text) {
            this[buffer] += part.text;
            addedText += part.text;
          }
        }
        
        if (addedText) {
          logger.info(`📝 Accumulating text in ${source} buffer`, {
            addedLength: addedText.length,
            addedText: addedText.substring(0, 100),
            totalBufferLength: this[buffer].length
          });
        }
      }

      // Only process when turn is complete
      if (message.serverContent?.turnComplete) {
        const completeText = this[buffer].trim();

        logger.info(`🏁 Turn complete for ${source}`, {
          bufferLength: completeText.length,
          text: completeText.substring(0, 200),
          isEmpty: !completeText
        });

        if (completeText) {
          // Validate the COMPLETE question
          const isQuestion = this.looksLikeQuestion(completeText);
          
          logger.info(`🔍 Question validation for ${source}`, {
            text: completeText,
            isQuestion: isQuestion,
            length: completeText.length
          });
          
          if (isQuestion) {
            const question: DetectedQuestion = {
              id: uuidv4(),
              text: completeText,
              timestamp: Date.now(),
              confidence: 0.95, // High confidence from Gemini Live
              source: source,
              isRefined: true,
              refinedText: completeText
            };

            logger.info(`❓ Question detected (${source}): "${completeText}"`);

            this.state.questionBuffer.push(question);
            this.state.lastActivityTime = Date.now();

            this.emitQuestionDetected(question);
            this.emitStateChanged();
          } else {
            logger.info(`❌ Text rejected - not a question (${source})`, {
              text: completeText
            });
          }
        } else {
          logger.warn(`⚠️ Turn complete but buffer is empty (${source})`);
        }

        // Clear buffer for next turn
        this[buffer] = '';
      }

      // Check for interruption (VAD detected user speaking)
      if (message.serverContent?.interrupted) {
        logger.info(`⚡ Generation interrupted for ${source} (VAD) - clearing buffer`, {
          bufferLength: this[buffer].length,
          bufferContent: this[buffer].substring(0, 100)
        });
        this[buffer] = ''; // Clear buffer on interruption
      }

    } catch (error) {
      logger.error(`Error handling message (${source})`, error as Error);
    }
  }

  /**
   * Validate that text is a complete, well-formed question
   * ENHANCED - rejects auto-generated responses from Gemini
   */
  private looksLikeQuestion(text: string): boolean {
    // Reject if looks like a response/answer (common response patterns)
    const responsePatterns = [
      /^はい[、。]/,                    // "はい、" (Yes,)
      /^いいえ[、。]/,                  // "いいえ、" (No,)
      /^えっと[、。]/,                  // "えっと、" (Um,)
      /^そうですね[、。]/,              // "そうですね、" (Well,)
      /私の|私は/,                     // "私の" "私は" (my/I) - likely a personal response
      /成功体験|経験|思います|考えます/,  // Common answer keywords
      /でした[。、]?$/,                // Ends with past tense statement
      /です[。、]?$/,                   // Ends with statement (not question)
      /ました[。、]?$/,                 // Past tense statement ending
    ];

    if (responsePatterns.some(pattern => pattern.test(text))) {
      logger.info(`❌ Rejected: Looks like a response/answer, not a question: "${text}"`);
      return false;
    }

    // Reject if ends with incomplete markers (particles/connectors)
    const incompleteEndings = [
      /、$/,              // Ends with comma
      /[のがをにでと]$/,  // Ends with particle
      /って$/,            // Ends with quotation marker
      /という$/,          // Ends with "called/that"
      /について$/,        // Ends with "about" (needs verb)
    ];

    if (incompleteEndings.some(pattern => pattern.test(text))) {
      logger.info(`❌ Rejected: Incomplete ending: "${text}"`);
      return false;
    }

    // Reject if excessive spaces (poor transcription)
    const spaceRatio = (text.match(/ /g) || []).length / text.replace(/ /g, '').length;
    if (spaceRatio > 0.3) {
      logger.info(`❌ Rejected: Too many spaces: "${text}"`);
      return false;
    }

    // Japanese question patterns (simplified)
    const questionPatterns = [
      /[？?]$/,                                                    // Question mark
      /(です|ます|でしょう|です)か[？?]?$/,                        // Standard questions
      /(ください|もらえますか|いただけますか|くれますか)[？?]?$/,  // Requests
      /(思い|考え|感じ)ますか[？?]?$/,                            // Opinion questions
      /(いかが|よろしい|どう)ですか[？?]?$/,                      // Polite inquiries
      /^(どう|何|いつ|どこ|なぜ|誰|どの|いくら|どちら|どれ)/,      // Question words
      /(教えて|話して|説明して|聞かせて)(ください|もらえますか|いただけますか)/,  // Request patterns
    ];

    const isQuestion = questionPatterns.some(pattern => pattern.test(text));

    if (!isQuestion) {
      logger.info(`❌ Rejected: Not a question: "${text}"`);
    }

    return isQuestion;
  }

  /**
   * Stop listening and close Live API sessions
   */
  public async stopListening(): Promise<void> {
    if (!this.state.isListening) return;

    try {
      console.log('[GeminiLiveQuestionDetector] Stopping Live API sessions...');

      // Close user session
      if (this.userSession) {
        await this.userSession.close(); // ✅ Session has close() method
        this.userSession = null;
        this.state.userSessionActive = false;
      }

      // Close opponent session
      if (this.opponentSession) {
        await this.opponentSession.close();
        this.opponentSession = null;
        this.state.opponentSessionActive = false;
      }

      // Clear response queues
      this.userResponseQueue = [];
      this.opponentResponseQueue = [];

      this.state.isListening = false;
      this.emitStateChanged();

      console.log('[GeminiLiveQuestionDetector] ✅ Live API sessions stopped');

    } catch (error) {
      console.error('[GeminiLiveQuestionDetector] Error stopping sessions:', error);
      this.emitError(error as Error);
    }
  }

  /**
   * Helper methods for callbacks (replaces EventEmitter.emit)
   */
  private emitQuestionDetected(question: DetectedQuestion): void {
    this.onQuestionDetected?.(question);
  }

  private emitStateChanged(): void {
    this.onStateChanged?.(this.getState());
  }

  private emitError(error: any): void {
    this.onError?.(error);
  }

  /**
   * Get current state
   */
  public getState(): GeminiLiveState {
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
    this.emitStateChanged();
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopListening();
    // No removeAllListeners() - we're not using EventEmitter anymore
  }
}
