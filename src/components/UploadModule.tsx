import React from 'react';
import { AlertCircle, ImageIcon, Copy } from 'lucide-react';
import { UploadArea } from './UploadArea';
import { UploadRecord } from '../types';

interface UploadModuleProps {
  uploadHistory: UploadRecord[];
  onUploadSuccess: (record: UploadRecord) => void;
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
  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    onShowNotification('链接已复制到剪贴板', 'success');
  };

  return (
    <div className="space-y-8">
      {/* 上传组件 */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="max-w-2xl mx-auto">
            <h2 className="card-title text-2xl justify-center mb-6 text-base-content">上传图片到 R2</h2>
            <UploadArea
              onUploadSuccess={onUploadSuccess}
              onUploadError={onUploadError}
              isActive={true}
            />
            
            {/* 粘贴上传提示 */}
            <div className="alert alert-info mt-6">
              <AlertCircle className="w-4 h-4 text-info" />
              <span>提示：您也可以直接复制图片后按 Ctrl+V 上传</span>
            </div>
          </div>
        </div>
      </div>

      {/* 最近上传的图片列表 */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h3 className="card-title text-base-content">最近上传</h3>
            <button
              onClick={onViewAllHistory}
              className="btn btn-ghost btn-sm"
            >
              <span className="text-base-content">查看全部 →</span>
            </button>
          </div>
          
          {uploadHistory.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 mx-auto mb-4 text-base-content/40" />
              <p className="text-base-content/60">暂无上传记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>缩略图</th>
                    <th>文件名</th>
                    <th>大小</th>
                    <th>上传时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadHistory.slice(0, 10).map((item: UploadRecord) => (
                    <tr key={item.id}>
                      <td>
                        <div className="avatar">
                          <div className="w-12 h-12 rounded">
                            <img
                              src={item.url}
                              alt={item.original_filename}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="w-full h-full bg-base-200 flex items-center justify-center">
                                      <svg class="w-6 h-6 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                      </svg>
                                    </div>
                                  `;
                                }
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="max-w-xs truncate text-base-content" title={item.original_filename}>
                          {item.original_filename}
                        </div>
                      </td>
                      <td className="text-sm text-base-content/70">
                        {(item.file_size / 1024).toFixed(1)} KB
                      </td>
                      <td className="text-sm text-base-content/70">
                        {new Date(item.upload_time * 1000).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td>
                        <button
                          onClick={() => handleCopyUrl(item.url)}
                          className="btn btn-ghost btn-xs"
                          title="复制链接"
                        >
                          <Copy className="w-4 h-4 text-base-content" />
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
    </div>
  );
};

export default UploadModule;