use anyhow::Result;
use sha256::digest;

use crate::github_uploader::GitHubUploader;
use crate::imgur_uploader::ImgurUploader;
use crate::s3_uploader::S3Uploader;
use crate::smms_uploader::SmmsUploader;
use crate::types::{StorageConfig, StorageProvider};
use crate::upyun_uploader::UpyunUploader;

/// Unified storage manager that dispatches uploads to the correct backend
#[derive(Clone)]
pub enum StorageManager {
    S3(S3Uploader),
    Imgur(ImgurUploader),
    SmMs(SmmsUploader),
    GitHub(GitHubUploader),
    Upyun(UpyunUploader),
}

impl StorageManager {
    pub async fn new(config: StorageConfig) -> Result<Self> {
        println!(
            "[StorageManager] Creating uploader for provider: {}",
            config.provider
        );

        match config.provider {
            // All S3-compatible providers
            StorageProvider::CloudflareR2
            | StorageProvider::AwsS3
            | StorageProvider::BackblazeB2
            | StorageProvider::DigitaloceanSpaces
            | StorageProvider::MinIO
            | StorageProvider::Wasabi
            | StorageProvider::AliyunOss
            | StorageProvider::TencentCos
            | StorageProvider::QiniuKodo
            | StorageProvider::CustomS3 => {
                let uploader = S3Uploader::new(config).await?;
                Ok(StorageManager::S3(uploader))
            }

            StorageProvider::Imgur => {
                let uploader = ImgurUploader::new(config.imgur_client_id)?;
                Ok(StorageManager::Imgur(uploader))
            }

            StorageProvider::SmMs => {
                let uploader = SmmsUploader::new(config.smms_api_token)?;
                Ok(StorageManager::SmMs(uploader))
            }

            StorageProvider::GitHub => {
                let uploader = GitHubUploader::new(
                    config.github_token,
                    config.github_owner,
                    config.github_repo,
                    config.github_branch,
                    config.github_path,
                    config.github_cdn_url,
                )?;
                Ok(StorageManager::GitHub(uploader))
            }

            StorageProvider::Upyun => {
                let uploader = UpyunUploader::new(
                    config.upyun_bucket,
                    config.upyun_operator,
                    config.upyun_password,
                    config.upyun_domain,
                )?;
                Ok(StorageManager::Upyun(uploader))
            }
        }
    }

    pub async fn upload_file(
        &self,
        file_data: Vec<u8>,
        filename: &str,
        content_type: &str,
    ) -> Result<String> {
        match self {
            StorageManager::S3(uploader) => {
                uploader
                    .upload_file(file_data, filename, content_type)
                    .await
            }
            StorageManager::Imgur(uploader) => {
                uploader
                    .upload_file(file_data, filename, content_type)
                    .await
            }
            StorageManager::SmMs(uploader) => {
                uploader
                    .upload_file(file_data, filename, content_type)
                    .await
            }
            StorageManager::GitHub(uploader) => {
                uploader
                    .upload_file(file_data, filename, content_type)
                    .await
            }
            StorageManager::Upyun(uploader) => {
                uploader
                    .upload_file(file_data, filename, content_type)
                    .await
            }
        }
    }

    pub fn calculate_hash(data: &[u8]) -> String {
        digest(data)
    }
}
