import { autoUpdater } from 'electron-updater';
import { dialog, BrowserWindow } from 'electron';
import { Logger } from '../utils/Logger';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export class AutoUpdateManager {
  private checkInterval: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;
  private isUpdateAvailable = false;
  private isUpdateDownloaded = false;

  constructor() {
    this.setupAutoUpdater();
  }

  /**
   * Setup auto-updater configuration and event listeners
   */
  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = true; // Auto-download updates
    autoUpdater.autoInstallOnAppQuit = true; // Auto-install on quit

    // Development mode skip
    if (process.env.NODE_ENV === 'development') {
      Logger.info('[AutoUpdate] Development mode - updater disabled');
      return;
    }

    // Update available event
    autoUpdater.on('update-available', (info) => {
      Logger.info('[AutoUpdate] Update available:', info.version);
      this.isUpdateAvailable = true;
      this.notifyUpdateAvailable(info);
    });

    // Update not available event
    autoUpdater.on('update-not-available', () => {
      Logger.info('[AutoUpdate] No updates available');
    });

    // Download progress event
    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Downloaded ${progressObj.percent.toFixed(2)}% (${progressObj.transferred}/${progressObj.total})`;
      Logger.info('[AutoUpdate]', logMessage);
      
      // Send progress to renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-download-progress', {
          percent: progressObj.percent,
          transferred: progressObj.transferred,
          total: progressObj.total
        });
      }
    });

    // Update downloaded event
    autoUpdater.on('update-downloaded', (info) => {
      Logger.info('[AutoUpdate] Update downloaded:', info.version);
      this.isUpdateDownloaded = true;
      this.notifyUpdateDownloaded(info);
    });

    // Error event
    autoUpdater.on('error', (err) => {
      Logger.error('[AutoUpdate] Error:', err);
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-error', {
          message: err.message || 'Update check failed'
        });
      }
    });

    Logger.info('[AutoUpdate] ✅ Auto-updater configured');
  }

  /**
   * Set main window reference for sending events
   */
  public setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Start checking for updates
   * @param immediate - Check immediately on startup
   */
  public startUpdateChecks(immediate: boolean = true): void {
    if (process.env.NODE_ENV === 'development') {
      Logger.info('[AutoUpdate] Skipping update checks in development');
      return;
    }

    // Check immediately if requested
    if (immediate) {
      // Delay initial check by 3 seconds to let app fully initialize
      setTimeout(() => {
        this.checkForUpdates();
      }, 3000);
    }

    // Setup periodic checks every 4 hours
    const CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, CHECK_INTERVAL);

    Logger.info('[AutoUpdate] ✅ Update checks scheduled (every 4 hours)');
  }

  /**
   * Stop periodic update checks
   */
  public stopUpdateChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      Logger.info('[AutoUpdate] Update checks stopped');
    }
  }

  /**
   * Manually check for updates
   */
  public async checkForUpdates(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      Logger.info('[AutoUpdate] Skipping update check in development');
      return;
    }

    try {
      Logger.info('[AutoUpdate] Checking for updates...');
      
      // Notify renderer that check is starting
      if (this.mainWindow) {
        this.mainWindow.webContents.send('update-checking');
      }

      await autoUpdater.checkForUpdates();
    } catch (error) {
      Logger.error('[AutoUpdate] Failed to check for updates:', error);
    }
  }

  /**
   * Notify renderer that an update is available and downloading
   */
  private notifyUpdateAvailable(info: any): void {
    if (!this.mainWindow) return;

    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    };

    this.mainWindow.webContents.send('update-available', updateInfo);
  }

  /**
   * Notify renderer that update is downloaded and ready to install
   */
  private notifyUpdateDownloaded(info: any): void {
    if (!this.mainWindow) return;

    const updateInfo: UpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    };

    // Send to renderer to show dialog
    this.mainWindow.webContents.send('update-downloaded', updateInfo);
  }

  /**
   * Quit and install the update
   */
  public quitAndInstall(): void {
    if (!this.isUpdateDownloaded) {
      Logger.warn('[AutoUpdate] No update downloaded yet');
      return;
    }

    Logger.info('[AutoUpdate] Quitting and installing update...');
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Get current update status
   */
  public getStatus(): { available: boolean; downloaded: boolean } {
    return {
      available: this.isUpdateAvailable,
      downloaded: this.isUpdateDownloaded
    };
  }
}
