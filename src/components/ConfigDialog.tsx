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
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Cloudflare R2 Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="access-key" className="text-sm font-medium">
              Access Key ID
            </label>
            <Input
              id="access-key"
              value={config.access_key_id}
              onChange={(e) => handleInputChange("access_key_id", e.target.value)}
              placeholder="Your R2 Access Key ID"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="secret-key" className="text-sm font-medium">
              Secret Access Key
            </label>
            <Input
              id="secret-key"
              type="password"
              value={config.secret_access_key}
              onChange={(e) => handleInputChange("secret_access_key", e.target.value)}
              placeholder="Your R2 Secret Access Key"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="endpoint" className="text-sm font-medium">
              Endpoint
            </label>
            <Input
              id="endpoint"
              value={config.endpoint}
              onChange={(e) => handleInputChange("endpoint", e.target.value)}
              placeholder="https://your-account-id.r2.cloudflarestorage.com"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="bucket" className="text-sm font-medium">
              Bucket Name
            </label>
            <Input
              id="bucket"
              value={config.bucket_name}
              onChange={(e) => handleInputChange("bucket_name", e.target.value)}
              placeholder="your-bucket-name"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="public-url" className="text-sm font-medium">
              Public URL Base
            </label>
            <Input
              id="public-url"
              value={config.public_url_base}
              onChange={(e) => handleInputChange("public_url_base", e.target.value)}
              placeholder="https://your-domain.com or https://pub-xxx.r2.dev"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};