export import { AudioStreamState, DetectedQuestion } from './audio-stream'

// Audio source type
interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'system';
  available: boolean;
}

interface ElectronAPI {
  updateContentDimensions: (dimensions: {
    width: number
    height: number
  }) => Promise<void>
  getScreenshots: () => Promise<Array<{ path: string; preview: string }>>
  deleteScreenshot: (path: string) => Promise<{ success: boolean; error?: string }>
  onScreenshotTaken: (callback: (data: { path: string; preview: string }) => void) => () => void
  onSolutionsReady: (callback: (solutions: string) => void) => () => void
  onResetView: (callback: () => void) => () => void
  onSolutionStart: (callback: () => void) => () => void
  onDebugStart: (callback: () => void) => () => void
  onDebugSuccess: (callback: (data: any) => void) => () => void
  onSolutionError: (callback: (error: string) => void) => () => void
  onProcessingNoScreenshots: (callback: () => void) => () => void
  onProblemExtracted: (callback: (data: any) => void) => () => void
  onSolutionSuccess: (callback: (data: any) => void) => () => void
  onUnauthorized: (callback: () => void) => () => void
  onDebugError: (callback: (error: string) => void) => () => void
  takeScreenshot: () => Promise<void>
  moveWindowLeft: () => Promise<void>
  moveWindowRight: () => Promise<void>
  moveWindowUp: () => Promise<void>
  moveWindowDown: () => Promise<void>
  analyzeAudioFromBase64: (data: string, mimeType: string, collectionId?: string) => Promise<{ text: string; timestamp: number }>
  analyzeAudioFile: (path: string, collectionId?: string) => Promise<{ text: string; timestamp: number }>
  quitApp: () => Promise<void>
  invoke: (channel: string, ...args: any[]) => Promise<any>
  
  // Mode-enabled chat methods
  "gemini-chat-mode": (message: string, modeKey?: string, collectionId?: string) => Promise<{ text?: string; modeResponse?: any; response?: string }>
  "get-available-modes": () => Promise<Array<{ key: string; displayName: string; description: string }>>
  
  // Auth methods
  authSignIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  authSignUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  authSignOut: () => Promise<{ success: boolean; error?: string }>
  authGetState: () => Promise<{ user: any | null; session: any | null; isLoading: boolean }>
  authResetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  onAuthStateChange: (callback: (state: { user: any | null; session: any | null; isLoading: boolean }) => void) => () => void
  
  // System status and logging
  getSystemStatus: () => Promise<{ success: boolean; status?: any; error?: string }>
  openLogFile: () => Promise<{ success: boolean; path?: string; error?: string }>
  getLogPath: () => Promise<{ success: boolean; path?: string; error?: string }>
  
  // Audio Stream methods (legacy - using AudioStreamProcessor)
  audioStreamStart: (sourceId?: string) => Promise<{ success: boolean; error?: string }>
  audioStreamStop: () => Promise<{ success: boolean; error?: string }>
  audioStreamProcessChunk: (audioData: Buffer) => Promise<{ success: boolean; error?: string }>
  audioStreamGetState: () => Promise<AudioStreamState>
  audioStreamGetQuestions: () => Promise<DetectedQuestion[]>
  audioStreamClearQuestions: () => Promise<{ success: boolean; error?: string }>
  audioStreamAnswerQuestion: (questionText: string, collectionId?: string) => Promise<{ response: string; timestamp: number }>
  
  // Microphone capture from renderer (new - MicrophoneCapture service)
  audioProcessMicrophoneChunk: (audioData: Float32Array) => Promise<{ success: boolean; error?: string }>
  
  // Dual Audio methods (new - using Gemini Live API)
  dualAudioStart: (systemAudioSourceId?: string) => Promise<{ success: boolean; error?: string }>
  dualAudioStop: () => Promise<{ success: boolean; error?: string }>
  dualAudioProcessMicrophoneChunk: (audioData: Float32Array) => Promise<{ success: boolean; error?: string }>
  dualAudioGetState: () => Promise<{ isCapturing: boolean; geminiState: any }>
  dualAudioGetQuestions: () => Promise<DetectedQuestion[]>
  dualAudioClearQuestions: () => Promise<{ success: boolean; error?: string }>
  
  // System Audio methods
  audioGetSources: () => Promise<{ success: boolean; sources: AudioSource[]; error?: string }>
  audioSwitchSource: (sourceId: string) => Promise<{ success: boolean; error?: string }>
  audioRequestPermissions: () => Promise<{ granted: boolean; error?: string }>
  audioCheckSystemSupport: () => Promise<{ supported: boolean }>
  
  // Audio Stream event listeners
  onAudioQuestionDetected: (callback: (question: DetectedQuestion) => void) => () => void
  onAudioBatchProcessed: (callback: (questions: DetectedQuestion[]) => void) => () => void
  onAudioStreamStateChanged: (callback: (state: AudioStreamState) => void) => () => void
  onAudioStreamError: (callback: (error: string) => void) => () => void
  onChatToggle: (callback: () => void) => () => void
  onListenToggle: (callback: () => void) => () => void
  
  // Permission methods
  permissionGetStatus: () => Promise<{ microphone: 'granted' | 'denied' | 'not-determined' | 'unknown'; screenCapture: 'granted' | 'denied' | 'not-determined' | 'unknown' }>
  permissionRequestMicrophone: () => Promise<{ granted: boolean; error?: string }>
  permissionRequestSystemAudio: () => Promise<{ granted: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}