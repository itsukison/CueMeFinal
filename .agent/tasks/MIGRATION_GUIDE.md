# Audio System Migration Guide

## Overview

The audio processing system has been upgraded from Whisper-based batch processing to Gemini Live API real-time streaming. This document explains the migration path.

## Current State (Phase 3 - Partial Migration)

### ✅ Completed
- **New System**: DualAudioCaptureManager with Gemini Live API
  - Real-time audio streaming (200-500ms latency)
  - Dual audio sources (microphone + system audio)
  - Direct question detection (no transcription step)
  - IPC handlers: `dual-audio-*`

- **Frontend UI**: Updated to show source badges (User vs Opponent)

### ⚠️ Still Active (Legacy System)
- **Old System**: AudioStreamProcessor with Whisper API
  - Batch processing (1.1-1.2s latency)
  - Single audio source
  - Transcription → Regex detection pipeline
  - IPC handlers: `audio-stream-*`
  - **Still used by**: Existing frontend code in QueueCommands.tsx

## Why Keep Both Systems?

The legacy AudioStreamProcessor is still actively used by:
1. `audioHandlers.ts` - All `audio-stream-*` IPC handlers
2. `permissionHandlers.ts` - Permission management
3. Frontend - QueueCommands.tsx uses `audio-stream-start`, etc.

**Deleting it now would break the app.**

## Migration Path

### Phase 3.5: Frontend Migration (TODO)

Update `QueueCommands.tsx` to use new dual audio handlers:

```typescript
// OLD (current)
await window.electronAPI.audioStreamStart(sourceId);
await window.electronAPI.audioStreamProcessChunk(audioData);

// NEW (target)
await window.electronAPI.dualAudioStart(systemAudioSourceId);
await window.electronAPI.dualAudioProcessMicrophoneChunk(audioData);
```

### Phase 3.6: Cleanup (After Frontend Migration)

Once frontend is fully migrated, DELETE:
- `electron/AudioStreamProcessor.ts`
- `electron/audio/AudioTranscriber.ts`
- `electron/audio/QuestionRefiner.ts`
- `electron/audio/StreamingQuestionDetector.ts`
- `electron/QuestionDetector.ts`

And remove:
- OpenAI dependency from `package.json`
- `OPENAI_API_KEY` from `.env`
- Legacy `audio-stream-*` IPC handlers

## Benefits of New System

| Feature | Old (Whisper) | New (Gemini Live) |
|---------|---------------|-------------------|
| Latency | 1.1-1.2s | 200-500ms (5x faster) |
| Audio Sources | Single | Dual (user + opponent) |
| Pipeline | Transcribe → Regex | Direct detection |
| Cost/hour | $0.72 | $1.35 |
| Accuracy | Regex patterns | AI-powered |
| Code Complexity | High | Low |

## Testing New System

To test the new Gemini Live system:

```typescript
// Use dual-audio-* handlers instead of audio-stream-*
const result = await window.electronAPI.dualAudioStart('system-audio-id');
```

Questions will have `source: 'user' | 'opponent'` field and display with color-coded badges.

## Rollback Plan

If issues arise with Gemini Live:
1. Frontend continues using `audio-stream-*` handlers (legacy system)
2. Old system remains fully functional
3. No data loss or breaking changes

## Timeline

- **Phase 1-2**: ✅ Complete (Gemini Live backend + UI)
- **Phase 3**: ✅ Complete (Documentation + .env updates)
- **Phase 3.5**: ✅ Complete (Frontend migration to dual-audio handlers)
- **Phase 3.6**: 🔜 TODO (Delete legacy code after testing)

## Migration Status

### ✅ Frontend Migration Complete

`QueueCommands.tsx` now uses:
```typescript
// Start dual audio capture
await window.electronAPI.dualAudioStart(systemAudioSourceId);

// Process microphone chunks
await window.electronAPI.dualAudioProcessMicrophoneChunk(audioData);

// Stop dual audio capture
await window.electronAPI.dualAudioStop();
```

### 🎯 Current State

- **Active**: Gemini Live system (dual-audio-* handlers)
- **Inactive**: Legacy system (audio-stream-* handlers) - no longer called
- **Ready for cleanup**: AudioStreamProcessor and related files can be deleted

---

**Last Updated**: 2025-10-20
**Status**: Migration complete - using Gemini Live API exclusively
