import React, { useCallback, useState, useEffect } from "react";
import { Image as ImageIcon, CloudUpload } from "lucide-react";
import { ImageHostingAPI } from "../api";
import { UploadResult } from "../types";
import { listen } from "@tauri-apps/api/event";
import { useLanguage } from "../contexts/LanguageContext";

interface UploadAreaProps {
  onUploadSuccess: (result: UploadResult) => void;
  onUploadError: (error: string) => void;
  isActive?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onUploadSuccess,
  onUploadError,
  isActive = true,
}) => {
  const { t } = useLanguage();
  console.log("[UploadArea] Component initializing...");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  console.log("[UploadArea] Component state:", { isDragOver, isUploading });

  const handleFiles = useCallback(
    async (files: FileList) => {
      console.log("[UploadArea] === HANDLE FILES CALLED ===");
      console.log("[UploadArea] Files received:", files);
      console.log("[UploadArea] Files length:", files.length);

      const file = files[0];
      if (!file) {
        console.log("[UploadArea] No file selected - returning early");
        return;
      }

      console.log("[UploadArea] Processing first file:", {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toISOString()
      });

      // Check if file is an image
      if (!file.type.startsWith("image/")) {
        console.error("[UploadArea] Invalid file type:", file.type);
        onUploadError(t.upload.selectImageFile);
        return;
      }

      console.log("[UploadArea] File type validation passed");
      setIsUploading(true);
      console.log("[UploadArea] Starting upload process...");

      try {
        console.log("[UploadArea] Converting file to Uint8Array...");
        const fileData = await ImageHostingAPI.convertFileToUint8Array(file);
        console.log("[UploadArea] File converted, size:", fileData.length, "bytes");

        console.log("[UploadArea] Calling upload API...");
        const result = await ImageHostingAPI.uploadImage(fileData, file.name);
        console.log("[UploadArea] Upload API response:", result);

        if (result.success) {
          console.log("[UploadArea] Upload successful, URL:", result.url);
          onUploadSuccess(result);
        } else {
          console.error("[UploadArea] Upload failed with error:", result.error);
          onUploadError(result.error || t.upload.uploadFailed);
        }
      } catch (error) {
        console.error("[UploadArea] Upload exception:", error);
        const errorMessage = error instanceof Error ? error.message : t.upload.uploadFailed;
        console.error("[UploadArea] Error details:", {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : 'No stack trace',
          type: typeof error
        });
        onUploadError(errorMessage);
      } finally {
        setIsUploading(false);
        console.log("[UploadArea] Upload process completed, isUploading set to false");
      }
    },
    [onUploadSuccess, onUploadError]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isActive) {
      console.log("[UploadArea] Ignoring drag enter - component not active");
      return;
    }
    console.log("[UploadArea] === DRAG ENTER DETECTED ===");
    console.log("[UploadArea] Event:", e);
    console.log("[UploadArea] DataTransfer:", e.dataTransfer);
    console.log("[UploadArea] DataTransfer types:", e.dataTransfer?.types);
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    console.log("[UploadArea] isDragOver set to true");
  }, [isActive]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isActive) {
      console.log("[UploadArea] Ignoring drag over - component not active");
      return;
    }
    console.log("[UploadArea] === DRAG OVER DETECTED ===");
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
      console.log("[UploadArea] dropEffect set to copy");
    }
  }, [isActive]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isActive) {
      console.log("[UploadArea] Ignoring drag leave - component not active");
      return;
    }
    console.log("[UploadArea] === DRAG LEAVE DETECTED ===");
    console.log("[UploadArea] Event target:", e.target);
    console.log("[UploadArea] Current target:", e.currentTarget);
    e.preventDefault();
    e.stopPropagation();

    // Only set isDragOver to false if we're leaving the main container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    console.log("[UploadArea] Mouse position:", { x, y });
    console.log("[UploadArea] Container bounds:", rect);

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      console.log("[UploadArea] Mouse outside container, setting isDragOver to false");
      setIsDragOver(false);
    }
  }, [isActive]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isActive) {
        console.log("[UploadArea] Ignoring drop - component not active");
        return;
      }
      console.log("[UploadArea] === DROP EVENT DETECTED ===");
      console.log("[UploadArea] Event:", e);
      console.log("[UploadArea] DataTransfer:", e.dataTransfer);
      console.log("[UploadArea] DataTransfer files:", e.dataTransfer?.files);
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      console.log(`[UploadArea] Files dropped: ${files?.length || 0}`);

      if (files && files.length > 0) {
        console.log("[UploadArea] Processing dropped files...");
        for (let i = 0; i < files.length; i++) {
          console.log(`[UploadArea] File ${i}:`, files[i]);
        }
        handleFiles(files);
      } else {
        console.log("[UploadArea] No files in drop event");
      }
    },
    [handleFiles, isActive]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      console.log("[UploadArea] File input change event");
      const files = e.target.files;
      if (files && files.length > 0) {
        console.log(`[UploadArea] Files selected via input: ${files.length}`);
        handleFiles(files);
      }
      // Reset input value to allow selecting the same file again
      e.target.value = "";
    },
    [handleFiles]
  );

  // Add Tauri-specific drag and drop event listeners
  useEffect(() => {
    if (!isActive) {
      return;
    }

    console.log("[UploadArea] Setting up Tauri drag and drop listeners...");

    const processDroppedFiles = async (paths: string[]) => {
      for (const filePath of paths) {
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filePath);
        if (!isImage) {
          console.log("[UploadArea] Skipping non-image file:", filePath);
          continue;
        }

        setIsUploading(true);
        try {
          const fileData = await ImageHostingAPI.readFileFromPath(filePath);
          if (fileData) {
            const fileName = filePath.split('/').pop() || 'dropped-file';
            const result = await ImageHostingAPI.uploadImage(fileData, fileName);
            if (result.success) {
              onUploadSuccess(result);
            } else {
              onUploadError(result.error || t.upload.uploadFailed);
            }
          } else {
            onUploadError(t.upload.failedToReadFile);
          }
        } catch (error) {
          onUploadError(error instanceof Error ? error.message : t.upload.errorProcessingDrag);
        } finally {
          setIsUploading(false);
        }
      }
    };

    const unlistenPromises = [
      listen('tauri://drag-over', () => {
        setIsDragOver(true);
      }),
      listen('tauri://drag-drop', (event) => {
        setIsDragOver(false);
        const payload = event.payload as { paths: string[] };
        if (payload.paths && payload.paths.length > 0) {
          processDroppedFiles(payload.paths);
        }
      }),
      listen('tauri://drag-cancelled', () => {
        setIsDragOver(false);
      })
    ];

    return () => {
      console.log("[UploadArea] Cleaning up Tauri listeners...");
      Promise.all(unlistenPromises).then((unlisteners) => {
        unlisteners.forEach((unlisten) => unlisten());
        console.log("[UploadArea] Tauri listeners cleaned up.");
      });
    };
  }, [isActive, onUploadSuccess, onUploadError]);



  const handlePasteFromClipboard = useCallback(async () => {
    console.log("[UploadArea] Clipboard paste initiated");
    setIsUploading(true);
    try {
      console.log("[UploadArea] Getting clipboard image...");
      const clipboardData = await ImageHostingAPI.getClipboardImage();
      console.log("[UploadArea] Clipboard data received:", clipboardData ? `${clipboardData.length} bytes` : 'null');

      if (!clipboardData) {
        console.warn("[UploadArea] No image found in clipboard");
        onUploadError(t.upload.noImageInClipboard);
        return;
      }

      const filename = `clipboard-${Date.now()}.png`;
      console.log("[UploadArea] Uploading clipboard image as:", filename);
      const result = await ImageHostingAPI.uploadImage(clipboardData, filename);
      console.log("[UploadArea] Clipboard upload result:", result);

      if (result.success) {
        console.log("[UploadArea] Clipboard upload successful");
        onUploadSuccess(result);
      } else {
        console.error("[UploadArea] Clipboard upload failed:", result.error);
        onUploadError(result.error || t.upload.uploadFailed);
      }
    } catch (error) {
      console.error("[UploadArea] Clipboard upload exception:", error);
      onUploadError(error instanceof Error ? error.message : t.upload.uploadFailed);
    } finally {
      setIsUploading(false);
      console.log("[UploadArea] Clipboard upload process completed");
    }
  }, [onUploadSuccess, onUploadError, t]);

  return (
    <div className="w-full space-y-6">
      {/* 拖拽上传区域 */}
      <div
        data-upload-drop-zone
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center gap-6 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors
          ${isDragOver
            ? "border-primary bg-primary/5"
            : "border-gray-300 dark:border-gray-700 hover:border-primary dark:hover:border-primary"
          }
          ${isUploading ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <CloudUpload className={`text-5xl transition-colors ${isDragOver ? "text-primary" : "text-gray-400 dark:text-gray-500"}`} size={48} strokeWidth={1.5} />

        <div className="flex flex-col items-center gap-1">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {isDragOver ? t.upload.dropHere : t.upload.dragDropTitle}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.upload.pasteHint}</p>
        </div>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          multiple
          disabled={isUploading}
        />

        {!isUploading && (
          <button
            onClick={() => {
              const input = document.querySelector('input[type="file"]') as HTMLInputElement;
              input?.click();
            }}
            className="flex min-w-[120px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-5 bg-primary text-white text-sm font-semibold tracking-wide shadow-sm hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors"
          >
            <span className="truncate">{t.upload.chooseFile}</span>
          </button>
        )}

        {isUploading && (
          <div className="w-full max-w-xs space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900 dark:text-white">{t.common.uploading}</span>
              <span className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 w-full overflow-hidden">
              <div className="h-2 rounded-full bg-primary animate-pulse w-full"></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <hr className="w-full border-t border-gray-200 dark:border-gray-700" />
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500">{t.common.or}</span>
        <hr className="w-full border-t border-gray-200 dark:border-gray-700" />
      </div>

      {/* 剪贴板粘贴按钮 */}
      <div className="flex justify-center">
        <button
          onClick={handlePasteFromClipboard}
          disabled={isUploading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>{t.upload.pasteFromClipboard}</span>
        </button>
      </div>

      <div className="px-6 pb-4 pt-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">{t.upload.supportedFormats}</p>
      </div>
    </div>
  );
};