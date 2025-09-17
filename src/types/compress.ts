// 压缩配置接口
export interface CompressConfig {
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

// 压缩记录接口
export interface CompressRecord {
  id: string;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressTime: number;
  config: CompressConfig; // 完整的压缩配置
  originalImagePath: string; // 原始图片文件路径
  compressedImagePath: string; // 压缩后图片文件路径
  sourceType: 'file' | 'clipboard' | 'drag'; // 图片来源类型
}

// 压缩结果接口
export interface CompressedResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  originalBlob: Blob;
  compressedBlob: Blob;
  originalUrl: string;
  compressedUrl: string;
}