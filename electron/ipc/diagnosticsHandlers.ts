/**
 * Diagnostics IPC Handlers
 * 
 * Provides system diagnostics and debugging information for troubleshooting
 * audio pipeline issues in production builds.
 */

import { ipcMain, systemPreferences, app } from 'electron';
import { DiagnosticLogger } from '../utils/DiagnosticLogger';
import * as fs from 'fs';
import * as path from 'path';
import { shell } from 'electron';

const logger = new DiagnosticLogger('DiagnosticsHandlers');

export function registerDiagnosticsHandlers(): void {
  logger.info('Registering diagnostics IPC handlers');

  /**
   * Test IPC connectivity
   */
  ipcMain.handle('diagnostics-test-ipc', async () => {
    logger.info('IPC connectivity test called');
    return {
      success: true,
      timestamp: Date.now(),
      process: 'main',
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      appVersion: app.getVersion(),
      isPackaged: app.isPackaged
    };
  });

  /**
   * Get system information
   */
  ipcMain.handle('diagnostics-get-system-info', async () => {
    logger.info('System info requested');
    
    const info = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      versions: {
        node: process.versions.node,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        v8: process.versions.v8
      },
      app: {
        version: app.getVersion(),
        name: app.getName(),
        isPackaged: app.isPackaged,
        path: app.getAppPath()
      },
      paths: {
        cwd: process.cwd(),
        execPath: process.execPath,
        resourcesPath: process.resourcesPath,
        userData: app.getPath('userData'),
        logs: app.getPath('logs')
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasGemini: !!process.env.GEMINI_API_KEY,
        hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL
      }
    };

    logger.debug('System info', info);
    return info;
  });

  /**
   * Check permission status (macOS only)
   */
  ipcMain.handle('diagnostics-check-permissions', async () => {
    logger.info('Permission status check requested');
    
    if (process.platform !== 'darwin') {
      return {
        platform: process.platform,
        supported: false,
        message: 'Permission checking only supported on macOS'
      };
    }

    try {
      const micStatus = systemPreferences.getMediaAccessStatus('microphone');
      const screenStatus = systemPreferences.getMediaAccessStatus('screen');

      const result = {
        platform: 'darwin',
        supported: true,
        microphone: {
          status: micStatus,
          granted: micStatus === 'granted',
          denied: micStatus === 'denied',
          notDetermined: micStatus === 'not-determined'
        },
        screenCapture: {
          status: screenStatus,
          granted: screenStatus === 'granted',
          denied: screenStatus === 'denied',
          notDetermined: screenStatus === 'not-determined'
        }
      };

      logger.info('Permission status', result);
      return result;
    } catch (error) {
      logger.error('Error checking permissions', error);
      throw error;
    }
  });

  /**
   * Request microphone permission (macOS only)
   */
  ipcMain.handle('diagnostics-request-microphone', async () => {
    logger.info('Microphone permission request');
    
    if (process.platform !== 'darwin') {
      return {
        success: false,
        error: 'Only supported on macOS'
      };
    }

    try {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      logger.info('Microphone permission result', { granted });
      return {
        success: true,
        granted
      };
    } catch (error) {
      logger.error('Error requesting microphone permission', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Request screen recording permission (macOS only)
   */
  ipcMain.handle('diagnostics-request-screen-capture', async () => {
    logger.info('Screen capture permission request');
    
    if (process.platform !== 'darwin') {
      return {
        success: false,
        error: 'Only supported on macOS'
      };
    }

    try {
      // Note: Screen recording permission cannot be requested programmatically
      // User must grant it manually in System Preferences
      // We can only check the status
      const status = systemPreferences.getMediaAccessStatus('screen');
      
      logger.info('Screen capture permission status', { status });
      
      return {
        success: true,
        granted: status === 'granted',
        status,
        requiresManualGrant: true,
        message: 'Screen recording permission must be granted manually in System Preferences > Privacy & Security > Screen Recording. The app must be restarted after granting permission.'
      };
    } catch (error) {
      logger.error('Error checking screen capture permission', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Verify audiotee binary
   */
  ipcMain.handle('diagnostics-verify-audiotee', async () => {
    logger.info('Audiotee binary verification requested');
    
    const possiblePaths = [
      path.join(__dirname, '..', 'node_modules', 'audiotee', 'bin', 'audiotee'),
      path.join(process.cwd(), 'node_modules', 'audiotee', 'bin', 'audiotee'),
      path.join(process.resourcesPath, 'node_modules', 'audiotee', 'bin', 'audiotee'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'audiotee', 'bin', 'audiotee'),
    ];

    const results = [];
    let foundPath: string | null = null;

    for (const binaryPath of possiblePaths) {
      const exists = fs.existsSync(binaryPath);
      let fileInfo = null;

      if (exists) {
        try {
          const stats = fs.statSync(binaryPath);
          const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
          fileInfo = {
            size: stats.size,
            mode: stats.mode.toString(8),
            isFile: stats.isFile(),
            isExecutable
          };
          
          if (!foundPath) {
            foundPath = binaryPath;
          }
        } catch (error) {
          logger.error('Error checking binary stats', error, { path: binaryPath });
        }
      }

      results.push({
        path: binaryPath,
        exists,
        fileInfo
      });
    }

    const result = {
      found: !!foundPath,
      foundPath,
      allPaths: results
    };

    logger.info('Audiotee verification result', result);
    return result;
  });

  /**
   * Get log file path
   */
  ipcMain.handle('diagnostics-get-log-path', async () => {
    const logPath = DiagnosticLogger.getLogPath();
    logger.info('Log path requested', { logPath });
    return {
      success: true,
      path: logPath
    };
  });

  /**
   * Open log file in default application
   */
  ipcMain.handle('diagnostics-open-log-file', async () => {
    try {
      const logPath = DiagnosticLogger.getLogPath();
      logger.info('Opening log file', { logPath });
      
      // Open the log file in the default text editor
      await shell.openPath(logPath);
      
      return {
        success: true,
        path: logPath
      };
    } catch (error) {
      logger.error('Error opening log file', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  /**
   * Open logs folder
   */
  ipcMain.handle('diagnostics-open-logs-folder', async () => {
    try {
      const logPath = DiagnosticLogger.getLogPath();
      const logsFolder = path.dirname(logPath);
      logger.info('Opening logs folder', { logsFolder });
      
      await shell.openPath(logsFolder);
      
      return {
        success: true,
        path: logsFolder
      };
    } catch (error) {
      logger.error('Error opening logs folder', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  logger.info('✅ Diagnostics IPC handlers registered');
}
