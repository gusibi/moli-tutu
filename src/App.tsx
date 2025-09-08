import { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle, CloudUpload, History, Settings, Upload } from "lucide-react";
import { UploadArea } from "./components/UploadArea";
import { ConfigDialog } from "./components/ConfigDialog";
import { UploadHistory } from "./components/UploadHistory";
import { UploadResult } from "./types";
import { ImageHostingAPI } from "./api";
import { cn } from "./lib/utils";

function App() {
  const [configExists, setConfigExists] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'config'>('upload');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    checkConfig();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const checkConfig = async () => {
    try {
      const config = await ImageHostingAPI.getR2Config();
      setConfigExists(config !== null);
    } catch (error) {
      console.error("Failed to check config:", error);
    }
  };

  const handleUploadSuccess = (result: UploadResult) => {
    if (result.url) {
      // Copy URL to clipboard automatically
      navigator.clipboard.writeText(result.url).catch(console.error);
      
      setNotification({
        type: 'success',
        message: result.from_cache 
          ? 'Image URL copied! (from cache)' 
          : 'Image uploaded and URL copied!'
      });
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const handleUploadError = (error: string) => {
    setNotification({
      type: 'error',
      message: error
    });
  };

  const handleConfigSaved = () => {
    setConfigExists(true);
    setNotification({
      type: 'success',
      message: 'Configuration saved successfully!'
    });
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <CloudUpload className="text-2xl text-indigo-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">图床管理器</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setActiveTab('upload')}
                className={cn("nav-btn", activeTab === 'upload' && "active")}
              >
                <Upload className="w-4 h-4 mr-2" />
                上传
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={cn("nav-btn", activeTab === 'history' && "active")}
              >
                <History className="w-4 h-4 mr-2" />
                上传记录
              </button>
              <button 
                onClick={() => setActiveTab('config')}
                className={cn("nav-btn", activeTab === 'config' && "active")}
              >
                <Settings className="w-4 h-4 mr-2" />
                R2 配置
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <div className={cn(
            "rounded-lg p-4 shadow-lg max-w-sm",
            notification.type === 'success' && "bg-green-50 border border-green-200 text-green-800",
            notification.type === 'error' && "bg-red-50 border border-red-200 text-red-800",
            notification.type === 'info' && "bg-blue-50 border border-blue-200 text-blue-800"
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

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 上传区域 */}
        {activeTab === 'upload' && (
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
        )}

        {/* 上传记录 */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">上传记录</h2>
            </div>
            <div className="p-6">
              <UploadHistory refreshTrigger={refreshTrigger} />
            </div>
          </div>
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