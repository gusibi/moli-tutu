import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import UploadModule from './UploadModule';
import { UploadHistory } from './UploadHistory';
import { ImageCompressor } from './ImageCompressor';
import { CompressHistory } from './CompressHistory';
import { ConfigDialog } from './ConfigDialog';
import { LanguageSelector } from './LanguageSelector';
import { ApiProxyStatus, UploadRecord, UploadResult } from '../types';
import { CompressRecord } from '../types/compress';
import { ImageHostingAPI } from '../api';
import { useLanguage } from '../contexts/LanguageContext';

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
  const { t } = useLanguage();
  // 用于存储要恢复的压缩记录
  const [restoreRecord, setRestoreRecord] = useState<CompressRecord | null>(null);
  const [apiProxyStatus, setApiProxyStatus] = useState<ApiProxyStatus | null>(null);
  const [apiProxyPort, setApiProxyPort] = useState(38123);
  const [apiProxyLoading, setApiProxyLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'config') {
      return;
    }

    let mounted = true;
    ImageHostingAPI.getApiProxyStatus()
      .then((status) => {
        if (!mounted) return;
        setApiProxyStatus(status);
        setApiProxyPort(status.port);
      })
      .catch((error) => {
        console.error('Failed to load API proxy status:', error);
        onShowNotification(t.config.apiProxyStatusFailed, 'error');
      });

    return () => {
      mounted = false;
    };
  }, [activeTab, onShowNotification, t.config.apiProxyStatusFailed]);

  const handleApiProxyToggle = async (enabled: boolean) => {
    setApiProxyLoading(true);
    try {
      const status = await ImageHostingAPI.setApiProxyEnabled(
        enabled,
        enabled ? apiProxyPort : undefined
      );
      setApiProxyStatus(status);
      setApiProxyPort(status.port);
      if (status.running && enabled) {
        onShowNotification(t.config.apiProxyStarted, 'success');
      }
      if (!enabled) {
        onShowNotification(t.config.apiProxyStopped, 'info');
      }
    } catch (error) {
      console.error('Failed to toggle API proxy:', error);
      onShowNotification(t.config.apiProxyToggleFailed, 'error');
    } finally {
      setApiProxyLoading(false);
    }
  };

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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{t.sidebar.settings}</h2>

            {/* 语言设置 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <LanguageSelector />
            </div>

            {/* API 代理 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t.config.apiProxyTitle}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t.config.apiProxyDescription}</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={apiProxyStatus?.enabled ?? false}
                  disabled={apiProxyLoading}
                  onChange={(e) => handleApiProxyToggle(e.target.checked)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="form-control w-full">
                  <div className="label">
                    <span className="label-text font-semibold text-base-content">{t.config.apiProxyPort}</span>
                  </div>
                  <input
                    type="number"
                    min={1024}
                    max={65535}
                    value={apiProxyPort}
                    disabled={apiProxyLoading || (apiProxyStatus?.enabled ?? false)}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setApiProxyPort(Number.isFinite(value) ? value : 0);
                    }}
                    className="input input-bordered w-full"
                  />
                </label>
                <div className="flex flex-col justify-end">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{t.config.apiProxyEndpoint}</span>
                  <span className="text-sm font-mono text-primary break-all">
                    {`http://127.0.0.1:${apiProxyPort}/upload`}
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t.config.apiProxyHint}
              </div>
            </div>

            {/* R2 配置 */}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.config.r2Config}</h3>

            {!configExists && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{t.config.configureR2}</span>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <ConfigDialog onConfigSaved={onConfigSaved} />
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{t.config.configWarning}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainContent;
