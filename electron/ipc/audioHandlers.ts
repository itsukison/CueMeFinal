import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";
import { Logger } from "../utils/Logger";

/**
 * Audio processing and streaming IPC handlers
 * Handles audio analysis, streaming, and system audio capture
 */
export function registerAudioHandlers(appState: AppState): void {
  // Analyze audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string, collectionId?: string) => {
    try {
      // Check if user is authenticated and try usage tracking (optional)
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // Check usage limits for 1 question (audio analysis counts as 1 user question)
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }
        
        if (usageCheck.remaining !== undefined && usageCheck.remaining < 1) {
          const error = new Error(`Insufficient usage remaining. This operation requires 1 question but only ${usageCheck.remaining} remaining.`);
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining;
          throw error;
        }

        // Increment usage by 1
        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken, 1);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
        }
      }

      const result = await appState.processingHelper.processAudioBase64(data, mimeType, collectionId);
      return result;
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error);
      throw error;
    }
  });

  // Analyze audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string, collectionId?: string) => {
    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }
        
        if (usageCheck.remaining !== undefined && usageCheck.remaining < 1) {
          const error = new Error(`Insufficient usage remaining. This operation requires 1 question but only ${usageCheck.remaining} remaining.`);
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining;
          throw error;
        }

        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken, 1);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
        }
      }

      const result = await appState.processingHelper.processAudioFile(path, collectionId);
      return result;
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error);
      throw error;
    }
  });

  // Audio Stream Processing handlers
  ipcMain.handle("audio-stream-start", async (event, audioSourceId?: string) => {
    Logger.info(`[IPC audioHandlers] 🎙️  Received audio-stream-start request with sourceId: ${audioSourceId || 'default'}`);
    try {
      await appState.audioStreamProcessor.startListening(audioSourceId);
      Logger.info('[IPC audioHandlers] ✅ Audio stream started successfully');
      return { success: true };
    } catch (error: any) {
      Logger.error("[IPC audioHandlers] ❌ Error starting audio stream:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("audio-stream-stop", async () => {
    Logger.info('[IPC audioHandlers] 🛑 Received audio-stream-stop request');
    try {
      await appState.audioStreamProcessor.stopListening();
      Logger.info('[IPC audioHandlers] ✅ Audio stream stopped successfully');
      return { success: true };
    } catch (error: any) {
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
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        const usageCheck = await appState.usageTracker.checkCanAskQuestion(accessToken);
        if (!usageCheck.allowed) {
          const error = new Error(usageCheck.error || 'Usage limit exceeded');
          (error as any).code = 'USAGE_LIMIT_EXCEEDED';
          (error as any).remaining = usageCheck.remaining || 0;
          throw error;
        }

        const usageResult = await appState.usageTracker.incrementQuestionUsage(accessToken);
        if (!usageResult.success) {
          console.warn('Usage tracking failed, but continuing with request:', usageResult.error);
        }
      }

      // Use existing LLM helper with RAG if collection ID provided
      let result;
      if (collectionId && appState.processingHelper.getLLMHelper()) {
        result = await appState.processingHelper.getLLMHelper().chatWithRAG(questionText, collectionId);
      } else {
        result = await appState.processingHelper.getLLMHelper().chatWithGemini(questionText);
      }
      
      // Handle different return types
      const response = typeof result === 'string' ? result : result.response;
      return { response, timestamp: Date.now() };
    } catch (error: any) {
      console.error("Error answering question:", error);
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
    try {
      if (!appState.dualAudioManager) {
        return { success: false, error: 'Dual audio manager not initialized. Check GEMINI_API_KEY.' };
      }
      // No sourceId needed - both sources start automatically
      await appState.dualAudioManager.startCapture();
      Logger.info('[IPC audioHandlers] ✅ Dual audio capture started successfully (microphone + system audio)');
      return { success: true };
    } catch (error: any) {
      Logger.error("[IPC audioHandlers] ❌ Error starting dual audio capture:", error);
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
