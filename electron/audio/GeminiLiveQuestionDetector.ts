import { GoogleGenAI, Modality } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { DetectedQuestion, GeminiLiveConfig, GeminiLiveState } from '../../src/types/audio-stream';

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

    // Initialize Gemini Live client
    this.genAI = new GoogleGenAI({ apiKey: this.config.apiKey });

    // Store callbacks
    this.onQuestionDetected = callbacks?.onQuestionDetected;
    this.onStateChanged = callbacks?.onStateChanged;
    this.onError = callbacks?.onError;

    console.log('[GeminiLiveQuestionDetector] Initialized with Gemini Live model:', this.config.model);
  }

  /**
   * Start listening with dual audio sources using Gemini Live API
   */
  public async startListening(): Promise<void> {
    if (this.state.isListening) {
      console.log('[GeminiLiveQuestionDetector] Already listening');
      return;
    }

    try {
      console.log('[GeminiLiveQuestionDetector] Starting dual Gemini Live sessions...');

      // Start user session (microphone) - direct audio streaming
      this.userSession = await this.createLiveSession('user');
      this.state.userSessionActive = true;

      // Start opponent session (system audio) - direct audio streaming
      this.opponentSession = await this.createLiveSession('opponent');
      this.state.opponentSessionActive = true;

      this.state.isListening = true;
      this.state.lastActivityTime = Date.now();

      this.emitStateChanged();
      console.log('[GeminiLiveQuestionDetector] ✅ Both Live API sessions started successfully');

    } catch (error) {
      console.error('[GeminiLiveQuestionDetector] Failed to start listening:', error);
      this.emitError(error as Error);
      throw error;
    }
  }

  /**
   * Create a Gemini Live API session with CALLBACK pattern (not EventEmitter)
   */
  private async createLiveSession(source: 'user' | 'opponent'): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(source);
    const responseQueue = source === 'user' ? this.userResponseQueue : this.opponentResponseQueue;

    try {
      // ✅ CORRECT: Pass callbacks during connection (not session.on!)
      const session = await this.genAI.live.connect({
        model: this.config.model,
        callbacks: {
          onopen: () => {
            console.log(`[GeminiLiveQuestionDetector] ${source} session opened`);
          },
          onmessage: (message: any) => {
            // Push to queue for async processing
            responseQueue.push(message);
            // Process immediately for real-time detection
            this.handleLiveMessage(message, source);
          },
          onerror: (error: any) => {
            console.error(`[GeminiLiveQuestionDetector] ${source} session error:`, error);
            this.emitError({ source, error });
          },
          onclose: (event: any) => {
            console.log(`[GeminiLiveQuestionDetector] ${source} session closed:`, event.reason);
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

      console.log(`[GeminiLiveQuestionDetector] ✅ ${source} Live API session created`);
      return session;

    } catch (error) {
      console.error(`[GeminiLiveQuestionDetector] Failed to create ${source} Live session:`, error);
      throw error;
    }
  }

  /**
   * Build system prompt for question detection
   * SIMPLIFIED for faster, more accurate responses
   */
  private buildSystemPrompt(source: 'user' | 'opponent'): string {
    const sourceLabel = source === 'user' ? 'ユーザー' : '相手';

    return `${sourceLabel}の音声から完全な質問のみを検出してください。

ルール:
- 質問が完全に終わるまで待つ
- フィラーワード（えー、あー、うーん）を除去
- 自然な日本語で返す（スペースなし）
- 質問でない文は無視
- 一度に一つの完全な質問のみ返す

質問形式: 〜ですか、〜ますか、〜ください、〜もらえますか、どう/何/なぜ/誰/いつ/どこで始まる文

例: "えーと、それはどうやって実装するんですか？" → "それはどうやって実装するんですか？"`;
  }

  /**
   * Send audio data directly to Gemini Live API (real-time streaming)
   * NO transcription step - audio goes directly to Gemini
   */
  public async sendAudioData(audioData: Buffer, source: 'user' | 'opponent'): Promise<void> {
    const session = source === 'user' ? this.userSession : this.opponentSession;

    if (!session) {
      console.warn(`[GeminiLiveQuestionDetector] ${source} session not active`);
      return;
    }

    try {
      // Convert Buffer to base64 for Gemini Live API
      const base64Audio = audioData.toString('base64');

      // Send audio directly to Gemini Live API
      // Audio format: 16-bit PCM, 16kHz, mono
      await session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000'
        }
      });

      this.state.lastActivityTime = Date.now();

    } catch (error) {
      console.error(`[GeminiLiveQuestionDetector] Error sending audio (${source}):`, error);
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
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.text) {
            this[buffer] += part.text;
          }
        }
      }

      // Only process when turn is complete
      if (message.serverContent?.turnComplete) {
        const completeText = this[buffer].trim();

        if (completeText) {
          // Validate the COMPLETE question
          if (this.looksLikeQuestion(completeText)) {
            const question: DetectedQuestion = {
              id: uuidv4(),
              text: completeText,
              timestamp: Date.now(),
              confidence: 0.95, // High confidence from Gemini Live
              source: source,
              isRefined: true,
              refinedText: completeText
            };

            console.log(`[GeminiLiveQuestionDetector] ❓ Question detected (${source}): "${completeText}"`);

            this.state.questionBuffer.push(question);
            this.state.lastActivityTime = Date.now();

            this.emitQuestionDetected(question);
            this.emitStateChanged();
          }
        }

        // Clear buffer for next turn
        this[buffer] = '';
      }

      // Check for interruption (VAD detected user speaking)
      if (message.serverContent?.interrupted) {
        console.log(`[GeminiLiveQuestionDetector] Generation interrupted for ${source} (VAD) - clearing buffer`);
        this[buffer] = ''; // Clear buffer on interruption
      }

    } catch (error) {
      console.error(`[GeminiLiveQuestionDetector] Error handling message (${source}):`, error);
    }
  }

  /**
   * Validate that text is a complete, well-formed question
   * SIMPLIFIED - only essential checks
   */
  private looksLikeQuestion(text: string): boolean {
    // Reject if ends with incomplete markers (particles/connectors)
    const incompleteEndings = [
      /、$/,              // Ends with comma
      /[のがをにでと]$/,  // Ends with particle
      /って$/,            // Ends with quotation marker
      /という$/,          // Ends with "called/that"
      /について$/,        // Ends with "about" (needs verb)
    ];

    if (incompleteEndings.some(pattern => pattern.test(text))) {
      console.log(`[GeminiLiveQuestionDetector] Rejected: Incomplete ending: "${text}"`);
      return false;
    }

    // Reject if excessive spaces (poor transcription)
    const spaceRatio = (text.match(/ /g) || []).length / text.replace(/ /g, '').length;
    if (spaceRatio > 0.3) {
      console.log(`[GeminiLiveQuestionDetector] Rejected: Too many spaces: "${text}"`);
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
      console.log(`[GeminiLiveQuestionDetector] Rejected: Not a question: "${text}"`);
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
