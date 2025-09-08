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
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="bg-base-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap justify-between items-center gap-4">
          <h1 className="text-2xl font-bold text-base-content bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
            Moli TuTu
          </h1>
          <div className="shrink-0">
            <ConfigDialog onConfigSaved={handleConfigSaved} />
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-down">
          <div className={cn(
            "alert shadow-lg max-w-xs rounded-box p-4",
            notification.type === 'success' && "alert-success",
            notification.type === 'error' && "alert-error",
            notification.type === 'info' && "alert-info"
          )}>
            <div className="flex items-center gap-3">
              {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
              {notification.type === 'error' && <XCircle className="w-5 h-5" />}
              {notification.type === 'info' && <AlertCircle className="w-5 h-5" />}
              <span className="font-medium">{notification.message}</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {!configExists ? (
          <div className="text-center py-12 bg-base-100 rounded-box shadow-sm">
            <div className="inline-flex p-4 rounded-full bg-primary/10 mb-6">
              <AlertCircle className="w-16 h-16 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-3 text-base-content">
              Configuration Required
            </h2>
            <p className="mb-6 max-w-md mx-auto text-base-content/70">
              Please configure your Cloudflare R2 settings before uploading images.
            </p>
            <div className="inline-flex">
              <ConfigDialog onConfigSaved={handleConfigSaved} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upload Area */}
            <div className="bg-base-100 rounded-box shadow-sm p-8 hover:shadow-md transition-shadow border border-base-300">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <h2 className="text-lg font-semibold text-base-content">
                  Upload Images
                </h2>
              </div>
              <div className="px-4">
                <UploadArea
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                />
              </div>
            </div>

            {/* Upload History */}
            <div className="bg-base-100 rounded-box shadow-sm p-8 hover:shadow-md transition-shadow border border-base-300">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-secondary"></div>
                <h2 className="text-lg font-semibold text-base-content">
                  Recent Uploads
                </h2>
              </div>
              <div className="px-4">
                <UploadHistory refreshTrigger={refreshTrigger} />
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-base-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm text-base-content/60">
          <p className="mb-2">Moli TuTu - A modern image uploader for Cloudflare R2</p>
          <p>© {new Date().getFullYear()} All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
