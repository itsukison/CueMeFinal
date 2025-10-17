export interface AudioChunk {
  id: string;
  data: Float32Array;
  timestamp: number;
  duration: number;
  wordCount: number;
}

export interface AudioStreamState {
  isListening: boolean;
  isProcessing: boolean;
  lastActivityTime: number;
  questionBuffer: DetectedQuestion[];
  batchProcessor: {
    lastBatchTime: number;
    isProcessing: boolean;
    pendingQuestions: DetectedQuestion[];
  };
  currentAudioSource: AudioSource | null;
}

export interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'system';
  available: boolean;
}

export interface AudioStreamConfig {
  sampleRate: number;
  chunkDuration: number; // Minimum duration before considering transcription (ms)
  silenceThreshold: number; // How long to wait in silence before transcribing (ms)
  maxWords: number;
  questionDetectionEnabled: boolean;
  batchInterval: number;
  maxBatchSize: number;
  maxChunkDuration?: number; // Maximum duration before forcing transcription (ms)
  silenceEnergyThreshold?: number; // RMS threshold for detecting silence (0-1)
}

export interface DetectedQuestion {
  id: string;
  text: string;
  timestamp: number;
  confidence: number;
  // Optional fields populated during refinement and used by renderer UI
  isRefined?: boolean;
  refinedText?: string;
}

export interface QuestionBatch {
  id: string;
  questions: DetectedQuestion[];
  timestamp: number;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  timestamp: number;
  confidence: number;
  isQuestion: boolean;
  originalChunkId: string;
}

export interface AudioStreamEvents {
  'state-changed': (state: AudioStreamState) => void;
  'error': (error: Error) => void;
  'chunk-recorded': (chunk: AudioChunk) => void;
  'transcription-completed': (result: TranscriptionResult) => void;
  'question-detected': (question: DetectedQuestion) => void;
  'batch-processed': (batch: DetectedQuestion[]) => void;
}