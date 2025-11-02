# Chat & Answer Panel UX Improvements

## Status: ✅ Completed (with bug fixes v2)

## Problem Statement

Three UX issues need to be addressed to improve the chat and answer panel experience:

1. **Unnecessary close button in chat interface** - Close button appears even when only the input bar is visible (no answer displayed yet)
2. **Non-functional input bar in answer panel** - The input bar at the bottom of the answer panel (QuestionSidePanel) is just a display element showing "回答を表示中..." instead of being an editable input for follow-up questions
3. **Duplicate panels** - Currently there are TWO separate panels (chat interface + answer panel in QuestionSidePanel), but they should be MERGED into ONE unified panel that serves both purposes

## Core Concept: Unified Panel Architecture with Dynamic Layout

**Current (Wrong):**
```
[Question Panel] [Answer Panel from QuestionSidePanel]
[Chat Interface] (separate, can stack with above)
```

**Desired (Correct):**
```
Scenario 1: Chat open, no questions
[        Unified Chat/Answer Panel (centered, full width)        ]

Scenario 2: Questions detected, chat open
[Question Panel (left, 50%)] [Unified Chat/Answer Panel (right, 50%)]

Scenario 3: Questions detected, no chat
[Question Panel (centered, full width)]

Scenario 4: Question clicked (answer shown)
[Question Panel (left, 50%)] [Unified Chat/Answer Panel (right, 50%)]
```

The unified panel should:
- **Start centered** when opened via "会話" button (no questions)
- **Slide right** when questions appear, making space for question panel on left
- Display answers from both manual chat input AND detected questions
- Have ONE functional input bar for all interactions
- Maximum 2 panels on screen: Question Panel + Unified Chat/Answer Panel

## Current Implementation Analysis

### 1. Chat Interface (Queue.tsx)

**Location:** `src/_pages/Queue.tsx` (Lines ~710-860)

**Current Behavior:**
```tsx
{isChatOpen && (
  <div className="mt-4 w-full max-w-2xl liquid-glass chat-container p-4 flex flex-col relative overflow-hidden">
    {/* Close Button - ALWAYS VISIBLE */}
    <button onClick={() => setIsChatOpen(false)} className="absolute top-3 right-3 ...">
      {/* X icon */}
    </button>

    {/* Answer Display Area - Animates in when content appears */}
    <div className={chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === "gemini" 
      ? "opacity-100 scale-y-100 mb-3" 
      : "opacity-0 scale-y-0 h-0 mb-0"}>
      {/* Latest gemini message */}
    </div>

    {/* Loading indicator */}
    {chatLoading && <div>回答を生成中...</div>}

    {/* Input Form - Always visible at bottom */}
    <div className="mt-auto">
      <form onSubmit={handleChatSend}>
        <input value={chatInput} onChange={...} />
        <button type="submit">送信</button>
      </form>
    </div>
  </div>
)}
```

**Issue:** Close button is always visible, even when only input bar is shown (no answer yet).

### 2. Answer Panel (QuestionSidePanel.tsx)

**Location:** `src/components/AudioListener/QuestionSidePanel.tsx` (Lines ~275-285)

**Current Behavior:**
```tsx
{/* Input bar at bottom (chat-style) */}
<div className="mt-auto pt-3 flex-shrink-0">
  <div className="morphism-input px-3 py-2 text-xs text-white/60">
    回答を表示中...
  </div>
</div>
```

**Issue:** This is just a static display div, not an actual input field. Users cannot ask follow-up questions.

### 3. Duplicate Answer Display

**Current Flow:**
1. User opens chat interface (`isChatOpen = true`)
2. User starts listening, questions detected
3. User clicks a question in QuestionSidePanel
4. Answer appears in BOTH:
   - Chat interface (via `setChatMessages`)
   - Answer panel (via `setCurrentAnswer`)

**Code in Queue.tsx (Lines ~620-640):**
```tsx
const handleAnswerQuestion = async (question, collectionId) => {
  const result = await window.electronAPI.audioStreamAnswerQuestion(question.text, collectionId);
  
  // Show answer in chat - THIS CAUSES DUPLICATION
  setChatMessages((prev) => [
    ...prev,
    { role: "user", text: question.text },
    { role: "gemini", text: result.response },
  ]);
  
  // Cache the result
  answersCacheRef.current.set(question.id, result);
  return result;
};
```

## Solution Design

### Change 1: Conditional Close Button in Chat Interface

**Goal:** Only show close button when there's actual content (answer or loading state).

**Implementation:**
```tsx
{isChatOpen && (
  <div className="...">
    {/* Close Button - CONDITIONAL */}
    {(chatMessages.length > 0 || chatLoading) && (
      <button onClick={() => setIsChatOpen(false)} className="absolute top-3 right-3 ...">
        {/* X icon */}
      </button>
    )}
    
    {/* Rest of chat interface */}
  </div>
)}
```

**Logic:** Show close button only when:
- `chatMessages.length > 0` (has messages) OR
- `chatLoading === true` (generating answer)

### Change 2: Make Answer Panel Input Bar Functional

**Goal:** Convert static display div into functional input field for follow-up questions.

**Implementation:**

**Add state to QuestionSidePanel:**
```tsx
const [followUpInput, setFollowUpInput] = useState("");
const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
```

**Replace static div with functional input:**
```tsx
{/* Input bar at bottom (chat-style) */}
<div className="mt-auto pt-3 flex-shrink-0">
  <form
    className="flex gap-2 items-center"
    onSubmit={async (e) => {
      e.preventDefault();
      if (!followUpInput.trim() || !selectedQuestionId) return;
      
      setIsFollowUpLoading(true);
      try {
        // Create a follow-up question object
        const followUpQuestion: DetectedQuestion = {
          id: `followup-${Date.now()}`,
          text: followUpInput,
          timestamp: Date.now(),
          confidence: 1.0,
        };
        
        // Use the same answer handler
        const result = await onAnswerQuestion(
          followUpQuestion,
          responseMode.type === "qna" ? responseMode.collectionId : undefined
        );
        
        // Update current answer with follow-up response
        setCurrentAnswer(result.response);
        setFollowUpInput("");
      } catch (error) {
        console.error("Failed to answer follow-up:", error);
      } finally {
        setIsFollowUpLoading(false);
      }
    }}
  >
    <input
      className="flex-1 morphism-input px-3 py-2 text-white placeholder-white/60 text-xs focus:outline-none"
      placeholder="フォローアップ質問を入力..."
      value={followUpInput}
      onChange={(e) => setFollowUpInput(e.target.value)}
      disabled={isFollowUpLoading || generatingAnswer}
    />
    <button
      type="submit"
      className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
      disabled={isFollowUpLoading || generatingAnswer || !followUpInput.trim()}
    >
      <svg className="w-4 h-4" /* send icon */>
        <path d="M4.5 19.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z" />
      </svg>
    </button>
  </form>
</div>
```

### Change 3: Merge Chat and Answer Panel into ONE Unified Panel

**Goal:** Eliminate the separate chat interface and answer panel. Create ONE unified panel that handles both chat interactions and question answers.

**Current Architecture (WRONG):**
- Chat Interface: Separate component in Queue.tsx (lines ~740-860)
- Answer Panel: Part of QuestionSidePanel.tsx (right side when question clicked)
- Result: Can have 3 panels on screen (Question + Answer + Chat) ❌

**New Architecture (CORRECT):**
- Question Panel: Left side (existing)
- Unified Chat/Answer Panel: Right side (replaces BOTH chat interface AND answer panel)
- Result: Maximum 2 panels on screen ✅

**Implementation Strategy:**

**Step 1: Remove standalone chat interface from Queue.tsx**
```tsx
// DELETE THIS ENTIRE SECTION (lines ~740-860)
{isChatOpen && (
  <div className="mt-4 w-full max-w-2xl liquid-glass chat-container ...">
    {/* Chat interface */}
  </div>
)}
```

**Step 2: Modify QuestionSidePanel to become the unified panel**

The answer panel in QuestionSidePanel should:
- Show when `isChatOpen === true` OR when a question is clicked
- Use the SAME panel for both purposes
- Have ONE functional input bar

**Modify Queue.tsx:**
```tsx
// Pass isChatOpen to control unified panel visibility
<QuestionSidePanel
  questions={detectedQuestions}
  audioStreamState={audioStreamState}
  onAnswerQuestion={handleAnswerQuestion}
  responseMode={responseMode}
  isChatOpen={isChatOpen}  // NEW: Controls unified panel
  chatMessages={chatMessages}  // NEW: Share chat state
  onChatSend={handleChatSend}  // NEW: Share chat handler
  chatLoading={chatLoading}  // NEW: Share loading state
  className="w-full h-full"
  onClose={() => {
    setIsChatOpen(false);  // Close unified panel
    // ... existing close logic
  }}
/>
```

**Step 3: Update QuestionSidePanel visibility logic**
```tsx
// Current: Show when listening OR has questions
{(audioStreamState?.isListening || detectedQuestions.length > 0) && (
  <QuestionSidePanel ... />
)}

// New: Show when listening OR has questions OR chat is open
{(audioStreamState?.isListening || detectedQuestions.length > 0 || isChatOpen) && (
  <QuestionSidePanel ... />
)}
```

**Step 4: Modify QuestionSidePanel.tsx for dynamic layout**

The component should handle THREE layout states:

**Layout State 1: Only questions (no chat/answer)**
```tsx
[Question Panel - centered, full width]
```

**Layout State 2: Only chat (no questions)**
```tsx
[Unified Chat/Answer Panel - centered, full width]
```

**Layout State 3: Both questions and chat/answer**
```tsx
[Question Panel - left, 50%] [Unified Chat/Answer Panel - right, 50%]
```

**Implementation:**
```tsx
interface QuestionSidePanelProps {
  // ... existing props
  isChatOpen?: boolean;  // NEW
  chatMessages?: Array<{ role: "user" | "gemini"; text: string }>;  // NEW
  onChatSend?: (message: string) => Promise<void>;  // NEW
  chatLoading?: boolean;  // NEW
}

const QuestionSidePanel: React.FC<QuestionSidePanelProps> = ({
  questions,
  audioStreamState,
  onAnswerQuestion,
  responseMode,
  isChatOpen = false,
  chatMessages = [],
  onChatSend,
  chatLoading = false,
  className,
  onClose,
}) => {
  // Determine what to show
  const hasQuestions = questions.length > 0 || audioStreamState?.isListening;
  const shouldShowUnifiedPanel = showAnswerPanel || isChatOpen;
  
  // Dynamic layout based on what's visible
  const showBothPanels = hasQuestions && shouldShowUnifiedPanel;

  return (
    <div className={`w-full h-full flex justify-center ${className}`}>
      {/* Question Panel - Dynamic width and visibility */}
      <div
        className={`transition-all duration-300 ${
          showBothPanels
            ? "w-1/2 mr-1"  // Split view: left side
            : shouldShowUnifiedPanel
            ? "w-0 opacity-0"  // Hide when only chat is open
            : "w-full max-w-2xl"  // Centered when only questions
        }`}
      >
        {hasQuestions && (
          <div className="liquid-glass chat-container p-4 flex flex-col h-full min-h-[200px] relative">
            {/* Question list content */}
          </div>
        )}
      </div>

      {/* Unified Chat/Answer Panel - Dynamic width and visibility */}
      <div
        className={`transition-all duration-300 ${
          showBothPanels
            ? "w-1/2 opacity-100 ml-1"  // Split view: right side
            : shouldShowUnifiedPanel
            ? "w-full max-w-2xl opacity-100"  // Centered when only chat
            : "w-0 opacity-0"  // Hidden
        }`}
      >
        {shouldShowUnifiedPanel && (
          <div className="liquid-glass chat-container p-4 flex flex-col h-full min-h-[200px] relative">
            {/* Close Button - Conditional */}
            {(currentAnswer || chatMessages.length > 0 || generatingAnswer || chatLoading) && (
              <button onClick={handleClose}>X</button>
            )}

            {/* Header */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <img src="./logo.png" alt="CueMe Logo" className="w-4 h-4" />
              <span className="text-sm font-medium text-white/90">AI回答</span>
            </div>

            {/* Content Area - Shows answer OR chat messages */}
            <div className="flex-1 flex flex-col min-h-0">
              {(generatingAnswer || chatLoading) ? (
                <div>回答を生成中...</div>
              ) : (currentAnswer || chatMessages.length > 0) ? (
                <div className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap overflow-y-auto flex-1 min-h-0 px-2 morphism-scrollbar">
                  {/* Show current answer OR latest chat message */}
                  {currentAnswer || chatMessages[chatMessages.length - 1]?.text}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-white/50">メッセージを入力してください</p>
                </div>
              )}
            </div>

            {/* Unified Input Bar - FUNCTIONAL */}
            <div className="mt-auto pt-3 flex-shrink-0">
              <form onSubmit={handleUnifiedSend}>
                <input
                  placeholder="メッセージを入力..."
                  value={unifiedInput}
                  onChange={(e) => setUnifiedInput(e.target.value)}
                  disabled={generatingAnswer || chatLoading}
                />
                <button type="submit">送信</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
```

## Files to Modify

1. ✅ `src/_pages/Queue.tsx`
   - **REMOVE** standalone chat interface component (lines ~740-860)
   - Pass chat-related props to QuestionSidePanel (`isChatOpen`, `chatMessages`, `onChatSend`, `chatLoading`)
   - Update QuestionSidePanel visibility condition to include `isChatOpen`

2. ✅ `src/components/AudioListener/QuestionSidePanel.tsx`
   - Add chat-related props to interface
   - Merge answer panel and chat functionality into ONE unified panel
   - Replace static input div with functional unified input
   - Show unified panel when `showAnswerPanel || isChatOpen`
   - Conditional close button (only when content exists)
   - Handle both question answers and chat messages in same panel

## Implementation Plan

### Phase 1: Remove Standalone Chat Interface (Queue.tsx)
- Delete the standalone chat interface component (lines ~740-860)
- Keep chat state (`isChatOpen`, `chatMessages`, `chatLoading`, `chatInput`)
- Keep chat handlers (`handleChatSend`, `handleChatToggle`)
- Test: Chat button still toggles state, but no separate panel appears

### Phase 2: Pass Chat Props to QuestionSidePanel (Queue.tsx)
- Add chat-related props to QuestionSidePanel component
- Update visibility condition: `(audioStreamState?.isListening || detectedQuestions.length > 0 || isChatOpen)`
- Test: Panel shows when chat button is clicked

### Phase 3: Merge Panels in QuestionSidePanel (QuestionSidePanel.tsx)
- Add chat props to interface
- Create unified input state
- Show answer panel when `showAnswerPanel || isChatOpen`
- Display content from either question answer OR chat messages
- Replace static input with functional unified input
- Add conditional close button
- Test: One unified panel serves both purposes

### Phase 4: Polish and Edge Cases
- Handle transitions smoothly
- Ensure no duplicate content
- Test all interaction flows
- Verify maximum 2 panels on screen

## Testing Checklist

### Architecture Verification
- [ ] Maximum 2 panels on screen at any time
- [ ] No standalone chat interface exists
- [ ] Question panel (left) + Unified panel (right) layout works

### Unified Panel Behavior
- [ ] Panel shows when "会話" button clicked
- [ ] Panel shows when question clicked
- [ ] Panel shows when listening starts
- [ ] Close button hidden when only input bar visible
- [ ] Close button appears when content exists
- [ ] Close button works to close unified panel

### Input Functionality
- [ ] Input bar accepts text in unified panel
- [ ] Send button disabled when empty
- [ ] Send button disabled during loading
- [ ] Can send chat messages
- [ ] Can send follow-up questions after clicking a question
- [ ] Input clears after sending

### Content Display
- [ ] Chat messages appear in unified panel
- [ ] Question answers appear in unified panel
- [ ] No duplicate content anywhere
- [ ] Loading states show correctly
- [ ] Smooth transitions between states

### Interaction Flows
- [ ] Flow 1: Click "会話" → unified panel opens centered → type message → answer appears
- [ ] Flow 2: Click question → unified panel opens → answer appears → can ask follow-up
- [ ] Flow 3: Listening → question detected → click question → answer in unified panel
- [ ] Flow 4: Chat open → click question → answer appears in same unified panel
- [ ] Flow 5: Question answered → click "会話" → can continue conversation in same panel

### Dynamic Layout Flows
- [ ] Layout 1: Chat open (centered) → questions detected → chat slides right, questions appear left
- [ ] Layout 2: Questions visible (centered) → click "会話" → questions slide left, chat appears right
- [ ] Layout 3: Both panels visible → close chat → questions slide back to center
- [ ] Layout 4: Both panels visible → stop listening (no questions) → chat slides back to center
- [ ] Layout 5: Smooth transitions with no visual glitches

## Edge Cases to Consider

1. **User closes chat while answer is generating**
   - Should answer still appear in QuestionSidePanel?
   - Solution: Track where answer was requested, show in appropriate panel

2. **User opens chat after clicking question**
   - Answer already showing in QuestionSidePanel
   - Solution: Keep answer in panel, don't duplicate in chat

3. **Follow-up question fails**
   - Show error message in answer panel
   - Don't clear previous answer

4. **Multiple follow-up questions rapidly**
   - Disable input during loading
   - Queue requests or cancel previous

## UI/UX Considerations

### Visual Feedback
- Loading states should be clear in both panels
- Smooth transitions when showing/hiding elements
- Consistent styling between chat and answer panel inputs

### User Flow
- Natural progression: Question → Answer → Follow-up
- Clear indication of which panel is active
- No confusion about where answers will appear

### Accessibility
- Input fields properly labeled
- Keyboard navigation works smoothly
- Screen reader friendly

## Completion Criteria

- ✅ Standalone chat interface completely removed
- ✅ ONE unified panel handles both chat and question answers
- ✅ Maximum 2 panels on screen (Question + Unified)
- ✅ Close button only appears when content exists
- ✅ Input bar is fully functional for all interactions
- ✅ No duplicate content anywhere
- ✅ Smooth transitions between states
- ✅ All interaction flows work correctly
- ✅ No visual glitches or layout issues

## Key Architectural Change

**Before:**
```
Components:
1. Chat Interface (Queue.tsx) - standalone panel
2. Question Panel (QuestionSidePanel.tsx - left side)
3. Answer Panel (QuestionSidePanel.tsx - right side)

Result: Can have 3 panels stacked/overlapping ❌
```

**After:**
```
Components (Dynamic Layout):
1. Question Panel (QuestionSidePanel.tsx - left side OR centered)
2. Unified Chat/Answer Panel (QuestionSidePanel.tsx - right side OR centered)

Layout Behavior:
- Only questions: Question panel centered (full width)
- Only chat: Unified panel centered (full width)
- Both: Question panel left (50%) + Unified panel right (50%)

Result: Maximum 2 panels, dynamic responsive layout ✅
```

## Visual Layout Examples

**Example 1: User clicks "会話" button (no questions detected)**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│         [Unified Chat/Answer Panel - Centered]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Example 2: User starts listening, questions detected**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│         [Question Panel - Centered]                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Example 3: Chat open + Questions detected (SPLIT VIEW)**
```
┌──────────────────────────┬──────────────────────────────┐
│                          │                              │
│  [Question Panel]        │  [Unified Chat/Answer Panel] │
│  (left, 50%)             │  (right, 50%)                │
│                          │                              │
└──────────────────────────┴──────────────────────────────┘
```

**Example 4: User clicks question (answer shown)**
```
┌──────────────────────────┬──────────────────────────────┐
│                          │                              │
│  [Question Panel]        │  [Unified Chat/Answer Panel] │
│  (left, 50%)             │  (right, 50%)                │
│                          │  Shows answer                │
└──────────────────────────┴──────────────────────────────┘
```

## Implementation Summary

### Changes Made

**Phase 1: Removed Standalone Chat Interface (Queue.tsx)**
- ✅ Deleted standalone chat interface component (lines ~740-860)
- ✅ Kept chat state and handlers for use in unified panel
- ✅ Updated QuestionSidePanel visibility condition to include `isChatOpen`

**Phase 2: Passed Chat Props to QuestionSidePanel (Queue.tsx)**
- ✅ Added props: `isChatOpen`, `chatMessages`, `chatInput`, `onChatInputChange`, `onChatSend`, `chatLoading`
- ✅ Updated visibility: `(audioStreamState?.isListening || detectedQuestions.length > 0 || isChatOpen)`
- ✅ Updated onClose handler to close chat when panel closes

**Phase 3: Implemented Unified Panel (QuestionSidePanel.tsx)**
- ✅ Added chat-related props to interface
- ✅ Implemented dynamic layout logic:
  - `hasQuestions`: Questions exist or listening
  - `shouldShowUnifiedPanel`: Answer panel or chat open
  - `showBothPanels`: Both conditions true (split view)
- ✅ Question panel: Hides when only chat open, centers when only questions, left side when both
- ✅ Unified panel: Hides when closed, centers when only chat, right side when both
- ✅ Conditional close button (only shows when content exists)
- ✅ Functional input bar for all interactions
- ✅ Content displays either question answer OR chat messages

### Result

**Before:** 3 separate panels (Question + Answer + Chat) ❌
**After:** Maximum 2 panels with dynamic layout ✅

**Layout States:**
1. Only questions → Question panel centered
2. Only chat → Unified panel centered
3. Both → Split view (50/50)

---

## Bug Fixes (Post-Implementation)

### Issue 1: Title and Placeholder Always Visible
**Problem:** When chat opens with just input bar (no content), "AI回答" title and "メッセージを入力してください" placeholder were always visible.

**Root Cause:** Header and placeholder were NOT conditional - they rendered whenever `shouldShowUnifiedPanel` was true.

**Fix:** Made header conditional on content existence:
```tsx
{/* Header - Only show when there's content */}
{(currentAnswer || chatMessages.length > 0 || generatingAnswer || chatLoading) && (
  <div className="flex items-center gap-2 mb-3 flex-shrink-0">
    <img src="./logo.png" alt="CueMe Logo" className="w-4 h-4" />
    <span className="text-sm font-medium text-white/90">AI回答</span>
  </div>
)}
```

Removed placeholder entirely (replaced with `null`):
```tsx
) : null}  // Instead of showing "メッセージを入力してください"
```

### Issue 2: Close Buttons Not Appearing Correctly
**Problem:** 
- When both panels visible, NO close buttons appeared until answer was generated
- Only one close button total instead of one per panel

**Root Cause:**
- **Question Panel Close Button:** Had condition `!shouldShowUnifiedPanel` - disappeared when unified panel opened
- **Unified Panel Close Button:** Had condition checking for content - didn't show when just input bar visible

**Fix:** 
1. **Question Panel:** Always show close button when questions exist (removed `!shouldShowUnifiedPanel` condition)
2. **Unified Panel:** Always show close button when panel is visible (removed content check condition)

```tsx
// Question Panel - Always show
{onClose && (
  <button onClick={onClose}>X</button>
)}

// Unified Panel - Always show
{onClose && (
  <button onClick={onClose}>X</button>
)}
```

**Result:** 
- ✅ Each panel has its own close button at all times
- ✅ Title only shows when there's content
- ✅ No placeholder when just input bar is visible

### Issue 3: Closing One Panel Closes Both (Dual Display Mode)
**Problem:** In dual display mode (both panels visible), clicking either close button closed BOTH panels.

**Root Cause:** Both close buttons called the same `onClose` handler in Queue.tsx, which did EVERYTHING:
```tsx
onClose={() => {
  setIsChatOpen(false);           // Close chat
  stopListening();                 // Stop listening
  setDetectedQuestions([]);        // Clear questions
}}
```

**Fix:** Split into TWO separate handlers:

**1. Question Panel Close Handler (`onCloseQuestions`):**
```tsx
onCloseQuestions={() => {
  // Only stop listening and clear questions
  if (audioStreamState?.isListening && queueCommandsRef.current?.stopListening) {
    queueCommandsRef.current.stopListening();
  }
  if (window.electronAPI?.audioStreamClearQuestions) {
    window.electronAPI.audioStreamClearQuestions();
  }
  setDetectedQuestions([]);
}}
```

**2. Chat/Answer Panel Close Handler (`onCloseChat`):**
```tsx
onCloseChat={() => {
  // Only close chat
  setIsChatOpen(false);
}}
```

**QuestionSidePanel.tsx Changes:**
- Updated interface: `onClose` → `onCloseQuestions` + `onCloseChat`
- Question panel close button calls `onCloseQuestions`
- Unified panel close button calls `onCloseChat` (and clears answer state)

**Result:**
- ✅ Closing question panel only stops listening and clears questions
- ✅ Closing chat panel only closes chat (unified panel)
- ✅ Each panel operates independently
- ✅ No unintended side effects

---

**Created:** 2025-11-02
**Completed:** 2025-11-02
**Bug Fixes v1:** 2025-11-02 (Title/placeholder + close button visibility)
**Bug Fixes v2:** 2025-11-02 (Independent panel closing)
**Priority:** High
**Actual Effort:** 2 hours (including all bug fixes)
**Complexity:** Medium-High (Architectural refactoring)
