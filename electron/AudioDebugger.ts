import { Logger } from "./utils/Logger";

/**
 * Audio System Debugger
 * Comprehensive debugging utility to diagnose audio issues in production
 */

export class AudioDebugger {
  static async diagnoseAudioSystem(): Promise<void> {
    Logger.info('🔍 ===== AUDIO SYSTEM DIAGNOSTICS =====');
    
    // 1. Check Environment Variables
    Logger.info('📋 Environment Variables:');
    Logger.info('  NODE_ENV:', process.env.NODE_ENV);
    Logger.info('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
    Logger.info('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Present' : 'Missing');
    Logger.info('  SUPABASE_URL:', process.env.SUPABASE_URL ? 'Present' : 'Missing');
    
    // 2. Check Process Information
    Logger.info('📋 Process Information:');
    Logger.info('  Platform:', process.platform);
    Logger.info('  Architecture:', process.arch);
    Logger.info('  CWD:', process.cwd());
    Logger.info('  Resources Path:', process.resourcesPath || 'Not Available');
    Logger.info('  App Packaged:', process.resourcesPath ? 'Yes' : 'No');
    
    // 3. Check Native Binary
    await this.checkNativeBinary();
    
    // 4. Check Permissions
    await this.checkPermissions();
    
    // 5. Test Audio Subsystems
    await this.testAudioSubsystems();
    
    Logger.info('🔍 ===== DIAGNOSTICS COMPLETE =====');
  }
  
  private static async checkNativeBinary(): Promise<void> {
    Logger.info('📋 Native Binary Check:');
    
    const { app } = await import('electron');
    const path = await import('path');
    const fs = await import('fs');
    
    const isDev = !app.isPackaged;
    const binaryPath = isDev 
      ? path.join(process.cwd(), 'dist-native', 'SystemAudioCapture')
      : path.join(process.resourcesPath, 'dist-native', 'SystemAudioCapture');
    
    Logger.info('  Expected Binary Path:', binaryPath);
    Logger.info('  Binary Exists:', fs.existsSync(binaryPath));
    
    if (fs.existsSync(binaryPath)) {
      const stats = fs.statSync(binaryPath);
      Logger.info('  Binary Size:', stats.size, 'bytes');
      Logger.info('  Binary Executable:', (stats.mode & fs.constants.S_IXUSR) !== 0);
      Logger.info('  Binary Modified:', stats.mtime.toISOString());
    }
  }
  
  private static async checkPermissions(): Promise<void> {
    Logger.info('📋 macOS Permissions:');
    
    // NOTE: Microphone permission check removed because navigator.mediaDevices
    // is only available in the renderer process, not the main process.
    // Microphone permission is now checked in the renderer via MicrophoneCapture service.
    Logger.info('  Microphone Permission: Check via renderer process (MicrophoneCapture service)');
    
    try {
      // Test screen capture permission via desktopCapturer
      const { desktopCapturer } = await import('electron');
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      Logger.info('  Screen Recording Permission:', sources.length > 0 ? 'Granted' : 'Denied');
    } catch (error) {
      Logger.warn('  Screen Recording Permission: Error:', (error as Error).message);
    }
  }
  
  private static async testAudioSubsystems(): Promise<void> {
    Logger.info('📋 Audio Subsystem Tests:');
    
    // Test SystemAudioCapture
    try {
      const { SystemAudioCapture } = await import('./SystemAudioCapture');
      const capture = new SystemAudioCapture();
      const sources = await capture.getAvailableSources();
      Logger.info('  SystemAudioCapture Sources:', sources.length);
      sources.forEach(source => {
        Logger.info(`    - ${source.name} (${source.type}): ${source.available ? 'Available' : 'Unavailable'}`);
      });
      capture.destroy();
    } catch (error) {
      Logger.error('  SystemAudioCapture Error:', (error as Error).message);
    }
    
    // Test AudioTranscriber
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey && openaiKey.trim() !== '') {
        const { AudioTranscriber } = await import('./audio/AudioTranscriber');
        const transcriber = new AudioTranscriber(openaiKey);
        Logger.info('  AudioTranscriber: Initialized successfully');
      } else {
        Logger.error('  AudioTranscriber: Cannot initialize - Missing OpenAI API key');
        Logger.error('  This is likely why audio transcription is not working!');
      }
    } catch (error) {
      Logger.error('  AudioTranscriber Error:', (error as Error).message);
    }
  }
}