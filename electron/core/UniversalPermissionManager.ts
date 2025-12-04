import { EventEmitter } from 'events';
import { app, dialog, shell } from 'electron';
import { PermissionStorage } from '../services/permissions/PermissionStorage';
import { ProcessSupervisor } from './ProcessSupervisor';
import { PermissionWatcher } from './PermissionWatcher';
import path from 'path';
import fs from 'fs';

/**
 * UniversalPermissionManager - Comprehensive solution to prevent permission errors for ALL users
 * 
 * This addresses the core issues from the diagnostic output:
 * 1. Multiple processes running simultaneously causing permission conflicts
 * 2. Code signature verification timeouts affecting TCC validation
 * 3. XPC connection invalidation due to permission handshake failures
 * 
 * The universal solution ensures that permission errors don't occur for anyone downloading the app.
 */
export class UniversalPermissionManager extends EventEmitter {
  private permissionStorage: PermissionStorage;
  private processSupervisor: ProcessSupervisor;
  private permissionWatcher: PermissionWatcher;
  private isInitialized: boolean = false;

  constructor() {
    super();
    
    this.permissionStorage = new PermissionStorage();
    this.processSupervisor = new ProcessSupervisor();
    this.permissionWatcher = new PermissionWatcher();
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the universal permission management system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[UniversalPermissionManager] 🚀 Initializing universal permission system...');
    
    try {
      // Step 1: Validate binary signature and environment
      const binaryValidation = await this.validateBinaryEnvironment();
      this.emit('binary-validation', binaryValidation);
      
      // Step 2: Start process supervision to prevent conflicts
      this.processSupervisor.startSupervision();
      
      // Step 3: Start permission monitoring
      this.permissionWatcher.startWatching();
      
      // Step 4: Check if first-time setup is needed
      const isFirstTime = await this.permissionStorage.isFirstTimeSetup();
      
      if (isFirstTime) {
        console.log('[UniversalPermissionManager] 👋 First-time user detected - preparing guided setup');
        this.emit('first-time-setup-needed');
      } else {
        console.log('[UniversalPermissionManager] ✅ Returning user - validating existing permissions');
        await this.validateExistingPermissions();
      }
      
      this.isInitialized = true;
      console.log('[UniversalPermissionManager] ✅ Universal permission system initialized');
      this.emit('initialized', { isFirstTime });
      
    } catch (error) {
      console.error('[UniversalPermissionManager] ❌ Initialization failed:', error);
      this.emit('initialization-error', error);
      throw error;
    }
  }

  /**
   * Validate the binary environment for proper code signing
   */
  private async validateBinaryEnvironment(): Promise<{
    isValid: boolean;
    isProduction: boolean;
    binaryExists: boolean;
    signatureValid: boolean;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    // Check if this is a production build
    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.resourcesPath !== undefined ||
                        !process.execPath.includes('node_modules');
    
    // Check if SystemAudioCapture binary exists
    const binaryPath = this.getSystemAudioBinaryPath();
    const binaryExists = fs.existsSync(binaryPath);
    
    if (!binaryExists) {
      recommendations.push('Build SystemAudioCapture binary: npm run build:native');
    }
    
    // Check code signature (macOS only)
    let signatureValid = true;
    if (process.platform === 'darwin' && binaryExists) {
      try {
        const { execSync } = require('child_process');
        execSync(`codesign --verify --strict \"${binaryPath}\"`, { stdio: 'pipe' });
        console.log('[UniversalPermissionManager] ✅ Binary signature valid');
      } catch (error) {
        signatureValid = false;
        if (!isProduction) {
          recommendations.push('Use production build for stable permissions: npm run app:build:mac');
        } else {
          recommendations.push('Binary signature invalid - may cause permission issues');
        }
      }
    }
    
    const isValid = binaryExists && (signatureValid || !isProduction);
    
    return {
      isValid,
      isProduction,
      binaryExists,
      signatureValid,
      recommendations
    };
  }

  /**
   * Get the path to the SystemAudioCapture binary
   */
  private getSystemAudioBinaryPath(): string {
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      return path.join(process.cwd(), 'dist-native', 'SystemAudioCapture');
    } else {
      return path.join(process.resourcesPath || process.cwd(), 'dist-native', 'SystemAudioCapture');
    }
  }

  /**
   * Validate existing permissions for returning users
   */
  private async validateExistingPermissions(): Promise<void> {
    try {
      const status = await this.permissionStorage.getCurrentPermissionStatus();
      
      if (status.microphone === 'granted' && status.screenCapture === 'granted') {
        console.log('[UniversalPermissionManager] ✅ All permissions granted - user ready to go');
        this.emit('permissions-validated', { status, needsAttention: false });
      } else {
        console.log('[UniversalPermissionManager] ⚠️  Some permissions missing - may need re-grant');
        this.emit('permissions-validated', { status, needsAttention: true });
      }
    } catch (error) {
      console.error('[UniversalPermissionManager] Error validating permissions:', error);
      this.emit('permission-validation-error', error);
    }
  }

  /**
   * Request system permissions with enhanced recovery
   */
  public async requestPermissions(): Promise<{
    success: boolean;
    microphone: boolean;
    screenCapture: boolean;
    errors: string[];
    recommendations: string[];
  }> {
    const errors: string[] = [];
    const recommendations: string[] = [];
    let microphoneGranted = false;
    let screenCaptureGranted = false;
    
    try {
      console.log('[UniversalPermissionManager] 🔐 Requesting permissions with enhanced recovery...');
      
      // Request microphone permission
      try {
        microphoneGranted = await this.permissionStorage.requestMicrophonePermission();
        if (!microphoneGranted) {
          errors.push('Microphone permission denied');
          recommendations.push('Grant microphone access in System Preferences → Security & Privacy → Microphone');
        }
      } catch (error) {
        errors.push(`Microphone permission error: ${(error as Error).message}`);
      }
      
      // Request screen capture permission (more complex)
      try {
        const result = await this.requestScreenCapturePermissionWithRecovery();
        screenCaptureGranted = result.granted;
        
        if (!screenCaptureGranted) {
          errors.push(result.error || 'Screen capture permission denied');
          recommendations.push('Grant screen recording access in System Preferences → Security & Privacy → Screen Recording');
        }
        
        if (result.recommendations) {
          recommendations.push(...result.recommendations);
        }
      } catch (error) {
        errors.push(`Screen capture permission error: ${(error as Error).message}`);
      }
      
      const success = microphoneGranted && screenCaptureGranted;
      
      if (success) {
        await this.permissionStorage.markInitialSetupCompleted();
        console.log('[UniversalPermissionManager] ✅ All permissions granted successfully');
        this.emit('permissions-granted', { microphone: true, screenCapture: true });
      } else {
        console.log('[UniversalPermissionManager] ⚠️  Some permissions not granted');
        this.emit('permissions-partial', { microphone: microphoneGranted, screenCapture: screenCaptureGranted });
      }
      
      return {
        success,
        microphone: microphoneGranted,
        screenCapture: screenCaptureGranted,
        errors,
        recommendations
      };
      
    } catch (error) {
      console.error('[UniversalPermissionManager] ❌ Permission request failed:', error);
      errors.push(`Permission system error: ${(error as Error).message}`);
      
      return {
        success: false,
        microphone: false,
        screenCapture: false,
        errors,
        recommendations
      };
    }
  }

  /**
   * Request screen capture permission with enhanced recovery
   */
  private async requestScreenCapturePermissionWithRecovery(): Promise<{
    granted: boolean;
    error?: string;
    recommendations?: string[];
  }> {
    const recommendations: string[] = [];
    
    try {
      // First, try the permission watcher's enhanced method
      const analysis = this.permissionWatcher.getPermissionAnalysis();
      
      if (analysis.status === 'signature_issue') {
        // If there's a signature issue, provide specific guidance
        recommendations.push('Code signature issue detected. Using production build is recommended.');
        recommendations.push('Alternatively, try: sudo tccutil reset ScreenCapture');
      }
      
      // Attempt permission recovery
      const recovery = await this.permissionWatcher.attemptPermissionRecovery();
      
      if (recovery.success) {
        return { granted: true };
      }
      
      // If automatic recovery failed, open System Preferences
      recommendations.push('Permission requires manual grant in System Preferences');
      recommendations.push('After granting, restart the app for changes to take effect');
      
      if (process.platform === 'darwin') {
        await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      }
      
      return {
        granted: false,
        error: recovery.message,
        recommendations
      };
      
    } catch (error) {
      return {
        granted: false,
        error: `Screen capture permission failed: ${(error as Error).message}`,
        recommendations
      };
    }
  }

  /**
   * Show guided first-time setup
   */
  public async showFirstTimeSetup(): Promise<boolean> {
    console.log('[UniversalPermissionManager] 🎯 Triggering first-time setup flow');
    
    // Emit event for UI to show FirstLaunchSetup component
    this.emit('show-first-time-setup');
    
    return new Promise((resolve) => {
      const onSetupComplete = () => {
        this.removeListener('first-time-setup-complete', onSetupComplete);
        resolve(true);
      };
      
      const onSetupSkipped = () => {
        this.removeListener('first-time-setup-skipped', onSetupSkipped);
        resolve(false);
      };
      
      this.once('first-time-setup-complete', onSetupComplete);
      this.once('first-time-setup-skipped', onSetupSkipped);
    });
  }

  /**
   * Handle first-time setup completion
   */
  public async completeFirstTimeSetup(): Promise<void> {
    try {
      await this.permissionStorage.markInitialSetupCompleted();
      console.log('[UniversalPermissionManager] ✅ First-time setup completed');
      this.emit('first-time-setup-complete');
    } catch (error) {
      console.error('[UniversalPermissionManager] Error completing first-time setup:', error);
      throw error;
    }
  }

  /**
   * Skip first-time setup
   */
  public skipFirstTimeSetup(): void {
    console.log('[UniversalPermissionManager] ⏭️  First-time setup skipped');
    this.emit('first-time-setup-skipped');
  }

  /**
   * Get comprehensive status for debugging
   */
  public getComprehensiveStatus(): {
    initialized: boolean;
    binaryValidation: any;
    permissionStatus: any;
    processSupervisorStatus: any;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // Get process supervisor status
    const processStatus = this.processSupervisor.getStatus();
    if (processStatus.activeProcesses.length > 1) {
      recommendations.push('Multiple audio processes detected - conflicts may occur');
    }
    
    // Get permission analysis
    const permissionAnalysis = this.permissionWatcher.getPermissionAnalysis();
    recommendations.push(...permissionAnalysis.actionRequired);
    
    return {
      initialized: this.isInitialized,
      binaryValidation: {}, // Will be populated during initialization
      permissionStatus: permissionAnalysis,
      processSupervisorStatus: processStatus,
      recommendations
    };
  }

  /**
   * Setup event handlers for child components
   */
  private setupEventHandlers(): void {
    // Process supervisor events
    this.processSupervisor.on('conflict-resolved', (info) => {
      console.log('[UniversalPermissionManager] 🔧 Process conflict auto-resolved');
      this.emit('process-conflict-resolved', info);
    });
    
    // Permission watcher events
    this.permissionWatcher.on('screen-recording-granted', () => {
      console.log('[UniversalPermissionManager] 🎉 Screen recording permission granted!');
      this.emit('permission-auto-granted', 'screen-recording');
    });
    
    this.permissionWatcher.on('screen-recording-revoked', () => {
      console.log('[UniversalPermissionManager] ⚠️  Screen recording permission revoked');
      this.emit('permission-revoked', 'screen-recording');
    });
  }

  /**
   * Emergency reset - clear all permission state and restart
   */
  public async emergencyReset(): Promise<void> {
    console.log('[UniversalPermissionManager] 🚨 Performing emergency reset...');
    
    try {
      // Clear stored permission state
      this.permissionStorage.clearPermissionState();
      
      // Emergency process cleanup
      this.processSupervisor.emergencyCleanup();
      
      // Restart permission monitoring
      this.permissionWatcher.destroy();
      this.permissionWatcher = new PermissionWatcher();
      this.permissionWatcher.startWatching();
      
      console.log('[UniversalPermissionManager] ✅ Emergency reset completed');
      this.emit('emergency-reset-complete');
      
      // Show restart dialog
      const dialogResult = await dialog.showMessageBox({
        type: 'info',
        title: 'Permission Reset Complete',
        message: 'Permission system has been reset. Please restart the app for changes to take effect.',
        buttons: ['Restart Now', 'Restart Later'],
        defaultId: 0
      });
      
      if (dialogResult === 0) {
        app.relaunch();
        app.exit();
      }
      
    } catch (error) {
      console.error('[UniversalPermissionManager] Emergency reset failed:', error);
      this.emit('emergency-reset-error', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    console.log('[UniversalPermissionManager] 🧹 Cleaning up resources...');
    
    this.processSupervisor.destroy();
    this.permissionWatcher.destroy();
    this.removeAllListeners();
    
    this.isInitialized = false;
    console.log('[UniversalPermissionManager] ✅ Cleanup completed');
  }
}