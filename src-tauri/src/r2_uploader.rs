use crate::types::R2Config;
use anyhow::Result;
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::{config::Region, primitives::ByteStream, Client};
use sha256::digest;
use uuid::Uuid;

#[derive(Clone)]
pub struct R2Uploader {
    client: Client,
    config: R2Config,
}

impl R2Uploader {
    pub async fn new(config: R2Config) -> Result<Self> {
        println!("[R2Uploader] Creating new uploader with endpoint: {}", config.endpoint);
        println!("[R2Uploader] Bucket: {}", config.bucket_name);
        println!("[R2Uploader] Public URL base: {}", config.public_url_base);
        println!("[R2Uploader] Access Key ID: {}...", &config.access_key_id[..std::cmp::min(8, config.access_key_id.len())]);
        
        // Validate configuration format
        Self::validate_config(&config)?;
        
        let region_provider = RegionProviderChain::default_provider().or_else(Region::new("auto"));
        
        println!("[R2Uploader] Building AWS config...");
        let aws_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .endpoint_url(&config.endpoint)
            .credentials_provider(aws_credential_types::Credentials::new(
                &config.access_key_id,
                &config.secret_access_key,
                None,
                None,
                "cloudflare-r2",
            ))
            .region(region_provider)
            .load()
            .await;

        println!("[R2Uploader] Creating S3 client...");
        let client = Client::new(&aws_config);
        
        // Test bucket access by listing objects (optional)
        println!("[R2Uploader] Testing bucket access...");
        match client.list_objects_v2().bucket(&config.bucket_name).max_keys(1).send().await {
            Ok(_) => println!("[R2Uploader] Bucket access test successful"),
            Err(e) => {
                println!("[R2Uploader] Warning: Bucket access test failed: {:?}", e);
                println!("[R2Uploader] This might indicate configuration issues");
            }
        }
        
        println!("[R2Uploader] R2Uploader initialized successfully");
        Ok(Self { client, config })
    }
    
    fn validate_config(config: &R2Config) -> Result<()> {
        println!("[R2Uploader] Validating configuration...");
        
        if config.access_key_id.is_empty() {
            return Err(anyhow::anyhow!("Access Key ID is empty"));
        }
        
        if config.secret_access_key.is_empty() {
            return Err(anyhow::anyhow!("Secret Access Key is empty"));
        }
        
        if config.bucket_name.is_empty() {
            return Err(anyhow::anyhow!("Bucket name is empty"));
        }
        
        if !config.endpoint.starts_with("https://") {
            println!("[R2Uploader] Warning: Endpoint should start with https://");
        }
        
        // Check if endpoint looks like a proper R2 endpoint
        if !config.endpoint.contains(".r2.cloudflarestorage.com") {
            println!("[R2Uploader] Warning: Endpoint doesn't look like a standard R2 endpoint");
            println!("[R2Uploader] Expected format: https://[account_id].r2.cloudflarestorage.com/[bucket]");
            println!("[R2Uploader] Current endpoint: {}", config.endpoint);
        }
        
        println!("[R2Uploader] Configuration validation completed");
        Ok(())
    }

    pub async fn upload_file(
        &self,
        file_data: Vec<u8>,
        filename: &str,
        content_type: &str,
    ) -> Result<String> {
        println!("[R2Uploader] Starting file upload: {} ({} bytes, type: {})", filename, file_data.len(), content_type);
        
        let file_hash = digest(&file_data);
        println!("[R2Uploader] File hash: {}", file_hash);
        
        let file_extension = std::path::Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");
        
        let key = format!("{}.{}", Uuid::new_v4(), file_extension);
        println!("[R2Uploader] Generated key: {}", key);
        println!("[R2Uploader] Target bucket: {}", self.config.bucket_name);
        
        println!("[R2Uploader] Sending put_object request to S3...");
        let response = self
            .client
            .put_object()
            .bucket(&self.config.bucket_name)
            .key(&key)
            .body(ByteStream::from(file_data))
            .content_type(content_type)
            .send()
            .await;
            
        match response {
            Ok(resp) => {
                println!("[R2Uploader] Upload successful! Response: {:?}", resp);
                let url = format!("{}/{}", self.config.public_url_base.trim_end_matches('/'), key);
                println!("[R2Uploader] Generated public URL: {}", url);
                Ok(url)
            },
            Err(e) => {
                println!("[R2Uploader] Upload failed: {:?}", e);
                Err(e.into())
            }
        }
    }

    pub fn calculate_hash(data: &[u8]) -> String {
        let hash = digest(data);
        println!("[R2Uploader] Calculated hash for {} bytes: {}", data.len(), hash);
        hash
    }
}