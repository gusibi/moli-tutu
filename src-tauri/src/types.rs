use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub api_proxy_enabled: bool,
    pub api_proxy_port: u16,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            api_proxy_enabled: false,
            api_proxy_port: 38123,
        }
    }
}

/// Supported storage provider types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StorageProvider {
    CloudflareR2,
    AwsS3,
    BackblazeB2,
    DigitaloceanSpaces,
    MinIO,
    Wasabi,
    AliyunOss,
    TencentCos,
    QiniuKodo,
    Upyun,
    CustomS3,
    Imgur,
    SmMs,
    GitHub,
}

impl std::fmt::Display for StorageProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageProvider::CloudflareR2 => write!(f, "Cloudflare R2"),
            StorageProvider::AwsS3 => write!(f, "AWS S3"),
            StorageProvider::BackblazeB2 => write!(f, "Backblaze B2"),
            StorageProvider::DigitaloceanSpaces => write!(f, "DigitalOcean Spaces"),
            StorageProvider::MinIO => write!(f, "MinIO"),
            StorageProvider::Wasabi => write!(f, "Wasabi"),
            StorageProvider::AliyunOss => write!(f, "Aliyun OSS"),
            StorageProvider::TencentCos => write!(f, "Tencent COS"),
            StorageProvider::QiniuKodo => write!(f, "Qiniu Kodo"),
            StorageProvider::Upyun => write!(f, "Upyun"),
            StorageProvider::CustomS3 => write!(f, "Custom S3"),
            StorageProvider::Imgur => write!(f, "Imgur"),
            StorageProvider::SmMs => write!(f, "SM.MS"),
            StorageProvider::GitHub => write!(f, "GitHub"),
        }
    }
}

impl StorageProvider {
    /// Returns true if this provider uses S3-compatible API
    pub fn is_s3_compatible(&self) -> bool {
        matches!(
            self,
            StorageProvider::CloudflareR2
                | StorageProvider::AwsS3
                | StorageProvider::BackblazeB2
                | StorageProvider::DigitaloceanSpaces
                | StorageProvider::MinIO
                | StorageProvider::Wasabi
                | StorageProvider::AliyunOss
                | StorageProvider::TencentCos
                | StorageProvider::QiniuKodo
                | StorageProvider::CustomS3
        )
    }
}

/// A collection of storage configs with one active
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfigList {
    pub configs: Vec<StorageConfig>,
    pub active_id: String,
}

/// Unified storage configuration that supports all providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    /// Unique identifier for this config entry
    #[serde(default = "generate_uuid")]
    pub id: String,
    /// User-friendly name for this config
    #[serde(default)]
    pub name: String,
    pub provider: StorageProvider,

    // --- S3-compatible fields ---
    #[serde(default)]
    pub access_key_id: String,
    #[serde(default)]
    pub secret_access_key: String,
    #[serde(default)]
    pub endpoint: String,
    #[serde(default)]
    pub bucket_name: String,
    #[serde(default)]
    pub public_url_base: String,
    #[serde(default)]
    pub region: String,
    #[serde(default)]
    pub path_prefix: String,

    // --- Imgur fields ---
    #[serde(default)]
    pub imgur_client_id: String,

    // --- SM.MS fields ---
    #[serde(default)]
    pub smms_api_token: String,

    // --- GitHub fields ---
    #[serde(default)]
    pub github_token: String,
    #[serde(default)]
    pub github_owner: String,
    #[serde(default)]
    pub github_repo: String,
    #[serde(default)]
    pub github_branch: String,
    #[serde(default)]
    pub github_path: String,
    #[serde(default)]
    pub github_cdn_url: String,

    // --- Upyun fields ---
    #[serde(default)]
    pub upyun_bucket: String,
    #[serde(default)]
    pub upyun_operator: String,
    #[serde(default)]
    pub upyun_password: String,
    #[serde(default)]
    pub upyun_domain: String,
}

/// Legacy R2 config for migration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct R2Config {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub endpoint: String,
    pub bucket_name: String,
    pub public_url_base: String,
}

impl R2Config {
    /// Convert legacy R2Config to new StorageConfig
    pub fn to_storage_config(self) -> StorageConfig {
        StorageConfig {
            id: generate_uuid(),
            name: "Cloudflare R2".to_string(),
            provider: StorageProvider::CloudflareR2,
            access_key_id: self.access_key_id,
            secret_access_key: self.secret_access_key,
            endpoint: self.endpoint,
            bucket_name: self.bucket_name,
            public_url_base: self.public_url_base,
            region: String::new(),
            path_prefix: String::new(),
            imgur_client_id: String::new(),
            smms_api_token: String::new(),
            github_token: String::new(),
            github_owner: String::new(),
            github_repo: String::new(),
            github_branch: "main".to_string(),
            github_path: "images".to_string(),
            github_cdn_url: String::new(),
            upyun_bucket: String::new(),
            upyun_operator: String::new(),
            upyun_password: String::new(),
            upyun_domain: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadRecord {
    pub id: String,
    pub original_filename: String,
    pub file_hash: String,
    pub file_size: u64,
    pub url: String,
    pub upload_time: i64,
}

#[derive(Debug, Serialize)]
pub struct UploadResult {
    pub success: bool,
    pub url: Option<String>,
    pub error: Option<String>,
    pub from_cache: bool,
}

#[derive(Debug, Serialize)]
pub struct ApiProxyStatus {
    pub enabled: bool,
    pub running: bool,
    pub port: u16,
}

fn generate_uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}
