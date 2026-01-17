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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct R2Config {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub endpoint: String,
    pub bucket_name: String,
    pub public_url_base: String,
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
