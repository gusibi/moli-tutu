import React, { useState, useRef, useCallback, useMemo } from "react";
import { Download, RotateCcw, ChevronDown, Link as LinkIcon, CloudUpload } from "lucide-react";
import { ImageHostingAPI } from "../api";
import { UploadResult } from "../types";

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

interface ImageEditorProps {
  originalImage: File;
  compressedResult: CompressedResult | null;
  config: CompressConfig;
  setConfig: React.Dispatch<React.SetStateAction<CompressConfig>>;
  isProcessing: boolean;
  onReset: () => void;
  onDownload: () => void;
  onUploadSuccess?: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  originalImage,
  compressedResult,
  config,
  setConfig,
  isProcessing,
  onReset,
  onDownload,
  onUploadSuccess,
  onUploadError,
}) => {
  const [splitPosition, setSplitPosition] = useState(50); // 分割线位置百分比
  const [isDragging, setIsDragging] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 获取图片尺寸
  React.useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      // 如果还没有设置自定义尺寸，使用原始尺寸
      if (!config.resizeWidth || !config.resizeHeight) {
        setConfig(prev => ({
          ...prev,
          resizeWidth: img.width,
          resizeHeight: img.height
        }));
      }
    };
    img.src = URL.createObjectURL(originalImage);

    return () => {
      URL.revokeObjectURL(img.src);
    };
  }, [originalImage]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(10, Math.min(90, (x / rect.width) * 100));
    setSplitPosition(percentage);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 上传压缩图片的处理函数
  const handleUploadCompressed = useCallback(async () => {
    if (!compressedResult || !onUploadSuccess || !onUploadError) {
      return;
    }

    setIsUploading(true);

    try {
      // 从 Blob 创建 File 对象
      const compressedFile = new File(
        [compressedResult.compressedBlob],
        `compressed_${originalImage.name}`,
        { type: compressedResult.compressedBlob.type }
      );

      // 转换为 Uint8Array
      const fileData = await ImageHostingAPI.convertFileToUint8Array(compressedFile);

      // 上传图片
      const result = await ImageHostingAPI.uploadImage(fileData, compressedFile.name);

      if (result.success) {
        onUploadSuccess(result);
      } else {
        onUploadError(result.error || "上传失败");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "上传失败";
      onUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [compressedResult, originalImage.name, onUploadSuccess, onUploadError]);

  // 使用 useMemo 优化尺寸计算，避免闪烁
  const calculatedDimensions = useMemo(() => {
    const originalWidth = imageDimensions.width;
    const originalHeight = imageDimensions.height;

    if (!originalWidth || !originalHeight) return 'Calculating...';

    if (config.resizePreset !== 'custom') {
      const percentage = parseInt(config.resizePreset.replace('%', '')) / 100;
      const width = Math.round(originalWidth * percentage);
      const height = Math.round(originalHeight * percentage);
      return `${width} × ${height}`;
    } else {
      if (config.maintainAspectRatio && config.resizeWidth && config.resizeHeight) {
        const aspectRatio = originalWidth / originalHeight;
        let width, height;
        if (config.resizeWidth / config.resizeHeight > aspectRatio) {
          width = Math.round(config.resizeHeight * aspectRatio);
          height = config.resizeHeight;
        } else {
          width = config.resizeWidth;
          height = Math.round(config.resizeWidth / aspectRatio);
        }
        return `${width} × ${height}`;
      } else {
        return `${config.resizeWidth || 0} × ${config.resizeHeight || 0}`;
      }
    }
  }, [
    imageDimensions.width,
    imageDimensions.height,
    config.resizePreset,
    config.resizeWidth,
    config.resizeHeight,
    config.maintainAspectRatio
  ]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background-light dark:bg-background-dark">
      {/* Settings Sidebar */}
      <aside className="flex w-80 flex-shrink-0 flex-col border-r border-gray-200/80 bg-gray-50/50 dark:border-gray-800/80 dark:bg-gray-900/50">
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Format Section */}
          <section>
            <h3 className="px-0 pb-2 pt-2 text-base font-bold leading-tight tracking-[-0.015em] text-gray-800 dark:text-white">
              Format
            </h3>
            <div className="flex h-10 flex-1 items-center justify-center rounded-lg bg-gray-200 p-1 dark:bg-black/40">
              {(['mozjpeg', 'webp', 'oxipng', 'avif'] as const).map((fmt) => {
                const label = fmt === 'mozjpeg' ? 'JPEG' : fmt === 'oxipng' ? 'PNG' : fmt.toUpperCase();
                const isSelected = config.format === fmt;
                return (
                  <label
                    key={fmt}
                    className={`flex h-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal transition-all
                      ${isSelected
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                  >
                    <span className="truncate">{label}</span>
                    <input
                      type="radio"
                      name="format-selector"
                      value={fmt}
                      checked={isSelected}
                      onChange={() => setConfig(prev => ({ ...prev, format: fmt }))}
                      className="hidden"
                    />
                  </label>
                );
              })}
            </div>
          </section>

          {/* Quality Section */}
          {config.format !== 'oxipng' && (
            <section>
              <h3 className="px-0 pb-2 pt-2 text-base font-bold leading-tight tracking-[-0.015em] text-gray-800 dark:text-white">
                Quality
              </h3>
              <div className="relative flex w-full flex-col items-start justify-between gap-3 rounded-lg bg-gray-200 p-3 dark:bg-black/40">
                <div className="flex w-full items-center justify-between">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Quality</p>
                  <p className="text-sm font-normal text-gray-600 dark:text-gray-400">{config.quality}%</p>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={config.quality}
                  onChange={(e) => setConfig(prev => ({ ...prev, quality: parseInt(e.target.value) }))}
                  className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-primary"
                />
              </div>
            </section>
          )}

          {/* Resize Section */}
          <section>
            <h3 className="px-0 pb-2 pt-2 text-base font-bold leading-tight tracking-[-0.015em] text-gray-800 dark:text-white">
              Resize
            </h3>
            <div className="space-y-3 rounded-lg bg-gray-200 p-3 dark:bg-black/40">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Preset</label>
                <select
                  className="h-8 rounded-md border-gray-300 bg-white/50 text-sm shadow-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200 outline-none px-2"
                  value={config.resizePreset}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setConfig(prev => ({
                      ...prev,
                      resizePreset: val,
                      resize: val !== '100%' // Auto enable resize if not 100%
                    }));
                  }}
                >
                  <option value="100%">100%</option>
                  <option value="75%">75%</option>
                  <option value="50%">50%</option>
                  <option value="25%">25%</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  className="h-8 w-full rounded-md border-gray-300 bg-white/50 text-sm shadow-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200 px-2 disabled:opacity-50"
                  placeholder="Width"
                  type="number"
                  value={config.resizeWidth || ''}
                  disabled={config.resizePreset !== 'custom'}
                  onChange={(e) => setConfig(prev => ({ ...prev, resizeWidth: parseInt(e.target.value) || 0, resize: true }))}
                />
                <span className="text-gray-400">×</span>
                <input
                  className="h-8 w-full rounded-md border-gray-300 bg-white/50 text-sm shadow-sm focus:border-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200 px-2 disabled:opacity-50"
                  placeholder="Height"
                  type="number"
                  value={config.resizeHeight || ''}
                  disabled={config.resizePreset !== 'custom'}
                  onChange={(e) => setConfig(prev => ({ ...prev, resizeHeight: parseInt(e.target.value) || 0, resize: true }))}
                />
                <button
                  onClick={() => setConfig(prev => ({ ...prev, maintainAspectRatio: !prev.maintainAspectRatio }))}
                  className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${config.maintainAspectRatio ? 'bg-primary/20 text-primary' : 'bg-gray-300 text-gray-500 dark:bg-gray-600'}`}
                  title="Maintain Aspect Ratio"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between px-1">
                <span>Original: {imageDimensions.width}×{imageDimensions.height}</span>
                <span>New: {calculatedDimensions}</span>
              </div>
            </div>
          </section>

          {/* Advanced Section */}
          <section>
            <details className="group" open>
              <summary className="flex list-none cursor-pointer items-center justify-between py-2">
                <h3 className="text-base font-bold leading-tight tracking-[-0.015em] text-gray-800 dark:text-white">
                  Advanced
                </h3>
                <ChevronDown className="w-4 h-4 transition-transform duration-200 group-open:rotate-180 text-gray-500" />
              </summary>
              <div className="space-y-2 rounded-lg bg-gray-200 p-3 dark:bg-black/40">
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pre-multiply Alpha</span>
                  <input
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:focus:ring-offset-gray-900 accent-primary"
                    type="checkbox"
                    checked={config.premultiplyAlpha}
                    onChange={(e) => setConfig(prev => ({ ...prev, premultiplyAlpha: e.target.checked }))}
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Linear RGB</span>
                  <input
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:focus:ring-offset-gray-900 accent-primary"
                    type="checkbox"
                    checked={config.linearRGB}
                    onChange={(e) => setConfig(prev => ({ ...prev, linearRGB: e.target.checked }))}
                  />
                </label>
              </div>
            </details>
          </section>

          {/* PNG Options */}
          {config.format === 'oxipng' && (
            <section>
              <details className="group" open>
                <summary className="flex list-none cursor-pointer items-center justify-between py-2">
                  <h3 className="text-base font-bold leading-tight tracking-[-0.015em] text-gray-800 dark:text-white">
                    PNG Options
                  </h3>
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 group-open:rotate-180 text-gray-500" />
                </summary>
                <div className="space-y-3 rounded-lg bg-gray-200 p-3 dark:bg-black/40">
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reduce Palette</span>
                    <input
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-900 dark:focus:ring-offset-gray-900 accent-primary"
                      type="checkbox"
                      checked={config.reducePalette}
                      onChange={(e) => setConfig(prev => ({ ...prev, reducePalette: e.target.checked }))}
                    />
                  </label>

                  {config.reducePalette && (
                    <>
                      <div className="relative flex w-full flex-col items-start justify-between gap-3">
                        <div className="flex w-full items-center justify-between">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Colors</p>
                          <p className="text-sm font-normal text-gray-600 dark:text-gray-400">{config.paletteColors}</p>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="256"
                          value={config.paletteColors}
                          onChange={(e) => setConfig(prev => ({ ...prev, paletteColors: parseInt(e.target.value) }))}
                          className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-primary"
                        />
                      </div>
                      <div className="relative flex w-full flex-col items-start justify-between gap-3">
                        <div className="flex w-full items-center justify-between">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dithering</p>
                          <p className="text-sm font-normal text-gray-600 dark:text-gray-400">{config.dithering}</p>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={config.dithering}
                          onChange={(e) => setConfig(prev => ({ ...prev, dithering: parseFloat(e.target.value) }))}
                          className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-primary"
                        />
                      </div>
                    </>
                  )}
                </div>
              </details>
            </section>
          )}
        </div>

        {/* Sidebar Footer Actions */}
        <div className="flex flex-shrink-0 items-center gap-2 border-t border-gray-200/80 p-4 dark:border-gray-800/80">
          <button
            onClick={onReset}
            className="flex h-9 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-gray-200/80 px-4 text-sm font-medium text-gray-700 hover:bg-gray-300/80 dark:bg-gray-700/80 dark:text-gray-200 dark:hover:bg-gray-600/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            <span className="truncate">Reset</span>
          </button>
          <button
            onClick={onDownload}
            className="flex h-9 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="truncate">Save Image</span>
          </button>
          {onUploadSuccess && (
            <button
              onClick={handleUploadCompressed}
              disabled={isUploading || !compressedResult}
              className="flex h-9 flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Quick Upload to R2"
            >
              <CloudUpload className="w-4 h-4 mr-2" />
              <span className="truncate">{isUploading ? 'Uploading...' : 'Upload'}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Preview Area */}
      <main className="flex flex-1 flex-col overflow-hidden bg-background-light dark:bg-background-dark relative">
        {/* Preview Container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] dark:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-repeat"
          style={{ cursor: isDragging ? 'col-resize' : 'default' }}
        >
          {/* Original Image (Left) */}
          <div
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}
          >
            <img
              src={URL.createObjectURL(originalImage)}
              alt="Original"
              className="max-w-full max-h-full object-contain p-8"
              draggable={false}
            />
            <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">
              Original
            </div>
          </div>

          {/* Compressed Image (Right) */}
          <div
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{ clipPath: `inset(0 0 0 ${splitPosition}%)` }}
          >
            {compressedResult ? (
              <img
                src={compressedResult.compressedUrl}
                alt="Compressed"
                className="max-w-full max-h-full object-contain p-8"
                draggable={false}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {isProcessing ? 'Compressing...' : 'Waiting...'}
              </div>
            )}
            <div className="absolute top-4 right-4 bg-primary/80 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">
              Compressed
            </div>
          </div>

          {/* Split Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white cursor-col-resize z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
            style={{ left: `${splitPosition}%` }}
            onMouseDown={handleMouseDown}
          >
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-primary">
              <div className="flex gap-0.5">
                <div className="w-0.5 h-3 bg-gray-400 rounded-full"></div>
                <div className="w-0.5 h-3 bg-gray-400 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <footer className="flex h-16 flex-shrink-0 items-center justify-between border-t border-gray-200/80 bg-gray-100/50 px-8 backdrop-blur-sm dark:border-gray-800/80 dark:bg-gray-900/50">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Original Size</p>
            <p className="text-base font-semibold text-gray-800 dark:text-gray-200">{formatFileSize(originalImage.size)}</p>
          </div>
          <div className="h-8 border-l border-gray-300 dark:border-gray-700"></div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">New Size</p>
            <p className="text-base font-semibold text-gray-800 dark:text-gray-200">
              {compressedResult ? formatFileSize(compressedResult.compressedSize) : '-'}
            </p>
          </div>
          <div className="h-8 border-l border-gray-300 dark:border-gray-700"></div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Reduction</p>
            <p className={`text-base font-semibold ${compressedResult && compressedResult.compressionRatio > 0 ? 'text-green-600 dark:text-green-500' : 'text-gray-800 dark:text-gray-200'}`}>
              {compressedResult ? `-${Math.abs(compressedResult.compressionRatio).toFixed(0)}%` : '-'}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
};