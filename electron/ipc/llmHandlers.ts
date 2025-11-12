import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";

// Fast usage checking utility (same as in audioHandlers)
function checkUsageFast(appState: AppState, requiredCount: number = 1): { allowed: boolean; remaining?: number; error?: string } {
  const user = appState.authService.getCurrentUser();
  const accessToken = appState.authService.getAccessToken();

  if (!user || !accessToken) {
    return { allowed: true }; // Allow anonymous usage
  }

  // Use local usage estimation (non-blocking)
  const localUsageCheck = appState.localUsageManager.canUse(requiredCount);

  if (!localUsageCheck.allowed) {
    console.log(`[LLMHandlers] Usage limit exceeded locally - remaining: ${localUsageCheck.remaining}`);
    const error = new Error(localUsageCheck.error || 'Usage limit exceeded');
    (error as any).code = 'USAGE_LIMIT_EXCEEDED';
    (error as any).remaining = localUsageCheck.remaining || 0;
    throw error;
  }

  console.log(`[LLMHandlers] Local usage check passed - remaining: ${localUsageCheck.remaining}`);
  return localUsageCheck;
}

// Post-processing usage tracking utility
function trackUsagePostProcessing(appState: AppState, count: number = 1, type: 'question' | 'other' = 'question'): void {
  const user = appState.authService.getCurrentUser();
  const accessToken = appState.authService.getAccessToken();

  if (user && accessToken) {
    console.log('[LLMHandlers] Tracking usage post-processing (non-blocking)');
    appState.localUsageManager.trackUsage(count, type);

    // Trigger background sync after a small delay
    setTimeout(() => {
      appState.localUsageManager.forceSync(accessToken);
    }, 1000);
  }
}

/**
 * LLM and AI processing IPC handlers
 * Handles Gemini chat, RAG, modes, and image analysis
 */
export function registerLLMHandlers(appState: AppState): void {
  // Analyze image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      console.log('[LLMHandlers] analyze-image-file - starting fast usage check...');

      // FAST: Use local usage estimation (non-blocking)
      checkUsageFast(appState, 1);

      const result = await appState.processingHelper.getLLMHelper().analyzeImageFile(path);

      // POST-PROCESSING: Track usage after successful analysis
      trackUsagePostProcessing(appState, 1, 'question');
      return result;
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error);
      throw error;
    }
  });

  // Basic Gemini chat
  ipcMain.handle("gemini-chat", async (event, message: string) => {
    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // FAST: Use local usage estimation (non-blocking)
        checkUsageFast(appState, 1);
      }

      const result = await appState.processingHelper.getLLMHelper().chatWithGemini(message);

      // POST-PROCESSING: Track usage after successful chat
      trackUsagePostProcessing(appState, 1, 'question');

      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat handler:", error);
      throw error;
    }
  });

  // Mode-enabled chat handler
  ipcMain.handle("gemini-chat-mode", async (event, message: string, modeKey: string = 'interview', collectionId?: string) => {
    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // FAST: Use local usage estimation (non-blocking)
        checkUsageFast(appState, 1);
      }

      const result = await appState.processingHelper.getLLMHelper().chatWithMode(message, modeKey, collectionId);

      // POST-PROCESSING: Track usage after successful chat
      trackUsagePostProcessing(appState, 1, 'question');

      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat-mode handler:", error);
      throw error;
    }
  });

  // Get available modes
  ipcMain.handle("get-available-modes", async () => {
    try {
      return appState.processingHelper.getLLMHelper().getModeManager().getModeOptions();
    } catch (error: any) {
      console.error("Error in get-available-modes handler:", error);
      throw error;
    }
  });

  // RAG-enabled chat handler
  ipcMain.handle("gemini-chat-rag", async (event, message: string, collectionId?: string) => {
    try {
      const user = appState.authService.getCurrentUser();
      const accessToken = appState.authService.getAccessToken();
      
      if (user && accessToken) {
        // FAST: Use local usage estimation (non-blocking)
        checkUsageFast(appState, 1);
      }

      const result = await appState.processingHelper.getLLMHelper().chatWithRAG(message, collectionId);

      // POST-PROCESSING: Track usage after successful chat
      trackUsagePostProcessing(appState, 1, 'question');

      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat-rag handler:", error);
      throw error;
    }
  });
}
