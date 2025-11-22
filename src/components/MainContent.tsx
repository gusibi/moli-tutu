import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import UploadModule from './UploadModule';
import { UploadHistory } from './UploadHistory';
import { ImageCompressor } from './ImageCompressor';
import { CompressHistory } from './CompressHistory';
import { ConfigDialog } from './ConfigDialog';
import { UploadRecord, UploadResult } from '../types';
import { CompressRecord } from '../types/compress';

interface MainContentProps {
  activeTab: 'upload' | 'history' | 'config' | 'compress' | 'compress-history';
  uploadHistory: UploadRecord[];
  refreshTrigger: number;
  configExists: boolean;
  onUploadSuccess: (result: UploadResult) => void;
  onUploadError: (error: string) => void;
  onShowNotification: (message: string, type: 'success' | 'error' | 'info') => void;
  onConfigSaved: () => void;
  onTabChange: (tab: 'upload' | 'history' | 'config' | 'compress' | 'compress-history') => void;
}

const MainContent: React.FC<MainContentProps> = ({
  activeTab,
  uploadHistory,
  refreshTrigger,
  configExists,
  onUploadSuccess,
  onUploadError,
  onShowNotification,
  onConfigSaved,
  onTabChange
}) => {
  // 用于存储要恢复的压缩记录
  const [restoreRecord, setRestoreRecord] = useState<CompressRecord | null>(null);

  return (
    <div className="w-full h-full">
      {/* 上传区域 */}
      {activeTab === 'upload' && (
        <div className="w-full max-w-5xl mx-auto p-6">
          <UploadModule
            uploadHistory={uploadHistory}
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            onShowNotification={onShowNotification}
            onViewAllHistory={() => onTabChange('history')}
          />
        </div>
      )}

      {/* 上传记录 */}
      {activeTab === 'history' && (
        <div className="w-full max-w-5xl mx-auto p-6">
          <UploadHistory refreshTrigger={refreshTrigger} />
        </div>
      )}

      {/* 图片压缩 */}
      {activeTab === 'compress' && (
        <div className="w-full h-full flex flex-col">
          <ImageCompressor
            isActive={activeTab === 'compress'}
            onUploadSuccess={onUploadSuccess}
            onUploadError={onUploadError}
            restoreRecord={restoreRecord}
            onRecordRestored={() => setRestoreRecord(null)}
          />
        </div>
      )}

      {/* 压缩记录 */}
      {activeTab === 'compress-history' && (
        <div className="w-full max-w-5xl mx-auto p-6">
          <CompressHistory
            onPreviewRecord={(record) => {
              // 设置要恢复的记录
              setRestoreRecord(record);
              // 切换到压缩页面
              onTabChange('compress');
            }}
          />
        </div>
      )}

      {/* R2 配置 */}
      {activeTab === 'config' && (
        <div className="w-full max-w-5xl mx-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">R2 Configuration</h2>

            {!configExists && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">Please configure your Cloudflare R2 settings to enable image uploading.</span>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <ConfigDialog onConfigSaved={onConfigSaved} />
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">Note: Ensure your configuration is correct. Incorrect settings will cause upload failures.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainContent;