import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
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
        <button className="btn btn-outline btn-square btn-sm hover:bg-base-200 transition-colors duration-200">
          <Settings className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md rounded-box shadow-lg border border-base-300">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-base-300">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-base-content">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            Cloudflare R2 Configuration
          </DialogTitle>
        </DialogHeader>
        
        <div className="px-6 pt-6 pb-4">
          <p className="text-sm text-base-content/70 mb-6">
            Configure your Cloudflare R2 settings to enable image uploads. All fields are required.
          </p>
          
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="access-key" className="text-sm font-medium flex items-center gap-2">
                <span>Access Key ID</span>
                <span className="badge badge-neutral badge-sm">Required</span>
              </label>
              <Input
                id="access-key"
                value={config.access_key_id}
                onChange={(e) => handleInputChange("access_key_id", e.target.value)}
                placeholder="Your R2 Access Key ID"
                className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 h-11"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="secret-key" className="text-sm font-medium flex items-center gap-2">
                <span>Secret Access Key</span>
                <span className="badge badge-neutral badge-sm">Required</span>
              </label>
              <Input
                id="secret-key"
                type="password"
                value={config.secret_access_key}
                onChange={(e) => handleInputChange("secret_access_key", e.target.value)}
                placeholder="Your R2 Secret Access Key"
                className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 h-11"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="endpoint" className="text-sm font-medium flex items-center gap-2">
                <span>Endpoint</span>
                <span className="badge badge-neutral badge-sm">Required</span>
              </label>
              <Input
                id="endpoint"
                value={config.endpoint}
                onChange={(e) => handleInputChange("endpoint", e.target.value)}
                placeholder="https://your-account-id.r2.cloudflarestorage.com"
                className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 h-11"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="bucket" className="text-sm font-medium flex items-center gap-2">
                <span>Bucket Name</span>
                <span className="badge badge-neutral badge-sm">Required</span>
              </label>
              <Input
                id="bucket"
                value={config.bucket_name}
                onChange={(e) => handleInputChange("bucket_name", e.target.value)}
                placeholder="your-bucket-name"
                className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 h-11"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="public-url" className="text-sm font-medium flex items-center gap-2">
                <span>Public URL Base</span>
                <span className="badge badge-neutral badge-sm">Required</span>
              </label>
              <Input
                id="public-url"
                value={config.public_url_base}
                onChange={(e) => handleInputChange("public_url_base", e.target.value)}
                placeholder="https://your-domain.com or https://pub-xxx.r2.dev"
                className="input input-bordered w-full focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 h-11"
              />
            </div>
          </div>
        </div>
        
        <div className="px-6 pt-2 pb-6 border-t border-base-300">
          <div className="flex justify-end space-x-3">
            <button 
              className="btn btn-outline btn-sm hover:bg-base-200 transition-colors duration-200 min-h-10 h-10 py-2 px-4"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              className={cn(
                "btn btn-primary btn-sm transition-all duration-200 min-h-10 h-10 py-2 px-4",
                loading && "opacity-70 cursor-not-allowed"
              )} 
              onClick={handleSave} 
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </span>
              ) : "Save Configuration"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};