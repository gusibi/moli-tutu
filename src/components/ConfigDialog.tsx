import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
// import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Settings } from "lucide-react";
import { R2Config } from "../types";
import { ImageHostingAPI } from "../api";
import { cn } from "../lib/utils";

interface ConfigDialogProps {
  onConfigSaved: () => void;
}

export const ConfigDialog: React.FC<ConfigDialogProps> = ({ onConfigSaved }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<R2Config>({
    access_key_id: "",
    secret_access_key: "",
    endpoint: "",
    bucket_name: "",
    public_url_base: "",
  });

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  const loadConfig = async () => {
    try {
      const existingConfig = await ImageHostingAPI.getR2Config();
      if (existingConfig) {
        setConfig(existingConfig);
      }
    } catch (error) {
      console.error("Failed to load config:", error);
    }
  };

  const handleSave = async () => {
    if (!config.access_key_id || !config.secret_access_key || !config.endpoint || !config.bucket_name || !config.public_url_base) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      await ImageHostingAPI.saveR2Config(config);
      setOpen(false);
      onConfigSaved();
    } catch (error) {
      alert("Failed to save configuration: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof R2Config, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="group inline-flex items-center justify-center w-12 h-12 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:border-blue-200 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl">
          <Settings className="h-5 w-5 text-slate-500 group-hover:text-blue-500 transition-colors duration-300 group-hover:rotate-90" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-lg rounded-3xl shadow-2xl border border-white/20 bg-white/95 backdrop-blur-xl">
        <DialogHeader className="px-8 pt-8 pb-6 border-b border-slate-100">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Settings className="w-4 h-4 text-white" />
            </div>
            Cloudflare R2 配置
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            配置您的 Cloudflare R2 设置以启用图片上传功能。所有字段都是必填的。
          </p>
        </DialogHeader>
        
        <div className="px-8 pt-6 pb-4">
          <div className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="access-key" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span>Access Key ID</span>
                <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full font-medium">必填</span>
              </label>
              <Input
                id="access-key"
                value={config.access_key_id}
                onChange={(e) => handleInputChange("access_key_id", e.target.value)}
                placeholder="输入您的 R2 Access Key ID"
                className="w-full h-12 px-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
              />
            </div>
            
            <div className="space-y-3">
              <label htmlFor="secret-key" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span>Secret Access Key</span>
                <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full font-medium">必填</span>
              </label>
              <Input
                id="secret-key"
                type="password"
                value={config.secret_access_key}
                onChange={(e) => handleInputChange("secret_access_key", e.target.value)}
                placeholder="输入您的 R2 Secret Access Key"
                className="w-full h-12 px-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
              />
            </div>
            
            <div className="space-y-3">
              <label htmlFor="endpoint" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span>Endpoint</span>
                <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full font-medium">必填</span>
              </label>
              <Input
                id="endpoint"
                value={config.endpoint}
                onChange={(e) => handleInputChange("endpoint", e.target.value)}
                placeholder="https://your-account-id.r2.cloudflarestorage.com"
                className="w-full h-12 px-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
              />
            </div>
            
            <div className="space-y-3">
              <label htmlFor="bucket" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span>Bucket Name</span>
                <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full font-medium">必填</span>
              </label>
              <Input
                id="bucket"
                value={config.bucket_name}
                onChange={(e) => handleInputChange("bucket_name", e.target.value)}
                placeholder="your-bucket-name"
                className="w-full h-12 px-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
              />
            </div>
            
            <div className="space-y-3">
              <label htmlFor="public-url" className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <span>Public URL Base</span>
                <span className="px-2 py-1 bg-red-100 text-red-600 text-xs rounded-full font-medium">必填</span>
              </label>
              <Input
                id="public-url"
                value={config.public_url_base}
                onChange={(e) => handleInputChange("public_url_base", e.target.value)}
                placeholder="https://your-domain.com 或 https://pub-xxx.r2.dev"
                className="w-full h-12 px-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-300 text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>
        
        <div className="px-8 pt-4 pb-8 border-t border-slate-100">
          <div className="flex justify-end gap-3">
            <button 
              className="px-6 py-3 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 hover:scale-105 shadow-sm hover:shadow-md"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              取消
            </button>
            <button 
              className={cn(
                "px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 hover:from-blue-600 hover:to-purple-700",
                loading && "opacity-70 cursor-not-allowed hover:scale-100"
              )} 
              onClick={handleSave} 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>保存中...</span>
                </span>
              ) : "保存配置"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};