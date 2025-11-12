import React, { useState } from "react";
import { Mic, Monitor, Loader2, AlertTriangle } from "lucide-react";

interface InlinePermissionPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InlinePermissionPanel: React.FC<InlinePermissionPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const requestMicrophonePermission = async () => {
    try {
      setLoading(true);
      setError("");

      const result = await window.electronAPI.invoke(
        "permission-request-microphone"
      );

      if (result.granted) {
        // Success - show brief message and close
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setError(result.error || "マイクの権限が拒否されました");
      }
    } catch (err) {
      console.error("Error requesting microphone permission:", err);
      setError("マイクの権限リクエストに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const openSystemPreferences = async () => {
    try {
      setLoading(true);
      setError("");

      // Open System Audio preferences specifically
      await window.electronAPI.invoke(
        "permission-open-system-preferences",
        "system-audio"
      );

      setError("");
    } catch (err) {
      console.error("Error opening system preferences:", err);
      setError("システム環境設定を開けませんでした");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 w-full max-w-md liquid-glass chat-container p-4 text-white/90 text-xs relative">
      {/* Close Button */}
      <button
        onClick={onClose}
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

      {/* Title */}
      <div className="mb-3 text-sm font-medium text-white/90 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[#D8F9B8]" />
        <span>権限設定</span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Permission Buttons */}
      <div className="space-y-2 pr-8">
        {/* Microphone Permission */}
        <button
          onClick={requestMicrophonePermission}
          disabled={loading}
          className="w-full px-3 py-2.5 text-left text-xs text-white/90 hover:text-white bg-white/5 hover:bg-white/10 flex items-center gap-2 transition-colors rounded-lg disabled:opacity-50"
        >
          <Mic className="w-4 h-4 text-[#D8F9B8]" />
          <div className="flex-1">
            <div className="font-medium">マイクを許可</div>
            <div className="text-white/60 text-[10px]">音声質問の検出に必要</div>
          </div>
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        </button>

        {/* Screen Recording Permission */}
        <button
          onClick={openSystemPreferences}
          disabled={loading}
          className="w-full px-3 py-2.5 text-left text-xs text-white/90 hover:text-white bg-white/5 hover:bg-white/10 flex items-center gap-2 transition-colors rounded-lg disabled:opacity-50"
        >
          <Monitor className="w-4 h-4 text-[#D8F9B8]" />
          <div className="flex-1">
            <div className="font-medium">システム音声を許可</div>
            <div className="text-white/60 text-[10px]">
              ⚠️ 画面収録ではなくシステム音声を選択
            </div>
          </div>
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-3 p-2 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs text-white/70 space-y-1">
          <div className="font-medium text-white/90 mb-1">📌 設定手順:</div>
          <div>1. システム環境設定を開く</div>
          <div>2. プライバシーとセキュリティ → システムオーディオ録音</div>
          <div>3. CueMeにチェックを入れる</div>
          <div className="font-medium text-[#D8F9B8] mt-1">
            ※ 設定後、アプリを再起動してください
          </div>
        </div>
      </div>
    </div>
  );
};
