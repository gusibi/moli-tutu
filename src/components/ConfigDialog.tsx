import React, { useState, useEffect } from "react";
import { Settings, Plus, Trash2, Edit2, Star } from "lucide-react";
import {
  StorageConfig,
  StorageConfigList,
  StorageProvider,
  PROVIDER_LABELS,
  S3_PROVIDERS,
  PROVIDER_ENDPOINT_HINTS,
  createDefaultStorageConfig,
} from "../types";
import { ImageHostingAPI } from "../api";
import { useLanguage } from "../contexts/LanguageContext";

interface ConfigDialogProps {
  onConfigSaved: () => void;
}

const PROVIDER_GROUPS = [
  {
    label: "S3 Compatible",
    providers: [
      "cloudflare_r2",
      "aws_s3",
      "backblaze_b2",
      "digitalocean_spaces",
      "min_io",
      "wasabi",
      "aliyun_oss",
      "tencent_cos",
      "qiniu_kodo",
      "custom_s3",
    ] as StorageProvider[],
  },
  {
    label: "Image Hosting",
    providers: ["imgur", "sm_ms"] as StorageProvider[],
  },
  {
    label: "Other",
    providers: ["git_hub", "upyun"] as StorageProvider[],
  },
];

type DialogView = "list" | "edit";

export const ConfigDialog: React.FC<ConfigDialogProps> = ({ onConfigSaved }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DialogView>("list");
  const [loading, setLoading] = useState(false);
  const [configList, setConfigList] = useState<StorageConfigList>({ configs: [], active_id: "" });
  const [editingConfig, setEditingConfig] = useState<StorageConfig>(createDefaultStorageConfig());
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (open) {
      loadConfigList();
      setView("list");
    }
  }, [open]);

  const loadConfigList = async () => {
    try {
      const list = await ImageHostingAPI.getStorageConfigList();
      setConfigList(list);
    } catch (error) {
      console.error("Failed to load config list:", error);
    }
  };

  const isS3Provider = S3_PROVIDERS.includes(editingConfig.provider);

  const validateConfig = (): boolean => {
    if (!editingConfig.name.trim()) return false;
    if (isS3Provider) {
      return !!(editingConfig.access_key_id && editingConfig.secret_access_key && editingConfig.endpoint && editingConfig.bucket_name && editingConfig.public_url_base);
    }
    switch (editingConfig.provider) {
      case "imgur": return !!editingConfig.imgur_client_id;
      case "sm_ms": return !!editingConfig.smms_api_token;
      case "git_hub": return !!(editingConfig.github_token && editingConfig.github_owner && editingConfig.github_repo);
      case "upyun": return !!(editingConfig.upyun_bucket && editingConfig.upyun_operator && editingConfig.upyun_password && editingConfig.upyun_domain);
      default: return false;
    }
  };

  const handleSave = async () => {
    if (!validateConfig()) {
      alert(t.config.fillAllFields);
      return;
    }
    setLoading(true);
    try {
      await ImageHostingAPI.saveStorageConfig(editingConfig);
      await loadConfigList();
      setView("list");
      onConfigSaved();
    } catch (error) {
      alert("Failed to save: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this configuration?")) return;
    try {
      const list = await ImageHostingAPI.deleteStorageConfig(id);
      setConfigList(list);
      onConfigSaved();
    } catch (error) {
      alert("Failed to delete: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      const list = await ImageHostingAPI.setActiveStorageConfig(id);
      setConfigList(list);
      onConfigSaved();
    } catch (error) {
      alert("Failed to set active: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleAddNew = () => {
    setEditingConfig(createDefaultStorageConfig());
    setIsNew(true);
    setView("edit");
  };

  const handleEdit = (config: StorageConfig) => {
    setEditingConfig({ ...config });
    setIsNew(false);
    setView("edit");
  };

  const handleInputChange = (field: keyof StorageConfig, value: string) => {
    setEditingConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleProviderChange = (provider: StorageProvider) => {
    setEditingConfig((prev) => ({
      ...createDefaultStorageConfig(provider),
      id: prev.id,
      name: prev.name || PROVIDER_LABELS[provider],
      ...(S3_PROVIDERS.includes(provider) && S3_PROVIDERS.includes(prev.provider)
        ? {
          access_key_id: prev.access_key_id,
          secret_access_key: prev.secret_access_key,
          bucket_name: prev.bucket_name,
          public_url_base: prev.public_url_base,
          region: prev.region,
          path_prefix: prev.path_prefix,
        }
        : {}),
    }));
  };

  const renderField = (
    field: keyof StorageConfig,
    label: string,
    placeholder: string,
    type: string = "text",
    required: boolean = true
  ) => (
    <div className="form-control" key={field}>
      <label className="label py-1">
        <span className="label-text text-sm font-medium text-base-content">{label}</span>
        {required && <span className="badge badge-error badge-xs">*</span>}
      </label>
      <input
        type={type}
        value={(editingConfig as any)[field] || ""}
        onChange={(e) => handleInputChange(field, e.target.value)}
        placeholder={placeholder}
        className="input input-bordered input-sm w-full"
      />
    </div>
  );

  const renderS3Fields = () => (
    <>
      {renderField("access_key_id", "Access Key ID", t.config.enterAccessKeyId)}
      {renderField("secret_access_key", "Secret Access Key", t.config.enterSecretAccessKey, "password")}
      {renderField("endpoint", "Endpoint", PROVIDER_ENDPOINT_HINTS[editingConfig.provider] || "https://your-endpoint.com")}
      {renderField("bucket_name", "Bucket Name", t.config.enterBucketName)}
      {renderField("public_url_base", "Public URL Base", t.config.enterPublicUrlBase)}
      {renderField("region", "Region", "auto / us-east-1", "text", false)}
      {renderField("path_prefix", "Path Prefix", "images/ (optional)", "text", false)}
    </>
  );

  const renderImgurFields = () => (
    <>
      {renderField("imgur_client_id", "Client ID", "Imgur Client ID")}
      <div className="text-xs text-base-content/50 mt-1">
        Get from <a href="https://api.imgur.com/oauth2/addclient" target="_blank" rel="noreferrer" className="link link-primary">api.imgur.com</a>
      </div>
    </>
  );

  const renderSmmsFields = () => (
    <>
      {renderField("smms_api_token", "API Token", "SM.MS API Token")}
      <div className="text-xs text-base-content/50 mt-1">
        Get from <a href="https://sm.ms/home/apitoken" target="_blank" rel="noreferrer" className="link link-primary">sm.ms</a>
      </div>
    </>
  );

  const renderGitHubFields = () => (
    <>
      {renderField("github_token", "Token", "ghp_xxxx", "password")}
      {renderField("github_owner", "Owner", "your-username")}
      {renderField("github_repo", "Repo", "image-hosting")}
      {renderField("github_branch", "Branch", "main", "text", false)}
      {renderField("github_path", "Path", "images", "text", false)}
      {renderField("github_cdn_url", "CDN URL", "jsdelivr CDN URL (optional)", "text", false)}
    </>
  );

  const renderUpyunFields = () => (
    <>
      {renderField("upyun_bucket", "Bucket", "service-name")}
      {renderField("upyun_operator", "Operator", "operator")}
      {renderField("upyun_password", "Password", "password", "password")}
      {renderField("upyun_domain", "Domain", "https://your-domain.com")}
    </>
  );

  const renderProviderFields = () => {
    if (isS3Provider) return renderS3Fields();
    switch (editingConfig.provider) {
      case "imgur": return renderImgurFields();
      case "sm_ms": return renderSmmsFields();
      case "git_hub": return renderGitHubFields();
      case "upyun": return renderUpyunFields();
      default: return null;
    }
  };

  // ========== List view ==========
  const renderListView = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-base-content">{t.config.cloudflareR2Config}</h3>
        <button className="btn btn-primary btn-sm gap-1" onClick={handleAddNew}>
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {configList.configs.length === 0 ? (
        <div className="text-center py-12 text-base-content/50">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t.config.configureR2}</p>
          <button className="btn btn-primary btn-sm mt-4" onClick={handleAddNew}>
            Add Storage Provider
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {configList.configs.map((cfg) => {
            const isActive = cfg.id === configList.active_id;
            return (
              <div
                key={cfg.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isActive
                  ? "border-primary/50 bg-primary/5 shadow-sm"
                  : "border-base-200 hover:border-base-300 bg-base-100"
                  }`}
              >
                {/* Active indicator */}
                <button
                  className={`btn btn-circle btn-sm ${isActive ? "btn-primary" : "btn-ghost border border-base-300"
                    }`}
                  onClick={() => !isActive && handleSetActive(cfg.id)}
                  title={isActive ? "Active" : "Set as active"}
                >
                  {isActive ? (
                    <Star className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Star className="w-3.5 h-3.5 opacity-30" />
                  )}
                </button>

                {/* Config info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-base-content truncate">
                      {cfg.name || PROVIDER_LABELS[cfg.provider]}
                    </span>
                    {isActive && (
                      <span className="badge badge-primary badge-xs">Active</span>
                    )}
                  </div>
                  <span className="text-xs text-base-content/50">
                    {PROVIDER_LABELS[cfg.provider]}
                    {cfg.endpoint && ` · ${cfg.endpoint.replace(/^https?:\/\//, "").slice(0, 30)}`}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    className="btn btn-ghost btn-xs btn-square"
                    onClick={() => handleEdit(cfg)}
                    title="Edit"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs btn-square text-error"
                    onClick={() => handleDelete(cfg.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="modal-action">
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          <span className="text-base-content">{t.common.cancel}</span>
        </button>
      </div>
    </>
  );

  // ========== Edit view ==========
  const renderEditView = () => (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm btn-square" onClick={() => setView("list")}>
          ←
        </button>
        <h3 className="font-bold text-base text-base-content">
          {isNew ? "Add Configuration" : "Edit Configuration"}
        </h3>
      </div>

      <div className="space-y-3 overflow-y-auto max-h-[55vh] pr-1">
        {/* Name */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-sm font-medium text-base-content">Name</span>
            <span className="badge badge-error badge-xs">*</span>
          </label>
          <input
            type="text"
            value={editingConfig.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="My R2 / Production S3 / ..."
            className="input input-bordered input-sm w-full"
          />
        </div>

        {/* Provider */}
        <div className="form-control">
          <label className="label py-1">
            <span className="label-text text-sm font-medium text-base-content">Provider</span>
          </label>
          <select
            className="select select-bordered select-sm w-full"
            value={editingConfig.provider}
            onChange={(e) => handleProviderChange(e.target.value as StorageProvider)}
          >
            {PROVIDER_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.providers.map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Dynamic fields */}
        {renderProviderFields()}
      </div>

      <div className="modal-action">
        <button className="btn btn-ghost btn-sm" onClick={() => setView("list")} disabled={loading}>
          <span className="text-base-content">{t.common.cancel}</span>
        </button>
        <button className={`btn btn-primary btn-sm ${loading ? "loading" : ""}`} onClick={handleSave} disabled={loading}>
          <span className="text-primary-content">
            {loading ? t.common.saving : t.config.saveConfig}
          </span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <button className="btn btn-ghost gap-2" onClick={() => setOpen(true)}>
        <Settings className="h-5 w-5" />
        {t.config.r2Config}
      </button>

      <dialog className={`modal ${open ? "modal-open" : ""}`}>
        <div className="modal-box w-11/12 max-w-2xl max-h-[85vh]">
          {view === "list" ? renderListView() : renderEditView()}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setOpen(false)}>close</button>
        </form>
      </dialog>
    </>
  );
};