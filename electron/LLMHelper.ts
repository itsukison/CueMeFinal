import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"
import { QnAService, SearchResult } from "./QnAService"
import { DocumentService, DocumentSearchResult } from "./DocumentService"
import { ModeManager } from "./ModeManager"
import { ModeResponse, CompatibleResponse } from "../src/types/modes"

export interface RAGContext {
  hasContext: boolean
  results: SearchResult[]
  documentChunks?: DocumentSearchResult[]
  collectionName?: string
  documentName?: string
  type: 'qna' | 'document'
}

export class LLMHelper {
  private model: GenerativeModel
  private qnaService: QnAService | null = null
  private documentService: DocumentService | null = null
  private readonly modelName: string
  private readonly systemPrompt = `面接で直接使える日本語回答を提供してください。

禁止事項:
• 前置き（「はい、」「それでは、」「お答えします」など）
• メタ説明（「面接官に伝える形で」「説明します」など）
• 情報源への言及（「参考情報によると」など）
• マークダウン記法（**太字**、*斜体*、*箇条書き）は使用禁止

回答形式:
• 核心を最初に述べる
• 具体例を2-3個含める
• 箇条書きは「•」を使用
• 重要な語句は【】で囲む（例: 【重要】）`

  constructor(apiKey: string, modelName: string = "gemini-2.0-flash") {
    const genAI = new GoogleGenerativeAI(apiKey)
    this.modelName = modelName
    this.model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1200, // Balanced length for detailed but concise responses
      }
    })
    console.log(`[LLMHelper] Initialized with model: ${modelName}`);
  }

  private async fileToGenerativePart(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath)
    return {
      inlineData: {
        data: imageData.toString("base64"),
        mimeType: "image/png"
      }
    }
  }

  private cleanJsonResponse(text: string): string {
    // Remove markdown code block syntax if present
    text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    // Remove any leading/trailing whitespace
    text = text.trim();
    return text;
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `あなたは面接支援AIです。これらの画像を分析し、以下のJSON形式で情報を抽出してください：

{
  "problem_statement": "画像に描かれている問題や状況の明確な説明（日本語）",
  "context": "画像から読み取れる関連する背景や文脈（日本語）",
  "suggested_responses": ["面接で使える回答例1", "面接で使える回答例2", "面接で使える回答例3"],
  "reasoning": "これらの回答が適切である理由の説明（日本語）"
}

重要：JSONオブジェクトのみを返し、マークダウン形式やコードブロックは使用しないでください。すべての内容は日本語で、面接で直接使える形式にしてください。`

      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      return JSON.parse(text)
    } catch (error) {
      console.error("Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `あなたは面接支援AIです。以下の問題や状況に対して、面接で使える回答を提供してください：

問題情報：
${JSON.stringify(problemInfo, null, 2)}

以下のJSON形式で回答してください：
{
  "solution": {
    "code": "メインの回答やコード（面接で直接使える形）",
    "problem_statement": "問題や状況の再確認（日本語）",
    "context": "関連する背景や文脈（日本語）",
    "suggested_responses": ["面接で使える回答例1", "面接で使える回答例2", "面接で使える回答例3"],
    "reasoning": "これらの回答が適切である理由（日本語）"
  }
}

重要：JSONオブジェクトのみを返し、マークダウン形式やコードブロックは使用しないでください。すべての内容は日本語で、面接で直接使える簡潔で明確な形式にしてください。`

    console.log("[LLMHelper] Calling Gemini LLM for solution...");
    try {
      const result = await this.model.generateContent(prompt)
      console.log("[LLMHelper] Gemini LLM returned result.");
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error);
      throw error;
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(debugImagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `あなたは面接支援AIです。以下の情報を分析してデバッグ支援を行ってください：

1. 元の問題や状況：${JSON.stringify(problemInfo, null, 2)}
2. 現在の回答やアプローチ：${currentCode}
3. デバッグ情報：提供された画像を参照

画像のデバッグ情報を分析し、以下のJSON形式でフィードバックを提供してください：
{
  "solution": {
    "code": "改善された回答やコード（面接で直接使える形）",
    "problem_statement": "問題や状況の再確認（日本語）",
    "context": "関連する背景や文脈（日本語）",
    "suggested_responses": ["改善された面接回答例1", "改善された面接回答例2", "改善された面接回答例3"],
    "reasoning": "改善理由と適切性の説明（日本語）"
  }
}

重要：JSONオブジェクトのみを返し、マークダウン形式やコードブロックは使用しないでください。すべての内容は日本語で、面接で直接使える簡潔で明確な形式にしてください。`

      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed debug LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("Error debugging solution with images:", error)
      throw error
    }
  }

  public async analyzeAudioFile(audioPath: string, collectionId?: string) {
    try {
      const audioData = await fs.promises.readFile(audioPath);
      const audioPart = {
        inlineData: {
          data: audioData.toString("base64"),
          mimeType: "audio/mp3"
        }
      };
      
      // First, extract the text content from audio
      const transcriptionPrompt = `この音声ファイルの内容を正確に文字起こししてください。技術的な質問や面接に関連する内容があれば、それを明確に抽出してください。`;
      
      const transcriptionResult = await this.model.generateContent([transcriptionPrompt, audioPart]);
      const transcriptionResponse = await transcriptionResult.response;
      const transcribedText = transcriptionResponse.text();
      
      // If we have a collection ID, use RAG to enhance the response
      if (collectionId && this.qnaService) {
        const ragContext = await this.searchRAGContext(transcribedText, collectionId);
        const enhancedPrompt = this.formatRAGPrompt(transcribedText, ragContext);
        
        const result = await this.model.generateContent(enhancedPrompt);
        const response = await result.response;
        let text = response.text();
        text = this.cleanResponseText(text);
        return { text, timestamp: Date.now(), ragContext };
      } else {
        // Use basic audio analysis without RAG
        const prompt = `${this.systemPrompt}

音声内容: ${transcribedText}

上記の音声内容を分析し、面接で使える形で日本語で回答してください。音声の内容を簡潔に説明し、必要に応じて関連する技術的な補足や面接での回答例を提供してください。`;
        
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        text = this.cleanResponseText(text);
        return { text, timestamp: Date.now() };
      }
    } catch (error) {
      console.error("Error analyzing audio file:", error);
      throw error;
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string, collectionId?: string) {
    try {
      // Debug logging for RAG functionality
      console.log('[LLMHelper] analyzeAudioFromBase64 Debug:', {
        hasCollectionId: !!collectionId,
        collectionId: collectionId,
        hasQnAService: !!this.qnaService,
        mimeType: mimeType
      });
      
      const audioPart = {
        inlineData: {
          data,
          mimeType
        }
      };
      
      // First, extract the text content from audio
      const transcriptionPrompt = `この音声ファイルの内容を正確に文字起こししてください。技術的な質問や面接に関連する内容があれば、それを明確に抽出してください。`;
      
      const transcriptionResult = await this.model.generateContent([transcriptionPrompt, audioPart]);
      const transcriptionResponse = await transcriptionResult.response;
      const transcribedText = transcriptionResponse.text();
      
      console.log('[LLMHelper] Transcription result:', {
        transcribedTextLength: transcribedText.length,
        transcribedText: transcribedText.substring(0, 100) + '...' // First 100 chars for debugging
      });
      
      // If we have a collection ID, use RAG to enhance the response
      if (collectionId && this.qnaService) {
        console.log('[LLMHelper] Using RAG enhancement with collection:', collectionId);
        const ragContext = await this.searchRAGContext(transcribedText, collectionId);
        
        console.log('[LLMHelper] RAG context result:', {
          hasContext: ragContext.hasContext,
          resultsCount: ragContext.results.length,
          collectionName: ragContext.collectionName
        });
        
        const enhancedPrompt = this.formatRAGPrompt(transcribedText, ragContext);
        
        const result = await this.model.generateContent(enhancedPrompt);
        const response = await result.response;
        let text = response.text();
        text = this.cleanResponseText(text);
        
        console.log('[LLMHelper] RAG-enhanced response generated, length:', text.length);
        return { text, timestamp: Date.now(), ragContext };
      } else {
        console.log('[LLMHelper] Using basic audio analysis without RAG - Conditions not met:', {
          hasCollectionId: !!collectionId,
          collectionIdValue: collectionId,
          hasQnAService: !!this.qnaService,
          qnaServiceType: this.qnaService?.constructor?.name || 'undefined'
        });
        // Use basic audio analysis without RAG
        const prompt = `${this.systemPrompt}

音声内容: ${transcribedText}

上記の音声内容を分析し、面接で使える形で日本語で回答してください。音声の内容を簡潔に説明し、必要に応じて関連する技術的な補足や面接での回答例を提供してください。`;
        
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        text = this.cleanResponseText(text);
        return { text, timestamp: Date.now() };
      }
    } catch (error) {
      console.error("Error analyzing audio from base64:", error);
      throw error;
    }
  }

  public async analyzeImageFile(imagePath: string) {
    try {
      const imageData = await fs.promises.readFile(imagePath);
      const imagePart = {
        inlineData: {
          data: imageData.toString("base64"),
          mimeType: "image/png"
        }
      };
      const prompt = `${this.systemPrompt}

この画像の内容を分析し、面接で使える形で日本語で回答してください。画像に含まれる技術的な内容や質問があれば、それに対する適切な回答を提供してください。簡潔で実用的な内容にしてください。`;
      
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      let text = response.text();
      text = this.cleanResponseText(text);
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing image file:", error);
      throw error;
    }
  }

  public async chatWithGemini(message: string): Promise<string> {
    try {
      const enhancedPrompt = `${this.systemPrompt}

ユーザーの質問: ${message}

上記の質問に対して、面接で直接使える形で日本語で回答してください。回答は完結で実用的にし、面接官に対して自然に話せる内容にしてください。`;
      
      const result = await this.model.generateContent(enhancedPrompt);
      const response = await result.response;
      let text = response.text();
      
      // Clean up any unwanted phrases
      text = this.cleanResponseText(text);
      
      return text;
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithGemini:", error);
      throw error;
    }
  }

  public setQnAService(qnaService: QnAService) {
    this.qnaService = qnaService
  }

  public setDocumentService(documentService: DocumentService) {
    this.documentService = documentService
  }

  private async searchRAGContext(
    message: string, 
    collectionId?: string
  ): Promise<RAGContext> {
    if (!collectionId) {
      return { hasContext: false, results: [], type: 'qna' }
    }

    // All IDs are now collection IDs in the unified file system
    // Collections can contain both QnA pairs and documents
    console.log(`[LLMHelper] Processing collection search - collectionId: ${collectionId}`)
    
    if (this.qnaService) {
      // Handle collection search (unified system with both QnA and document content)
      try {
        const searchResults = await this.qnaService.findRelevantAnswers(
          message,
          collectionId,
          0.6 // Reasonable similarity threshold for better recall
        )

        console.log(`[LLMHelper] Collection RAG search for "${message}" found ${searchResults.answers.length} results`)
        if (searchResults.answers.length > 0) {
          console.log(`[LLMHelper] Best match similarity: ${searchResults.answers[0].similarity.toFixed(3)}`)
        }

        return {
          hasContext: searchResults.hasRelevantAnswers,
          results: searchResults.answers,
          collectionName: collectionId,
          type: 'qna'
        }
      } catch (error) {
        console.error('[LLMHelper] Error searching collection context:', error)
        return { hasContext: false, results: [], type: 'qna' }
      }
    }

    return { hasContext: false, results: [], type: 'qna' }
  }

  private formatRAGPrompt(message: string, ragContext: RAGContext): string {
    if (!ragContext.hasContext) {
      return `${this.systemPrompt}

質問: ${message}

上記の形式で回答してください。`
    }

    let contextInfo = ''
    
    if (ragContext.type === 'qna' && ragContext.results.length > 0) {
      contextInfo = ragContext.results
        .map((result, index) => {
          return `【関連知識 ${index + 1}】\nQ: ${result.question}\nA: ${result.answer}\n類似度: ${(result.similarity * 100).toFixed(1)}%`
        })
        .join('\n\n')
    } else if (ragContext.type === 'document' && ragContext.documentChunks && ragContext.documentChunks.length > 0) {
      contextInfo = ragContext.documentChunks
        .map((chunk, index) => {
          return `【文書情報 ${index + 1}】\n内容: ${chunk.chunk_text}\n類似度: ${(chunk.similarity * 100).toFixed(1)}%`
        })
        .join('\n\n')
    }

    return `${this.systemPrompt}

関連情報:
${contextInfo}

質問: ${message}

上記の情報を活用し、指定の形式で回答してください。`
  }

  public async chatWithRAG(
    message: string,
    collectionId?: string
  ): Promise<{ response: string; ragContext: RAGContext }> {
    try {
      // Search for relevant context if collection is specified
      const ragContext = await this.searchRAGContext(message, collectionId)
      
      // Format the prompt with RAG context if available
      const enhancedPrompt = this.formatRAGPrompt(message, ragContext)
      
      const result = await this.model.generateContent(enhancedPrompt)
      const response = await result.response
      let text = response.text()
      
      // Clean up any unwanted phrases
      text = this.cleanResponseText(text)
      
      return {
        response: text,
        ragContext
      }
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithRAG:", error)
      throw error
    }
  }

  /**
   * Chat with RAG support using streaming for better UX
   * Calls onChunk callback for each token received
   */
  public async chatWithRAGStreaming(
    message: string,
    collectionId: string | undefined,
    onChunk: (chunk: string) => void
  ): Promise<{ response: string; ragContext: RAGContext; performance?: { firstChunkLatency: number | null } }> {
    try {
      const startTime = Date.now();
      console.log(`[LLMHelper] Starting streaming response with model ${this.modelName}...`);

      // Search for relevant context if collection is specified
      const ragContext = await this.searchRAGContext(message, collectionId);
      const ragTime = Date.now();
      console.log(`[LLMHelper] RAG search completed in ${ragTime - startTime}ms`);

      // Format the prompt with RAG context if available
      const enhancedPrompt = this.formatRAGPrompt(message, ragContext);

      // Use streaming API
      const result = await this.model.generateContentStream(enhancedPrompt);
      const apiCallTime = Date.now();
      console.log(`[LLMHelper] API call initiated in ${apiCallTime - ragTime}ms`);

      let fullResponse = '';
      let chunkCount = 0;
      let firstChunkTime: number | null = null;

      // Stream chunks as they arrive
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();

        if (!firstChunkTime) {
          firstChunkTime = Date.now();
          const firstChunkLatency = firstChunkTime - apiCallTime;
          console.log(`[LLMHelper] First chunk received in ${firstChunkLatency}ms`);
        }

        fullResponse += chunkText;
        chunkCount++;

        // Send chunk to callback immediately with timestamp
        const chunkTime = Date.now();
        console.log(`[LLMHelper] Chunk ${chunkCount} (${chunkText.length} chars) at ${chunkTime - startTime}ms`);
        onChunk(chunkText);
      }

      // Clean up the complete response
      const cleanedResponse = this.cleanResponseText(fullResponse);
      const totalTime = Date.now() - startTime;

      console.log(`[LLMHelper] Streaming complete:`);
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Total chunks: ${chunkCount}`);
      console.log(`  - Response length: ${cleanedResponse.length} chars`);
      console.log(`  - Chars per second: ${Math.round((cleanedResponse.length / totalTime) * 1000)}`);

      return {
        response: cleanedResponse,
        ragContext,
        performance: {
          firstChunkLatency: firstChunkTime ? firstChunkTime - apiCallTime : null
        }
      };
    } catch (error) {
      console.error('[LLMHelper] Error in chatWithRAGStreaming:', error);

      // Add streaming error code for fallback handling
      const streamingError = error as any;
      streamingError.code = 'STREAMING_ERROR';
      streamingError.message = `Streaming failed: ${streamingError.message}`;

      throw streamingError;
    }
  }

  private cleanResponseText(text: string): string {
    // Remove forbidden prefixes (meta-commentary about interview format)
    text = text.replace(/^はい、[^。]*面接官[^。]*お伝え[^。]*形で[^。]*私?[がは]?[、。]/i, "");
    text = text.replace(/^はい、[^。]{0,30}(お答え|説明|回答)[^。]*[。、]/i, "");
    
    // Remove English phrases about information sources
    text = text.replace(/I found relevant information|I'm using information from|Based on the information provided|According to the sources/gi, "");
    text = text.replace(/Let me search for relevant information|Let me check the relevant information/gi, "");
    
    // Remove Japanese phrases about information sources
    text = text.replace(/📚 \*Found \d+ relevant reference\(s\)\*\n\n/g, "");
    text = text.replace(/関連情報が見つかりました|参考情報によると|情報源によると|検索結果によると/g, "");
    text = text.replace(/以下が回答になります[。：]/g, "");
    text = text.replace(/回答いたします[。：]/g, "");
    text = text.replace(/説明いたします[。：]/g, "");
    text = text.replace(/お答えします[。：]/g, "");
    
    // Remove redundant introductory phrases
    text = text.replace(/^(それでは、|では、|まず、)/g, "");
    
    // Clean up extra whitespace
    text = text.replace(/\n{3,}/g, "\n\n");
    text = text.trim();
    
    return text;
  }

  // Mode support methods
  private modeManager: ModeManager = new ModeManager()

  public async chatWithMode(
    message: string,
    modeKey: string = 'interview',
    collectionId?: string
  ): Promise<CompatibleResponse> {
    try {
      // Search for relevant context if collection is specified
      const ragContext = await this.searchRAGContext(message, collectionId)
      
      // Build mode-specific system prompt
      const systemPrompt = this.modeManager.buildSystemPrompt(modeKey)
      
      // Format the prompt with RAG context if available
      const enhancedPrompt = this.formatModePrompt(message, ragContext, systemPrompt)
      
      const result = await this.model.generateContent(enhancedPrompt)
      const response = await result.response
      let text = response.text()
      
      // Try to parse as ModeResponse first
      const modeResponse = this.modeManager.parseResponse(text)
      
      if (modeResponse) {
        return this.modeManager.createCompatibleResponse(text, modeResponse, ragContext)
      } else {
        // Fallback to plain text processing
        text = this.cleanResponseText(text)
        return this.modeManager.createCompatibleResponse(text, null, ragContext)
      }
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithMode:", error)
      throw error
    }
  }

  private formatModePrompt(message: string, ragContext: RAGContext, systemPrompt: string): string {
    let contextInfo = ''
    
    if (ragContext.hasContext) {
      if (ragContext.type === 'qna' && ragContext.results.length > 0) {
        contextInfo = ragContext.results
          .map((result, index) => {
            return `【関連知識 ${index + 1}】\nQ: ${result.question}\nA: ${result.answer}\n類似度: ${(result.similarity * 100).toFixed(1)}%`
          })
          .join('\n\n')
      } else if (ragContext.type === 'document' && ragContext.documentChunks && ragContext.documentChunks.length > 0) {
        contextInfo = ragContext.documentChunks
          .map((chunk, index) => {
            return `【文書情報 ${index + 1}】\n内容: ${chunk.chunk_text}\n類似度: ${(chunk.similarity * 100).toFixed(1)}%`
          })
          .join('\n\n')
      }
    }

    let prompt = systemPrompt

    if (contextInfo) {
      prompt += `\n\n## 利用可能な関連情報：\n${contextInfo}`
    }

    prompt += `

## ユーザーの質問：
${message}

上記の質問に対して、指定されたモードの設定に従って回答してください。`

    return prompt
  }

  public getModeManager(): ModeManager {
    return this.modeManager
  }
}