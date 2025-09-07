use crate::types::R2Config;
use anyhow::Result;
use serde_json;
use std::fs;
use std::path::PathBuf;

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new(app_dir: PathBuf) -> Self {
        let config_path = app_dir.join("config.json");
        Self { config_path }
    }

    pub fn load_config(&self) -> Result<Option<R2Config>> {
        if !self.config_path.exists() {
            return Ok(None);
        }
        
        let content = fs::read_to_string(&self.config_path)?;
        let config: R2Config = serde_json::from_str(&content)?;
        Ok(Some(config))
    }

    pub fn save_config(&self, config: &R2Config) -> Result<()> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(config)?;
        fs::write(&self.config_path, content)?;
        Ok(())
    }

    pub fn config_exists(&self) -> bool {
        self.config_path.exists()
    }
}