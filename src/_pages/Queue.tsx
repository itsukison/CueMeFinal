import React, { useState, useEffect, useRef } from "react";
import { ModeSelect, ModeToggle } from "../components/ui/mode-select";
import { useQuery } from "react-query";
import { MessageCircle, Send } from "lucide-react";
import ScreenshotQueue from "../components/Queue/ScreenshotQueue";
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastVariant,
  ToastMessage,
} from "../components/ui/toast";
import QueueCommands, {
  QueueCommandsRef,
} from "../components/Queue/QueueCommands";
import QuestionSidePanel from "../components/AudioListener/QuestionSidePanel";
import { DetectedQuestion, AudioStreamState } from "../types/audio-stream";
import { useVerticalResize } from "../hooks/useVerticalResize";
import { ProfileDropdown } from "../components/Queue/ProfileDropdown";
// Removed AudioSettings import - dual audio capture is automatic

interface ResponseMode {
  type: "plain" | "qna";
  collectionId?: string;
  collectionName?: string;
}

interface QueueProps {
  setView: React.Dispatch<
    React.SetStateAction<"queue" | "solutions" | "debug">
  >;
  onSignOut: () => Promise<{ success: boolean; error?: string }>;
}

const Queue: React.FC<QueueProps> = ({ setView, onSignOut }) => {
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral",
  });
  const [showUsageLimitToast, setShowUsageLimitToast] = useState(false);

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "gemini"; text: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  // Removed isQuestionPanelOpen - panel shows automatically when listening or has questions
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Response mode state
  const [responseMode, setResponseMode] = useState<ResponseMode>({
    type: "plain",
  });

  // Mode state for new mode functionality
  const [currentMode, setCurrentMode] = useState("interview"); // デフォルトは面接モード

  // Audio stream state
  const [detectedQuestions, setDetectedQuestions] = useState<
    DetectedQuestion[]
  >([]);
  const [audioStreamState, setAudioStreamState] =
    useState<AudioStreamState | null>(null);

  // Audio listening state (no source selection needed - dual capture is automatic)
  const [isListening, setIsListening] = useState(false);

  // Ref to access QueueCommands methods
  const queueCommandsRef = useRef<QueueCommandsRef>(null);

  // Vertical resize hooks
  const chatResize = useVerticalResize({
    minHeight: 200,
    maxHeight: 600,
    initialHeight: 200,
  });
  const questionResize = useVerticalResize({
    minHeight: 120,  // Reduced for minimal chat input bar
    maxHeight: 600,
    initialHeight: 150,  // Reduced for compact initial view
  });

  const barRef = useRef<HTMLDivElement>(null);

  // Auto-expand panel when content is added
  useEffect(() => {
    const hasContent = detectedQuestions.length > 0 || chatMessages.length > 0;
    const hasAnswer = detectedQuestions.some(q => (q as any).refinedText);
    
    if (hasContent && questionResize.height < 300) {
      // Expand to comfortable viewing height when content appears
      questionResize.setHeight(350);
    } else if (!hasContent && questionResize.height > 150) {
      // Shrink back to minimal when no content
      questionResize.setHeight(150);
    }
  }, [detectedQuestions.length, chatMessages.length]);

  const { data: screenshots = [], refetch } = useQuery<
    Array<{ path: string; preview: string }>,
    Error
  >(
    ["screenshots"],
    async () => {
      try {
        const existing = await window.electronAPI.getScreenshots();
        return existing;
      } catch (error) {
        console.error("Error loading screenshots:", error);
        showToast(
          "エラー",
          "既存のスクリーンショットの読み込みに失敗しました",
          "error"
        );
        return [];
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    }
  );

  const showToast = (
    title: string,
    description: string,
    variant: ToastVariant
  ) => {
    setToastMessage({ title, description, variant });
    setToastOpen(true);
  };

  const handleUsageLimitError = () => {
    // Show usage limit specific toast
    setShowUsageLimitToast(true);
  };

  const handleSubscriptionUpgrade = () => {
    window.electronAPI
      .invoke(
        "open-external-url",
        "https://www.cueme.ink/dashboard/subscription"
      )
      .catch(console.error);
    setShowUsageLimitToast(false);
  };

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index];

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );

      if (response.success) {
        refetch();
      } else {
        console.error("Failed to delete screenshot:", response.error);
        showToast(
          "エラー",
          "スクリーンショットファイルの削除に失敗しました",
          "error"
        );
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    setChatMessages((msgs) => [...msgs, { role: "user", text: chatInput }]);
    setChatLoading(true);
    const currentInput = chatInput;
    setChatInput("");

    try {
      let response: string;

      if (responseMode.type === "qna" && responseMode.collectionId) {
        // Use mode-enabled RAG chat
        const result = await window.electronAPI.invoke(
          "gemini-chat-mode",
          currentInput,
          currentMode,
          responseMode.collectionId
        );
        response =
          result.text || result.modeResponse?.answer || result.response;
      } else {
        // Use mode-enabled plain chat
        const result = await window.electronAPI.invoke(
          "gemini-chat-mode",
          currentInput,
          currentMode
        );
        response =
          result.text || result.modeResponse?.answer || result.response;
      }

      setChatMessages((msgs) => [...msgs, { role: "gemini", text: response }]);
    } catch (err: any) {
      // Check if this is a usage limit error
      if (
        (err.message && err.message.includes("Usage limit exceeded")) ||
        (err.message && err.message.includes("Monthly limit")) ||
        (err.message && err.message.includes("Insufficient usage remaining"))
      ) {
        handleUsageLimitError();
      } else {
        // Handle other errors normally
        setChatMessages((msgs) => [
          ...msgs,
          { role: "gemini", text: "エラー: " + String(err) },
        ]);
      }
    } finally {
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight;
        const contentWidth = contentRef.current.scrollWidth;
        if (isTooltipVisible) {
          contentHeight += tooltipHeight;
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    updateDimensions();

    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "処理失敗",
          "スクリーンショットの処理中にエラーが発生しました。",
          "error"
        );
        setView("queue");
        console.error("Processing error:", error);
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "スクリーンショットなし",
          "処理するスクリーンショットがありません。",
          "neutral"
        );
      }),
    ];

    return () => {
      resizeObserver.disconnect();
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [isTooltipVisible, tooltipHeight]);

  // Seamless screenshot-to-LLM flow
  useEffect(() => {
    // Listen for screenshot taken event
    const unsubscribe = window.electronAPI.onScreenshotTaken(async (data) => {
      // Refetch screenshots to update the queue
      await refetch();
      // Show loading in chat
      setChatLoading(true);
      try {
        // Get the latest screenshot path
        const latest =
          data?.path ||
          (Array.isArray(data) &&
            data.length > 0 &&
            data[data.length - 1]?.path);
        if (latest) {
          // Call the LLM to process the screenshot
          const response = await window.electronAPI.invoke(
            "analyze-image-file",
            latest
          );
          setChatMessages((msgs) => [
            ...msgs,
            { role: "gemini", text: response.text },
          ]);
        }
      } catch (err: any) {
        // Check if this is a usage limit error
        if (
          (err.message && err.message.includes("Usage limit exceeded")) ||
          (err.message && err.message.includes("Monthly limit")) ||
          (err.message && err.message.includes("Insufficient usage remaining"))
        ) {
          handleUsageLimitError();
        } else {
          // Handle other errors normally
          setChatMessages((msgs) => [
            ...msgs,
            { role: "gemini", text: "エラー: " + String(err) },
          ]);
        }
      } finally {
        setChatLoading(false);
      }
    });
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [refetch]);

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible);
    setTooltipHeight(height);
  };

  const handleChatToggle = () => {
    setIsChatOpen(!isChatOpen);
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      const result = await onSignOut();
      if (result.success) {
        // Reset response mode when signing out
        setResponseMode({ type: "plain" });
        // Clear chat messages
        setChatMessages([]);
      }
    } catch (error) {
      console.error("Logout error:", error);
      showToast("エラー", "ログアウトに失敗しました", "error");
    }
  };

  // Settings handler
  const handleSettings = () => {
    window.electronAPI.invoke("open-external-url", "https://www.cueme.ink/");
  };

  // Permission request handler
  const handlePermissionRequest = async () => {
    try {
      console.log("[Queue] Opening permission request dialog...");

      // Check current permission status first
      const status = await window.electronAPI.invoke("permission-check-status");
      console.log("[Queue] Current permission status:", status);

      let hasRequestedAny = false;

      // Handle microphone permission
      if (status.microphone !== "granted") {
        console.log("[Queue] Microphone permission not granted, requesting...");
        hasRequestedAny = true;

        try {
          // First try to request programmatically
          const micResult = await window.electronAPI.invoke(
            "permission-request-microphone"
          );
          if (micResult.granted) {
            showToast("権限許可", "マイクの権限が許可されました", "success");
          } else {
            // If denied, open system preferences for microphone
            console.log(
              "[Queue] Microphone permission denied, opening system preferences..."
            );
            await window.electronAPI.invoke(
              "permission-open-system-preferences",
              "microphone"
            );
            showToast(
              "マイクの設定",
              "システム環境設定が開きました。セキュリティとプライバシー → マイクでCueMeを有効にしてください。",
              "neutral"
            );
          }
        } catch (error) {
          console.error(
            "[Queue] Error requesting microphone permission:",
            error
          );
          // Fallback to opening system preferences
          await window.electronAPI.invoke(
            "permission-open-system-preferences",
            "microphone"
          );
          showToast(
            "マイクの設定",
            "システム環境設定が開きました。セキュリティとプライバシー → マイクでCueMeを有効にしてください。",
            "neutral"
          );
        }
      }

      // Handle screen recording permission (cannot be requested programmatically)
      if (status.screenCapture !== "granted") {
        console.log(
          "[Queue] Screen recording permission not granted, opening system preferences..."
        );
        hasRequestedAny = true;

        await window.electronAPI.invoke(
          "permission-open-system-preferences",
          "screen"
        );
        showToast(
          "画面収録の設定",
          "システム環境設定が開きました。セキュリティとプライバシー → 画面収録でCueMeを有効にしてください。",
          "neutral"
        );
      }

      // If both permissions are already granted
      if (
        status.microphone === "granted" &&
        status.screenCapture === "granted"
      ) {
        showToast("権限確認", "すべての権限が許可されています。", "success");
      } else if (hasRequestedAny) {
        // Show additional guidance for users
        setTimeout(() => {
          showToast(
            "再起動のお知らせ",
            "権限を変更した後は、アプリを再起動することをお勧めします。",
            "neutral"
          );
        }, 3000);
      }
    } catch (error) {
      console.error("[Queue] Error requesting permissions:", error);
      showToast("エラー", "権限の確認に失敗しました", "error");
    }
  };

  const handleResponseModeChange = (mode: ResponseMode) => {
    setResponseMode(mode);
  };

  // Audio stream event handlers
  const handleQuestionDetected = (question: DetectedQuestion) => {
    console.log("[Queue] Question detected (pre-refined):", question);
    // Questions now come pre-refined from the new immediate processing pipeline
    setDetectedQuestions((prev) => [...prev, question]);
  };

  const handleAudioStreamStateChange = (state: AudioStreamState) => {
    console.log("[Queue] Audio stream state changed:", state);
    setAudioStreamState(state);

    // Update listening state
    setIsListening(state.isListening || false);

    // No audio source management needed - dual capture is automatic
  };

  // Panel automatically shows when listening starts (no manual state needed)

  const answersCacheRef = useRef<
    Map<string, { response: string; timestamp: number }>
  >(new Map());

  const handleAnswerQuestion = async (
    question: DetectedQuestion,
    collectionId?: string
  ): Promise<{ response: string; timestamp: number }> => {
    try {
      console.log(
        "[Queue] Answering question:",
        question.text,
        "with collection:",
        collectionId
      );

      // Memoization: return cached response if present
      const cached = answersCacheRef.current.get(question.id);
      if (cached) {
        console.log("[Queue] Returning cached answer");
        // Also surface in chat to keep UX consistent
        setChatMessages((prev) => [
          ...prev,
          { role: "user", text: question.text },
          { role: "gemini", text: cached.response },
        ]);
        return cached;
      }

      const result = await (
        window.electronAPI as any
      ).audioStreamAnswerQuestion(question.text, collectionId);

      console.log("[Queue] Question answered:", result);

      // Show answer in chat
      setChatMessages((prev) => [
        ...prev,
        { role: "user", text: question.text },
        { role: "gemini", text: result.response },
      ]);

      // Cache the result
      answersCacheRef.current.set(question.id, result);
      return result;
    } catch (error: any) {
      console.error("[Queue] Failed to answer question:", error);

      // Handle usage limit errors
      if (
        error.message &&
        (error.message.includes("Usage limit exceeded") ||
          error.message.includes("Monthly limit") ||
          error.message.includes("Insufficient usage remaining"))
      ) {
        handleUsageLimitError();
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "user", text: question.text },
          { role: "gemini", text: "エラー: " + error.message },
        ]);
      }
      throw error;
    }
  };

  // Audio Stream event listeners setup
  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onAudioStreamStateChanged(
        (state: AudioStreamState) => {
          console.log("[Queue] Audio stream state changed:", state);
          setAudioStreamState(state);

          // Update listening state
          setIsListening(state.isListening || false);

          // No audio source management needed - dual capture is automatic
        }
      ),

      window.electronAPI.onAudioStreamError((error: string) => {
        console.error("[Queue] Audio stream error:", error);

        // For actual failures, stop listening
        setIsListening(false);
      }),
    ];

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, []);

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleChatToggle = () => {
      setIsChatOpen((prev) => !prev);
    };

    const handleListenToggle = () => {
      // Trigger the listen button in QueueCommands
      if (queueCommandsRef.current) {
        // Call the exposed stopListening method, or we can add a toggle method
        console.log("[Queue] Listen toggle triggered via Command+L");
        // Since we don't have a toggle method exposed, we'll trigger the button click
        // by dispatching a custom event that QueueCommands can listen to
        document.dispatchEvent(new CustomEvent("trigger-listen-toggle"));
      }
    };

    // Handle usage limit events from voice recording
    const handleUsageLimitExceeded = () => {
      handleUsageLimitError();
    };

    // Set up keyboard shortcut listeners using proper electronAPI pattern
    const setupIpcListeners = () => {
      try {
        if (window.electronAPI) {
          const cleanupChatToggle =
            window.electronAPI.onChatToggle(handleChatToggle);
          const cleanupListenToggle =
            window.electronAPI.onListenToggle(handleListenToggle);

          return () => {
            cleanupChatToggle();
            cleanupListenToggle();
          };
        }
      } catch (error) {
        console.log("IPC setup skipped:", error);
      }
      return () => {};
    };

    const cleanup = setupIpcListeners();

    // Add custom event listener for usage limit exceeded
    document.addEventListener("usage-limit-exceeded", handleUsageLimitExceeded);

    return () => {
      cleanup();
      document.removeEventListener(
        "usage-limit-exceeded",
        handleUsageLimitExceeded
      );
    };
  }, []);

  return (
    <div
      ref={barRef}
      style={{
        position: "relative",
        width: "100%",
        pointerEvents: "auto",
      }}
      className="select-none"
    >
      <div className="bg-transparent w-full">
        {/* Center everything in a flex container */}
        <div className="flex flex-col items-center w-full">
          {/* Main Bar with Logout Button - Centered */}
          <div className="w-fit overflow-visible relative">
            <div className="flex items-center gap-2">
              <QueueCommands
                ref={queueCommandsRef}
                screenshots={screenshots}
                onTooltipVisibilityChange={handleTooltipVisibilityChange}
                onChatToggle={handleChatToggle}
                responseMode={responseMode}
                onResponseModeChange={handleResponseModeChange}
                isAuthenticated={true} // User is always authenticated when Queue is rendered
                onQuestionDetected={handleQuestionDetected}
                onAudioStreamStateChange={handleAudioStreamStateChange}
              />
            </div>

            {/* Profile Dropdown - Fixed position relative to the main bar */}
            <ProfileDropdown
              currentMode={currentMode}
              onModeChange={setCurrentMode}
              onLogout={handleLogout}
              onSettings={handleSettings}
              onPermissionRequest={handlePermissionRequest}
              dropdownWidth="w-36"
            />
          </div>

          {/* Permission and general toasts - positioned below the floating bar */}
          {toastOpen && (
            <div className="mt-2 w-full max-w-md">
              <Toast
                open={toastOpen}
                onOpenChange={setToastOpen}
                variant={toastMessage.variant}
                duration={3000}
              >
                <ToastTitle>{toastMessage.title}</ToastTitle>
                <ToastDescription>{toastMessage.description}</ToastDescription>
              </Toast>
            </div>
          )}

          {/* Usage Limit Notification - Centered below the bar */}
          {showUsageLimitToast && (
            <div className="mt-2 w-full max-w-md liquid-glass chat-container p-4 text-white/90 text-xs relative bg-red-500/10 border border-red-500/20">
              {/* Close Button */}
              <button
                onClick={() => setShowUsageLimitToast(false)}
                className="absolute top-3 right-3 w-5 h-5 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center transition-colors"
                type="button"
                title="閉じる"
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

              {/* Error Icon and Title */}
              <div className="mb-2 text-sm font-medium text-red-400 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>月間利用制限に達しました</span>
              </div>

              {/* Description */}
              <div className="mb-3 text-white/80 pr-8">
                続行するにはプランをアップグレードしてください
              </div>

              {/* Upgrade Button */}
              <button
                onClick={handleSubscriptionUpgrade}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-xs font-medium transition-colors morphism-button"
              >
                プランをアップグレード
              </button>
            </div>
          )}

          {/* Question Panel with Unified Chat/Answer - Show when listening OR has questions OR chat is open */}
          {(audioStreamState?.isListening || detectedQuestions.length > 0 || isChatOpen) && (
            <div
              className="mt-4 w-full max-w-4xl relative"
              style={{
                height: `${questionResize.height}px`,
                minHeight: "120px",  // Reduced for minimal chat input bar
              }}
            >
              <QuestionSidePanel
                questions={detectedQuestions}
                audioStreamState={audioStreamState}
                onAnswerQuestion={handleAnswerQuestion}
                responseMode={responseMode}
                isChatOpen={isChatOpen}
                chatMessages={chatMessages}
                chatInput={chatInput}
                onChatInputChange={setChatInput}
                onChatSend={handleChatSend}
                chatLoading={chatLoading}
                className="w-full h-full"
                onCloseQuestions={() => {
                  // Stop listening session if active
                  if (
                    audioStreamState?.isListening &&
                    queueCommandsRef.current?.stopListening
                  ) {
                    queueCommandsRef.current.stopListening();
                  }

                  // Clear questions via backend
                  if (window.electronAPI?.audioStreamClearQuestions) {
                    window.electronAPI.audioStreamClearQuestions();
                  }

                  // Clear frontend questions state
                  setDetectedQuestions([]);
                }}
                onCloseChat={() => {
                  // Close chat only
                  setIsChatOpen(false);
                }}
              />

              {/* Resize Handle */}
              <questionResize.ResizeHandle />
            </div>
          )}
        </div>
      </div>

      <div ref={contentRef}>
        <ScreenshotQueue
          isLoading={false}
          screenshots={screenshots}
          onDeleteScreenshot={handleDeleteScreenshot}
        />
      </div>
    </div>
  );
};

export default Queue;
