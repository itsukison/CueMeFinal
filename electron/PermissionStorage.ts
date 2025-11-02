import * as fs from 'fs'
import * as path from 'path'
import { app, systemPreferences } from 'electron'
import * as crypto from 'crypto'

export interface PermissionState {
  hasShownInitialSetup: boolean
  microphonePermissionChecked: boolean
  screenRecordingPermissionChecked: boolean
  lastPermissionCheckDate: number
}

export class PermissionStorage {
  private readonly permissionFilePath: string
  private readonly encryptionKey = 'cueme-permission-state-v1'

  constructor() {
    // Store permission state in app's user data directory
    const userDataPath = app.getPath('userData')
    this.permissionFilePath = path.join(userDataPath, 'permission-state.json')
  }

  /**
   * Store permission state securely
   */
  public async storePermissionState(state: PermissionState): Promise<boolean> {
    try {
      console.log('[PermissionStorage] Storing permission state...')
      
      const stateData = JSON.stringify(state)
      const encryptedData = this.encrypt(stateData)
      
      // Ensure directory exists
      const dir = path.dirname(this.permissionFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(this.permissionFilePath, encryptedData)
      console.log('[PermissionStorage] ✅ Permission state stored successfully')
      return true
    } catch (error) {
      console.error('[PermissionStorage] ❌ Error storing permission state:', error)
      return false
    }
  }

  /**
   * Retrieve stored permission state
   */
  public async getPermissionState(): Promise<PermissionState | null> {
    try {
      console.log('[PermissionStorage] Retrieving permission state...')
      
      if (!fs.existsSync(this.permissionFilePath)) {
        console.log('[PermissionStorage] No permission state found - first time setup needed')
        return null
      }

      const encryptedData = fs.readFileSync(this.permissionFilePath, 'utf8')
      const decryptedData = this.decrypt(encryptedData)
      const state: PermissionState = JSON.parse(decryptedData)
      
      console.log('[PermissionStorage] ✅ Permission state retrieved successfully')
      console.log('[PermissionStorage] - Has shown initial setup:', state.hasShownInitialSetup)
      console.log('[PermissionStorage] - Last check date:', new Date(state.lastPermissionCheckDate).toISOString())
      
      return state
    } catch (error) {
      console.error('[PermissionStorage] ❌ Error retrieving permission state:', error)
      // If we can't decrypt, remove the corrupted file
      this.clearPermissionState()
      return null
    }
  }

  /**
   * Clear stored permission state
   */
  public clearPermissionState(): void {
    try {
      console.log('[PermissionStorage] Clearing permission state...')
      
      if (fs.existsSync(this.permissionFilePath)) {
        fs.unlinkSync(this.permissionFilePath)
        console.log('[PermissionStorage] ✅ Permission state cleared successfully')
      } else {
        console.log('[PermissionStorage] No permission state to clear')
      }
    } catch (error) {
      console.error('[PermissionStorage] ❌ Error clearing permission state:', error)
    }
  }

  /**
   * Check if this is the first time the app is being run
   */
  public async isFirstTimeSetup(): Promise<boolean> {
    const state = await this.getPermissionState()
    return state === null || !state.hasShownInitialSetup
  }

  /**
   * Mark initial setup as completed
   */
  public async markInitialSetupCompleted(): Promise<boolean> {
    const currentState = await this.getPermissionState()
    
    const newState: PermissionState = {
      hasShownInitialSetup: true,
      microphonePermissionChecked: currentState?.microphonePermissionChecked || false,
      screenRecordingPermissionChecked: currentState?.screenRecordingPermissionChecked || false,
      lastPermissionCheckDate: Date.now()
    }
    
    return await this.storePermissionState(newState)
  }

  /**
   * Update permission check status
   */
  public async updatePermissionCheckStatus(
    microphoneChecked?: boolean, 
    screenRecordingChecked?: boolean
  ): Promise<boolean> {
    const currentState = await this.getPermissionState()
    
    const newState: PermissionState = {
      hasShownInitialSetup: currentState?.hasShownInitialSetup || false,
      microphonePermissionChecked: microphoneChecked !== undefined ? microphoneChecked : (currentState?.microphonePermissionChecked || false),
      screenRecordingPermissionChecked: screenRecordingChecked !== undefined ? screenRecordingChecked : (currentState?.screenRecordingPermissionChecked || false),
      lastPermissionCheckDate: Date.now()
    }
    
    return await this.storePermissionState(newState)
  }

  /**
   * Check current system permissions status
   */
  public async getCurrentPermissionStatus(): Promise<{
    microphone: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined'
    screenCapture: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined'
    systemAudio: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined'
  }> {
    try {
      console.log('[PermissionStorage] Checking current system permissions...')
      
      let microphoneStatus: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined' = 'unknown'
      let screenCaptureStatus: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined' = 'unknown'
      let systemAudioStatus: 'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined' = 'unknown'
      
      // Check microphone permission (macOS only)
      if (process.platform === 'darwin') {
        try {
          microphoneStatus = systemPreferences.getMediaAccessStatus('microphone')
          console.log('[PermissionStorage] Microphone permission status:', microphoneStatus)
        } catch (error) {
          console.warn('[PermissionStorage] Could not check microphone permission:', error)
        }
        
        try {
          screenCaptureStatus = systemPreferences.getMediaAccessStatus('screen')
          console.log('[PermissionStorage] Screen capture permission status:', screenCaptureStatus)
        } catch (error) {
          console.warn('[PermissionStorage] Could not check screen capture permission:', error)
        }

        // Check System Audio permission
        try {
          systemAudioStatus = await this.checkSystemAudioPermission()
          console.log('[PermissionStorage] System Audio permission status:', systemAudioStatus)
        } catch (error) {
          console.warn('[PermissionStorage] Could not check system audio permission:', error)
        }
      }
      
      return {
        microphone: microphoneStatus,
        screenCapture: screenCaptureStatus,
        systemAudio: systemAudioStatus
      }
    } catch (error) {
      console.error('[PermissionStorage] Error checking permissions:', error)
      return {
        microphone: 'unknown',
        screenCapture: 'unknown',
        systemAudio: 'unknown'
      }
    }
  }

  /**
   * Check System Audio permission by attempting a test capture
   * This is a workaround since there's no direct macOS API
   */
  private async checkSystemAudioPermission(): Promise<'granted' | 'denied' | 'restricted' | 'unknown' | 'not-determined'> {
    try {
      const { spawn } = require('child_process')
      const path = require('path')
      
      // Determine audiotee binary path based on environment
      let audioteeDir: string
      if (app.isPackaged) {
        // Production: Binary is in Contents/Resources/audiotee
        audioteeDir = process.resourcesPath
      } else {
        // Development: Binary is in custom-audiotee/.build/apple/Products/Release
        audioteeDir = path.join(process.cwd(), 'custom-audiotee', '.build', 'apple', 'Products', 'Release')
      }
      
      const audioteeExecutable = path.join(audioteeDir, 'audiotee')
      
      // Check if binary exists
      if (!require('fs').existsSync(audioteeExecutable)) {
        console.log('[PermissionStorage] audiotee binary not found at:', audioteeExecutable)
        return 'unknown'
      }
      
      // Attempt a quick test capture (1 second, redirect output to /dev/null)
      return new Promise((resolve) => {
        const testProcess = spawn(audioteeExecutable, [
          '-t', '1',  // 1 second test
          '/dev/null'  // Discard output
        ], {
          stdio: 'pipe'
        })
        
        let stderr = ''
        
        testProcess.stderr?.on('data', (data) => {
          stderr += data.toString()
        })
        
        testProcess.on('close', (code) => {
          if (code === 0) {
            console.log('[PermissionStorage] System Audio permission test: GRANTED')
            resolve('granted')
          } else if (stderr.includes('permission') || stderr.includes('denied') || stderr.includes('0x6E6F7065')) {
            console.log('[PermissionStorage] System Audio permission test: DENIED')
            resolve('denied')
          } else {
            console.log('[PermissionStorage] System Audio permission test: UNKNOWN (exit code:', code, ')')
            resolve('unknown')
          }
        })
        
        testProcess.on('error', (error) => {
          console.log('[PermissionStorage] System Audio permission test error:', error)
          resolve('unknown')
        })
        
        // Timeout after 3 seconds
        setTimeout(() => {
          testProcess.kill()
          console.log('[PermissionStorage] System Audio permission test: TIMEOUT')
          resolve('unknown')
        }, 3000)
      })
    } catch (error) {
      console.error('[PermissionStorage] Error checking system audio permission:', error)
      return 'unknown'
    }
  }

  /**
   * Request permission for microphone access (macOS only)
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      console.log('[PermissionStorage] Microphone permission request only available on macOS')
      return true // Assume granted on other platforms
    }
    
    try {
      console.log('[PermissionStorage] Requesting microphone permission...')
      const granted = await systemPreferences.askForMediaAccess('microphone')
      console.log('[PermissionStorage] Microphone permission result:', granted)
      
      // Update our stored state
      await this.updatePermissionCheckStatus(granted, undefined)
      
      return granted
    } catch (error) {
      console.error('[PermissionStorage] Error requesting microphone permission:', error)
      return false
    }
  }

  /**
   * Simple encryption using AES-256-GCM
   */
  private encrypt(text: string): string {
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    })
  }

  /**
   * Simple decryption using AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    const algorithm = 'aes-256-gcm'
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32)
    
    const { encrypted, iv, authTag } = JSON.parse(encryptedData)
    
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}