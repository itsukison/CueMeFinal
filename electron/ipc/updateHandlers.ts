import { ipcMain } from "electron";
import type { AppState } from "../core/AppState";

/**
 * Register auto-update IPC handlers
 */
export function registerUpdateHandlers(appState: AppState): void {
  console.log('[IPC] Registering update handlers...');

  // Install update and quit
  ipcMain.handle('update-install', async () => {
    try {
      const autoUpdateManager = appState.getAutoUpdateManager();
      if (!autoUpdateManager) {
        throw new Error('Auto-update manager not initialized');
      }

      autoUpdateManager.quitAndInstall();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error installing update:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Manually check for updates
  ipcMain.handle('update-check', async () => {
    try {
      const autoUpdateManager = appState.getAutoUpdateManager();
      if (!autoUpdateManager) {
        throw new Error('Auto-update manager not initialized');
      }

      await autoUpdateManager.checkForUpdates();
      return { success: true };
    } catch (error) {
      console.error('[IPC] Error checking for updates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get update status
  ipcMain.handle('update-get-status', async () => {
    try {
      const autoUpdateManager = appState.getAutoUpdateManager();
      if (!autoUpdateManager) {
        return { available: false, downloaded: false };
      }

      return autoUpdateManager.getStatus();
    } catch (error) {
      console.error('[IPC] Error getting update status:', error);
      return { available: false, downloaded: false };
    }
  });

  console.log('[IPC] ✅ Update handlers registered');
}
