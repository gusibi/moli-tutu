import React, { useCallback, useState, useEffect } from "react";
import { Image as ImageIcon, Zap } from "lucide-react";
import { ImageEditor } from "./ImageEditor";

interface CompressConfig {
  format: 'mozjpeg' | 'webp' | 'avif' | 'oxipng';
  quality: number;
  resize: boolean;
  resizeMethod: 'lanczos3' | 'mitchell' | 'catmull-rom' | 'triangle' | 'hqx' | 'browser-pixelated' | 'browser-low' | 'browser-medium' | 'browser-high';
  resizePreset: '100%' | '75%' | '50%' | '25%' | 'custom';
  resizeWidth?: number;
  resizeHeight?: number;
  premultiplyAlpha: boolean;
  linearRGB: boolean;
  maintainAspectRatio: boolean;
  reducePalette: boolean;
  paletteColors: number;
  dithering: number;
}

interface CompressedResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalBlob: Blob;
  compressedBlob: Blob;
  originalUrl: string;
  compressedUrl: string;
}

export const ImageCompressor: React.FC = () => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalImage, setOriginalImage] = useState<File | null>(null);
  const [compressedResult, setCompressedResult] = useState<CompressedResult | null>(null);
  const [hasProcessed, setHasProcessed] = useState(false);
  const [config, setConfig] = useState<CompressConfig>({
    format: 'mozjpeg',
    quality: 75,
    resize: false,
    resizeMethod: 'lanczos3',
    resizePreset: '100%',
    resizeWidth: 1920,
    resizeHeight: 1080,
    premultiplyAlpha: false,
    linearRGB: false,
    maintainAspectRatio: true,
    reducePalette: false,
    paletteColors: 256,
    dithering: 1,
  });

  const handleFiles = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件");
      return;
    }

    setOriginalImage(file);
    setCompressedResult(null);
    setHasProcessed(false);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[ImageCompressor] Drag enter - setting compression mode");
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    console.log("[ImageCompressor] Drop event captured - processing for compression");
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    e.target.value = "";
  }, [handleFiles]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const file = new File([blob], `clipboard-${Date.now()}.${type.split('/')[1]}`, { type });
            setOriginalImage(file);
            setCompressedResult(null);
            setHasProcessed(false);
            return;
          }
        }
      }
      alert("剪贴板中没有找到图片");
    } catch (error) {
      console.error("读取剪贴板失败:", error);
      alert("读取剪贴板失败");
    }
  }, []);

  const compressImage = useCallback(async () => {
    if (!originalImage || isProcessing) return;

    setIsProcessing(true);
    setHasProcessed(false);
    try {
      // 创建 canvas 进行图片处理
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法创建 Canvas 上下文');

      // 创建图片对象
      const img = new Image();
      const imageUrl = URL.createObjectURL(originalImage);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // 计算目标尺寸
      let { width, height } = img;
      if (config.resize) {
        if (config.resizePreset !== 'custom') {
          // 使用预设百分比
          const percentage = parseInt(config.resizePreset.replace('%', '')) / 100;
          width = Math.round(img.width * percentage);
          height = Math.round(img.height * percentage);
        } else if (config.resizeWidth && config.resizeHeight) {
          // 使用自定义尺寸
          if (config.maintainAspectRatio) {
            const aspectRatio = img.width / img.height;
            if (config.resizeWidth / config.resizeHeight > aspectRatio) {
              width = Math.round(config.resizeHeight * aspectRatio);
              height = config.resizeHeight;
            } else {
              width = config.resizeWidth;
              height = Math.round(config.resizeWidth / aspectRatio);
            }
          } else {
            width = config.resizeWidth;
            height = config.resizeHeight;
          }
        }
      }

      // 设置 canvas 尺寸
      canvas.width = width;
      canvas.height = height;

      // 绘制图片
      ctx.drawImage(img, 0, 0, width, height);

      // 根据格式和质量导出
      let mimeType = 'image/jpeg';
      let quality = config.quality / 100;

      switch (config.format) {
        case 'mozjpeg':
          mimeType = 'image/jpeg';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'oxipng':
          mimeType = 'image/png';
          quality = 1; // PNG 不支持质量参数
          break;
        case 'avif':
          // 大多数浏览器还不支持 AVIF 导出，回退到 WebP
          mimeType = 'image/webp';
          break;
      }

      // 转换为 Blob
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('压缩失败'));
        }, mimeType, quality);
      });

      const originalBlob = new Blob([await originalImage.arrayBuffer()], { type: originalImage.type });
      const compressionRatio = ((originalBlob.size - compressedBlob.size) / originalBlob.size) * 100;

      setCompressedResult({
        originalSize: originalBlob.size,
        compressedSize: compressedBlob.size,
        compressionRatio,
        originalBlob,
        compressedBlob,
        originalUrl: URL.createObjectURL(originalBlob),
        compressedUrl: URL.createObjectURL(compressedBlob),
      });

      // 清理
      URL.revokeObjectURL(imageUrl);
      setHasProcessed(true);

    } catch (error) {
      console.error("压缩失败:", error);
      alert("压缩失败: " + (error instanceof Error ? error.message : "未知错误"));
      setHasProcessed(true);
    } finally {
      setIsProcessing(false);
    }
  }, [originalImage, config, isProcessing]);

  const downloadCompressed = useCallback(() => {
    if (!compressedResult) return;

    const link = document.createElement('a');
    link.href = compressedResult.compressedUrl;
    const extension = config.format === 'mozjpeg' ? 'jpg' : config.format;
    link.download = `compressed-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [compressedResult, config.format]);

  const resetAll = useCallback(() => {
    setOriginalImage(null);
    setCompressedResult(null);
    setHasProcessed(false);
    setIsProcessing(false);
    if (compressedResult) {
      URL.revokeObjectURL(compressedResult.originalUrl);
      URL.revokeObjectURL(compressedResult.compressedUrl);
    }
  }, [compressedResult]);

  // 首次加载图片时压缩
  useEffect(() => {
    if (originalImage && !hasProcessed && !isProcessing) {
      compressImage();
    }
  }, [originalImage, hasProcessed, isProcessing, compressImage]);

  // 配置更改时重新压缩
  useEffect(() => {
    if (originalImage && hasProcessed && !isProcessing) {
      const timer = setTimeout(() => {
        compressImage();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    config.format, 
    config.quality, 
    config.resize, 
    config.resizeMethod,
    config.resizePreset,
    config.resizeWidth, 
    config.resizeHeight, 
    config.premultiplyAlpha,
    config.linearRGB,
    config.maintainAspectRatio,
    config.reducePalette,
    config.paletteColors,
    config.dithering
  ]);

  if (originalImage) {
    return (
      <ImageEditor 
        originalImage={originalImage}
        compressedResult={compressedResult}
        config={config}
        setConfig={setConfig}
        isProcessing={isProcessing}
        onReset={resetAll}
        onDownload={downloadCompressed}
      />
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* 拖拽上传区域 */}
      <div 
        data-compress-drop-zone="true"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer 
          transition-all duration-300 ease-in-out overflow-hidden z-50
          ${isDragOver 
            ? "border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/20" 
            : "border-base-300 hover:border-primary/50 hover:scale-102"
          }
        `}
        style={{ position: 'relative', zIndex: 1000 }}
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

        <Zap className={`mx-auto w-16 h-16 mb-4 transition-all duration-300 relative z-10 ${
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
            {isDragOver ? (
              <span className="animate-bounce">✨ 在这里放下图片进行压缩 ✨</span>
            ) : (
              "拖拽图片到这里或点击选择 开始压缩"
            )}
          </p>
          <p className={`text-sm transition-all duration-300 ${
            isDragOver 
              ? "text-primary/80 scale-105" 
              : "text-base-content/60"
          }`}>
            支持 JPG、PNG、GIF、WebP 格式
          </p>
        </div>
        
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileSelect}
          className="hidden" 
          id="compress-file-input"
        />
        
        <button 
          onClick={() => {
            const input = document.getElementById('compress-file-input') as HTMLInputElement;
            input?.click();
          }}
          className={`btn btn-primary mt-4 transition-all duration-300 relative z-10 ${
            isDragOver 
              ? "scale-110 shadow-lg shadow-primary/30 animate-pulse" 
              : "hover:scale-105 hover:shadow-md"
          }`}
        >
          <span className="text-primary-content">选择图片</span>
        </button>
      </div>
      
      {/* 剪贴板粘贴按钮 */}
      <div className="flex justify-center">
        <button
          onClick={handlePasteFromClipboard}
          className="btn btn-outline btn-sm gap-2"
        >
          <ImageIcon className="w-4 h-4 text-base-content" />
          <span className="text-base-content">从剪贴板粘贴</span>
        </button>
      </div>
    </div>
  );
};