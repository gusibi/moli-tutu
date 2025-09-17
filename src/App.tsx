import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import Navigation from "./components/Navigation";
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
      <Navigation
        theme={theme}
        activeTab={activeTab}
        onThemeChange={handleThemeChange}
        onTabChange={setActiveTab}
      />


      {/* 主内容区 */}
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
  );
}

export default App;