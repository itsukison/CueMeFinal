# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CueMe is an AI-powered interview assistant built with Electron that provides real-time assistance during coding interviews by capturing screenshots, transcribing audio questions, and generating AI responses using RAG (Retrieval Augmented Generation).

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Backend: Electron 33 (Node.js main process)
- AI: Google Gemini (Live API, Vision, Text), OpenAI (embeddings only)
- Database: Supabase (PostgreSQL with vector search)
- Audio: Gemini Live API for transcription, native system audio capture

## Development Commands

### Build & Run
```bash
# Development
npm run dev                # Start Vite dev server only (default port 5173)
npm run electron:dev       # Start Electron only
npm start                  # Run both concurrently (recommended, uses port 5181)

# Production builds
npm run build              # Build for current platform (includes native binary)
npm run build:native       # Build native audio binary only
npm run app:build          # Create distributable for current platform

# Platform-specific builds
npm run app:build:mac      # macOS build
npm run app:build:win      # Windows build
npm run app:build:linux    # Linux build
npm run app:build:all      # All platforms

# Release
npm run release            # Build and publish to GitHub releases
npm run release:draft      # Build and create draft release
```

### Testing
```bash
# Currently no test commands configured
# Jest config files exist but tests may be incomplete
```

### Development Workflow
```bash
# Watch TypeScript compilation
npm run watch              # Watch electron/ TypeScript files

# Clean build artifacts
npm run clean              # Remove dist/ and dist-electron/
```

## Architecture Overview

### Electron Process Architecture

**Main Process** (`electron/main.ts`)
- Entry point for Electron app
- Manages AppState singleton (central state coordinator)
- Registers IPC handlers via `initializeIpcHandlers()`
- Sets up deep link protocol handling (`cueme://`)
- Manages global shortcuts (Cmd+B, Cmd+L, Cmd+C, Cmd+H)
- Coordinates all services and manages app lifecycle

**Renderer Process** (`src/`)
- React app built with Vite
- Communicates with main process via `window.electronAPI` (defined in preload.ts)
- Uses React Query for server state management
- Event-driven updates from main process

### Core Service Layer

Services are organized in `electron/services/` by domain:

**Authentication** (`services/auth/`)
- `AuthService.ts`: Supabase authentication integration
- `TokenStorage.ts`: Secure token storage

**Q&A Collections** (`services/qna/`)
- `QnAService.ts`: Collection CRUD, vector search, embeddings
- `DocumentService.ts`: Document upload, text extraction, chunking

**AI/LLM** (`services/ai/`)
- `LLMHelper.ts`: Gemini API integration, RAG implementation
- `ModeManager.ts`: Conversation mode management (interview, meeting, sales, etc.)
- `ProcessingHelper.ts`: Screenshot processing, solution generation

**Audio** (`electron/audio/`)
- `DualAudioCaptureManager.ts`: Manages both mic and system audio capture
- `GeminiLiveQuestionDetector.ts`: Real-time question detection via Gemini Live
- `StreamingQuestionDetector.ts`: Streaming question detection logic
- `SystemAudioCapture.ts`: Native system audio capture (macOS)
- `DeepgramTranscriptionService.ts`: Alternative transcription service (optional)

**Other Services**
- `services/screenshot/ScreenshotHelper.ts`: Screenshot capture and management
- `services/window/WindowHelper.ts`: Window positioning and visibility
- `services/usage/UsageTracker.ts`: API usage tracking and rate limiting
- `services/usage/LocalUsageManager.ts`: Fast local usage estimation
- `services/permissions/PermissionStorage.ts`: Permission state management

### IPC Communication Pattern

**Handler Organization** (`electron/ipc/`)
All IPC handlers are split by domain and registered in `ipc/index.ts`:
- `audioHandlers.ts`: Audio capture, transcription, question detection
- `authHandlers.ts`: Sign in/up/out, session management
- `llmHandlers.ts`: Gemini chat, RAG, modes
- `qnaHandlers.ts`: Collection and Q&A item operations
- `screenshotHandlers.ts`: Screenshot operations
- `windowHandlers.ts`: Window management
- `permissionHandlers.ts`: Permission checks and requests
- `diagnosticsHandlers.ts`: Diagnostic information
- `updateHandlers.ts`: Auto-update functionality
- `utilityHandlers.ts`: Miscellaneous utilities

**Communication Flow:**
```typescript
// Renderer → Main (invoke)
const result = await window.electronAPI.methodName(args)

// Main → Renderer (send)
mainWindow.webContents.send('event-name', data)
// Renderer listens: window.electronAPI.onEventName((data) => {...})
```

### Audio Pipeline (Gemini Live)

**Current System (Post-Migration):**
1. `DualAudioCaptureManager` captures both mic and system audio
2. Audio streams to Gemini Live API in real-time
3. `GeminiLiveQuestionDetector` analyzes transcription
4. Questions extracted and displayed in UI
5. User clicks question → LLM generates answer with RAG

**Key Files:**
- `electron/audio/DualAudioCaptureManager.ts`
- `electron/audio/GeminiLiveQuestionDetector.ts`
- `electron/audio/SystemAudioCapture.ts`

**Deprecated Pipeline (DO NOT USE):**
- Old Whisper-based transcription (deleted)
- Regex-based question detection (deleted)
- `AudioStreamProcessor.ts` (deleted - replaced by DualAudioCaptureManager)

### Frontend Architecture

**Pages** (`src/_pages/`)
- `Queue.tsx`: Main landing page with screenshot queue and chat
- `Solutions.tsx`: AI-generated solution display
- `Debug.tsx`: Development debugging tools

**Feature Components** (`src/components/`)
- `Queue/`: QueueCommands, ScreenshotQueue, ProfileDropdown
- `Solutions/`: SolutionCommands
- `AudioListener/`: QuestionSidePanel
- `ui/`: Radix UI wrappers, dialogs, toast notifications

**Large Files Requiring Refactoring:**
- `components/Queue/QueueCommands.tsx` (1245 lines) - handles too many responsibilities
- `_pages/Queue.tsx` (756 lines) - improved but could use further extraction
- `_pages/Solutions.tsx` (577 lines) - could benefit from component extraction
- See `.agent/tasks/ACTIVE/PROJECT_CLEANUP_REORGANIZATION.md` for refactoring plan

## Important Patterns & Conventions

### Service Initialization
- All services instantiated in `AppState` constructor
- Services access each other through AppState reference
- Use dependency injection pattern for testability

### Error Handling
- Always wrap IPC handlers in try-catch
- Return structured error objects: `{ success: false, error: string }`
- Log errors with context using `Logger.error()` or `DiagnosticLogger`

### Usage Tracking
- Use `LocalUsageManager` for fast, non-blocking usage checks
- Call `checkUsageFast()` before operations
- Call `trackUsagePostProcessing()` after successful operations
- DO NOT use old `UsageTracker` (causes blocking network calls)

### AI Embeddings
- **CRITICAL**: Use OpenAI embeddings (text-embedding-3-large, 1536 dimensions)
- DO NOT switch to Gemini embeddings - must align with CueMeWeb backend
- Supabase stores OpenAI embeddings - changing this requires migration
- Gemini Live API only used for audio transcription, NOT embeddings

### Permission Management
- macOS requires microphone and screen recording permissions
- Use `PermissionStorage` to track permission state
- Permission dialogs shown on first launch
- `UniversalPermissionManager` coordinates between different permission systems

## Environment Variables

Required environment variables (see `.env`):
```bash
# AI Services
GEMINI_API_KEY=           # Required: Gemini Live API (audio transcription)
OPENAI_API_KEY=           # Required: OpenAI embeddings (text-embedding-3-large)

# Database
NEXT_PUBLIC_SUPABASE_URL=      # Required: Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Required: Supabase anonymous key

# macOS Notarization (for releases only)
APPLE_ID=                 # macOS notarization
APPLE_PASSWORD=           # App-specific password
APPLE_TEAM_ID=            # Developer team ID
```

## Native Dependencies

### macOS System Audio Capture
- Custom native module in `custom-binaries/audiotee`
- Built during `npm run build:native`
- Required for system audio capture on macOS
- Requires screen recording permission

### Build Prerequisites
- macOS: Xcode Command Line Tools
- Windows: Visual Studio Build Tools
- Linux: build-essential

## Common Development Tasks

### Adding a New IPC Handler
1. Add handler function to appropriate file in `electron/ipc/`
2. Register handler in `electron/ipc/index.ts`
3. Add TypeScript definition to `src/types/electron.d.ts`
4. Implement in renderer via `window.electronAPI.methodName()`

### Adding a New Conversation Mode
1. Add mode definition to `electron/config/modes.json`
2. Mode automatically available via `ModeManager`
3. Update UI mode selector if needed

### Modifying Audio Pipeline
- Work with files in `electron/audio/`
- Main coordinator: `DualAudioCaptureManager.ts`
- Question detection: `GeminiLiveQuestionDetector.ts`
- DO NOT reintroduce old Whisper/regex pipeline

### Working with Vector Search
- Embeddings generated in `QnAService.ts` and `DocumentService.ts`
- Must use OpenAI text-embedding-3-large (1536 dimensions)
- Vector search performed via Supabase RPC functions
- See `electron/services/qna/QnAService.ts` for examples

## Known Issues & Gotchas

### DO NOT
- Switch from OpenAI to Gemini embeddings (incompatible with backend)
- Use old `UsageTracker` for usage checks (use `LocalUsageManager`)
- Reintroduce deleted audio pipeline files (Whisper, regex-based)
- Create global shortcuts that conflict with OS defaults

### Important Notes
- AppState is a singleton - use `AppState.getInstance()`
- IPC handlers must be registered before window creation
- Global shortcuts registered in main.ts must be unregistered on quit
- Audio permissions must be requested before capture

## Project Status & Cleanup Plan

**Recent Major Changes:**
- Migrated from Whisper to Gemini Live API for audio transcription
- Deleted obsolete audio pipeline (~6200 lines removed)
- Reorganized electron services into domain folders
- Unified usage tracking under LocalUsageManager

**Pending Cleanup (See `.agent/tasks/ACTIVE/PROJECT_CLEANUP_REORGANIZATION.md`):**
- Split oversized React components (QueueCommands.tsx, Solutions.tsx)
- Feature-based organization for frontend
- Extract custom hooks from large components

**Note:** Previous cleanup successfully completed - legacy audio recorder, debug scripts, and completed task docs have been removed.

## Documentation

**Architecture Documentation** (`.agent/system/`)
- `ARCHITECTURE.md`: Comprehensive architecture overview
- `COMPONENT_MAP.md`: Component hierarchy and file locations

**Task Documentation** (`.agent/tasks/`)
- `ACTIVE/`: Currently active tasks
- `COMPLETED/`: Completed task summaries
- `PLANNED/`: Future work
- `REFERENCE/`: Reference documentation and guides

**Build Scripts** (`scripts/`)
- `afterPack.js`: Post-packaging customization
- `afterSign.js`: Code signing for macOS
- `build-native-binary.sh`: Native audio binary build

## Troubleshooting

**Build Failures:**
- Clear `node_modules` and reinstall
- Rebuild native modules: `npm rebuild`
- Check TypeScript errors: `tsc -p electron/tsconfig.json --noEmit`

**Audio Not Working:**
- Verify microphone permission granted
- Check screen recording permission (macOS system audio)
- Ensure Gemini Live API key is set
- Check logs for audio capture errors

**Authentication Issues:**
- Verify Supabase credentials in `.env`
- Clear token storage and re-authenticate
- Check network connectivity

**IPC Communication Errors:**
- Ensure handlers are registered before window creation
- Check TypeScript definitions match handler signatures
- Verify preload script is loaded correctly
