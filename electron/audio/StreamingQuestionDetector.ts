import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { DetectedQuestion } from '../../src/types/audio-stream';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';

const logger = new DiagnosticLogger('StreamingQuestionDetector');

export interface StreamingDetectorConfig {
    apiKey: string;
    model?: string;
}

/**
 * Question detector using Gemini Flash streaming API
 * Extracts Japanese questions from transcribed text with high reliability
 */
export class StreamingQuestionDetector {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;
    private readonly modelName: string;

    // Callbacks for external event handling
    private onQuestionDetected?: (question: DetectedQuestion) => void;
    private onError?: (error: any) => void;

    constructor(
        config: StreamingDetectorConfig,
        callbacks?: {
            onQuestionDetected?: (question: DetectedQuestion) => void;
            onError?: (error: any) => void;
        }
    ) {
        this.modelName = config.model || 'gemini-2.0-flash';
        this.genAI = new GoogleGenerativeAI(config.apiKey);

        this.model = this.genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                temperature: 0.0, // Maximum determinism for JSON output
                maxOutputTokens: 150,
                topP: 0.8,
            },
        });

        this.onQuestionDetected = callbacks?.onQuestionDetected;
        this.onError = callbacks?.onError;

        logger.info('✅ Initialized StreamingQuestionDetector', {
            model: this.modelName,
        });
    }

    /**
     * System prompt for strict JSON-only question extraction
     */
    private buildPrompt(transcribedText: string): string {
        return `You are a JSON-only question extractor for Japanese speech.

INPUT: "${transcribedText}"

OUTPUT RULES:
- Output ONLY a valid JSON object
- If a question is detected: {"question": "the question text"}
- If NO question is detected: {"question": null}
- NEVER output markdown, analysis, or any text outside the JSON

QUESTION INDICATORS:
- Ends with か, ですか, ますか, でしょうか
- Contains 何, どこ, だれ, いつ, なぜ, どう, どれ, いくつ, いくら
- Request patterns: ください, お願いします, 教えて

EXAMPLES:
Input: "今日はいい天気ですね" → {"question": null}
Input: "お名前は何ですか" → {"question": "お名前は何ですか"}
Input: "えーとあのー今どこにいますか" → {"question": "今どこにいますか"}

Output the JSON now:`;
    }

    /**
     * Detect question from transcribed text using streaming API
     */
    public async detectQuestion(
        transcribedText: string,
        source: 'user' | 'opponent'
    ): Promise<DetectedQuestion | null> {
        if (!transcribedText || transcribedText.trim().length < 3) {
            return null;
        }

        const startTime = Date.now();

        try {
            const prompt = this.buildPrompt(transcribedText);

            // Use streaming for faster first-token response
            const result = await this.model.generateContentStream(prompt);

            let fullResponse = '';
            for await (const chunk of result.stream) {
                fullResponse += chunk.text();
            }

            const parseTime = Date.now();
            logger.info(`🤖 Gemini response (${parseTime - startTime}ms)`, {
                source,
                inputLength: transcribedText.length,
                outputLength: fullResponse.length,
                output: fullResponse.substring(0, 100),
            });

            // Parse the JSON response
            const question = this.parseQuestionFromJson(fullResponse);

            if (question) {
                const detectedQuestion: DetectedQuestion = {
                    id: uuidv4(),
                    text: question,
                    timestamp: Date.now(),
                    confidence: 0.95, // High confidence from text model
                    source,
                    isRefined: true,
                    refinedText: question,
                };

                logger.info(`❓ Question detected (${source}): "${question}"`);

                this.onQuestionDetected?.(detectedQuestion);
                return detectedQuestion;
            }

            return null;
        } catch (error) {
            logger.error(`Error detecting question (${source})`, error as Error);
            this.onError?.({ source, error });
            return null;
        }
    }

    /**
     * Parse question from JSON output
     */
    private parseQuestionFromJson(text: string): string | null {
        try {
            // Clean markdown code blocks if present
            const cleanText = text
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();

            const data = JSON.parse(cleanText);

            if (data && typeof data.question === 'string' && data.question.trim().length > 0) {
                return data.question.trim();
            }

            return null; // Explicit null or empty question
        } catch (e) {
            // Fallback: regex extraction
            const jsonMatch = text.match(/"question":\s*"([^"]+)"/);
            if (jsonMatch && jsonMatch[1]) {
                return jsonMatch[1].trim();
            }

            logger.warn(`⚠️ Failed to parse JSON: "${text.substring(0, 50)}..."`);
            return null;
        }
    }

    /**
     * Quick check if text might contain a question (pre-filter)
     * Used to avoid unnecessary API calls
     */
    public mightContainQuestion(text: string): boolean {
        if (!text || text.length < 5) return false;

        // Japanese question patterns
        const questionPatterns = [
            /[？?]/, // Question marks
            /か[。．]?$/, // Ends with か
            /ですか/, // Polite question
            /ますか/, // Polite question
            /でしょうか/, // Very polite question
            /何|なに|なん/, // What
            /どこ/, // Where
            /だれ|誰/, // Who
            /いつ/, // When
            /なぜ|どうして/, // Why
            /どう/, // How
            /どれ|どちら/, // Which
            /いくつ|いくら/, // How many/much
            /ください/, // Please (request)
            /お願い/, // Request
            /教えて/, // Tell me
        ];

        return questionPatterns.some((pattern) => pattern.test(text));
    }

    /**
     * Set callbacks after construction
     */
    public setCallbacks(callbacks: {
        onQuestionDetected?: (question: DetectedQuestion) => void;
        onError?: (error: any) => void;
    }): void {
        this.onQuestionDetected = callbacks.onQuestionDetected;
        this.onError = callbacks.onError;
    }
}
