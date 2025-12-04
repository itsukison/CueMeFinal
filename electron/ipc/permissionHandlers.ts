import { ipcMain, shell } from "electron";
import type { AppState } from "../core/AppState";

/**
 * Permission management IPC handlers
 * Handles microphone and screen capture permissions
 */
export function registerPermissionHandlers(appState: AppState): void {
  // Check if this is first time setup
  ipcMain.handle("permission-check-first-time", async () => {
    try {
      const isFirstTime = await appState.permissionStorage.isFirstTimeSetup();
      return { isFirstTime };
    } catch (error: any) {
      console.error("Error checking first time setup:", error);
      return { isFirstTime: true }; // Default to first time if error
    }
  });

  // Check current permission status
  ipcMain.handle("permission-check-status", async () => {
    try {
      const status = await appState.permissionStorage.getCurrentPermissionStatus();
      return status;
    } catch (error: any) {
      console.error("Error checking permission status:", error);
      return {
        microphone: 'unknown',
        screenCapture: 'unknown',
        systemAudio: 'unknown'
      };
    }
  });

  // Request microphone permission
  ipcMain.handle("permission-request-microphone", async () => {
    try {
      const granted = await appState.permissionStorage.requestMicrophonePermission();
      return { granted };
    } catch (error: any) {
      console.error("Error requesting microphone permission:", error);
      return { granted: false, error: error.message };
    }
  });

  // OLD permission handlers REMOVED - referenced deleted AudioStreamProcessor
  // permission-request-system-audio, permission-get-diagnostics, permission-attempt-fix
  // TODO: Reimplement if needed using UniversalPermissionManager

  // Open system preferences for permissions
  ipcMain.handle("permission-open-system-preferences", async (event, permissionType?: string) => {
    try {
      if (process.platform === 'darwin') {
        // Default to System Audio instead of Screen Recording
        let url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_SystemAudio';
        
        // Open specific privacy settings based on permission type
        if (permissionType === 'microphone') {
          url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone';
        } else if (permissionType === 'screen') {
          url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';
        } else if (permissionType === 'system-audio') {
          url = 'x-apple.systempreferences:com.apple.preference.security?Privacy_SystemAudio';
        }
        
        console.log('[IPC] Opening macOS system preferences:', url);
        await shell.openExternal(url);
      } else if (process.platform === 'win32') {
        // Open Windows Privacy settings based on permission type
        let url = 'ms-settings:privacy-microphone';
        if (permissionType === 'screen') {
          url = 'ms-settings:privacy-screencapture';
        }
        
        console.log('[IPC] Opening Windows privacy settings:', url);
        await shell.openExternal(url);
      }
      return { success: true };
    } catch (error: any) {
      console.error("Error opening system preferences:", error);
      return { success: false, error: error.message };
    }
  });

  // Mark initial setup as completed
  ipcMain.handle("permission-mark-setup-completed", async () => {
    try {
      const success = await appState.permissionStorage.markInitialSetupCompleted();
      return { success };
    } catch (error: any) {
      console.error("Error marking setup completed:", error);
      return { success: false, error: error.message };
    }
  });

  // Universal Permission Manager handlers
  ipcMain.handle("universal-permission-request", async () => {
    try {
      console.log('[IPC] Universal permission request started...');
      const result = await appState.universalPermissionManager.requestPermissions();
      console.log('[IPC] Universal permission result:', result);
      return result;
    } catch (error: any) {
      console.error("Universal permission request failed:", error);
      return {
        success: false,
        microphone: false,
        screenCapture: false,
        errors: [error.message],
        recommendations: ['Check console for detailed error information']
      };
    }
  });

  ipcMain.handle("universal-permission-status", async () => {
    try {
      const status = await appState.universalPermissionManager.getComprehensiveStatus();
      return { success: true, status };
    } catch (error: any) {
      console.error("Error getting universal permission status:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("universal-permission-first-time-setup", async () => {
    try {
      const result = await appState.universalPermissionManager.showFirstTimeSetup();
      return { success: true, completed: result };
    } catch (error: any) {
      console.error("Error starting first-time setup:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("universal-permission-complete-setup", async () => {
    try {
      await appState.universalPermissionManager.completeFirstTimeSetup();
      return { success: true };
    } catch (error: any) {
      console.error("Error completing first-time setup:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("universal-permission-skip-setup", async () => {
    try {
      appState.universalPermissionManager.skipFirstTimeSetup();
      return { success: true };
    } catch (error: any) {
      console.error("Error skipping first-time setup:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("universal-permission-emergency-reset", async () => {
    try {
      await appState.universalPermissionManager.emergencyReset();
      return { success: true };
    } catch (error: any) {
      console.error("Error in emergency reset:", error);
      return { success: false, error: error.message };
    }
  });

  // Enhanced diagnostic handlers
  ipcMain.handle("run-permission-diagnostics", async () => {
    try {
      console.log('[IPC] Running permission diagnostics...');
      const { spawn } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.join(process.cwd(), 'scripts', 'diagnose-permissions.sh');
      
      // Run diagnostic script in background
      const child = spawn('bash', [scriptPath], {
        detached: true,
        stdio: 'inherit'
      });
      
      child.unref();
      
      return { success: true, message: 'Diagnostic script launched in terminal' };
    } catch (error: any) {
      console.error("Error running diagnostics:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("fix-development-signature", async () => {
    try {
      console.log('[IPC] Fixing development signature...');
      const { execSync } = require('child_process');
      const path = require('path');
      
      const scriptPath = path.join(process.cwd(), 'scripts', 'sign-electron-dev.sh');
      
      // Run signature fix script
      const output = execSync(`bash "${scriptPath}"`, {
        encoding: 'utf8',
        timeout: 30000
      });
      
      console.log('[IPC] Signature fix output:', output);
      
      return { 
        success: true, 
        message: 'Development signature fixed successfully',
        output: output
      };
    } catch (error: any) {
      console.error("Error fixing signature:", error);
      return { 
        success: false, 
        error: error.message,
        message: 'Failed to fix development signature'
      };
    }
  });
}
