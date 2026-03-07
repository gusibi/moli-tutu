use crate::types::StorageConfig;
use anyhow::Result;
use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::{config::Region, primitives::ByteStream, Client};
use sha256::digest;
use uuid::Uuid;

#[derive(Clone)]
pub struct S3Uploader {
    client: Client,
    config: StorageConfig,
}

impl S3Uploader {
    pub async fn new(config: StorageConfig) -> Result<Self> {
        println!(
            "[S3Uploader] Creating uploader for provider: {}",
            config.provider
        );
        println!("[S3Uploader] Endpoint: {}", config.endpoint);
        println!("[S3Uploader] Bucket: {}", config.bucket_name);

        Self::validate_config(&config)?;

        let region_str = if config.region.is_empty() {
            "auto".to_string()
        } else {
            config.region.clone()
        };
        let region_provider =
            RegionProviderChain::default_provider().or_else(Region::new(region_str));

        let credentials_provider_name: &'static str =
            Box::leak(format!("{}", config.provider).into_boxed_str());

        let aws_config = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .endpoint_url(&config.endpoint)
            .credentials_provider(aws_credential_types::Credentials::new(
                &config.access_key_id,
                &config.secret_access_key,
                None,
                None,
                credentials_provider_name,
            ))
            .region(region_provider)
            .load()
            .await;

        let client = Client::new(&aws_config);

        // Test bucket access
        println!("[S3Uploader] Testing bucket access...");
        match client
            .list_objects_v2()
            .bucket(&config.bucket_name)
            .max_keys(1)
            .send()
            .await
        {
            Ok(_) => println!("[S3Uploader] Bucket access test successful"),
            Err(e) => {
                println!("[S3Uploader] Warning: Bucket access test failed: {:?}", e);
            }
        }

        println!("[S3Uploader] S3Uploader initialized successfully");
        Ok(Self { client, config })
    }

    fn validate_config(config: &StorageConfig) -> Result<()> {
        if config.access_key_id.is_empty() {
            return Err(anyhow::anyhow!("Access Key ID is empty"));
        }
        if config.secret_access_key.is_empty() {
            return Err(anyhow::anyhow!("Secret Access Key is empty"));
        }
        if config.bucket_name.is_empty() {
            return Err(anyhow::anyhow!("Bucket name is empty"));
        }
        if config.endpoint.is_empty() {
            return Err(anyhow::anyhow!("Endpoint is empty"));
        }
        Ok(())
    }

    pub async fn upload_file(
        &self,
        file_data: Vec<u8>,
        filename: &str,
        content_type: &str,
    ) -> Result<String> {
        println!(
            "[S3Uploader] Uploading: {} ({} bytes, type: {})",
            filename,
            file_data.len(),
            content_type
        );

        let file_extension = std::path::Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");

        let key = if self.config.path_prefix.is_empty() {
            format!("{}.{}", Uuid::new_v4(), file_extension)
        } else {
            format!(
                "{}/{}.{}",
                self.config.path_prefix.trim_end_matches('/'),
                Uuid::new_v4(),
                file_extension
            )
        };

        println!("[S3Uploader] Generated key: {}", key);

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
            Ok(_) => {
                let url = format!(
                    "{}/{}",
                    self.config.public_url_base.trim_end_matches('/'),
                    key
                );
                println!("[S3Uploader] Upload successful: {}", url);
                Ok(url)
            }
            Err(e) => {
                println!("[S3Uploader] Upload failed: {:?}", e);
                Err(e.into())
            }
        }
    }

    pub fn calculate_hash(data: &[u8]) -> String {
        digest(data)
    }
}
