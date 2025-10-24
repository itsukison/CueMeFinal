/**
 * DiagnosticLogger - Enhanced logging for production debugging
 * 
 * Provides structured logging with context for debugging audio pipeline issues
 * in production builds. Logs are written to file and can be accessed by users.
 */

import log from 'electron-log';
import { app } from 'electron';

// Configure electron-log
log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

// Always log to file, even in production
if (process.env.NODE_ENV === 'production' || !process.env.NODE_ENV) {
  log.transports.file.level = 'debug';
}

export class DiagnosticLogger {
  private component: string;

  constructor(component: string) {
    this.component = component;
  }

  /**
   * Log info message with component context
   */
  info(message: string, data?: any): void {
    if (data) {
      log.info(`[${this.component}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      log.info(`[${this.component}] ${message}`);
    }
  }

  /**
   * Log debug message with component context
   */
  debug(message: string, data?: any): void {
    if (data) {
      log.debug(`[${this.component}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      log.debug(`[${this.component}] ${message}`);
    }
  }

  /**
   * Log warning message with component context
   */
  warn(message: string, data?: any): void {
    if (data) {
      log.warn(`[${this.component}] ${message}`, JSON.stringify(data, null, 2));
    } else {
      log.warn(`[${this.component}] ${message}`);
    }
  }

  /**
   * Log error with full details including stack trace
   */
  error(message: string, error?: any, context?: any): void {
    const errorDetails: any = {
      message: message,
      timestamp: new Date().toISOString(),
      component: this.component
    };

    if (error) {
      errorDetails.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        ...error
      };
    }

    if (context) {
      errorDetails.context = context;
    }

    log.error(`[${this.component}] ${message}`, JSON.stringify(errorDetails, null, 2));
  }

  /**
   * Log method entry with parameters
   */
  methodEntry(methodName: string, params?: any): void {
    if (params) {
      log.debug(`[${this.component}] → ${methodName}()`, JSON.stringify(params, null, 2));
    } else {
      log.debug(`[${this.component}] → ${methodName}()`);
    }
  }

  /**
   * Log method exit with result
   */
  methodExit(methodName: string, result?: any): void {
    if (result !== undefined) {
      log.debug(`[${this.component}] ← ${methodName}()`, JSON.stringify(result, null, 2));
    } else {
      log.debug(`[${this.component}] ← ${methodName}()`);
    }
  }

  /**
   * Log system information (useful for diagnostics)
   */
  static logSystemInfo(): void {
    const info = {
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      appVersion: app?.getVersion() || 'unknown',
      isPackaged: app?.isPackaged || false,
      execPath: process.execPath,
      resourcesPath: process.resourcesPath,
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE
      }
    };

    log.info('[SystemInfo]', JSON.stringify(info, null, 2));
  }

  /**
   * Get log file path
   */
  static getLogPath(): string {
    return log.transports.file.getFile().path;
  }
}

// Log system info on module load
if (app) {
  DiagnosticLogger.logSystemInfo();
}

export default DiagnosticLogger;
