import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import MainContent from "./components/MainContent";
import { UploadResult, UploadRecord } from "./types";
import { ImageHostingAPI } from "./api";

function App() {
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'config' | 'compress' | 'compress-history'>('upload');
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

  // 异步检查配置和加载历史记录
  useEffect(() => {
    // 使用 setTimeout 让页面先渲染，然后异步执行校验
    const asyncInit = () => {
      setTimeout(async () => {
        // 异步检查配置
        try {
          const config = await ImageHostingAPI.getR2Config();
          setConfigExists(!!config);
        } catch (error) {
          console.error('Failed to check config:', error);
        }

        // 异步加载上传历史
        try {
          const history = await ImageHostingAPI.getUploadHistory();
          setUploadHistory(history);
        } catch (error) {
          console.error('Failed to load upload history:', error);
        }
      }, 0); // 使用 0ms 延迟，让页面先渲染
    };

    asyncInit();
  }, []);

  const handleUploadSuccess = (_result: UploadResult) => {
    showNotification('图片上传成功！', 'success');
    // 重新加载历史记录
    ImageHostingAPI.getUploadHistory().then(setUploadHistory);
    // 触发历史记录组件刷新
    setRefreshTrigger(prev => prev + 1);
  };

  const handleUploadError = (error: string) => {
    showNotification(`上传失败: ${error}`, 'error');
  };

  const handleConfigSaved = () => {
    setConfigExists(true);
    showNotification('配置保存成功！', 'success');
  };

  return (
    <div className="mac-window">
      {/* Sidebar */}
      <Sidebar
        theme={theme}
        activeTab={activeTab}
        onThemeChange={handleThemeChange}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <div className="mac-content">
        {/* Title Bar Drag Region */}
        <div className="mac-titlebar drag-region">
          {/* Title bar content if needed, currently empty for clean look */}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pt-12">
          <MainContent
            activeTab={activeTab}
            uploadHistory={uploadHistory}
            refreshTrigger={refreshTrigger}
            configExists={configExists}
            onUploadSuccess={handleUploadSuccess}
            onUploadError={handleUploadError}
            onShowNotification={showNotification}
            onConfigSaved={handleConfigSaved}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Notifications */}
        {notification && (
          <div className="toast toast-top toast-end z-50 mt-12 mr-4">
            <div className={`alert ${notification.type === 'success' ? 'alert-success' :
              notification.type === 'error' ? 'alert-error' : 'alert-info'
              } shadow-lg`}>
              {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {notification.type === 'error' && <XCircle className="w-5 h-5" />}
              {notification.type === 'info' && <AlertCircle className="w-5 h-5" />}
              <span>{notification.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;