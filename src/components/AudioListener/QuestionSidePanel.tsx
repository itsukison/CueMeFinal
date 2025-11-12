import React, { useState, useEffect, useRef, useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { DetectedQuestion, AudioStreamState } from "../../types/audio-stream";

interface QuestionSidePanelProps {
  questions: DetectedQuestion[];
  audioStreamState: AudioStreamState | null;
  onAnswerQuestion: (
    question: DetectedQuestion,
    collectionId?: string
  ) => Promise<{ response: string; timestamp: number }>;
  responseMode: {
    type: "plain" | "qna";
    collectionId?: string;
    collectionName?: string;
  };
  className?: string;
  onCloseQuestions?: () => void;  // Close question panel only
  onCloseChat?: () => void;  // Close chat/answer panel only
  // New props for unified chat/answer panel
  isChatOpen?: boolean;
  chatMessages?: Array<{ role: "user" | "gemini"; text: string }>;
  chatInput?: string;
  onChatInputChange?: (value: string) => void;
  onChatSend?: () => void;
  chatLoading?: boolean;
}

interface QuestionItemProps {
  question: DetectedQuestion;
  isSelected: boolean;
  onClick: () => void;
}

const QuestionItem: React.FC<QuestionItemProps> = ({
  question,
  isSelected,
  onClick,
}) => {
  const refined = (question as any).refinedText as string | undefined;
  const displayText =
    refined && refined.trim().length > 0 ? refined : question.text;

  return (
    <div
      className={`p-3 cursor-pointer transition-all rounded-lg ${
        isSelected ? "bg-white/10" : "bg-transparent hover:bg-white/5"
      }`}
      onClick={onClick}
    >
      <p className="text-xs text-white/90 leading-relaxed">{displayText}</p>
    </div>
  );
};

const QuestionSidePanel: React.FC<QuestionSidePanelProps> = ({
  questions,
  audioStreamState,
  onAnswerQuestion,
  responseMode = { type: "plain" },
  className = "",
  onCloseQuestions,
  onCloseChat,
  isChatOpen = false,
  chatMessages = [],
  chatInput = "",
  onChatInputChange,
  onChatSend,
  chatLoading = false,
}) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  );
  const [generatingAnswer, setGeneratingAnswer] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [showAnswerPanel, setShowAnswerPanel] = useState(false);

  // Filter to only show refined questions
  const refinedQuestions = useMemo(() => {
    const seen = new Set<string>();
    const result: DetectedQuestion[] = [];

    for (const q of questions) {
      const refined: string | undefined = (q as any).refinedText;
      // Only include questions that have been refined
      if (refined && refined.trim().length > 0) {
        const norm = refined.toLowerCase().replace(/\s+/g, " ");
        if (!seen.has(norm)) {
          seen.add(norm);
          result.push(q);
        }
      }
    }

    // Sort by timestamp, newest first
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [questions]);

  const handleQuestionClick = async (question: DetectedQuestion) => {
    setSelectedQuestionId(question.id);
    setShowAnswerPanel(true); // Show answer panel

    // Check if we already have an answer cached
    const cachedAnswer = answers.get(question.id);
    if (cachedAnswer) {
      setCurrentAnswer(cachedAnswer);
      return;
    }

    // Generate new answer with streaming
    setGeneratingAnswer(true);
    setCurrentAnswer(""); // Start with empty string for streaming

    try {
      const collectionId =
        responseMode.type === "qna" ? responseMode.collectionId : undefined;
      
      // Use streaming API directly for real-time updates
      let streamingResponse = "";
      let chunkCount = 0;
      const startTime = Date.now();

      const result = await window.electronAPI.audioStreamAnswerQuestionStreaming(
        question.text,
        collectionId,
        (chunk: string) => {
          chunkCount++;
          const now = Date.now();
          const latency = now - startTime;

          // Log performance for debugging
          console.log(`[QuestionSidePanel] Chunk ${chunkCount} (${chunk.length} chars) arrived in ${latency}ms`);

          // Append each chunk as it arrives
          streamingResponse += chunk;

          // Use flushSync to prevent React batching and ensure immediate UI updates
          import('react-dom').then(({ flushSync }) => {
            flushSync(() => {
              setCurrentAnswer(streamingResponse);
            });
          }).catch(() => {
            // Fallback if flushSync fails
            setCurrentAnswer(streamingResponse);
          });
        }
      );

      // Cache the final answer
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(question.id, result.response);
        return next;
      });

      // Ensure final answer is set (should already be set by streaming)
      setCurrentAnswer(result.response);
    } catch (error: any) {
      console.error("Failed to answer question with streaming:", error);

      // Check if it's a streaming-specific error and fallback to non-streaming
      if (error.message?.includes('streaming') || error.code === 'STREAMING_ERROR') {
        console.log('[QuestionSidePanel] Falling back to non-streaming mode...');
        try {
          const result = await window.electronAPI.audioStreamAnswerQuestion(
            question.text,
            collectionId
          );
          setCurrentAnswer(result.response);

          // Cache the answer
          setAnswers((prev) => {
            const next = new Map(prev);
            next.set(question.id, result.response);
            return next;
          });
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError);
          setCurrentAnswer("回答の生成中にエラーが発生しました。もう一度お試しください。");
        }
      } else {
        setCurrentAnswer("回答の生成中にエラーが発生しました。もう一度お試しください。");
      }
    } finally {
      setGeneratingAnswer(false);
    }
  };

  const isListening = audioStreamState?.isListening || false;

  // Determine what to show
  const hasQuestions = refinedQuestions.length > 0 || isListening;
  const shouldShowUnifiedPanel = showAnswerPanel || isChatOpen; // Show when user clicks question or opens chat
  
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
            : "w-full max-w-lg"  // Centered when only questions - reduced from max-w-2xl to max-w-lg
        }`}
      >
        {hasQuestions && (
          <div className="liquid-glass chat-container p-4 flex flex-col h-full min-h-[80px] relative">
            {/* Close Button - Question Panel (always show when questions exist) */}
            {onCloseQuestions && (
              <button
                onClick={onCloseQuestions}
                className="absolute top-3 right-3 w-5 h-5 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center transition-colors z-10"
                type="button"
                title="質問パネルを閉じる"
              >
                <svg
                  className="w-3 h-3 text-white/60 hover:text-white/90 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}

          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-[#D8F9B8]" />
            <span className="text-sm font-medium text-white/90">
              検出された質問
            </span>
            {refinedQuestions.length > 0 && (
              <span className="bg-[#D8F9B8]/20 text-[#D8F9B8] text-xs px-2 py-0.5 rounded-full">
                {refinedQuestions.length}
              </span>
            )}
            {isListening && (
              <div className="ml-auto flex items-center gap-1">
                <div className="w-2 h-2 bg-[#D8F9B8] rounded-full animate-pulse" />
                <span className="text-[10px] text-[#D8F9B8]">リスニング中</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            {refinedQuestions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-8 h-8 text-white/30 mx-auto mb-2" />
                  <p className="text-xs text-white/50">質問を検出中...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-1 overflow-y-auto flex-1 min-h-0 morphism-scrollbar">
                {refinedQuestions.map((question) => (
                  <QuestionItem
                    key={question.id}
                    question={question}
                    isSelected={selectedQuestionId === question.id}
                    onClick={() => handleQuestionClick(question)}
                  />
                ))}
              </div>
            )}
          </div>
          </div>
        )}
      </div>

      {/* Unified Chat/Answer Panel - Dynamic width and visibility */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          showBothPanels
            ? "w-1/2 opacity-100 ml-1"  // Split view: right side
            : shouldShowUnifiedPanel
            ? "w-full max-w-lg opacity-100"  // Centered when only chat - reduced from max-w-2xl to max-w-lg
            : "w-0 opacity-0"  // Hidden
        }`}
      >
        {shouldShowUnifiedPanel && (
          <div className="liquid-glass chat-container p-4 flex flex-col h-full min-h-[100px] relative">
            {/* Close Button - Always show when unified panel is visible */}
            {onCloseChat && (
              <button
                onClick={() => {
                  // Close chat and clear answer state
                  onCloseChat();
                  setShowAnswerPanel(false);
                  setSelectedQuestionId(null);
                  setCurrentAnswer(null);
                }}
                className="absolute top-3 right-3 w-5 h-5 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center transition-colors z-10"
                type="button"
                title="チャットを閉じる"
              >
                <svg
                  className="w-3 h-3 text-white/60 hover:text-white/90 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}

            {/* Header - Always show */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
              <img src="./logo.png" alt="CueMe Logo" className="w-4 h-4" />
              <span className="text-sm font-medium text-white/90">AI回答</span>
            </div>

            {/* Content Area - Shows answer OR chat messages OR placeholder */}
            <div className="flex-1 flex flex-col min-h-0">
              {(generatingAnswer || chatLoading) ? (
                <div className="flex items-center px-2">
                  <span className="text-xs text-white/70 mr-2">回答を生成中</span>
                  <div className="flex gap-0.5">
                    <div
                      className="w-1 h-1 bg-white/70 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    ></div>
                    <div
                      className="w-1 h-1 bg-white/70 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    ></div>
                    <div
                      className="w-1 h-1 bg-white/70 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    ></div>
                  </div>
                </div>
              ) : (currentAnswer || chatMessages.length > 0) ? (
                <div className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap overflow-y-auto flex-1 min-h-0 px-2 morphism-scrollbar">
                  {/* Show current answer OR latest chat message */}
                  {currentAnswer || (() => {
                    const lastGeminiMsg = [...chatMessages]
                      .reverse()
                      .find((msg) => msg.role === "gemini");
                    return lastGeminiMsg?.text || "";
                  })()}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center px-2">
                  <p className="text-xs text-white/40 text-center">
                    質問を入力するか、検出された質問をクリックしてください
                  </p>
                </div>
              )}
            </div>

            {/* Unified Input Bar - FUNCTIONAL */}
            <div className="mt-auto pt-3 flex-shrink-0">
              <form
                className="flex gap-2 items-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (onChatSend) {
                    onChatSend();
                  }
                }}
              >
                <input
                  className="flex-1 morphism-input px-3 py-2 text-white placeholder-white/60 text-xs focus:outline-none transition-all duration-200"
                  placeholder="メッセージを入力..."
                  value={chatInput}
                  onChange={(e) => onChatInputChange?.(e.target.value)}
                  disabled={generatingAnswer || chatLoading}
                />
                <button
                  type="submit"
                  className="text-white/70 hover:text-white transition-colors disabled:opacity-50"
                  disabled={generatingAnswer || chatLoading || !chatInput.trim()}
                  tabIndex={-1}
                  aria-label="送信"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 19.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z"
                    />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionSidePanel;
