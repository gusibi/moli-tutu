import React, { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { R2Config } from "../types";
import { ImageHostingAPI } from "../api";

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
    <>
      {/* 触发按钮 */}
      <button 
        className="btn btn-ghost gap-2"
        onClick={() => setOpen(true)}
      >
        <Settings className="h-5 w-5" />
        R2 配置
      </button>

      {/* 模态框 */}
      <dialog className={`modal ${open ? 'modal-open' : ''}`}>
        <div className="modal-box w-11/12 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-8">
                <Settings className="w-4 h-4 text-primary-content" />
              </div>
            </div>
            <h3 className="font-bold text-lg text-base-content">Cloudflare R2 配置</h3>
          </div>
          
          <p className="text-sm text-base-content/70 mb-6">
            配置您的 Cloudflare R2 设置以启用图片上传功能。所有字段都是必填的。
          </p>
          
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold text-base-content">Access Key ID</span>
                <span className="badge badge-error badge-sm">必填</span>
              </label>
              <input
                type="text"
                value={config.access_key_id}
                onChange={(e) => handleInputChange("access_key_id", e.target.value)}
                placeholder="输入您的 R2 Access Key ID"
                className="input input-bordered w-full"
              />
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold text-base-content">Secret Access Key</span>
                <span className="badge badge-error badge-sm">必填</span>
              </label>
              <input
                type="password"
                value={config.secret_access_key}
                onChange={(e) => handleInputChange("secret_access_key", e.target.value)}
                placeholder="输入您的 R2 Secret Access Key"
                className="input input-bordered w-full"
              />
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold text-base-content">Endpoint</span>
                <span className="badge badge-error badge-sm">必填</span>
              </label>
              <input
                type="text"
                value={config.endpoint}
                onChange={(e) => handleInputChange("endpoint", e.target.value)}
                placeholder="https://your-account-id.r2.cloudflarestorage.com"
                className="input input-bordered w-full"
              />
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold text-base-content">Bucket Name</span>
                <span className="badge badge-error badge-sm">必填</span>
              </label>
              <input
                type="text"
                value={config.bucket_name}
                onChange={(e) => handleInputChange("bucket_name", e.target.value)}
                placeholder="your-bucket-name"
                className="input input-bordered w-full"
              />
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold text-base-content">Public URL Base</span>
                <span className="badge badge-error badge-sm">必填</span>
              </label>
              <input
                type="text"
                value={config.public_url_base}
                onChange={(e) => handleInputChange("public_url_base", e.target.value)}
                placeholder="https://your-domain.com 或 https://pub-xxx.r2.dev"
                className="input input-bordered w-full"
              />
            </div>
          </div>
          
          <div className="modal-action">
            <button 
              className="btn btn-ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              <span className="text-base-content">取消</span>
            </button>
            <button 
              className={`btn btn-primary ${loading ? 'loading' : ''}`}
              onClick={handleSave} 
              disabled={loading}
            >
              <span className="text-primary-content">{loading ? "保存中..." : "保存配置"}</span>
            </button>
          </div>
        </div>
        
        {/* 点击背景关闭 */}
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setOpen(false)}>close</button>
        </form>
      </dialog>
    </>
  );
};