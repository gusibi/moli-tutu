import React, { useState } from 'react';
import { AlertCircle, ImageIcon, Copy } from 'lucide-react';
import { UploadArea } from './UploadArea';
import { UploadRecord, UploadResult } from '../types';
import { ImageHostingAPI } from '../api';
import { useLanguage } from '../contexts/LanguageContext';

interface UploadModuleProps {
  uploadHistory: UploadRecord[];
  onUploadSuccess: (result: UploadResult) => void;
  onUploadError: (error: string) => void;
  onShowNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  onViewAllHistory: () => void;
}

const UploadModule: React.FC<UploadModuleProps> = ({
  uploadHistory,
  onUploadSuccess,
  onUploadError,
  onShowNotification,
  onViewAllHistory
}) => {
  const { t } = useLanguage();
  const [urlInput, setUrlInput] = useState('');
  const [isUrlUploading, setIsUrlUploading] = useState(false);
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    onShowNotification(t.history.linkCopied, 'success');
  };

  const handleUploadFromUrl = async () => {
    const raw = urlInput.trim();
    if (!raw) {
      onShowNotification(t.upload.pasteImageUrl, 'error');
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      onShowNotification(t.upload.urlFormatError, 'error');
      return;
    }
    if (!(parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
      onShowNotification(t.upload.onlyHttpSupported, 'error');
      return;
    }

    setIsUrlUploading(true);
    try {
      const resp = await fetch(parsed.toString());
      if (!resp.ok) {
        onUploadError(`${t.upload.fetchUrlFailed}: ${resp.status} ${resp.statusText}`);
        return;
      }
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        // 某些站点不返回正确 content-type，这里不强制，但警告
        // onShowNotification('提示：该 URL 的 Content-Type 非 image/*，尝试继续上传', 'info');
      }
      const buffer = await resp.arrayBuffer();
      const data = new Uint8Array(buffer);

      // 生成文件名
      const pathname = parsed.pathname.split('?')[0];
      let baseName = pathname.split('/').pop() || `image-${Date.now()}`;
      const hasExt = /\.[a-zA-Z0-9]+$/.test(baseName);
      const extFromType = (() => {
        if (contentType.startsWith('image/')) {
          const sub = contentType.split('/')[1];
          switch (sub) {
            case 'jpeg':
            case 'jpg':
              return 'jpg';
            case 'png':
            case 'gif':
            case 'webp':
            case 'bmp':
              return sub;
            case 'svg+xml':
              return 'svg';
            default:
              return 'jpg';
          }
        }
        return 'jpg';
      })();
      const filename = hasExt ? baseName : `${baseName}.${extFromType}`;

      const result = await ImageHostingAPI.uploadImage(data, filename);
      if (result.success) {
        onUploadSuccess(result);
        onShowNotification(t.upload.urlUploadSuccess, 'success');
      } else {
        onUploadError(result.error || t.upload.uploadFailed);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onUploadError(`${t.upload.processingUrlError}: ${msg}`);
    } finally {
      setIsUrlUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 上传组件 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="max-w-4xl mx-auto">
          <UploadArea
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            isActive={true}
          />

          {/* URL 上传 */}
          <div className="mt-6 flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                className="w-full h-10 pl-3 pr-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder={t.upload.pasteImageUrl}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUploadFromUrl();
                }}
                disabled={isUrlUploading}
              />
            </div>
            <button
              onClick={handleUploadFromUrl}
              className={`h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[100px]`}
              disabled={isUrlUploading || !urlInput.trim()}
            >
              {isUrlUploading ? t.common.uploading : t.upload.uploadUrl}
            </button>
          </div>

          {/* 粘贴上传提示 */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <AlertCircle className="w-3 h-3" />
            <span>{t.upload.uploadTip}</span>
          </div>
        </div>
      </div>

      {/* 最近上传的图片列表 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t.upload.recentUploads}</h3>
          <button
            onClick={onViewAllHistory}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            {t.upload.viewAll}
          </button>
        </div>

        {uploadHistory.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t.upload.noHistory}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-4 py-3">{t.history.thumbnail}</th>
                  <th className="px-4 py-3">{t.history.filename}</th>
                  <th className="px-4 py-3">{t.history.size}</th>
                  <th className="px-4 py-3">{t.history.time}</th>
                  <th className="px-4 py-3 text-right">{t.history.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {uploadHistory.slice(0, 10).map((item: UploadRecord) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center">
                        <img
                          src={item.url}
                          alt={item.original_filename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                              `;
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px] truncate font-medium text-gray-900 dark:text-white" title={item.original_filename}>
                        {item.original_filename}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {(item.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {new Date(item.upload_time * 1000).toLocaleDateString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleCopyUrl(item.url)}
                        className="p-1.5 rounded-md text-gray-500 hover:text-primary hover:bg-primary/10 transition-colors"
                        title={t.history.copyLink}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadModule;