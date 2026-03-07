use anyhow::Result;
use sha256::digest;
use uuid::Uuid;

/// Upyun (又拍云) REST API uploader
#[derive(Clone)]
pub struct UpyunUploader {
    bucket: String,
    operator: String,
    password: String,
    domain: String,
}

impl UpyunUploader {
    pub fn new(
        bucket: String,
        operator: String,
        password: String,
        domain: String,
    ) -> Result<Self> {
        if bucket.is_empty() {
            return Err(anyhow::anyhow!("Upyun bucket (service name) is empty"));
        }
        if operator.is_empty() || password.is_empty() {
            return Err(anyhow::anyhow!("Upyun operator/password is empty"));
        }
        if domain.is_empty() {
            return Err(anyhow::anyhow!("Upyun domain is empty"));
        }
        println!("[UpyunUploader] Initialized for bucket: {}", bucket);
        Ok(Self {
            bucket,
            operator,
            password,
            domain,
        })
    }

    pub async fn upload_file(
        &self,
        file_data: Vec<u8>,
        filename: &str,
        content_type: &str,
    ) -> Result<String> {
        println!(
            "[UpyunUploader] Uploading: {} ({} bytes)",
            filename,
            file_data.len()
        );

        let file_extension = std::path::Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");

        let remote_path = format!("/images/{}.{}", Uuid::new_v4(), file_extension);

        let url = format!(
            "https://v0.api.upyun.com/{}/{}",
            self.bucket,
            remote_path.trim_start_matches('/')
        );

        let client = reqwest::Client::new();

        // Upyun uses HTTP Basic Auth with operator:password
        let auth = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            format!("{}:{}", self.operator, self.password),
        );

        let response = client
            .put(&url)
            .header("Authorization", format!("Basic {}", auth))
            .header("Content-Type", content_type)
            .body(file_data)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Upyun upload request failed: {}", e))?;

        let status = response.status();
        if !status.is_success() {
            let error_body = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!(
                "Upyun upload failed ({}): {}",
                status,
                error_body
            ));
        }

        let image_url = format!(
            "{}/{}",
            self.domain.trim_end_matches('/'),
            remote_path.trim_start_matches('/')
        );
        println!("[UpyunUploader] Upload successful: {}", image_url);
        Ok(image_url)
    }

    pub fn calculate_hash(data: &[u8]) -> String {
        digest(data)
    }
}
