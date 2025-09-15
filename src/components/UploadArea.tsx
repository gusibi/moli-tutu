import React, { useCallback, useState, useEffect } from "react";
import { Image as ImageIcon, CloudUpload } from "lucide-react";
import { ImageHostingAPI } from "../api";
import { UploadResult } from "../types";
import { listen } from "@tauri-apps/api/event";

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
        onUploadError("请选择图片文件");
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
          onUploadError(result.error || "上传失败");
        }
      } catch (error) {
        console.error("[UploadArea] Upload exception:", error);
        const errorMessage = error instanceof Error ? error.message : "上传失败";
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
    console.log("[UploadArea] useEffect triggered, isActive:", isActive);
    
    // 只有在组件激活时才设置监听器
    if (!isActive) {
      console.log("[UploadArea] Component not active, skipping Tauri listeners setup");
      return;
    }
    
    console.log("[UploadArea] Setting up Tauri drag and drop listeners...");
    
    let unlistenDragOver: (() => void) | null = null;
    let unlistenDrop: (() => void) | null = null;
    
    const setupTauriListeners = async () => {
      try {
        // Listen for drag over events
        unlistenDragOver = await listen('tauri://drag-over', (event) => {
          // 再次检查是否激活，防止在非激活状态下处理事件
          if (!isActive) {
            console.log("[UploadArea] Ignoring drag-over event - component not active");
            return;
          }
          console.log("[UploadArea] === TAURI DRAG OVER EVENT ===", event);
          setIsDragOver(true);
        });
        
        // Listen for drop events
        unlistenDrop = await listen('tauri://drag-drop', (event) => {
          // 再次检查是否激活，防止在非激活状态下处理事件
          if (!isActive) {
            console.log("[UploadArea] Ignoring drop event - component not active");
            return;
          }
          
          console.log("[UploadArea] === TAURI DROP EVENT ===", event);
          console.log("[UploadArea] Event payload:", event.payload);
          
          setIsDragOver(false);
          
          // Handle the dropped files - payload structure is { paths: string[], position: { x: number, y: number } }
          const payload = event.payload as { paths: string[], position: { x: number, y: number } };
          if (payload && payload.paths && payload.paths.length > 0) {
            console.log("[UploadArea] Files dropped via Tauri:", payload.paths);
            
            // Convert file paths to File objects
            const processDroppedFiles = async () => {
              try {
                for (const filePath of payload.paths) {
                  console.log("[UploadArea] Processing dropped file:", filePath);
                  
                  // Check if it's an image file by extension
                  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filePath);
                  if (!isImage) {
                    console.log("[UploadArea] Skipping non-image file:", filePath);
                    continue;
                  }
                  
                  // Read the file using Tauri's fs API
                  console.log("[UploadArea] Reading file data...");
                  const fileData = await ImageHostingAPI.readFileFromPath(filePath);
                  if (fileData) {
                    const fileName = filePath.split('/').pop() || 'dropped-file';
                    console.log("[UploadArea] File read successfully, uploading:", fileName, "Size:", fileData.length, "bytes");
                    
                    setIsUploading(true);
                    try {
                      const result = await ImageHostingAPI.uploadImage(fileData, fileName);
                      console.log("[UploadArea] Upload result:", result);
                      if (result.success) {
                        console.log("[UploadArea] Upload successful!");
                        onUploadSuccess(result);
                      } else {
                        console.error("[UploadArea] Upload failed:", result.error);
                        onUploadError(result.error || "上传失败");
                      }
                    } catch (error) {
                      console.error("[UploadArea] Upload error:", error);
                      onUploadError(error instanceof Error ? error.message : "上传失败");
                    } finally {
                      setIsUploading(false);
                    }
                  } else {
                    console.error("[UploadArea] Failed to read file data");
                    onUploadError("无法读取文件数据");
                  }
                }
              } catch (error) {
                console.error("[UploadArea] Error processing dropped files:", error);
                onUploadError("处理拖拽文件时出错");
              }
            };
            
            processDroppedFiles();
          } else {
            console.log("[UploadArea] No files in drop event or invalid payload structure");
          }
        });
        
        console.log("[UploadArea] Tauri drag and drop listeners set up successfully");
      } catch (error) {
        console.error("[UploadArea] Failed to set up Tauri listeners:", error);
      }
    };
    
    setupTauriListeners();
    
    // Cleanup
    return () => {
      console.log("[UploadArea] Cleaning up Tauri listeners...");
      if (unlistenDragOver) {
        unlistenDragOver();
        unlistenDragOver = null;
      }
      if (unlistenDrop) {
        unlistenDrop();
        unlistenDrop = null;
      }
    };
  }, [isActive]); // 只依赖 isActive，当它变化时重新设置监听器



  const handlePasteFromClipboard = useCallback(async () => {
    console.log("[UploadArea] Clipboard paste initiated");
    setIsUploading(true);
    try {
      console.log("[UploadArea] Getting clipboard image...");
      const clipboardData = await ImageHostingAPI.getClipboardImage();
      console.log("[UploadArea] Clipboard data received:", clipboardData ? `${clipboardData.length} bytes` : 'null');
      
      if (!clipboardData) {
        console.warn("[UploadArea] No image found in clipboard");
        onUploadError("No image found in clipboard");
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
        onUploadError(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("[UploadArea] Clipboard upload exception:", error);
      onUploadError(error instanceof Error ? error.message : "Failed to upload from clipboard");
    } finally {
      setIsUploading(false);
      console.log("[UploadArea] Clipboard upload process completed");
    }
  }, [onUploadSuccess, onUploadError]);

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
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer 
          transition-all duration-300 ease-in-out overflow-hidden
          ${isDragOver 
            ? "border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20" 
            : "border-base-300 hover:border-primary/50 hover:scale-102"
          }
          ${isUploading ? "opacity-50 pointer-events-none" : ""}
        `}
        style={{
          background: isDragOver 
            ? `radial-gradient(circle at center, rgba(var(--p), 0.1) 0%, rgba(var(--p), 0.05) 50%, transparent 100%)`
            : undefined
        }}
      >
        {/* 动画边框效果 */}
        {isDragOver && (
          <div className="absolute inset-0 rounded-lg">
            <div className="absolute inset-0 rounded-lg border-2 border-primary animate-pulse"></div>
            <div className="absolute inset-2 rounded-lg border border-primary/50 animate-ping"></div>
          </div>
        )}
        
        {/* 星星粒子效果 */}
        {isDragOver && (
          <>
            <div className="absolute top-4 left-4 w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-8 right-8 w-1 h-1 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="absolute bottom-6 left-8 w-1.5 h-1.5 bg-primary/80 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            <div className="absolute bottom-4 right-6 w-1 h-1 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }}></div>
            <div className="absolute top-1/2 left-6 w-1 h-1 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0.8s' }}></div>
            <div className="absolute top-1/3 right-4 w-1.5 h-1.5 bg-primary/70 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
          </>
        )}

        <CloudUpload className={`mx-auto w-16 h-16 mb-4 transition-all duration-300 relative z-10 ${
          isDragOver 
            ? "text-primary scale-110 animate-pulse" 
            : "text-base-content/40 hover:text-primary/70"
        }`} />
        
        <div className="space-y-2 relative z-10">
          <p className={`text-lg font-medium transition-all duration-300 ${
            isDragOver 
              ? "text-primary scale-105 animate-pulse" 
              : "text-base-content"
          }`}>
            {isUploading ? (
              <span className="inline-flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></span>
                上传中...
              </span>
            ) : isDragOver ? (
              <span className="animate-bounce">✨ 在这里放下图片 ✨</span>
            ) : (
              "拖拽图片到这里或点击选择 开始上传"
            )}
          </p>
          <p className={`text-sm transition-all duration-300 ${
            isDragOver 
              ? "text-primary/80 scale-105" 
              : "text-base-content/60"
          }`}>
            支持 JPG、PNG、GIF 格式，最大 10MB
          </p>
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
            className={`btn btn-primary mt-4 transition-all duration-300 relative z-10 ${
              isDragOver 
                ? "scale-110 shadow-lg shadow-primary/30 animate-pulse" 
                : "hover:scale-105 hover:shadow-md"
            }`}
          >
            <span className="text-primary-content">选择文件</span>
          </button>
        )}
        
        {isUploading && (
          <div className="mt-6 space-y-2 animate-fade-in relative z-10">
            <div className="flex justify-between text-sm text-base-content/70">
              <span className="text-base-content/70 animate-pulse">上传进度</span>
              <span className="text-base-content/70 animate-bounce">处理中...</span>
            </div>
            <div className="relative">
              <progress className="progress progress-primary w-full animate-pulse"></progress>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
            </div>
          </div>
        )}
      </div>
      
      {/* 剪贴板粘贴按钮 */}
      <div className="flex justify-center">
        <button
          onClick={handlePasteFromClipboard}
          disabled={isUploading}
          className={`btn btn-outline btn-sm gap-2 ${isUploading ? 'btn-disabled' : ''}`}
        >
          <ImageIcon className="w-4 h-4 text-base-content" />
          <span className="text-base-content">从剪贴板粘贴</span>
        </button>
      </div>
    </div>
  );
};