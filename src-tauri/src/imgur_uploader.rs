use anyhow::Result;
use sha256::digest;

/// Imgur image hosting uploader (https://api.imgur.com)
#[derive(Clone)]
pub struct ImgurUploader {
    client_id: String,
}

impl ImgurUploader {
    pub fn new(client_id: String) -> Result<Self> {
        if client_id.is_empty() {
            return Err(anyhow::anyhow!("Imgur Client ID is empty"));
        }
        println!(
            "[ImgurUploader] Initialized with client_id: {}...",
            &client_id[..std::cmp::min(6, client_id.len())]
        );
        Ok(Self { client_id })
    }

    pub async fn upload_file(
        &self,
        file_data: Vec<u8>,
        filename: &str,
        _content_type: &str,
    ) -> Result<String> {
        println!(
            "[ImgurUploader] Uploading: {} ({} bytes)",
            filename,
            file_data.len()
        );

        let client = reqwest::Client::new();
        let base64_data =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &file_data);

        let response = client
            .post("https://api.imgur.com/3/image")
            .header("Authorization", format!("Client-ID {}", self.client_id))
            .form(&[
                ("image", base64_data.as_str()),
                ("type", "base64"),
                ("name", filename),
            ])
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Imgur upload request failed: {}", e))?;

        let status = response.status();
        let body: serde_json::Value = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse Imgur response: {}", e))?;

        if !status.is_success() {
            let error_msg = body["data"]["error"].as_str().unwrap_or("Unknown error");
            return Err(anyhow::anyhow!(
                "Imgur upload failed ({}): {}",
                status,
                error_msg
            ));
        }

        let url = body["data"]["link"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Imgur response missing image link"))?
            .to_string();

        println!("[ImgurUploader] Upload successful: {}", url);
        Ok(url)
    }

    pub fn calculate_hash(data: &[u8]) -> String {
        digest(data)
    }
}
