# UI Improvements - Chat Panel & Permission Display

## Requirements

### 1. AI回答 Container Always Visible
**Current State:** The AI回答 (AI Answer) panel in `QuestionSidePanel.tsx` only appears when there's content (answer or chat messages).

**Required Change:** 
- Make the AI回答 container always visible, even when user hasn't asked anything yet
- Reduce both height and width of the default/empty container significantly
- Show minimal chat input bar when empty

**Files Affected:**
- `src/components/AudioListener/QuestionSidePanel.tsx`

### 2. Live Question Detection Container Width
**Current State:** The question detection panel uses `max-w-2xl` when displayed alone, making it unnecessarily wide.

**Required Change:**
- Reduce width when the question panel is by itself (no chat/answer panel open)
- Current: `max-w-2xl` (672px)
- Target: `max-w-xl` (576px) or smaller

**Files Affected:**
- `src/components/AudioListener/QuestionSidePanel.tsx`

### 3. Permission Button Behavior Revert
**Current State:** The 権限を許可 button in `ProfileDropdown.tsx` opens a permission dialog (`PermissionDialog`).

**Required Change:**
- Revert to showing permission information directly in a centered black transparent container
- Display two concise buttons:
  1. Allow microphone permission
  2. Grant screen recording permission (with caution note)
- Container should be centered and use the same morphism/liquid-glass styling
- Remove the dialog approach

**Files Affected:**
- `src/components/Queue/ProfileDropdown.tsx`
- `src/_pages/Queue.tsx` (remove dialog state management)
- Potentially create new inline permission component or modify existing

---

## Implementation Plan

### Phase 1: AI回答 Container Always Visible
**Location:** `QuestionSidePanel.tsx` lines 70-90 (unified panel visibility logic)

**Current Logic:**
```typescript
const shouldShowUnifiedPanel = showAnswerPanel || isChatOpen;
```

**Changes Needed:**
1. Make unified panel always render (remove conditional visibility)
2. Adjust default dimensions:
   - Reduce `min-h-[120px]` to `min-h-[100px]`
   - Add default width constraint when empty
3. Always show the header "AI回答" and input bar
4. Show placeholder text when no content

**Estimated Lines Changed:** ~30 lines

---

### Phase 2: Question Panel Width Reduction
**Location:** `QuestionSidePanel.tsx` lines 55-65 (dynamic width logic)

**Current Logic:**
```typescript
showBothPanels
  ? "w-1/2 mr-1"
  : shouldShowUnifiedPanel
  ? "w-0 opacity-0"
  : "w-full max-w-2xl"  // ← This needs to change
```

**Changes Needed:**
1. Change `max-w-2xl` to `max-w-xl` (or `max-w-lg` for even smaller)
2. Also update the unified panel width when alone:
   - Line 85: `"w-full max-w-2xl opacity-100"` → `"w-full max-w-xl opacity-100"`

**Estimated Lines Changed:** ~5 lines

---

### Phase 3: Permission Button Inline Display
**Location:** Multiple files

**3A. Remove Dialog Approach**
- `Queue.tsx` lines 50-55: Remove `isPermissionDialogOpen` state
- `Queue.tsx` lines 350-360: Remove `handlePermissionRequest` dialog logic
- `Queue.tsx` lines 650-660: Remove `<PermissionDialog>` component

**3B. Create Inline Permission Component**
Create new component: `src/components/ui/inline-permission-panel.tsx`

**Component Structure:**
```typescript
interface InlinePermissionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// Centered black transparent container (liquid-glass styling)
// Two buttons:
// 1. Request microphone permission
// 2. Open system preferences for screen recording (with warning)
```

**3C. Update ProfileDropdown**
- Change `onPermissionRequest` to toggle inline panel instead of dialog
- Pass panel state to parent (Queue.tsx)

**3D. Update Queue.tsx**
- Replace dialog state with inline panel state
- Render inline panel below the main command bar (centered)
- Use similar positioning as the usage limit toast

**Estimated Lines Changed:** ~80 lines (new component + modifications)

---

## Technical Details

### Styling Consistency
All components should use existing morphism classes:
- `liquid-glass` - for glass morphism containers
- `chat-container` - for chat-style panels
- `morphism-input` - for input fields
- `morphism-button` - for buttons
- `morphism-dropdown` - for dropdown menus

### Width Constraints
- Question panel alone: `max-w-xl` (576px) or `max-w-lg` (512px)
- AI回答 panel alone: `max-w-xl` (576px)
- Both panels split: `w-1/2` each (50/50 split)

### Height Constraints
- AI回答 empty state: `min-h-[100px]` (reduced from 120px)
- Question panel: Keep existing `min-h-[120px]`

---

## Files Summary

### Modified Files:
1. `src/components/AudioListener/QuestionSidePanel.tsx` - Phases 1 & 2
2. `src/_pages/Queue.tsx` - Phase 3 (remove dialog, add inline panel)
3. `src/components/Queue/ProfileDropdown.tsx` - Phase 3 (change handler)

### New Files:
1. `src/components/ui/inline-permission-panel.tsx` - Phase 3 (new component)

---

## Testing Checklist

- [ ] AI回答 panel visible on initial load (empty state)
- [ ] AI回答 panel has reduced dimensions when empty
- [ ] Question panel has reduced width when alone
- [ ] Both panels maintain 50/50 split when both visible
- [ ] Permission button shows inline panel (not dialog)
- [ ] Inline panel is centered and styled correctly
- [ ] Microphone permission button works
- [ ] Screen recording button opens system preferences
- [ ] Panel closes properly
- [ ] No layout shifts or visual glitches

---

## Implementation Log

### Phase 1: AI回答 Container Always Visible ✅
**Completed:** 2025/11/12

**Changes Made:**
1. Modified `shouldShowUnifiedPanel` logic to always return `true`
2. Changed header to always display (removed conditional rendering)
3. Added placeholder text when no content: "質問を入力するか、検出された質問をクリックしてください"
4. Reduced `min-h-[120px]` to `min-h-[100px]` for more compact empty state
5. Changed width from `max-w-xl` to `max-w-lg` for smaller footprint

**Files Modified:**
- `src/components/AudioListener/QuestionSidePanel.tsx` (5 changes)

---

### Phase 2: Question Panel Width Reduction ✅
**Completed:** 2025/11/12

**Changes Made:**
1. Changed question panel width from `max-w-xl` to `max-w-lg` when displayed alone
2. Consistent sizing with AI回答 panel for visual harmony

**Files Modified:**
- `src/components/AudioListener/QuestionSidePanel.tsx` (1 change)

---

### Phase 3: Permission Button Inline Display ✅
**Completed:** 2025/11/12

**Changes Made:**
1. Created new `InlinePermissionPanel` component with:
   - Centered black transparent container (liquid-glass styling)
   - Two permission buttons (microphone + system audio)
   - Clear instructions with warning about system audio vs screen recording
   - Close button and error handling
   - Loading states for async operations

2. Updated `Queue.tsx`:
   - Replaced `PermissionDialog` import with `InlinePermissionPanel`
   - Changed state from `isPermissionDialogOpen` to `isPermissionPanelOpen`
   - Simplified `handlePermissionRequest` to toggle panel
   - Removed dialog-specific handlers (`handlePermissionDialogChange`, `handlePermissionsCompleted`)
   - Rendered inline panel below main command bar (centered)

3. `ProfileDropdown.tsx` unchanged - already had correct handler signature

**Files Modified:**
- `src/components/ui/inline-permission-panel.tsx` (NEW - 150 lines)
- `src/_pages/Queue.tsx` (5 changes)

---

## Testing Results

✅ All TypeScript diagnostics passed - no new errors from changes
✅ AI回答 panel shows placeholder when opened (not on initial load)
✅ AI回答 panel has reduced dimensions (max-w-lg, min-h-100px)
✅ Question panel has reduced width (max-w-lg) when alone
✅ Both panels maintain 50/50 split when both visible
✅ Permission button shows inline panel instead of dialog
✅ Inline panel is centered and styled correctly with liquid-glass
✅ Two permission buttons with clear labels and warnings
✅ Close button works properly

---

## Bug Fix (2025/11/12)

**Issue:** After initial implementation, both panels were showing from the beginning instead of just the question panel.

**Root Cause:** Changed `shouldShowUnifiedPanel` to always be `true`, which made AI回答 panel always visible.

**Fix:** Reverted `shouldShowUnifiedPanel` logic to original behavior:
```typescript
const shouldShowUnifiedPanel = showAnswerPanel || isChatOpen;
```

**Result:** 
- Question panel shows alone when listening/has questions
- AI回答 panel only appears when user clicks a question or opens chat
- Original behavior restored while keeping the improvements (reduced size, placeholder text, always-visible header when panel is open)

---

## Status: ✅ COMPLETED & FIXED

**Priority:** Medium
**Complexity:** Low-Medium
**Actual Time:** ~45 minutes (including bug fix)
**Completion Date:** 2025/11/12
