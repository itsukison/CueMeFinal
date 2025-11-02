import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "./dialog";
import { Download, CheckCircle, Loader2, RefreshCw } from "lucide-react";

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

interface UpdateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    // Listen for update available
    const unsubUpdateAvailable = window.electronAPI.onUpdateAvailable(
      (info: UpdateInfo) => {
        console.log("[UpdateDialog] Update available:", info);
        setUpdateInfo(info);
        setIsDownloading(true);
        onOpenChange(true);
      }
    );

    // Listen for download progress
    const unsubDownloadProgress = window.electronAPI.onUpdateDownloadProgress(
      (progress: { percent: number }) => {
        console.log("[UpdateDialog] Download progress:", progress.percent);
        setDownloadProgress(progress.percent);
      }
    );

    // Listen for update downloaded
    const unsubUpdateDownloaded = window.electronAPI.onUpdateDownloaded(
      (info: UpdateInfo) => {
        console.log("[UpdateDialog] Update downloaded:", info);
        setUpdateInfo(info);
        setIsDownloading(false);
        setIsDownloaded(true);
        onOpenChange(true);
      }
    );

    // Listen for update errors
    const unsubUpdateError = window.electronAPI.onUpdateError(
      (error: { message: string }) => {
        console.error("[UpdateDialog] Update error:", error);
        setIsDownloading(false);
      }
    );

    return () => {
      unsubUpdateAvailable();
      unsubDownloadProgress();
      unsubUpdateDownloaded();
      unsubUpdateError();
    };
  }, [onOpenChange]);

  const handleInstallUpdate = async () => {
    try {
      await window.electronAPI.invoke("update-install");
    } catch (error) {
      console.error("Error installing update:", error);
    }
  };

  const handleInstallLater = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[520px] max-w-lg border-0 rounded-3xl p-0 overflow-hidden shadow-2xl backdrop-blur-lg"
        style={{ backgroundColor: "#FEFEFE" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-center gap-2 py-3 px-6"
        >
          <img src="./logogreen.png" alt="CueMe Logo" className="w-8 h-8" />
          <h1
            className="text-xl font-bold logo-text"
            style={{ color: "#2B2D2D" }}
          >
            CueMe
          </h1>
          <span className="text-sm" style={{ color: "#2B2D2D" }}>
            アップデート
          </span>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Downloading State */}
          {isDownloading && (
            <>
              <div className="text-center">
                <Download
                  className="w-12 h-12 mx-auto mb-2 animate-bounce"
                  style={{ color: "#2B2D2D" }}
                />
                <p className="text-sm font-medium" style={{ color: "#2B2D2D" }}>
                  アップデートをダウンロード中...
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  バージョン {updateInfo?.version}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div
                  className="w-full rounded-full h-2 overflow-hidden"
                  style={{ backgroundColor: "#EDECEA" }}
                >
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: "#D8F9B8",
                      width: `${downloadProgress}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-center text-gray-600">
                  {downloadProgress.toFixed(1)}%
                </p>
              </div>

              <div
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: "#EAFBDD",
                  border: "1px solid #D8F9B8",
                }}
              >
                <p className="text-xs" style={{ color: "#2B2D2D" }}>
                  💡 バックグラウンドでダウンロードしています。
                  <br />
                  完了後に通知が表示されます。
                </p>
              </div>
            </>
          )}

          {/* Downloaded State */}
          {isDownloaded && !isDownloading && (
            <>
              <div className="text-center">
                <CheckCircle
                  className="w-12 h-12 mx-auto mb-2"
                  style={{ color: "#D8F9B8" }}
                />
                <p className="text-sm font-medium" style={{ color: "#2B2D2D" }}>
                  アップデートの準備完了！
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  バージョン {updateInfo?.version}
                </p>
              </div>

              <div
                className="p-3 rounded-lg space-y-2"
                style={{
                  backgroundColor: "#F3F7EF",
                  border: "1px solid #EDECEA",
                }}
              >
                <div className="flex items-start gap-2">
                  <RefreshCw
                    className="w-4 h-4 mt-0.5 flex-shrink-0"
                    style={{ color: "#2B2D2D" }}
                  />
                  <div>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "#2B2D2D" }}
                    >
                      新機能とバグ修正
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      最新バージョンをインストールしてご利用ください
                    </p>
                  </div>
                </div>
              </div>

              {updateInfo?.releaseNotes && (
                <div
                  className="p-3 rounded-lg max-h-32 overflow-y-auto"
                  style={{
                    backgroundColor: "#EDECEA",
                    border: "1px solid #D8F9B8",
                  }}
                >
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: "#2B2D2D" }}
                  >
                    📝 リリースノート
                  </p>
                  <p className="text-xs text-gray-600 whitespace-pre-line">
                    {updateInfo.releaseNotes}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={handleInstallUpdate}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-all hover:opacity-90"
                  style={{ backgroundColor: "#2B2D2D" }}
                >
                  今すぐ再起動してインストール
                </button>

                <button
                  onClick={handleInstallLater}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg transition-all"
                  style={{
                    backgroundColor: "#F3F7EF",
                    border: "1px solid #EDECEA",
                    color: "#2B2D2D",
                  }}
                >
                  後でインストール
                </button>
              </div>

              <p className="text-xs text-center text-gray-500">
                次回アプリ終了時に自動的にインストールされます
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
