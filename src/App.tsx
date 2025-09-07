import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { UploadArea } from "./components/UploadArea";
import { ConfigDialog } from "./components/ConfigDialog";
import { UploadHistory } from "./components/UploadHistory";
import { UploadResult } from "./types";
import { ImageHostingAPI } from "./api";
import { cn } from "./lib/utils";
import "./App.css";

function App() {
  const [configExists, setConfigExists] = useState(false);
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Moli TuTu</h1>
          <ConfigDialog onConfigSaved={handleConfigSaved} />
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <div className={cn(
            "flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg",
            notification.type === 'success' && "bg-green-500 text-white",
            notification.type === 'error' && "bg-red-500 text-white",
            notification.type === 'info' && "bg-blue-500 text-white"
          )}>
            {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5" />}
            {notification.type === 'info' && <AlertCircle className="w-5 h-5" />}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {!configExists ? (
          <div className="text-center py-8">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <h2 className="text-lg font-semibold mb-2">Configuration Required</h2>
            <p className="text-gray-500 mb-4">
              Please configure your Cloudflare R2 settings before uploading images.
            </p>
            <ConfigDialog onConfigSaved={handleConfigSaved} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Area */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Upload Images</h2>
              <UploadArea
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
              />
            </div>

            {/* Upload History */}
            <div>
              <UploadHistory refreshTrigger={refreshTrigger} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
