import React, { useCallback, useState } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { ImageHostingAPI } from "../api";
import { UploadResult } from "../types";

interface UploadAreaProps {
  onUploadSuccess: (result: UploadResult) => void;
  onUploadError: (error: string) => void;
}

export const UploadArea: React.FC<UploadAreaProps> = ({
  onUploadSuccess,
  onUploadError,
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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    console.log("[UploadArea] Drag over detected");
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    console.log("[UploadArea] Drag leave detected");
    e.preventDefault();
    e.stopPropagation();
    
    // Only set isDragOver to false if we're leaving the main container
    // Check if the related target is outside the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      console.log("[UploadArea] Drop event detected");
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      
      const files = e.dataTransfer.files;
      console.log(`[UploadArea] Files dropped: ${files.length}`);
      
      if (files.length > 0) {
        console.log("[UploadArea] Processing dropped files...");
        handleFiles(files);
      } else {
        console.log("[UploadArea] No files in drop event");
      }
    },
    [handleFiles]
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

  // Add drag event listeners to handle drag and drop
  React.useEffect(() => {
    console.log("[UploadArea] Setting up drag event listeners...");
    
    // Try multiple approaches for Tauri compatibility
    const dropZone = document.querySelector('[data-upload-drop-zone]') as HTMLElement;
    const wholeDocument = document.documentElement;
    const bodyElement = document.body;
    
    if (!dropZone) {
      console.error("[UploadArea] Drop zone element not found!");
      return;
    }
    
    console.log("[UploadArea] Drop zone element found:", dropZone);
    
    // Prevent default drag behaviors on document and body
    const preventDefaults = (e: DragEvent) => {
      console.log("[UploadArea] Preventing default for:", e.type, "on", e.target);
      e.preventDefault();
      e.stopPropagation();
    };
    
    const handleDragEnter = (e: DragEvent) => {
      console.log("[UploadArea] === DRAG ENTER EVENT ===", e);
      console.log("[UploadArea] Event target:", e.target);
      console.log("[UploadArea] Current target:", e.currentTarget);
      console.log("[UploadArea] Event type:", e.type);
      console.log("[UploadArea] DataTransfer:", e.dataTransfer);
      console.log("[UploadArea] DataTransfer types:", e.dataTransfer?.types);
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
      console.log("[UploadArea] isDragOver set to true");
    };
    
    const handleDragOver = (e: DragEvent) => {
      console.log("[UploadArea] === DRAG OVER EVENT ===");
      console.log("[UploadArea] DataTransfer effectAllowed:", e.dataTransfer?.effectAllowed);
      console.log("[UploadArea] DataTransfer dropEffect:", e.dataTransfer?.dropEffect);
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setIsDragOver(true);
    };
    
    const handleDragLeave = (e: DragEvent) => {
      console.log("[UploadArea] === DRAG LEAVE EVENT ===", e);
      console.log("[UploadArea] Event target:", e.target);
      console.log("[UploadArea] Related target:", e.relatedTarget);
      e.preventDefault();
      e.stopPropagation();
      
      // Only hide drag state if we're leaving the drop zone completely
      setTimeout(() => {
        const rect = dropZone.getBoundingClientRect();
        // Use current mouse position or assume we left
        console.log("[UploadArea] Setting isDragOver to false after drag leave");
        setIsDragOver(false);
      }, 100);
    };
    
    const handleDrop = (e: DragEvent) => {
      console.log("[UploadArea] === DROP EVENT ===", e);
      console.log("[UploadArea] Event target:", e.target);
      console.log("[UploadArea] DataTransfer:", e.dataTransfer);
      console.log("[UploadArea] DataTransfer files:", e.dataTransfer?.files);
      console.log("[UploadArea] Files length:", e.dataTransfer?.files?.length);
      
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      console.log("[UploadArea] isDragOver set to false");
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        console.log("[UploadArea] Files detected, details:");
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          console.log(`[UploadArea] File ${i}:`, {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
          });
        }
        console.log("[UploadArea] Calling handleFiles with", files.length, "files");
        handleFiles(files);
      } else {
        console.warn("[UploadArea] No files in drop event or files is null/undefined");
      }
    };
    
    // Event handlers for debugging
    const events = ['dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'drop', 'dragend'];
    
    const debugHandler = (eventType: string) => (e: DragEvent) => {
      console.log(`[UploadArea] ${eventType.toUpperCase()} on`, e.target, e);
      if (eventType === 'dragenter' || eventType === 'dragover') {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        setIsDragOver(true);
      } else if (eventType === 'drop') {
        handleDrop(e);
      } else if (eventType === 'dragleave') {
        // Only set to false if leaving the main container
        if (e.target === dropZone) {
          setTimeout(() => setIsDragOver(false), 100);
        }
      }
    };
    
    // Add comprehensive event listeners
    console.log("[UploadArea] Adding event listeners to multiple elements...");
    
    // Add to drop zone
    events.forEach(eventType => {
      dropZone.addEventListener(eventType, debugHandler(eventType), true);
    });
    
    // Add to document to catch all events
    events.forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        console.log(`[UploadArea] Document ${eventType}:`, e.target);
        if (eventType === 'dragover' || eventType === 'dragenter') {
          e.preventDefault();
        }
      }, true);
    });
    
    // Add to window for good measure
    window.addEventListener('dragover', (e) => {
      console.log('[UploadArea] Window dragover:', e);
      e.preventDefault();
    }, true);
    
    window.addEventListener('drop', (e) => {
      console.log('[UploadArea] Window drop:', e);
      e.preventDefault();
    }, true);
    
    console.log("[UploadArea] All drag event listeners attached successfully");
    
    // Cleanup
    return () => {
      console.log("[UploadArea] Cleaning up drag event listeners...");
      
      events.forEach(eventType => {
        dropZone.removeEventListener(eventType, debugHandler(eventType), true);
      });
      
      console.log("[UploadArea] Drag event listeners removed");
    };
  }, [handleFiles]);

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
    <div className="w-full max-w-2xl mx-auto">
      <div
        data-upload-drop-zone
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400",
          isUploading && "opacity-50 pointer-events-none"
        )}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isUploading}
          multiple
        />
        
        <div className="space-y-4 pointer-events-none relative z-0">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            {isUploading ? (
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-gray-400" />
            )}
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isUploading ? "上传中..." : isDragOver ? "在这里放下图片" : "拖拽图片到这里或点击上传"}
            </p>
            <p className="text-sm text-gray-500">
              支持 PNG, JPG, GIF, WebP 格式
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex justify-center">
        <button
          onClick={handlePasteFromClipboard}
          disabled={isUploading}
          className={cn(
            "inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
            isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          <ImageIcon className="w-4 h-4 mr-2" />
          Paste from Clipboard
        </button>
      </div>
    </div>
  );
};