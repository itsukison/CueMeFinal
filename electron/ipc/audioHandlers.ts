import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";
import { Logger } from "../utils/Logger";
import { DiagnosticLogger } from "../utils/DiagnosticLogger";

const diagLogger = new DiagnosticLogger('AudioHandlers');

// Fast usage checking utility
function checkUsageFast(appState: AppState, requiredCount: number = 1): { allowed: boolean; remaining?: number; error?: string } {
  const user = appState.authService.getCurrentUser();
  const accessToken = appState.authService.getAccessToken();

  if (!user || !accessToken) {
    return { allowed: true }; // Allow anonymous usage
  }

  // Use local usage estimation (non-blocking)
  const localUsageCheck = appState.localUsageManager.canUse(requiredCount);

  if (!localUsageCheck.allowed) {
    console.log(`[AudioHandlers] Usage limit exceeded locally - remaining: ${localUsageCheck.remaining}`);
    const error = new Error(localUsageCheck.error || 'Usage limit exceeded');
    (error as any).code = 'USAGE_LIMIT_EXCEEDED';
    (error as any).remaining = localUsageCheck.remaining || 0;
    throw error;
  }

  console.log(`[AudioHandlers] Local usage check passed - remaining: ${localUsageCheck.remaining}`);
  return localUsageCheck;
}

// Post-processing usage tracking utility
function trackUsagePostProcessing(appState: AppState, count: number = 1, type: 'question' | 'other' = 'question'): void {
  const user = appState.authService.getCurrentUser();
  const accessToken = appState.authService.getAccessToken();

  if (user && accessToken) {
    console.log('[AudioHandlers] Tracking usage post-processing (non-blocking)');
    appState.localUsageManager.trackUsage(count, type);

    // Trigger background sync after a small delay
    setTimeout(() => {
      appState.localUsageManager.forceSync(accessToken);
    }, 1000);
  }
}

/**
 * Audio processing and streaming IPC handlers
 * Handles audio analysis, streaming, and system audio capture
 */
export function registerAudioHandlers(appState: AppState): void {
  // Analyze audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string, collectionId?: string) => {
    try {
      console.log('[AudioHandlers] analyze-audio-base64 - starting fast usage check...');
      const startTime = Date.now();

      // FAST: Use local usage estimation (non-blocking)
      checkUsageFast(appState, 1);

      const result = await appState.processingHelper.processAudioBase64(data, mimeType, collectionId);

      // POST-PROCESSING: Track usage after successful audio analysis
      trackUsagePostProcessing(appState, 1, 'question');

      console.log(`[AudioHandlers] analyze-audio-base64 completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error);
      throw error;
    }
  });

  // Analyze audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string, collectionId?: string) => {
    try {
      console.log('[AudioHandlers] analyze-audio-file - starting fast usage check...');
      const startTime = Date.now();

      // FAST: Use local usage estimation (non-blocking)
      checkUsageFast(appState, 1);

      const result = await appState.processingHelper.processAudioFile(path, collectionId);

      // POST-PROCESSING: Track usage after successful audio analysis
      trackUsagePostProcessing(appState, 1, 'question');

      console.log(`[AudioHandlers] analyze-audio-file completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error);
      throw error;
    }
  });

  // Audio Stream Processing handlers
  ipcMain.handle("audio-stream-start", async (event, audioSourceId?: string) => {
    diagLogger.info(`IPC: audio-stream-start called`, { audioSourceId: audioSourceId || 'default' });
    Logger.info(`[IPC audioHandlers] 🎙️  Received audio-stream-start request with sourceId: ${audioSourceId || 'default'}`);
    try {
      await appState.audioStreamProcessor.startListening(audioSourceId);
      diagLogger.info('✅ Audio stream started successfully');
      Logger.info('[IPC audioHandlers] ✅ Audio stream started successfully');
      return { success: true };
    } catch (error: any) {
      diagLogger.error("Error starting audio stream", error, { audioSourceId });
      Logger.error("[IPC audioHandlers] ❌ Error starting audio stream:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("audio-stream-stop", async () => {
    diagLogger.info('IPC: audio-stream-stop called');
    Logger.info('[IPC audioHandlers] 🛑 Received audio-stream-stop request');
    try {
      await appState.audioStreamProcessor.stopListening();
      diagLogger.info('✅ Audio stream stopped successfully');
      Logger.info('[IPC audioHandlers] ✅ Audio stream stopped successfully');
      return { success: true };
    } catch (error: any) {
      diagLogger.error("Error stopping audio stream", error);
      Logger.error("[IPC audioHandlers] ❌ Error stopping audio stream:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("audio-stream-process-chunk", async (event, audioData: Float32Array) => {
    try {
      console.log('[IPC] Received audio chunk, samples:', audioData.length);
      
      // Convert Float32Array to Buffer for AudioStreamProcessor
      const buffer = Buffer.alloc(audioData.length * 2);
      for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        buffer.writeInt16LE(sample, i * 2);
      }
      
      await appState.audioStreamProcessor.processAudioChunk(buffer);
      return { success: true };
    } catch (error: any) {
      console.error("Error processing audio chunk:", error);
      return { success: false, error: error.message };
    }
  });

  // Process microphone audio chunk from renderer (new MicrophoneCapture service)
  let micChunkCount = 0;
  let lastMicLogTime = Date.now();
  
  ipcMain.handle("audio-process-microphone-chunk", async (event, audioData: Float32Array) => {
    try {
      micChunkCount++;
      
      // Log first chunk and then every 100 chunks
      if (micChunkCount === 1) {
        diagLogger.info('✅ First microphone chunk received from renderer', {
          sampleCount: audioData.length,
          sampleRate: '16000 (assumed)',
          duration: `${(audioData.length / 16000).toFixed(3)}s`
        });
      } else if (micChunkCount % 100 === 0) {
        const now = Date.now();
        const elapsed = now - lastMicLogTime;
        diagLogger.debug(`Microphone chunks: ${micChunkCount} total, ${elapsed}ms since last log`);
        lastMicLogTime = now;
      }
      
      // Convert Float32Array to Buffer for AudioStreamProcessor
      const buffer = Buffer.alloc(audioData.length * 2);
      for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        buffer.writeInt16LE(sample, i * 2);
      }
      
      await appState.audioStreamProcessor.processAudioChunk(buffer);
      return { success: true };
    } catch (error: any) {
      diagLogger.error("Error processing microphone chunk", error, {
        chunkNumber: micChunkCount,
        sampleCount: audioData?.length
      });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("audio-stream-get-state", async () => {
    try {
      return appState.audioStreamProcessor.getState();
    } catch (error: any) {
      console.error("Error getting audio stream state:", error);
      throw error;
    }
  });

  ipcMain.handle("audio-stream-get-questions", async () => {
    try {
      return appState.audioStreamProcessor.getQuestions();
    } catch (error: any) {
      console.error("Error getting detected questions:", error);
      throw error;
    }
  });

  ipcMain.handle("audio-stream-clear-questions", async () => {
    try {
      appState.audioStreamProcessor.clearQuestions();
      return { success: true };
    } catch (error: any) {
      console.error("Error clearing questions:", error);
      return { success: false, error: error.message };
    }
  });

  // Generate answers to detected questions using RAG system
  ipcMain.handle("audio-stream-answer-question", async (event, questionText: string, collectionId?: string) => {
    try {
      console.log('[AudioHandlers] audio-stream-answer-question - starting fast usage check...');
      const startTime = Date.now();

      // FAST: Use local usage estimation (non-blocking)
      checkUsageFast(appState, 1);

      // Use existing LLM helper with RAG if collection ID provided
      let result;
      if (collectionId && appState.processingHelper.getLLMHelper()) {
        result = await appState.processingHelper.getLLMHelper().chatWithRAG(questionText, collectionId);
      } else {
        result = await appState.processingHelper.getLLMHelper().chatWithGemini(questionText);
      }
      
      // Handle different return types
      const response = typeof result === 'string' ? result : result.response;

      // POST-PROCESSING: Track usage after successful response
      trackUsagePostProcessing(appState, 1, 'question');

      console.log(`[AudioHandlers] audio-stream-answer-question completed in ${Date.now() - startTime}ms`);
      return { response, timestamp: Date.now() };
    } catch (error: any) {
      console.error("Error answering question:", error);
      throw error;
    }
  });

  // Generate answers with streaming for better UX
  ipcMain.handle("audio-stream-answer-question-streaming", async (event, questionText: string, collectionId?: string) => {
    const startTime = Date.now();
    let usageTrackingTime = 0;

    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();

      if (user && accessToken) {
        console.log('[AudioHandlers] Starting fast usage check with LocalUsageManager...');
        const usageStartTime = Date.now();

        // FAST: Use local usage estimation (non-blocking)
        const localUsageCheck = appState.localUsageManager.canUse(1);
        usageTrackingTime = Date.now() - usageStartTime;

        if (!localUsageCheck.allowed) {
          console.log('[AudioHandlers] Usage limit exceeded locally');
          const error = new Error(localUsageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = localUsageCheck.remaining || 0;
          throw error;
        }

        console.log(`[AudioHandlers] Local usage check passed in ${usageTrackingTime}ms, remaining: ${localUsageCheck.remaining}`);

        // POST-PROCESSING: Track usage after successful response (non-blocking)
        // We'll track usage after the LLM response succeeds
      }

      const llmStartTime = Date.now();
      const llmHelper = appState.processingHelper.getLLMHelper();

      console.log(`[AudioHandlers] Starting LLM streaming... Total prep time: ${Date.now() - startTime}ms`);

      // Use streaming API with callback to send chunks to renderer
      const result = await llmHelper.chatWithRAGStreaming(
        questionText,
        collectionId,
        (chunk: string) => {
          // Send each chunk to the renderer process
          event.sender.send('audio-stream-answer-chunk', chunk);
        }
      );

      const llmEndTime = Date.now();
      const llmProcessingTime = llmEndTime - llmStartTime;

      // POST-PROCESSING: Track usage now that we have a successful response
      if (user && accessToken) {
        console.log('[AudioHandlers] Tracking usage post-processing (non-blocking)');
        appState.localUsageManager.trackUsage(1, 'question');

        // Trigger background sync if needed
        setTimeout(() => {
          appState.localUsageManager.forceSync(accessToken);
        }, 1000); // Small delay to not interfere with streaming
      }

      const totalTime = Date.now() - startTime;

      console.log(`[AudioHandlers] Performance metrics:`);
      console.log(`  - Usage tracking time: ${usageTrackingTime}ms`);
      console.log(`  - LLM processing time: ${llmProcessingTime}ms`);
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Performance improvement: ${usageTrackingTime < 100 ? '✅ Excellent' : usageTrackingTime < 500 ? '✅ Good' : '⚠️ Needs improvement'}`);

      // Return final response with performance data
      return {
        response: result.response,
        ragContext: result.ragContext,
        timestamp: Date.now(),
        performance: {
          usageTrackingTime,
          llmProcessingTime,
          totalTime,
          firstChunkLatency: result.performance?.firstChunkLatency // Add this from LLMHelper if available
        }
      };
    } catch (error: any) {
      console.error("Error answering question with streaming:", error);
      throw error;
    }
  });

  // System Audio Capture handlers
  ipcMain.handle("audio-get-sources", async () => {
    try {
      const sources = await appState.audioStreamProcessor.getAvailableAudioSources();
      return { success: true, sources };
    } catch (error: any) {
      console.error("Error getting audio sources:", error);
      return { success: false, error: error.message, sources: [] };
    }
  });

  ipcMain.handle("audio-switch-source", async (event, sourceId: string) => {
    try {
      await appState.audioStreamProcessor.switchAudioSource(sourceId);
      return { success: true };
    } catch (error: any) {
      console.error("Error switching audio source:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("audio-request-permissions", async () => {
    try {
      const result = await appState.audioStreamProcessor.requestAudioPermissions();
      return result;
    } catch (error: any) {
      console.error("Error requesting audio permissions:", error);
      return { granted: false, error: error.message };
    }
  });

  ipcMain.handle("audio-check-system-support", async () => {
    try {
      // System audio is supported on macOS 14.2+ via audioteejs
      // Check will be done in getAvailableSources()
      return { supported: process.platform === 'darwin' };
    } catch (error: any) {
      console.error("Error checking system audio support:", error);
      return { supported: false };
    }
  });

  // Dual Audio Capture with Gemini Live handlers
  // AUTOMATIC: Both microphone and system audio are captured simultaneously
  ipcMain.handle("dual-audio-start", async () => {
    Logger.info(`[IPC audioHandlers] 🎙️  Received dual-audio-start request (AUTOMATIC dual capture)`);
    diagLogger.info('IPC: dual-audio-start called');
    
    try {
      diagLogger.info('🔍 Checking dualAudioManager', {
        exists: !!appState.dualAudioManager,
        type: typeof appState.dualAudioManager
      });
      
      if (!appState.dualAudioManager) {
        const error = 'Dual audio manager not initialized. Check GEMINI_API_KEY.';
        Logger.error('[IPC audioHandlers] ❌', error);
        diagLogger.error('Dual audio manager not initialized', new Error(error));
        return { success: false, error };
      }
      
      diagLogger.info('✅ dualAudioManager exists, calling startCapture()...');
      // No sourceId needed - both sources start automatically
      await appState.dualAudioManager.startCapture();
      Logger.info('[IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)');
      diagLogger.info('✅ Dual audio capture started successfully');
      return { success: true };
    } catch (error: any) {
      Logger.error("[IPC audioHandlers] ❌ Error starting dual audio capture:", error);
      diagLogger.error('Error starting dual audio capture', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("dual-audio-stop", async () => {
    Logger.info('[IPC audioHandlers] 🛑 Received dual-audio-stop request');
    try {
      if (!appState.dualAudioManager) {
        return { success: false, error: 'Dual audio manager not initialized' };
      }
      await appState.dualAudioManager.stopCapture();
      Logger.info('[IPC audioHandlers] ✅ Dual audio capture stopped successfully');
      return { success: true };
    } catch (error: any) {
      Logger.error("[IPC audioHandlers] ❌ Error stopping dual audio capture:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("dual-audio-process-microphone-chunk", async (event, audioData: Float32Array) => {
    try {
      if (!appState.dualAudioManager) {
        return { success: false, error: 'Dual audio manager not initialized' };
      }
      
      // Convert Float32Array to Buffer
      const buffer = Buffer.alloc(audioData.length * 2);
      for (let i = 0; i < audioData.length; i++) {
        const sample = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
        buffer.writeInt16LE(sample, i * 2);
      }
      
      await appState.dualAudioManager.processMicrophoneAudio(buffer);
      return { success: true };
    } catch (error: any) {
      console.error("Error processing microphone chunk:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("dual-audio-get-state", async () => {
    try {
      if (!appState.dualAudioManager) {
        return { isCapturing: false, geminiState: null };
      }
      return appState.dualAudioManager.getState();
    } catch (error: any) {
      console.error("Error getting dual audio state:", error);
      throw error;
    }
  });

  ipcMain.handle("dual-audio-get-questions", async () => {
    try {
      if (!appState.dualAudioManager) {
        return [];
      }
      return appState.dualAudioManager.getQuestions();
    } catch (error: any) {
      console.error("Error getting dual audio questions:", error);
      throw error;
    }
  });

  ipcMain.handle("dual-audio-clear-questions", async () => {
    try {
      if (!appState.dualAudioManager) {
        return { success: false, error: 'Dual audio manager not initialized' };
      }
      appState.dualAudioManager.clearQuestions();
      return { success: true };
    } catch (error: any) {
      console.error("Error clearing dual audio questions:", error);
      return { success: false, error: error.message };
    }
  });
}
