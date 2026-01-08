Migrate to Regex-Based Japanese Question Detection
Replace Gemini Live API's direct audio-to-question detection with a transcription + regex pattern matching approach for improved reliability.

Feasibility Assessment
✅ Recommended Approach
Aspect	Assessment
Technical Feasibility	✅ High - Japanese has clear question markers
Implementation Effort	Medium (~4-6 files to modify/create)
Risk Level	Low - Non-destructive migration, Gemini Live code preserved
Expected Improvement	High - Regex patterns are deterministic vs. unreliable AI extraction
Why This Works Well for Japanese
Japanese questions have predictable linguistic markers:

Sentence-ending particles: か (ka), の (no - informal), かな (kana - wondering)
Interrogative words: 何 (nani), どこ (doko), だれ (dare), なぜ (naze), いつ (itsu), どう (dou), どれ (dore)
Request/prompt patterns: ～お願いします、～ください、～教えてください
Opinion patterns: ～どう思いますか、～いかがですか
Confirmation patterns: ～よろしいですか、～大丈夫ですか
Filler Words to Remove
| Filler | Reading | Meaning | |--------|---------|---------|| | あの(ー) | ano | um, er (pause) | | えーと | eeto | um, well | | えっと | etto | um (casual) | | えー | ee | uh | | その | sono | that (as filler) | | まあ | maa | well | | ね | ne | you know (mid-sentence) | | なんか | nanka | like, kinda |

Transcription API: Deepgram vs Whisper
Feature	Deepgram ✅	OpenAI Whisper
Real-time streaming	Native (<300ms latency)	Requires chunking (seconds of latency)
Japanese accuracy	~90% (Enhanced Japanese model)	~89% (varies)
Production WER	5.3–6.8%	~10.6%
Setup complexity	Simple REST/WebSocket	Needs GPU or API calls
Pricing	$0.0043/min	$0.006/min
TIP

Recommendation: Deepgram — Native streaming support is critical for real-time question detection. Deepgram's Enhanced Japanese model (released June 2024) offers lower latency and consistent accuracy.

WARNING

CLAUDE.md Conflict: The CLAUDE.md file explicitly says "DO NOT reintroduce old Whisper/regex pipeline." Since you've explicitly requested this change, I will proceed—but this is a deliberate policy override.

Proposed Changes
Component 1: New Regex Question Detector
[NEW] 
RegexQuestionDetector.ts
A new class that:

Receives transcribed text (from any transcription source)
Removes Japanese filler words using regex
Detects questions using regex patterns
Emits 
DetectedQuestion
 objects matching existing interface
Key patterns to implement:

// 1. GRAMMATICAL QUESTION ENDINGS (explicit question markers)
const QUESTION_ENDINGS = [
  /[？\?]$/,                           // Ends with question mark
  /か[。．]?$/,                         // Ends with か
  /の[？\?。．]?$/,                      // Ends with の (informal)
  /かな[？\?。．]?$/,                    // Ends with かな (wondering)
  /でしょうか[？\?。．]?$/,              // Polite question
  /ですかね[？\?。．]?$/,                // Softer question
  /ませんか[？\?。．]?$/,                // Negative question (invitation)
  /ないですか[？\?。．]?$/,              // Negative question
];
// 2. INTERROGATIVE WORDS (anywhere in sentence → likely question)
const INTERROGATIVES = [
  /何|なに|なん/,      // what
  /どこ/,             // where  
  /だれ|誰/,          // who
  /いつ/,             // when
  /なぜ|どうして/,     // why
  /どう|どのように/,   // how
  /どれ|どちら/,       // which
  /どんな|どういう/,   // what kind
  /いくつ|いくら/,     // how many/much
];
// 3. REQUEST/PROMPT PATTERNS (common interview prompts)
const REQUEST_PATTERNS = [
  /お願いします[。．]?$/,                // Please (request)
  /ください[。．]?$/,                    // Please give/do
  /教えてください/,                      // Please tell me
  /聞かせてください/,                    // Please let me hear
  /説明してください/,                    // Please explain
  /お聞かせください/,                    // Please tell (formal)
];
// 4. OPINION/THOUGHT PATTERNS
const OPINION_PATTERNS = [
  /どう思いますか/,                      // What do you think?
  /いかがですか/,                        // How about? (formal)
  /どうですか/,                          // How is it?
  /ご意見/,                              // Your opinion
  /お考え/,                              // Your thoughts
];
// 5. CONFIRMATION PATTERNS  
const CONFIRMATION_PATTERNS = [
  /よろしいですか/,                      // Is it okay?
  /大丈夫ですか/,                        // Is it alright?
  /問題ありませんか/,                    // No problems?
  /よろしいでしょうか/,                  // Would it be okay? (formal)
  /間違いありませんか/,                  // Is there no mistake?
];
// 6. FILLER WORD REMOVAL
const FILLERS = /^(あの(ー)?|えー(と)?|えっと|その|まあ|なんか|ちょっと)+[、,\s]*/g;
Component 2: Transcription Service (Browser-side)
[MODIFY] 
QueueCommands.tsx
Add Web Speech API integration for real-time transcription:

Create SpeechRecognition instance with Japanese language setting
Stream interim results to detect questions in real-time
Send transcribed text to main process via new IPC channel dual-audio-transcription
Alternative: If Web Speech API is not preferred, we can use a separate transcription endpoint.

Component 3: Connect Old Audio Pipeline to New Detector
[MODIFY] 
DualAudioCaptureManager.ts
Add a new mode useRegexDetection that:

Keeps Gemini Live sessions dormant (code preserved, not deleted)
Routes transcription text to RegexQuestionDetector instead
Emits question-detected events through existing pipeline
export class DualAudioCaptureManager extends EventEmitter {
   private geminiDetector: GeminiLiveQuestionDetector;
+  private regexDetector: RegexQuestionDetector;
   private systemAudioCapture: SystemAudioCapture;
   private isCapturing: boolean = false;
+  private useRegexDetection: boolean = true; // New flag - default to regex
+  // New method for transcription-based detection
+  public processTranscription(text: string, source: 'user' | 'opponent'): void {
+    if (this.useRegexDetection) {
+      this.regexDetector.detectQuestions(text, source);
+    }
+  }
Component 4: IPC Handler for Transcription
[MODIFY] 
audioHandlers.ts
Add new IPC handler to receive transcription from renderer:

ipcMain.handle('dual-audio-process-transcription', async (_, text: string, source: 'user' | 'opponent') => {
  const manager = AppState.getInstance().getDualAudioCaptureManager();
  if (manager) {
    manager.processTranscription(text, source);
  }
  return { success: true };
});
Component 5: Update Types & Preload
[MODIFY] 
preload.ts
Add new API method:

dualAudioProcessTranscription: (text: string, source: 'user' | 'opponent') => 
  ipcRenderer.invoke('dual-audio-process-transcription', text, source),
[MODIFY] 
electron.d.ts
Add type definition for the new method.

Architecture Diagram
Main Process
Renderer Process
Filler Removal
Pattern Match
question-detected
Future: needs own transcription
🔒 Preserved (Dormant)
GeminiLiveQuestionDetector
🎤 Microphone
Web Speech API(SpeechRecognition)
Transcribed Text
IPC: dual-audio-process-transcription
DualAudioCaptureManager
RegexQuestionDetector (NEW)
Cleaned Text
Question Detection
QuestionSidePanel
🔊 System Audio
Verification Plan
Automated Tests
NOTE

No existing test infrastructure for the audio pipeline. The only test file is 
SystemAudioCapture.test.ts
 which tests native audio capture, not question detection.

1. Unit Tests for RegexQuestionDetector (NEW)
Create electron/__tests__/RegexQuestionDetector.test.ts:

# Run with Jest
npx jest electron/__tests__/RegexQuestionDetector.test.ts
Test cases:

Detects questions ending with か
Detects questions with ？
Detects questions with interrogative words (何, どこ, etc.)
Removes filler words correctly
Returns empty for non-questions
Handles edge cases (empty string, just fillers)
2. Build Verification
npm run build
Ensures TypeScript compilation succeeds with new files.

Manual Verification
TIP

Since audio requires real speech input, manual testing is the primary verification method.

Step-by-step Manual Test:
Start the app in development mode:

npm start
Enable audio capture by clicking the microphone button in the app.

Speak the following test sentences in Japanese:

Sentence	Expected Result
"あのー、お名前は何ですか？"	Detected as question: "お名前は何ですか？"
"えっと、どこに住んでいますか？"	Detected as question: "どこに住んでいますか？"
"今日はいい天気ですね"	NOT detected (not a question)
"自己紹介をお願いします"	Context-dependent (request, not grammatical question — may or may not detect)
Verify in QuestionSidePanel:

Only questions should appear
Filler words should be stripped
Source label (user/opponent) should be correct
Implementation Order
Create RegexQuestionDetector.ts — core detection logic
Add unit tests for the detector
Modify 
DualAudioCaptureManager.ts
 — integrate new detector
Modify IPC handlers and preload
Modify QueueCommands.tsx — add Web Speech API
Manual integration testing
Update 
dualsummary.md
 with new architecture