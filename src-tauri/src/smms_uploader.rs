use anyhow::Result;
use sha256::digest;

/// SM.MS image hosting uploader (https://sm.ms)
#[derive(Clone)]
pub struct SmmsUploader {
    api_token: String,
}

impl SmmsUploader {
    pub fn new(api_token: String) -> Result<Self> {
        if api_token.is_empty() {
            return Err(anyhow::anyhow!("SM.MS API token is empty"));
        }
        println!("[SmmsUploader] Initialized");
        Ok(Self { api_token })
    }

    pub async fn upload_file(
        &self,
        file_data: Vec<u8>,
        filename: &str,
        content_type: &str,
    ) -> Result<String> {
        println!(
            "[SmmsUploader] Uploading: {} ({} bytes)",
            filename,
            file_data.len()
        );

        let client = reqwest::Client::new();

        let part = reqwest::multipart::Part::bytes(file_data)
            .file_name(filename.to_string())
            .mime_str(content_type)
            .map_err(|e| anyhow::anyhow!("Failed to create multipart: {}", e))?;

        let form = reqwest::multipart::Form::new().part("smfile", part);

        let response = client
            .post("https://sm.ms/api/v2/upload")
            .header("Authorization", &self.api_token)
            .multipart(form)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("SM.MS upload request failed: {}", e))?;

        let body: serde_json::Value = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse SM.MS response: {}", e))?;

        let success = body["success"].as_bool().unwrap_or(false);

        if success {
            let url = body["data"]["url"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("SM.MS response missing image URL"))?
                .to_string();
            println!("[SmmsUploader] Upload successful: {}", url);
            Ok(url)
        } else {
            // SM.MS returns existing image URL if duplicate
            let code = body["code"].as_str().unwrap_or("");
            if code == "image_repeated" {
                let url = body["images"]
                    .as_str()
                    .ok_or_else(|| anyhow::anyhow!("SM.MS duplicate but no URL returned"))?
                    .to_string();
                println!("[SmmsUploader] Image already exists: {}", url);
                Ok(url)
            } else {
                let message = body["message"].as_str().unwrap_or("Unknown error");
                Err(anyhow::anyhow!("SM.MS upload failed: {}", message))
            }
        }
    }

    pub fn calculate_hash(data: &[u8]) -> String {
        digest(data)
    }
}
