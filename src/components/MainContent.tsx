import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import UploadModule from './UploadModule';
import { UploadHistory } from './UploadHistory';
import { ImageCompressor } from './ImageCompressor';
import { CompressHistory } from './CompressHistory';
import { ConfigDialog } from './ConfigDialog';
import { restoreImagesFromRecord } from '../utils/compressStorage';
import { UploadRecord } from '../types';
import { CompressRecord } from '../types/compress';

interface MainContentProps {
  activeTab: 'upload' | 'history' | 'config' | 'compress' | 'compress-history';
  uploadHistory: UploadRecord[];
  refreshTrigger: number;
  configExists: boolean;
  onUploadSuccess: (record: UploadRecord) => void;
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
    <main className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 上传区域 */}
      {activeTab === 'upload' && (
        <UploadModule
          uploadHistory={uploadHistory}
          onUploadSuccess={onUploadSuccess}
          onUploadError={onUploadError}
          onShowNotification={onShowNotification}
          onViewAllHistory={() => onTabChange('history')}
        />
      )}

      {/* 上传记录 */}
      {activeTab === 'history' && (
        <UploadHistory refreshTrigger={refreshTrigger} />
      )}

      {/* 图片压缩 */}
      {activeTab === 'compress' && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-2xl justify-center mb-6 text-base-content">图片压缩</h2>
            <div className="max-w-6xl mx-auto">
              <ImageCompressor 
                isActive={activeTab === 'compress'} 
                onUploadSuccess={onUploadSuccess}
                onUploadError={onUploadError}
                restoreRecord={restoreRecord}
                onRecordRestored={() => setRestoreRecord(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 压缩记录 */}
      {activeTab === 'compress-history' && (
        <CompressHistory 
          onPreviewRecord={(record) => {
            // 设置要恢复的记录
            setRestoreRecord(record);
            // 切换到压缩页面
            onTabChange('compress');
          }}
        />
      )}

      {/* R2 配置 */}
      {activeTab === 'config' && (
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-2xl mb-6 text-base-content">R2 配置</h2>
            
            {!configExists && (
              <div className="alert alert-info mb-6">
                <AlertCircle className="w-4 h-4 text-info" />
                <span>请先配置您的 Cloudflare R2 设置以启用图片上传功能。</span>
              </div>
            )}
            
            <ConfigDialog onConfigSaved={onConfigSaved} />
            
            <div className="alert alert-warning mt-8">
              <AlertCircle className="w-4 h-4 text-warning" />
              <span>注意：请确保您的 R2 配置信息正确，错误的配置可能导致上传失败。</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default MainContent;