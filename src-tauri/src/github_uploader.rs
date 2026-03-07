use anyhow::Result;
use sha256::digest;
use uuid::Uuid;

/// GitHub repository image uploader
#[derive(Clone)]
pub struct GitHubUploader {
    token: String,
    owner: String,
    repo: String,
    branch: String,
    path: String,
    cdn_url: String,
}

impl GitHubUploader {
    pub fn new(
        token: String,
        owner: String,
        repo: String,
        branch: String,
        path: String,
        cdn_url: String,
    ) -> Result<Self> {
        if token.is_empty() {
            return Err(anyhow::anyhow!("GitHub token is empty"));
        }
        if owner.is_empty() || repo.is_empty() {
            return Err(anyhow::anyhow!("GitHub owner/repo is empty"));
        }
        println!("[GitHubUploader] Initialized for {}/{}", owner, repo);
        Ok(Self {
            token,
            owner,
            repo,
            branch: if branch.is_empty() {
                "main".to_string()
            } else {
                branch
            },
            path: if path.is_empty() {
                "images".to_string()
            } else {
                path
            },
            cdn_url,
        })
    }

    pub async fn upload_file(
        &self,
        file_data: Vec<u8>,
        filename: &str,
        _content_type: &str,
    ) -> Result<String> {
        println!(
            "[GitHubUploader] Uploading: {} ({} bytes)",
            filename,
            file_data.len()
        );

        let file_extension = std::path::Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");

        let unique_name = format!("{}.{}", Uuid::new_v4(), file_extension);
        let file_path = format!("{}/{}", self.path.trim_end_matches('/'), unique_name);

        let client = reqwest::Client::new();
        let base64_content =
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &file_data);

        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            self.owner, self.repo, file_path
        );

        let body = serde_json::json!({
            "message": format!("Upload image: {}", filename),
            "content": base64_content,
            "branch": self.branch,
        });

        let response = client
            .put(&url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Accept", "application/vnd.github.v3+json")
            .header("User-Agent", "MoliTutu-ImageUploader")
            .json(&body)
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("GitHub upload request failed: {}", e))?;

        let status = response.status();
        let resp_body: serde_json::Value = response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse GitHub response: {}", e))?;

        if !status.is_success() {
            let message = resp_body["message"].as_str().unwrap_or("Unknown error");
            return Err(anyhow::anyhow!(
                "GitHub upload failed ({}): {}",
                status,
                message
            ));
        }

        // Build the public URL
        let image_url = if !self.cdn_url.is_empty() {
            // Custom CDN (e.g., jsDelivr: https://cdn.jsdelivr.net/gh/owner/repo@branch/)
            format!("{}/{}", self.cdn_url.trim_end_matches('/'), file_path)
        } else {
            // Use raw.githubusercontent.com
            format!(
                "https://raw.githubusercontent.com/{}/{}/{}/{}",
                self.owner, self.repo, self.branch, file_path
            )
        };

        println!("[GitHubUploader] Upload successful: {}", image_url);
        Ok(image_url)
    }

    pub fn calculate_hash(data: &[u8]) -> String {
        digest(data)
    }
}
