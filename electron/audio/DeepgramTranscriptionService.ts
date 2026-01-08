import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';

const logger = new DiagnosticLogger('DeepgramTranscription');

export interface TranscriptionResult {
    text: string;
    isFinal: boolean;
    confidence: number;
    source: 'user' | 'opponent';
    timestamp: number;
}

export interface DeepgramConfig {
    apiKey: string;
    language?: string;
    model?: string;
    sampleRate?: number;
    encoding?: string;
    channels?: number;
}

/**
 * Real-time audio transcription using Deepgram WebSocket API
 * Emits: 'transcription', 'connected', 'disconnected', 'error'
 */
export class DeepgramTranscriptionService extends EventEmitter {
    private userSocket: WebSocket | null = null;
    private opponentSocket: WebSocket | null = null;
    private config: Required<DeepgramConfig>;
    private isConnected: { user: boolean; opponent: boolean } = { user: false, opponent: false };

    // Transcription buffers for accumulating text
    private userBuffer: string = '';
    private opponentBuffer: string = '';

    constructor(config: DeepgramConfig) {
        super();

        this.config = {
            apiKey: config.apiKey,
            language: config.language || 'ja',
            model: config.model || 'nova-2',
            sampleRate: config.sampleRate || 16000,
            encoding: config.encoding || 'linear16',
            channels: config.channels || 1,
        };

        logger.info('✅ Initialized Deepgram transcription service', {
            language: this.config.language,
            model: this.config.model,
            sampleRate: this.config.sampleRate,
        });
    }

    /**
     * Connect to Deepgram for real-time transcription
     */
    public async connect(): Promise<void> {
        logger.info('🔌 Connecting to Deepgram...');

        try {
            // Connect both user and opponent sockets
            await Promise.all([
                this.connectSocket('user'),
                this.connectSocket('opponent'),
            ]);

            logger.info('✅ Both Deepgram connections established');
        } catch (error) {
            logger.error('❌ Failed to connect to Deepgram', error as Error);
            throw error;
        }
    }

    private async connectSocket(source: 'user' | 'opponent'): Promise<void> {
        return new Promise((resolve, reject) => {
            const url = this.buildWebSocketUrl();

            logger.info(`📞 Connecting ${source} socket to Deepgram...`, { url: url.replace(this.config.apiKey, '[REDACTED]') });

            const socket = new WebSocket(url, {
                headers: {
                    Authorization: `Token ${this.config.apiKey}`,
                },
            });

            socket.on('open', () => {
                logger.info(`✅ ${source} Deepgram socket connected`);
                this.isConnected[source] = true;

                if (source === 'user') {
                    this.userSocket = socket;
                } else {
                    this.opponentSocket = socket;
                }

                this.emit('connected', source);
                resolve();
            });

            socket.on('message', (data: WebSocket.Data) => {
                this.handleMessage(data, source);
            });

            socket.on('error', (error) => {
                logger.error(`❌ ${source} Deepgram socket error`, error as Error);
                this.emit('error', { source, error });
                reject(error);
            });

            socket.on('close', (code, reason) => {
                logger.info(`🔌 ${source} Deepgram socket closed`, { code, reason: reason.toString() });
                this.isConnected[source] = false;
                this.emit('disconnected', source);
            });

            // Timeout for connection
            setTimeout(() => {
                if (!this.isConnected[source]) {
                    reject(new Error(`Connection timeout for ${source}`));
                }
            }, 10000);
        });
    }

    private buildWebSocketUrl(): string {
        const params = new URLSearchParams({
            model: this.config.model,
            language: this.config.language,
            encoding: this.config.encoding,
            sample_rate: this.config.sampleRate.toString(),
            channels: this.config.channels.toString(),
            punctuate: 'true',
            interim_results: 'true',
            endpointing: '1000', // 1000ms silence = end of utterance (fallback if no sentence pattern)
            vad_events: 'true',
        });

        return `wss://api.deepgram.com/v1/listen?${params.toString()}`;
    }

    private handleMessage(data: WebSocket.Data, source: 'user' | 'opponent'): void {
        try {
            const response = JSON.parse(data.toString());

            // Handle transcription results
            if (response.type === 'Results' && response.channel?.alternatives?.[0]) {
                const alternative = response.channel.alternatives[0];
                const text = alternative.transcript || '';
                const isFinal = response.is_final === true;
                const confidence = alternative.confidence || 0;

                if (text.trim()) {
                    // Accumulate text in buffer
                    const buffer = source === 'user' ? 'userBuffer' : 'opponentBuffer';

                    if (isFinal) {
                        this[buffer] += text + ' ';

                        logger.info(`📝 Final transcription (${source})`, {
                            text: text.substring(0, 100),
                            confidence: (confidence * 100).toFixed(1) + '%',
                            bufferLength: this[buffer].length,
                        });
                    }

                    const result: TranscriptionResult = {
                        text,
                        isFinal,
                        confidence,
                        source,
                        timestamp: Date.now(),
                    };

                    this.emit('transcription', result);
                }
            }

            // Handle speech end (utterance complete)
            if (response.type === 'UtteranceEnd') {
                const buffer = source === 'user' ? 'userBuffer' : 'opponentBuffer';
                const completeText = this[buffer].trim();

                if (completeText) {
                    logger.info(`🏁 Utterance complete (${source})`, {
                        text: completeText.substring(0, 100),
                        length: completeText.length,
                    });

                    this.emit('utterance-complete', {
                        text: completeText,
                        source,
                        timestamp: Date.now(),
                    });

                    // Clear buffer
                    this[buffer] = '';
                }
            }
        } catch (error) {
            logger.error(`Error parsing Deepgram message (${source})`, error as Error);
        }
    }

    /**
     * Send audio data to Deepgram for transcription
     */
    public sendAudio(audioData: Buffer, source: 'user' | 'opponent'): void {
        const socket = source === 'user' ? this.userSocket : this.opponentSocket;

        if (!socket || socket.readyState !== WebSocket.OPEN) {
            // Silently skip if not connected (will reconnect)
            return;
        }

        try {
            socket.send(audioData);
        } catch (error) {
            logger.error(`Error sending audio to Deepgram (${source})`, error as Error);
        }
    }

    /**
     * Flush the transcription buffer and get complete text
     */
    public flushBuffer(source: 'user' | 'opponent'): string {
        const buffer = source === 'user' ? 'userBuffer' : 'opponentBuffer';
        const text = this[buffer].trim();
        this[buffer] = '';
        return text;
    }

    /**
     * Disconnect from Deepgram
     */
    public disconnect(): void {
        logger.info('🔌 Disconnecting from Deepgram...');

        if (this.userSocket) {
            this.userSocket.close();
            this.userSocket = null;
        }

        if (this.opponentSocket) {
            this.opponentSocket.close();
            this.opponentSocket = null;
        }

        this.isConnected = { user: false, opponent: false };
        this.userBuffer = '';
        this.opponentBuffer = '';

        logger.info('✅ Deepgram disconnected');
    }

    /**
     * Check if connected
     */
    public isActive(): boolean {
        return this.isConnected.user || this.isConnected.opponent;
    }

    /**
     * Check connection status for specific source
     */
    public isSourceConnected(source: 'user' | 'opponent'): boolean {
        return this.isConnected[source];
    }
}
