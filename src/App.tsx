import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, CloudUpload, History, Settings, Upload, Copy, Image as ImageIcon } from "lucide-react";
import { UploadArea } from "./components/UploadArea";
import { ConfigDialog } from "./components/ConfigDialog";
import { UploadHistory } from "./components/UploadHistory";
import { UploadResult, UploadRecord } from "./types";
import { ImageHostingAPI } from "./api";
import { cn } from "./lib/utils";

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'config'>('upload');
  const [configExists, setConfigExists] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // 检查配置是否存在
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const config = await ImageHostingAPI.getR2Config();
        setConfigExists(!!config);
      } catch (error) {
        console.error('Failed to check config:', error);
      }
    };
    checkConfig();
  }, []);

  // 加载上传历史
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await ImageHostingAPI.getUploadHistory();
        setUploadHistory(history);
      } catch (error) {
        console.error('Failed to load upload history:', error);
      }
    };
    loadHistory();
  }, []);

  const handleUploadSuccess = (result: UploadResult) => {
    if (result.success && result.url) {
      showNotification('图片上传成功！', 'success');
      // 重新加载历史记录
      ImageHostingAPI.getUploadHistory().then(setUploadHistory);
      // 触发历史记录组件刷新
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleUploadError = (error: string) => {
    showNotification(`上传失败: ${error}`, 'error');
  };

  const handleConfigSaved = () => {
    setConfigExists(true);
    showNotification('配置保存成功！', 'success');
  };



  return (
    <div className="min-h-screen bg-gray-50">
      {/* 通知组件 */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className={cn(
            "p-4 rounded-lg shadow-lg border",
            notification.type === 'success' && "bg-green-50 border-green-200",
            notification.type === 'error' && "bg-red-50 border-red-200",
            notification.type === 'info' && "bg-blue-50 border-blue-200"
          )}>
            <div className="flex items-center">
              {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-500 mr-3" />}
              {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-500 mr-3" />}
              {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-500 mr-3" />}
              <p className="font-medium">{notification.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <CloudUpload className="w-8 h-8 text-indigo-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">图床管理器</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setActiveTab('upload')}
                className={cn(
                  "nav-btn",
                  activeTab === 'upload' && "active"
                )}
              >
                <Upload className="w-4 h-4 mr-2" />
                上传
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  "nav-btn",
                  activeTab === 'history' && "active"
                )}
              >
                <History className="w-4 h-4 mr-2" />
                上传记录
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={cn(
                  "nav-btn",
                  activeTab === 'config' && "active"
                )}
              >
                <Settings className="w-4 h-4 mr-2" />
                R2 配置
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 上传区域 */}
        {activeTab === 'upload' && (
          <div className="space-y-8">
            {/* 上传组件 */}
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">上传图片到 R2</h2>
                <UploadArea
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                />
                
                {/* 粘贴上传提示 */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    提示：您也可以直接复制图片后按 Ctrl+V 上传
                  </p>
                </div>
              </div>
            </div>

            {/* 最近上传的图片列表 */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">最近上传</h3>
                <button
                  onClick={() => setActiveTab('history')}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  查看全部 →
                </button>
              </div>
              <div className="p-6">
                {uploadHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>暂无上传记录</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">缩略图</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">文件名</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">大小</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">上传时间</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadHistory.slice(0, 10).map((item: UploadRecord) => (
                          <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="w-12 h-12 overflow-hidden rounded bg-gray-200">
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
                                        <div class="w-full h-full flex items-center justify-center">
                                          <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                          </svg>
                                        </div>
                                      `;
                                    }
                                  }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900 max-w-xs">
                              <div className="truncate" title={item.original_filename}>
                                {item.original_filename}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {(item.file_size / 1024).toFixed(1)} KB
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {new Date(item.upload_time * 1000).toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(item.url);
                                  showNotification('链接已复制到剪贴板', 'success');
                                }}
                                className="text-indigo-600 hover:text-indigo-800 p-1 rounded transition-colors"
                                title="复制链接"
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
          </div>
        )}

        {/* 上传记录 */}
        {activeTab === 'history' && (
          <UploadHistory refreshTrigger={refreshTrigger} />
        )}

        {/* R2 配置 */}
        {activeTab === 'config' && (
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">R2 配置</h2>
            {!configExists && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <AlertCircle className="w-4 h-4 inline mr-2" />
                  请先配置您的 Cloudflare R2 设置以启用图片上传功能。
                </p>
              </div>
            )}
            <ConfigDialog onConfigSaved={handleConfigSaved} />
            
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <AlertCircle className="w-4 h-4 inline mr-2" />
                注意：请确保您的 R2 配置信息正确，错误的配置可能导致上传失败。
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;