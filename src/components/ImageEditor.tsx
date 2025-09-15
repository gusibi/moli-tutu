import React, { useState, useRef, useCallback, useMemo } from "react";
import { Download, RotateCcw, Settings as SettingsIcon } from "lucide-react";

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
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  originalImage,
  compressedResult,
  config,
  setConfig,
  isProcessing,
  onReset,
  onDownload,
}) => {
  const [splitPosition, setSplitPosition] = useState(50); // 分割线位置百分比
  const [isDragging, setIsDragging] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
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

  // 使用 useMemo 优化尺寸计算，避免闪烁
  const calculatedDimensions = useMemo(() => {
    const originalWidth = imageDimensions.width;
    const originalHeight = imageDimensions.height;
    
    if (!originalWidth || !originalHeight) return '计算中...';
    
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
    <div className="fixed inset-0 bg-base-200 z-10">
      {/* 顶部操作栏 */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-base-100/95 backdrop-blur-sm border-b border-base-300">
        <div className="flex justify-between items-center px-6 py-4">
          <h3 className="text-lg font-semibold text-base-content">图片压缩编辑器</h3>
          <div className="flex gap-2">
            <button
              onClick={onReset}
              className="btn btn-ghost btn-sm gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              重新选择
            </button>
            {compressedResult && (
              <button
                onClick={onDownload}
                className="btn btn-primary btn-sm gap-2"
              >
                <Download className="w-4 h-4" />
                下载压缩图片
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 全屏分屏对比视图 */}
      <div className="absolute inset-0 pt-20">
        {/* 对比视图容器 */}
        <div 
          ref={containerRef}
          className="relative w-full h-full overflow-hidden bg-base-200"
          style={{ cursor: isDragging ? 'col-resize' : 'default' }}
        >
          {/* 原图 */}
          <div 
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - splitPosition}% 0 0)` }}
          >
            <img
              src={URL.createObjectURL(originalImage)}
              alt="原图"
              className="w-full h-full object-contain"
              draggable={false}
            />
            {/* 原图标签 */}
            <div className="absolute top-4 left-4 bg-base-100/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
              原图 ({formatFileSize(originalImage.size)})
            </div>
          </div>

          {/* 压缩后图片 */}
          <div 
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${splitPosition}%)` }}
          >
            {compressedResult ? (
              <>
                <img
                  src={compressedResult.compressedUrl}
                  alt="压缩后"
                  className="w-full h-full object-contain"
                  draggable={false}
                />
                {/* 压缩后标签 */}
                <div className="absolute top-4 right-4 bg-primary/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium text-primary-content">
                  压缩后 ({formatFileSize(compressedResult.compressedSize)})
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-base-300">
                <div className="text-center">
                  {isProcessing ? (
                    <>
                      <span className="loading loading-spinner loading-lg text-primary"></span>
                      <p className="mt-4 text-base-content/60">处理中...</p>
                    </>
                  ) : (
                    <p className="text-base-content/60">等待压缩...</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 分割线 */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-primary cursor-col-resize z-10 hover:w-2 transition-all duration-200"
            style={{ left: `${splitPosition}%`, transform: 'translateX(-50%)' }}
            onMouseDown={handleMouseDown}
          >
            {/* 分割线手柄 */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
              <div className="w-1 h-4 bg-primary-content rounded-full"></div>
              <div className="w-1 h-4 bg-primary-content rounded-full ml-1"></div>
            </div>
          </div>

          {/* 拖拽提示 */}
          {!compressedResult && !isProcessing && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-base-100/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-base-content/70">
              调整设置查看压缩效果
            </div>
          )}

          {/* 悬浮配置面板 */}
          <div className="absolute bottom-6 right-6 z-40">
            <div className="card bg-base-100/95 backdrop-blur-sm shadow-xl w-80 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="card-body p-4">
                <h4 className="card-title text-sm gap-2 mb-3">
                  <SettingsIcon className="w-4 h-4" />
                  压缩设置
                </h4>
                
                <div className="space-y-3">
                  {/* 格式选择 */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs">输出格式</span>
                    </label>
                    <select
                      className="select select-bordered select-xs"
                      value={config.format}
                      onChange={(e) => setConfig(prev => ({ ...prev, format: e.target.value as any }))}
                    >
                      <option value="mozjpeg">JPEG</option>
                      <option value="webp">WebP</option>
                      <option value="oxipng">PNG</option>
                    </select>
                  </div>

                  {/* 质量设置 */}
                  {config.format !== 'oxipng' && (
                    <div className="form-control">
                      <label className="label py-1">
                        <span className="label-text text-xs">质量: {config.quality}%</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={config.quality}
                        onChange={(e) => setConfig(prev => ({ ...prev, quality: parseInt(e.target.value) }))}
                        className="range range-primary range-xs"
                      />
                    </div>
                  )}

                  {/* 尺寸调整 */}
                  <div className="form-control">
                    <label className="label cursor-pointer py-1">
                      <span className="label-text text-xs">调整尺寸</span>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary toggle-xs"
                        checked={config.resize}
                        onChange={(e) => setConfig(prev => ({ ...prev, resize: e.target.checked }))}
                      />
                    </label>
                  </div>

                  {config.resize && (
                    <div className="space-y-3">
                      {/* 缩放方法 */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs">方法</span>
                        </label>
                        <select
                          className="select select-bordered select-xs"
                          value={config.resizeMethod}
                          onChange={(e) => setConfig(prev => ({ ...prev, resizeMethod: e.target.value as any }))}
                        >
                          <option value="lanczos3">Lanczos3</option>
                          <option value="mitchell">Mitchell</option>
                          <option value="catmull-rom">Catmull-Rom</option>
                          <option value="triangle">Triangle (bilinear)</option>
                          <option value="hqx">hqx (pixel art)</option>
                          <option value="browser-pixelated">Browser pixelated</option>
                          <option value="browser-low">Browser low quality</option>
                          <option value="browser-medium">Browser medium quality</option>
                          <option value="browser-high">Browser high quality</option>
                        </select>
                      </div>

                      {/* 预设尺寸 */}
                      <div className="form-control">
                        <label className="label py-1">
                          <span className="label-text text-xs">预设</span>
                        </label>
                        <select
                          className="select select-bordered select-xs"
                          value={config.resizePreset}
                          onChange={(e) => setConfig(prev => ({ ...prev, resizePreset: e.target.value as any }))}
                        >
                          <option value="100%">100%</option>
                          <option value="75%">75%</option>
                          <option value="50%">50%</option>
                          <option value="25%">25%</option>
                          <option value="custom">自定义</option>
                        </select>
                      </div>

                      {/* 显示当前尺寸信息 */}
                      <div className="bg-base-200 p-2 rounded text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-base-content/70">原始尺寸:</span>
                          <span className="font-medium">{imageDimensions.width} × {imageDimensions.height}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-base-content/70">调整后:</span>
                          <span className="font-medium text-primary">
                            {calculatedDimensions}
                          </span>
                        </div>
                      </div>

                      {/* 宽高输入 - 始终显示 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="form-control">
                          <label className="label py-1">
                            <span className="label-text text-xs">宽度</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-xs"
                            value={config.resizeWidth || ''}
                            disabled={config.resizePreset !== 'custom'}
                            onChange={(e) => setConfig(prev => ({ ...prev, resizeWidth: parseInt(e.target.value) || 0 }))}
                            placeholder={config.resizePreset !== 'custom' ? '自动计算' : '输入宽度'}
                          />
                        </div>
                        <div className="form-control">
                          <label className="label py-1">
                            <span className="label-text text-xs">高度</span>
                          </label>
                          <input
                            type="number"
                            className="input input-bordered input-xs"
                            value={config.resizeHeight || ''}
                            disabled={config.resizePreset !== 'custom'}
                            onChange={(e) => setConfig(prev => ({ ...prev, resizeHeight: parseInt(e.target.value) || 0 }))}
                            placeholder={config.resizePreset !== 'custom' ? '自动计算' : '输入高度'}
                          />
                        </div>
                      </div>

                      {/* 高级选项 */}
                      <div className="space-y-2">
                        <div className="form-control">
                          <label className="label cursor-pointer py-1">
                            <span className="label-text text-xs">预乘透明通道</span>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary checkbox-xs"
                              checked={config.premultiplyAlpha}
                              onChange={(e) => setConfig(prev => ({ ...prev, premultiplyAlpha: e.target.checked }))}
                            />
                          </label>
                        </div>

                        <div className="form-control">
                          <label className="label cursor-pointer py-1">
                            <span className="label-text text-xs">线性 RGB</span>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary checkbox-xs"
                              checked={config.linearRGB}
                              onChange={(e) => setConfig(prev => ({ ...prev, linearRGB: e.target.checked }))}
                            />
                          </label>
                        </div>

                        <div className="form-control">
                          <label className="label cursor-pointer py-1">
                            <span className="label-text text-xs">保持宽高比</span>
                            <input
                              type="checkbox"
                              className="checkbox checkbox-primary checkbox-xs"
                              checked={config.maintainAspectRatio}
                              onChange={(e) => setConfig(prev => ({ ...prev, maintainAspectRatio: e.target.checked }))}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 调色板设置 */}
                  {config.format === 'oxipng' && (
                    <div className="space-y-3">
                      <div className="form-control">
                        <label className="label cursor-pointer py-1">
                          <span className="label-text text-xs">减少调色板</span>
                          <input
                            type="checkbox"
                            className="toggle toggle-primary toggle-xs"
                            checked={config.reducePalette}
                            onChange={(e) => setConfig(prev => ({ ...prev, reducePalette: e.target.checked }))}
                          />
                        </label>
                      </div>

                      {config.reducePalette && (
                        <div className="space-y-3">
                          {/* 颜色数量 */}
                          <div className="form-control">
                            <label className="label py-1">
                              <span className="label-text text-xs">颜色数量: {config.paletteColors}</span>
                            </label>
                            <input
                              type="range"
                              min="2"
                              max="256"
                              value={config.paletteColors}
                              onChange={(e) => setConfig(prev => ({ ...prev, paletteColors: parseInt(e.target.value) }))}
                              className="range range-primary range-xs"
                            />
                            <div className="w-full flex justify-between text-xs px-2 text-base-content/50">
                              <span>2</span>
                              <span>256</span>
                            </div>
                          </div>

                          {/* 抖动 */}
                          <div className="form-control">
                            <label className="label py-1">
                              <span className="label-text text-xs">抖动: {config.dithering}</span>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="10"
                              step="0.1"
                              value={config.dithering}
                              onChange={(e) => setConfig(prev => ({ ...prev, dithering: parseFloat(e.target.value) }))}
                              className="range range-primary range-xs"
                            />
                            <div className="w-full flex justify-between text-xs px-2 text-base-content/50">
                              <span>0</span>
                              <span>10</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 文件信息 */}
                  <div className="divider my-2"></div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-base-content/70">原始大小:</span>
                      <span className="font-medium">{formatFileSize(originalImage.size)}</span>
                    </div>
                    {compressedResult && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-base-content/70">压缩后:</span>
                          <span className="font-medium">{formatFileSize(compressedResult.compressedSize)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-base-content/70">压缩率:</span>
                          <div className={`badge ${compressedResult.compressionRatio > 0 ? 'badge-success' : 'badge-warning'} badge-xs`}>
                            {compressedResult.compressionRatio > 0 ? '↓' : '↑'} {Math.abs(compressedResult.compressionRatio).toFixed(1)}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {isProcessing && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 text-xs text-base-content/70">
                        <span className="loading loading-spinner loading-xs"></span>
                        处理中...
                      </div>
                      <progress className="progress progress-primary w-full mt-1 h-1"></progress>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};