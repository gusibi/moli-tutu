import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, CloudUpload, History, Settings, Upload, Copy, Image as ImageIcon, Sun, Moon } from "lucide-react";
import { UploadArea } from "./components/UploadArea";
import { ConfigDialog } from "./components/ConfigDialog";
import { UploadHistory } from "./components/UploadHistory";
import { ThemeSelector } from "./components/ThemeSelector";
import { UploadResult, UploadRecord } from "./types";
import { ImageHostingAPI } from "./api";

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'config'>('upload');
  const [configExists, setConfigExists] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [theme, setTheme] = useState<string>('light');

  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // 主题切换
  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // 初始化主题
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

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
    <div className="min-h-screen bg-base-200">
      {/* 通知组件 */}
      {notification && (
        <div className="toast toast-top toast-end z-50">
          <div className={`alert ${
            notification.type === 'success' ? 'alert-success' :
            notification.type === 'error' ? 'alert-error' : 'alert-info'
          }`}>
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-success" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5 text-error" />}
            {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-info" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* 导航栏 */}
      <div className="navbar bg-base-100 shadow-sm">
        <div className="navbar-start">
          <div className="flex items-center gap-3">
            <CloudUpload className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-bold text-base-content">Moli TuTu</h1>
          </div>
        </div>
        
        <div className="navbar-end">
          <div className="flex items-center gap-4">
            {/* 简单的明暗主题切换 */}
            <button
              onClick={() => handleThemeChange(theme === 'light' ? 'dark' : 'light')}
              className="btn btn-ghost btn-circle"
              title={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 text-base-content" />
              ) : (
                <Sun className="w-5 h-5 text-base-content" />
              )}
            </button>
            
            {/* 主题选择器 */}
            <ThemeSelector 
              currentTheme={theme} 
              onThemeChange={handleThemeChange} 
            />
            
            {/* 导航标签 */}
            <div className="tabs tabs-boxed">
              <button
                onClick={() => setActiveTab('upload')}
                className={`tab gap-2 ${activeTab === 'upload' ? 'tab-active' : ''}`}
              >
                <Upload className="w-4 h-4 text-base-content" />
                <span className="text-base-content">上传</span>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`tab gap-2 ${activeTab === 'history' ? 'tab-active' : ''}`}
              >
                <History className="w-4 h-4 text-base-content" />
                <span className="text-base-content">上传记录</span>
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`tab gap-2 ${activeTab === 'config' ? 'tab-active' : ''}`}
              >
                <Settings className="w-4 h-4 text-base-content" />
                <span className="text-base-content">R2 配置</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 上传区域 */}
        {activeTab === 'upload' && (
          <div className="space-y-8">
            {/* 上传组件 */}
            <div className="card bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="max-w-2xl mx-auto">
                  <h2 className="card-title text-2xl justify-center mb-6 text-base-content">上传图片到 R2</h2>
                  <UploadArea
                    onUploadSuccess={handleUploadSuccess}
                    onUploadError={handleUploadError}
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
                    onClick={() => setActiveTab('history')}
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
                                onClick={() => {
                                  navigator.clipboard.writeText(item.url);
                                  showNotification('链接已复制到剪贴板', 'success');
                                }}
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
        )}

        {/* 上传记录 */}
        {activeTab === 'history' && (
          <UploadHistory refreshTrigger={refreshTrigger} />
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
              
              <ConfigDialog onConfigSaved={handleConfigSaved} />
              
              <div className="alert alert-warning mt-8">
                <AlertCircle className="w-4 h-4 text-warning" />
                <span>注意：请确保您的 R2 配置信息正确，错误的配置可能导致上传失败。</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;