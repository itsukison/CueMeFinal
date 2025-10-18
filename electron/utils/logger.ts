import log from 'electron-log';
import { app } from 'electron';

/**
 * Centralized logging utility for production debugging
 * Logs are written to:
 * - macOS: ~/Library/Logs/CueMe/main.log
 * - Windows: %USERPROFILE%\AppData\Roaming\CueMe\logs\main.log
 * - Linux: ~/.config/CueMe/logs/main.log
 */
export class Logger {
  private static initialized = false;

  static initialize() {
    if (this.initialized) return;
    
    // Configure log levels
    log.transports.file.level = 'info';
    log.transports.console.level = 'debug';
    
    // Set log file name
    log.transports.file.fileName = 'main.log';
    
    // Get log file path
    const logPath = log.transports.file.getFile().path;
    console.log(`[Logger] Logs will be written to: ${logPath}`);
    
    // Log app initialization info
    log.info('='.repeat(80));
    log.info(`CueMe v${app.getVersion()} - ${new Date().toISOString()}`);
    log.info(`Platform: ${process.platform} ${process.arch}`);
    log.info(`Node: ${process.version}`);
    log.info(`Electron: ${process.versions.electron}`);
    log.info(`Packaged: ${app.isPackaged}`);
    log.info(`CWD: ${process.cwd()}`);
    log.info(`Resources: ${process.resourcesPath || 'N/A'}`);
    log.info(`Log File: ${logPath}`);
    log.info('='.repeat(80));
    
    this.initialized = true;
  }
  
  static info(message: string, ...args: any[]) {
    log.info(message, ...args);
  }
  
  static error(message: string, ...args: any[]) {
    log.error(message, ...args);
  }
  
  static warn(message: string, ...args: any[]) {
    log.warn(message, ...args);
  }
  
  static debug(message: string, ...args: any[]) {
    log.debug(message, ...args);
  }
  
  static getLogPath(): string {
    return log.transports.file.getFile().path;
  }
}
