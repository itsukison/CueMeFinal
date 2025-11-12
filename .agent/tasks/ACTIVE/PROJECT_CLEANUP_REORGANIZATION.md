# Project Cleanup & Reorganization Plan (REFINED)

**Status:** 📋 Planning Phase - Updated for Gemini Live Migration  
**Created:** 2025-11-12  
**Updated:** 2025-11-12 (Post Gemini Live Analysis)  
**Priority:** High  
**Estimated Effort:** 2-3 days (reduced from 3-5)

---

## Executive Summary

CueMe has grown organically and now suffers from:
- **Flat file structure** with 25+ files in root electron/ directory
- **Oversized files** (1244 lines in QueueCommands)
- **OBSOLETE audio pipeline** - Old Whisper/regex code replaced by Gemini Live
- **Unused/dead code** (WorkflowOptimizationManager, OptimizationValidator, etc.)
- **Mixed concerns** in components and services
- **Inconsistent organization** (some files in subdirs, most in root)

**CRITICAL UPDATE:** After Gemini Live migration (DUAL_AUDIO_TRANSCRIPTION_IMPROVEMENT.md):
- ❌ AudioStreamProcessor.ts (937 lines) - **DELETE, don't split** (replaced by DualAudioCaptureManager)
- ❌ Entire Whisper/regex pipeline - **DELETE** (AudioTranscriber, QuestionRefiner, StreamingQuestionDetector, QuestionDetector)
- ❌ OpenAI dependency - **REMOVE** (no longer needed)
- ✅ New Gemini Live system is already organized properly in `electron/audio/`

This plan follows the Architecture Rules to create a clean, maintainable codebase.

---

## 🔥 KEY CHANGES FROM ORIGINAL PLAN

**Based on Gemini Live Migration Analysis:**

1. **AudioStreamProcessor.ts (937 lines):** ❌ DELETE (don't split) - Replaced by DualAudioCaptureManager
2. **Entire Whisper/regex pipeline:** ❌ DELETE - AudioTranscriber, QuestionRefiner, StreamingQuestionDetector, QuestionDetector
3. **OpenAI dependency:** ❌ REMOVE - No longer using Whisper API
4. **Old audio-stream-\* IPC handlers:** ❌ DELETE - Frontend migrated to dual-audio-\* handlers
5. **Estimated effort:** Reduced from 3-5 days to 2-3 days (less code to refactor)

**What's Already Good:**
- ✅ New Gemini Live system properly organized in `electron/audio/`
- ✅ IPC handlers already split by domain in `electron/ipc/`
- ✅ Frontend already migrated to new system

**Focus Areas:**
1. Delete obsolete code (biggest win)
2. Organize task documentation (quick win)
3. Move remaining root-level services to subdirectories
4. Split oversized React components

---

## Phase 1: Remove Obsolete Audio Pipeline (Day 1 - HIGH PRIORITY)

### 1.1 Delete Obsolete Whisper/Regex Pipeline

**VERIFIED: These files are NO LONGER USED (Gemini Live replaced them)**

**Electron Audio Files to DELETE:**
- ❌ `AudioStreamProcessor.ts` (937 lines) - Replaced by DualAudioCaptureManager
- ❌ `audio/AudioTranscriber.ts` - Whisper API (replaced by Gemini Live)
- ❌ `audio/QuestionRefiner.ts` - Regex refinement (replaced by Gemini prompt)
- ❌ `audio/StreamingQuestionDetector.ts` - Regex streaming (replaced by Gemini)
- ❌ `QuestionDetector.ts` - Base regex detection (replaced by Gemini)

**IPC Handlers to DELETE:**
- ❌ All `audio-stream-*` handlers in `ipc/audioHandlers.ts` (no longer called by frontend)
- ✅ Keep `dual-audio-*` handlers (new Gemini Live system)

**Dependencies to REMOVE:**
```bash
npm uninstall openai  # No longer using Whisper API
```

**Environment Variables to REMOVE:**
- ❌ `OPENAI_API_KEY` - No longer needed
- ✅ Keep `GEMINI_API_KEY` - Required for Gemini Live

### 1.2 Other Unused Files to Delete

**Electron (Main Process):**
- `WorkflowOptimizationManager.ts` (551 lines) - No imports found
- `OptimizationValidator.ts` (400 lines) - No imports found  
- `AdaptiveQualityManager.ts` (657 lines) - No imports found
- `AdaptiveAudioChunker.ts` (647 lines) - Check if used
- `ConnectionPoolManager.ts` (411 lines) - Check usage
- `PerformanceIpcHandlers.ts` - Check if registered
- `AudioDebugger.ts` - Check usage (commented out in main.ts)
- `shortcuts.ts` - Check if superseded by ShortcutsHelper

**Renderer (React):**
- `src/_pages/Debug.tsx` (418 lines) - Development only, move to dev-only
- `src/components/PerformanceDashboard.tsx` (354 lines) - Check usage

### 1.3 Verification Process
```bash
# Already verified - no imports found for audio pipeline files
rg "AudioStreamProcessor" --type ts  # No results
rg "audio-stream-start" --type ts    # No results
```

---

## Phase 2: Reorganize Electron (Main Process) - Days 2-3

### 2.1 Target Structure

```
electron/
├── main.ts                    # Entry point (keep minimal)
├── preload.ts                 # Preload script
├── tsconfig.json
│
├── core/                      # ✅ Already exists - Core app logic
│   ├── AppState.ts           # ✅ Central state manager
│   ├── EnvLoader.ts          # ✅ Environment config
│   ├── DeepLinkHandler.ts    # ✅ Protocol handling
│   ├── AuthCallbackServer.ts # ✅ OAuth callback
│   ├── AutoUpdateManager.ts  # ✅ Auto-updates
│   ├── PermissionWatcher.ts  # ✅ Permission monitoring
│   ├── ProcessSupervisor.ts  # ✅ Process management
│   └── UniversalPermissionManager.ts # ✅ Permission coordination
│
├── services/                  # NEW - Business logic services
│   ├── auth/
│   │   ├── AuthService.ts    # MOVE from root
│   │   └── TokenStorage.ts   # MOVE from root
│   ├── qna/
│   │   ├── QnAService.ts     # MOVE from root
│   │   └── DocumentService.ts # MOVE from root
│   ├── ai/
│   │   ├── LLMHelper.ts      # MOVE from root
│   │   ├── ModeManager.ts    # MOVE from root
│   │   └── ProcessingHelper.ts # MOVE from root
│   ├── audio/                # ✅ Already exists - consolidate here
│   │   ├── AudioStreamProcessor.ts # MOVE from root
│   │   ├── SystemAudioCapture.ts   # MOVE from root
│   │   ├── QuestionDetector.ts     # MOVE from root
│   │   ├── AudioTranscriber.ts     # ✅ Already here
│   │   ├── DualAudioCaptureManager.ts # ✅ Already here
│   │   ├── GeminiLiveQuestionDetector.ts # ✅ Already here
│   │   ├── QuestionRefiner.ts      # ✅ Already here
│   │   └── StreamingQuestionDetector.ts # ✅ Already here
│   ├── screenshot/
│   │   └── ScreenshotHelper.ts # MOVE from root
│   ├── window/
│   │   └── WindowHelper.ts   # MOVE from root
│   ├── usage/
│   │   ├── UsageTracker.ts   # MOVE from root
│   │   └── LocalUsageManager.ts # MOVE from root
│   └── permissions/
│       └── PermissionStorage.ts # MOVE from root
│
├── ipc/                       # ✅ Already organized
│   ├── index.ts              # ✅ Main registration
│   ├── audioHandlers.ts      # ✅ Audio IPC
│   ├── authHandlers.ts       # ✅ Auth IPC
│   ├── llmHandlers.ts        # ✅ LLM IPC
│   ├── qnaHandlers.ts        # ✅ Q&A IPC
│   ├── screenshotHandlers.ts # ✅ Screenshot IPC
│   ├── windowHandlers.ts     # ✅ Window IPC
│   ├── permissionHandlers.ts # ✅ Permission IPC
│   ├── diagnosticsHandlers.ts # ✅ Diagnostics IPC
│   ├── updateHandlers.ts     # ✅ Update IPC
│   └── utilityHandlers.ts    # ✅ Utility IPC
│
├── utils/                     # ✅ Already exists - Utilities
│   ├── Logger.ts             # ✅ Logging utility
│   ├── DiagnosticLogger.ts   # ✅ Diagnostic logging
│   └── HelperPermissionManager.ts # ✅ Helper permissions
│
├── config/                    # ✅ Already exists - Configuration
│   └── modes.json            # ✅ Mode definitions
│
├── decorators/                # ✅ Already exists - Decorators
│   └── PerformanceDecorators.ts # ✅ Performance decorators
│
└── __tests__/                 # ✅ Already exists - Tests
    ├── setup.ts
    ├── AdaptiveAudioChunker.test.ts
    ├── AudioStreamProcessor.test.ts
    └── SystemAudioCapture.test.ts
```

### 2.2 Migration Steps

**Step 1: Create service subdirectories**
```bash
mkdir -p electron/services/{auth,qna,ai,screenshot,window,usage,permissions}
```

**Step 2: Move files with git mv (preserves history)**
```bash
# Auth services
git mv electron/AuthService.ts electron/services/auth/
git mv electron/TokenStorage.ts electron/services/auth/

# Q&A services  
git mv electron/QnAService.ts electron/services/qna/
git mv electron/DocumentService.ts electron/services/qna/

# AI services
git mv electron/LLMHelper.ts electron/services/ai/
git mv electron/ModeManager.ts electron/services/ai/
git mv electron/ProcessingHelper.ts electron/services/ai/

# Audio services - ONLY move SystemAudioCapture (others already in audio/ or deleted)
git mv electron/SystemAudioCapture.ts electron/audio/
# NOTE: AudioStreamProcessor and QuestionDetector are DELETED (obsolete)

# Screenshot services
git mv electron/ScreenshotHelper.ts electron/services/screenshot/

# Window services
git mv electron/WindowHelper.ts electron/services/window/

# Usage services
git mv electron/UsageTracker.ts electron/services/usage/
git mv electron/LocalUsageManager.ts electron/services/usage/

# Permission services
git mv electron/PermissionStorage.ts electron/services/permissions/
```

**Step 3: Update all imports**
- Use find/replace to update import paths
- Test compilation after each batch

**Step 4: Update AppState.ts**
- Update service import paths
- Verify all service instantiation

---

## Phase 3: Split Oversized Files - Day 3

### 3.1 AudioStreamProcessor.ts (937 lines) - ❌ DELETE, DON'T SPLIT

**OBSOLETE:** This entire file is replaced by the new Gemini Live system.

**Why DELETE instead of split:**
- ✅ DualAudioCaptureManager (already exists) replaces this
- ✅ GeminiLiveQuestionDetector (already exists) handles question detection
- ✅ No Whisper transcription needed (Gemini Live does it)
- ✅ No regex refinement needed (Gemini prompt does it)
- ✅ Simpler architecture with fewer files

**Action:** DELETE this file completely (already verified not imported anywhere)

### 3.2 QueueCommands.tsx (1244 lines)

**Current Issues:**
- Handles all queue operations, chat, collections, modes
- Massive component with too many responsibilities

**Split into:**
```
src/components/Queue/
├── QueueCommands.tsx            # Main container (200 lines)
├── ChatInterface.tsx            # Chat UI (250 lines)
├── CollectionManager.tsx        # Collection CRUD (200 lines)
├── ModeSelector.tsx             # Mode selection (150 lines)
├── QuestionInput.tsx            # Question input (150 lines)
└── hooks/
    ├── useQueueOperations.ts    # Queue logic (150 lines)
    ├── useChatOperations.ts     # Chat logic (150 lines)
    └── useCollectionOperations.ts # Collection logic (150 lines)
```

### 3.3 Queue.tsx (756 lines)

**Split into:**
```
src/_pages/Queue/
├── index.tsx                    # Main page (150 lines)
├── QueueLayout.tsx              # Layout structure (150 lines)
├── QueueHeader.tsx              # Header section (100 lines)
├── QueueContent.tsx             # Content area (150 lines)
└── QueueSidebar.tsx             # Sidebar (150 lines)
```

### 3.4 Solutions.tsx (577 lines)

**Split into:**
```
src/_pages/Solutions/
├── index.tsx                    # Main page (150 lines)
├── SolutionDisplay.tsx          # Solution rendering (200 lines)
├── SolutionDebugger.tsx         # Debug interface (150 lines)
└── hooks/
    └── useSolutionOperations.ts # Solution logic (150 lines)
```

---

## Phase 4: Reorganize React (Renderer) - Day 4

### 4.1 Target Structure

```
src/
├── App.tsx                      # Root component
├── main.tsx                     # Entry point
├── index.css                    # Global styles
├── vite-env.d.ts
│
├── pages/                       # Rename from _pages/
│   ├── Queue/                   # Split into folder
│   │   ├── index.tsx
│   │   ├── QueueLayout.tsx
│   │   ├── QueueHeader.tsx
│   │   ├── QueueContent.tsx
│   │   └── QueueSidebar.tsx
│   ├── Solutions/               # Split into folder
│   │   ├── index.tsx
│   │   ├── SolutionDisplay.tsx
│   │   ├── SolutionDebugger.tsx
│   │   └── hooks/
│   │       └── useSolutionOperations.ts
│   └── Debug/                   # Move to dev-only
│       └── index.tsx
│
├── features/                    # NEW - Feature-based organization
│   ├── queue/
│   │   ├── components/
│   │   │   ├── QueueCommands.tsx
│   │   │   ├── ScreenshotQueue.tsx
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── CollectionManager.tsx
│   │   │   ├── ModeSelector.tsx
│   │   │   └── QuestionInput.tsx
│   │   └── hooks/
│   │       ├── useQueueOperations.ts
│   │       ├── useChatOperations.ts
│   │       └── useCollectionOperations.ts
│   ├── solutions/
│   │   └── components/
│   │       └── SolutionCommands.tsx
│   ├── audio/
│   │   ├── components/
│   │   │   ├── QuestionSidePanel.tsx
│   │   │   ├── AudioSettings.tsx
│   │   │   ├── AudioSourceSelector.tsx
│   │   │   ├── AudioLevelIndicator.tsx
│   │   │   └── AudioTroubleshootingHelp.tsx
│   │   └── services/
│   │       └── MicrophoneCapture.ts
│   └── auth/
│       └── components/
│           └── FirstLaunchSetup.tsx
│
├── components/                  # Shared/common components only
│   └── ui/                      # UI primitives
│       ├── auth-dialog.tsx
│       ├── permission-dialog.tsx
│       ├── mode-select.tsx
│       ├── update-dialog.tsx
│       ├── dev-auth-dialog.tsx
│       └── [other Radix wrappers]
│
├── hooks/                       # Shared hooks
│   └── useVerticalResize.ts
│
├── services/                    # Renderer services
│   └── (keep existing)
│
├── types/                       # Type definitions
│   ├── electron.d.ts
│   ├── audio-stream.ts
│   ├── audio.ts
│   ├── modes.ts
│   ├── solutions.ts
│   └── index.tsx
│
├── lib/                         # Utilities
│   └── utils.ts
│
└── __tests__/                   # Tests
    └── (keep existing)
```

### 4.2 Migration Strategy

**Step 1: Create feature directories**
```bash
mkdir -p src/features/{queue,solutions,audio,auth}/{components,hooks,services}
mkdir -p src/pages/{Queue,Solutions,Debug}
```

**Step 2: Move components by feature**
```bash
# Queue feature
git mv src/components/Queue/* src/features/queue/components/
git mv src/_pages/Queue.tsx src/pages/Queue/index.tsx

# Solutions feature
git mv src/components/Solutions/* src/features/solutions/components/
git mv src/_pages/Solutions.tsx src/pages/Solutions/index.tsx

# Audio feature
git mv src/components/AudioListener/* src/features/audio/components/
git mv src/components/Audio*.tsx src/features/audio/components/
git mv src/services/MicrophoneCapture.ts src/features/audio/services/

# Auth feature
git mv src/components/FirstLaunchSetup.tsx src/features/auth/components/

# Debug page
git mv src/_pages/Debug.tsx src/pages/Debug/index.tsx
```

**Step 3: Update imports in App.tsx**

**Step 4: Remove empty directories**

---

## Phase 5: Extract Custom Hooks - Day 4

### 5.1 From QueueCommands.tsx

Extract these hooks:
```typescript
// src/features/queue/hooks/useQueueOperations.ts
export function useQueueOperations() {
  // Screenshot queue management
  // Delete, clear operations
}

// src/features/queue/hooks/useChatOperations.ts
export function useChatOperations() {
  // Chat state
  // Message sending
  // Response handling
}

// src/features/queue/hooks/useCollectionOperations.ts
export function useCollectionOperations() {
  // Collection CRUD
  // Collection selection
  // Document upload
}
```

### 5.2 From Queue.tsx

Extract:
```typescript
// src/features/queue/hooks/useQueueLayout.ts
export function useQueueLayout() {
  // Window resize
  // Panel visibility
  // Layout state
}
```

### 5.3 From Solutions.tsx

Extract:
```typescript
// src/features/solutions/hooks/useSolutionOperations.ts
export function useSolutionOperations() {
  // Solution generation
  // Debug operations
  // Refinement
}
```

---

## Phase 6: Create Utility Modules - Day 5

### 6.1 Shared Utilities

Create organized utility modules:

```
src/lib/
├── utils.ts                    # Keep existing
├── audio/
│   ├── audioUtils.ts          # Audio processing utilities
│   └── volumeUtils.ts         # Volume calculation utilities
├── formatting/
│   ├── codeFormatter.ts       # Code formatting
│   └── markdownFormatter.ts   # Markdown formatting
└── validation/
    ├── inputValidation.ts     # Input validation
    └── permissionValidation.ts # Permission checks
```

### 6.2 Electron Utilities

```
electron/utils/
├── Logger.ts                   # ✅ Keep
├── DiagnosticLogger.ts         # ✅ Keep
├── HelperPermissionManager.ts  # ✅ Keep
├── fileUtils.ts               # NEW - File operations
├── pathUtils.ts               # NEW - Path handling
└── errorUtils.ts              # NEW - Error formatting
```

---

## Phase 7: Documentation Updates - Day 5

### 7.1 Update Architecture Docs

Files to update:
- `.agent/system/ARCHITECTURE.md` - Reflect new structure
- `.agent/README.md` - Update project structure section
- `.agent/system/COMPONENT_MAP.md` - Create if doesn't exist

### 7.2 Add README files

Create README.md in each major directory:
- `electron/services/README.md` - Service layer overview
- `electron/ipc/README.md` - IPC handler documentation
- `src/features/README.md` - Feature organization guide
- `src/pages/README.md` - Page structure guide

---

## Phase 8: Testing & Validation - Day 5

### 8.1 Compilation Tests

```bash
# Test TypeScript compilation
npm run build

# Test Electron build
npm run electron:dev

# Test full build
npm run app:build
```

### 8.2 Functionality Tests

Manual testing checklist:
- [ ] Screenshot capture (Cmd+H)
- [ ] Window toggle (Cmd+Shift+Space)
- [ ] Audio recording
- [ ] Always-on listening
- [ ] Question detection
- [ ] AI answer generation
- [ ] Q&A collections
- [ ] Mode switching
- [ ] Authentication
- [ ] Permissions

### 8.3 Import Validation

```bash
# Check for broken imports
npm run build 2>&1 | grep "Cannot find module"

# Check for circular dependencies
npx madge --circular --extensions ts,tsx src/
npx madge --circular --extensions ts electron/
```

---

## Success Criteria

### Code Quality Metrics

**Before:**
- Largest file: 1244 lines (QueueCommands.tsx)
- Files > 500 lines: 8 files
- Root-level services: 15+ files
- Unused files: 5+ obsolete audio files + 5+ other unused files
- Dependencies: OpenAI (unused after Gemini Live migration)

**After:**
- Largest file: < 400 lines
- Files > 500 lines: 0 files
- Root-level services: 0 files (all in subdirs)
- Unused files: 0 files
- Dependencies: Only what's actively used (OpenAI removed)

### Organization Metrics

**Before:**
- Flat structure with 25+ files in electron/
- Mixed concerns in components
- No feature-based organization

**After:**
- Hierarchical structure with clear domains
- Single responsibility per file
- Feature-based organization in renderer
- Service layer pattern in main process

---

## Rollback Plan

If issues arise:

1. **Git branches:** Create `cleanup-phase-N` branches for each phase
2. **Commit frequently:** After each file move/split
3. **Test after each phase:** Don't proceed if tests fail
4. **Keep backups:** Tag before starting: `git tag pre-cleanup`

Rollback command:
```bash
git reset --hard pre-cleanup
```

---

## Implementation Order

### Priority 1 (Must Do - Day 1)
1. **DELETE obsolete audio pipeline** (Phase 1.1) - AudioStreamProcessor, Whisper/regex files
2. Remove other dead code (Phase 1.2) - WorkflowOptimizationManager, etc.
3. Remove OpenAI dependency and OPENAI_API_KEY

### Priority 2 (Should Do - Day 2)
4. Reorganize electron services (Phase 2)
5. Split QueueCommands.tsx (Phase 3.2)

### Priority 3 (Nice to Have - Day 3)
6. Reorganize React features (Phase 4)
7. Extract custom hooks (Phase 5)
8. Create utility modules (Phase 6)
9. Documentation updates (Phase 7)

---

## Risk Assessment

### Low Risk ✅
- **Deleting obsolete audio pipeline** (verified not imported, replaced by Gemini Live)
- Removing unused files (verified no imports)
- Moving files to subdirectories (preserves functionality)
- Creating new directories
- Removing OpenAI dependency (no longer used)

### Medium Risk ⚠️
- Splitting large files (requires careful extraction)
- Updating import paths (many files affected)
- Extracting hooks (may affect component behavior)

### High Risk 🔴
- ~~Splitting AudioStreamProcessor~~ **CANCELLED** (file is deleted instead)
- Refactoring AppState imports (affects entire app)

**Mitigation:** Test thoroughly after each phase, commit frequently

**Risk Reduction:** Deleting obsolete audio pipeline is LOW RISK because:
- Already verified no imports exist
- Gemini Live system is already working
- Frontend already migrated to dual-audio-* handlers

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Create feature branch:** `git checkout -b feature/project-cleanup`
3. **Start with Phase 1:** Remove dead code (lowest risk)
4. **Proceed incrementally:** One phase at a time
5. **Update this document:** Mark completed phases

---

## Phase 0: Organize Task Documentation (Quick Win - 30 minutes)

### Current Problem
- `.agent/tasks/` has grown to 30+ files
- Mix of completed, in-progress, and planned tasks
- Hard to find relevant documentation
- No clear organization by status or domain

### Proposed Organization

```
.agent/tasks/
├── ACTIVE/                          # Currently working on
│   └── PROJECT_CLEANUP_REORGANIZATION.md
│
├── COMPLETED/                       # Finished tasks (archive)
│   ├── audio/
│   │   ├── DUAL_AUDIO_TRANSCRIPTION_IMPROVEMENT.md ✅
│   │   ├── QUESTION_DETECTION_SPEED_OPTIMIZATION.md ✅
│   │   ├── AUDIOTEE_INTEGRATION_PLAN.md ✅
│   │   └── IMPLEMENTATION_SUMMARY.md ✅
│   ├── auth/
│   │   └── PERSISTENT_AUTH.md ✅
│   ├── ui/
│   │   ├── GEMINI_OUTPUT_IMPROVEMENTS.md ✅
│   │   ├── CHAT_ANSWER_PANEL_UX_IMPROVEMENTS.md ✅
│   │   └── PROFILE_DROPDOWN_FIX.md ✅
│   └── releases/
│       ├── NOTARIZATION_FIX_SUMMARY.md ✅
│       └── AUDIOTEE-PACKAGING-ROOT-CAUSE.md ✅
│
├── PLANNED/                         # Future work
│   ├── LIVE_DETECTION_PRICING.md
│   ├── WINDOWS_SYSTEM_AUDIO_PLAN.md
│   └── FLOATING_BAR_UI_MIGRATION.md
│
└── REFERENCE/                       # Guides and documentation
    ├── CODE_RESTRUCTURE.md
    ├── CLEANUP_VISUAL_GUIDE.md
    └── hybrid.MD
```

### Migration Commands

```bash
cd .agent/tasks

# Create new structure
mkdir -p ACTIVE COMPLETED/{audio,auth,ui,releases,windows} PLANNED REFERENCE

# Move completed audio tasks
git mv AUDIO/DUAL_AUDIO_TRANSCRIPTION_IMPROVEMENT.md COMPLETED/audio/
git mv AUDIO/QUESTION_DETECTION_SPEED_OPTIMIZATION.md COMPLETED/audio/
git mv AUDIO/AUDIOTEE_INTEGRATION_PLAN.md COMPLETED/audio/
git mv AUDIO/IMPLEMENTATION_SUMMARY.md COMPLETED/audio/
git mv AUDIO/PRODUCTION_AUDIO_FAILURE.md COMPLETED/audio/
git mv AUDIO/geminiliveapi.md COMPLETED/audio/

# Move completed auth tasks
git mv PERSISTENT_AUTH.md COMPLETED/auth/

# Move completed UI tasks
git mv GEMINI_OUTPUT_IMPROVEMENTS.md COMPLETED/ui/
git mv CHAT_ANSWER_PANEL_UX_IMPROVEMENTS.md COMPLETED/ui/
git mv UI/PROFILE_DROPDOWN_FIX.md COMPLETED/ui/
git mv UI/QUEUE_COMMAND_UI_IMPROVEMENTS.md COMPLETED/ui/

# Move completed release tasks
git mv NOTARIZATION_FIX_SUMMARY.md COMPLETED/releases/
git mv releases/AUDIOTEE-PACKAGING-ROOT-CAUSE.md COMPLETED/releases/
git mv releases/packaging.md COMPLETED/releases/

# Move active task
git mv PROJECT_CLEANUP_REORGANIZATION.md ACTIVE/

# Move planned tasks
git mv LIVE_DETECTION_PRICING.md PLANNED/
git mv WINDOWS/WINDOWS_SYSTEM_AUDIO_PLAN.md PLANNED/
git mv UI/FLOATING_BAR_UI_MIGRATION.md PLANNED/

# Move reference docs
git mv UI/CODE_RESTRUCTURE.md REFERENCE/
git mv CLEANUP_VISUAL_GUIDE.md REFERENCE/
git mv hybrid.MD REFERENCE/

# Remove empty directories
rmdir AUDIO UI WINDOWS releases update 2>/dev/null || true
```

### Benefits
- ✅ Easy to find active work
- ✅ Completed tasks archived but accessible
- ✅ Clear separation of status
- ✅ Domain-based organization within COMPLETED
- ✅ Cleaner root directory

---

**Status:** 📋 Ready for Review  
**Last Updated:** 2025-11-12 (Refined for Gemini Live migration)
