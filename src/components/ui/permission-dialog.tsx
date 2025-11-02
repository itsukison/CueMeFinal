import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "./dialog";
import {
  Mic,
  Monitor,
  Shield,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface PermissionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPermissionsCompleted: () => void;
}

interface PermissionStatus {
  microphone:
    | "granted"
    | "denied"
    | "restricted"
    | "unknown"
    | "not-determined";
  screenCapture:
    | "granted"
    | "denied"
    | "restricted"
    | "unknown"
    | "not-determined";
  systemAudio:
    | "granted"
    | "denied"
    | "restricted"
    | "unknown"
    | "not-determined";
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  isOpen,
  onOpenChange,
  onPermissionsCompleted,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState<
    "welcome" | "permissions" | "completed"
  >("welcome");
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    microphone: "unknown",
    screenCapture: "unknown",
    systemAudio: "unknown",
  });
  const [checkingPermissions, setCheckingPermissions] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);

  // Check initial permission status
  useEffect(() => {
    if (isOpen && currentStep === "permissions") {
      checkPermissionStatus();
    }
  }, [isOpen, currentStep]);

  // Phase 3: Detect permission conflicts
  useEffect(() => {
    if (
      permissionStatus.screenCapture === "granted" &&
      permissionStatus.systemAudio !== "granted"
    ) {
      setError(
        "⚠️ 「画面収録」ではなく「システム音声」の権限を許可してください。" +
          "画面収録の権限は削除することをお勧めします。"
      );
    } else if (error.includes("画面収録")) {
      // Clear error if conflict is resolved
      setError("");
    }
  }, [permissionStatus]);

  const checkPermissionStatus = async () => {
    try {
      setCheckingPermissions(true);
      const status = await window.electronAPI.invoke("permission-check-status");
      setPermissionStatus(status);
    } catch (err) {
      console.error("Error checking permission status:", err);
      setError("権限の確認に失敗しました");
    } finally {
      setCheckingPermissions(false);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      setLoading(true);
      setError("");

      const result = await window.electronAPI.invoke(
        "permission-request-microphone"
      );

      if (result.granted) {
        setPermissionStatus((prev) => ({ ...prev, microphone: "granted" }));
      } else {
        setError(result.error || "マイクの権限が拒否されました");
      }

      // Refresh status after request
      await checkPermissionStatus();
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
      // Phase 4: Open System Audio preferences specifically
      await window.electronAPI.invoke(
        "permission-open-system-preferences",
        "system-audio"
      );
    } catch (err) {
      console.error("Error opening system preferences:", err);
      setError("システム環境設定を開けませんでした");
    } finally {
      setLoading(false);
    }
  };

  const openPermissionResetGuide = async () => {
    // Open System Preferences to Screen Recording to help users remove it
    try {
      await window.electronAPI.invoke(
        "permission-open-system-preferences",
        "screen"
      );
      setError(
        "権限をリセットする方法:\n" +
          "1. 開いた「画面収録」ページでCueMeのチェックを外す\n" +
          "2. 左側のリストから「システム音声」を選択\n" +
          "3. CueMeにチェックを入れる"
      );
    } catch (err) {
      console.error("Error opening reset guide:", err);
    }
  };

  const handleCompleteSetup = async () => {
    try {
      setLoading(true);

      // Mark initial setup as completed
      await window.electronAPI.invoke("permission-mark-setup-completed");

      // Close dialog and proceed to auth
      onPermissionsCompleted();
    } catch (err) {
      console.error("Error completing setup:", err);
      setError("セットアップの完了に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const getPermissionIcon = (status: string) => {
    switch (status) {
      case "granted":
        return <CheckCircle className="w-4 h-4" style={{ color: "#013220" }} />;
      case "denied":
      case "restricted":
        return <XCircle className="w-4 h-4" style={{ color: "#D4A574" }} />;
      default:
        return (
          <AlertTriangle className="w-4 h-4" style={{ color: "#D4A574" }} />
        );
    }
  };

  const getPermissionText = (status: string) => {
    switch (status) {
      case "granted":
        return "許可済み";
      case "denied":
        return "拒否済み";
      case "restricted":
        return "制限あり";
      case "not-determined":
        return "未設定";
      default:
        return "不明";
    }
  };

  const getStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <>
            {/* Compact Header */}
            <div className="flex items-center justify-center gap-2 py-3 px-6 bg-gradient-to-b from-white/20 to-transparent">
              <img src="./logogreen.png" alt="CueMe Logo" className="w-8 h-8" />
              <h1
                className="text-xl font-bold logo-text"
                style={{ color: "#013220" }}
              >
                CueMe
              </h1>
              <span className="text-sm" style={{ color: "#013220" }}>
                初期設定
              </span>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {error && (
                <div
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: "#FFF8E1",
                    border: "1px solid #D4A574",
                  }}
                >
                  <p className="text-xs" style={{ color: "#8B6914" }}>
                    {error}
                  </p>
                </div>
              )}

              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: "#013220" }}>
                  ようこそ！
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  システム権限の設定が必要です
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 bg-white/50 rounded-lg">
                  <Mic
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: "#013220" }}
                  />
                  <div className="flex-1">
                    <div
                      className="font-medium text-xs"
                      style={{ color: "#013220" }}
                    >
                      マイク
                    </div>
                    <div className="text-xs text-gray-600">音声質問の検出</div>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-2 bg-white/50 rounded-lg">
                  <Monitor
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: "#013220" }}
                  />
                  <div className="flex-1">
                    <div
                      className="font-medium text-xs"
                      style={{ color: "#013220" }}
                    >
                      システム音声
                    </div>
                    <div className="text-xs text-gray-600">
                      Zoom/Teams等の音声取得
                    </div>
                    <div
                      className="text-xs font-medium mt-0.5"
                      style={{ color: "#D4A574" }}
                    >
                      ⚠️ 画面収録ではなくシステム音声
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCurrentStep("permissions")}
                disabled={loading}
                className="w-full px-4 py-2.5 text-sm font-medium disabled:opacity-50 text-white rounded-lg transition-all hover:opacity-90"
                style={{ backgroundColor: "#013220" }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "設定する"
                )}
              </button>
            </div>
          </>
        );

      case "permissions":
        return (
          <>
            {/* Compact Header */}
            <div className="flex items-center justify-center gap-2 py-2 px-6 bg-gradient-to-b from-white/20 to-transparent">
              <img src="./logogreen.png" alt="CueMe Logo" className="w-7 h-7" />
              <h1
                className="text-lg font-bold logo-text"
                style={{ color: "#013220" }}
              >
                CueMe
              </h1>
              <span className="text-xs" style={{ color: "#013220" }}>
                権限設定
              </span>
            </div>

            <div className="px-5 pb-5 space-y-3">
              {error && (
                <div
                  className="p-2 rounded-lg text-xs whitespace-pre-line"
                  style={{
                    backgroundColor: "#FFF8E1",
                    border: "1px solid #D4A574",
                    color: "#8B6914",
                  }}
                >
                  {error}
                </div>
              )}

              {checkingPermissions ? (
                <div className="text-center py-4">
                  <Loader2
                    className="w-6 h-6 animate-spin mx-auto mb-2"
                    style={{ color: "#013220" }}
                  />
                  <p className="text-xs text-gray-600">確認中...</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Microphone Permission */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2 bg-white/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4" style={{ color: "#013220" }} />
                        <div>
                          <div
                            className="font-medium text-xs"
                            style={{ color: "#013220" }}
                          >
                            マイク
                          </div>
                          <div className="text-xs text-gray-600">
                            音声質問の検出
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {getPermissionIcon(permissionStatus.microphone)}
                        <span className="text-xs text-gray-600">
                          {getPermissionText(permissionStatus.microphone)}
                        </span>
                      </div>
                    </div>

                    {permissionStatus.microphone !== "granted" && (
                      <button
                        onClick={requestMicrophonePermission}
                        disabled={loading}
                        className="w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                        style={{
                          backgroundColor: "#F7F7EE",
                          border: "1px solid #013220",
                          color: "#013220",
                        }}
                      >
                        {loading ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                        ) : (
                          "許可"
                        )}
                      </button>
                    )}
                  </div>

                  {/* System Audio Permission */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 p-2 bg-white/50 rounded-lg">
                      <Monitor
                        className="w-4 h-4"
                        style={{ color: "#013220" }}
                      />
                      <div>
                        <div
                          className="font-medium text-xs"
                          style={{ color: "#013220" }}
                        >
                          システム音声
                        </div>
                        <div className="text-xs text-gray-600">
                          Zoom/Teams等
                        </div>
                      </div>
                    </div>

                    {/* Warning if Screen Recording is granted */}
                    {permissionStatus.screenCapture === "granted" &&
                      permissionStatus.systemAudio !== "granted" && (
                        <div
                          className="p-2 rounded-lg space-y-1"
                          style={{
                            backgroundColor: "#FFF8E1",
                            border: "1px solid #D4A574",
                          }}
                        >
                          <div
                            className="text-xs font-medium"
                            style={{ color: "#8B6914" }}
                          >
                            ⚠️ 間違った権限
                          </div>
                          <div className="text-xs" style={{ color: "#8B6914" }}>
                            画面収録ではなくシステム音声を許可してください
                          </div>
                          <button
                            onClick={openPermissionResetGuide}
                            className="w-full px-2 py-1 text-xs font-medium rounded transition-all"
                            style={{
                              backgroundColor: "#D4A574",
                              color: "#FFF",
                            }}
                          >
                            リセット手順
                          </button>
                        </div>
                      )}

                    <button
                      onClick={openSystemPreferences}
                      disabled={loading}
                      className="w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                      style={{
                        backgroundColor: "#F7F7EE",
                        border: "1px solid #013220",
                        color: "#013220",
                      }}
                    >
                      {loading ? (
                        <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                      ) : (
                        "設定を開く"
                      )}
                    </button>
                  </div>

                  {/* Compact Instructions */}
                  <div
                    className="p-2 rounded-lg"
                    style={{
                      backgroundColor: "#FFF8E1",
                      border: "1px solid #D4A574",
                    }}
                  >
                    <div
                      className="text-xs font-medium mb-1"
                      style={{ color: "#8B6914" }}
                    >
                      📌 設定手順
                    </div>
                    <ol
                      className="text-xs space-y-0.5 list-decimal list-inside"
                      style={{ color: "#8B6914" }}
                    >
                      <li>
                        プライバシーとセキュリティ →{" "}
                        <span className="font-bold">画面収録とシステムオーディオ録音</span>
                      </li>
                      <li>
                        <span className="font-bold">システムオーディオ録音のみ</span>
                        に+で追加{" "}
                        <span style={{ color: "#D4A574" }}>(重要：画面収録ではありません)</span>
                      </li>
                      <li>
                        CueMeにチェック →{" "}
                        <span className="font-bold">アプリを再起動</span>
                      </li>
                      <li>
                        再起動後、<span className="font-bold">設定完了</span>
                        ボタンを押す
                      </li>
                    </ol>
                  </div>

                  {/* Complete Button */}
                  <button
                    onClick={handleCompleteSetup}
                    disabled={loading}
                    className="w-full px-3 py-2 text-xs font-medium text-white rounded-lg transition-all hover:opacity-90"
                    style={{ backgroundColor: "#013220" }}
                  >
                    {loading ? (
                      <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                    ) : (
                      "設定完了"
                    )}
                  </button>

                  <p className="text-xs text-center text-gray-500">
                    権限設定後、必ずアプリを再起動してください
                  </p>
                </div>
              )}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="w-[520px] max-w-lg border-0 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-lg"
        style={{ backgroundColor: "#F7F7EE" }}
      >
        {getStepContent()}
      </DialogContent>
    </Dialog>
  );
};
