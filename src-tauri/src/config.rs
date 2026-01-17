use crate::types::{AppSettings, R2Config};
use anyhow::Result;
use serde_json;
use std::fs;
use std::path::PathBuf;

pub struct ConfigManager {
    config_path: PathBuf,
    settings_path: PathBuf,
}

impl ConfigManager {
    pub fn new(app_dir: PathBuf) -> Self {
        let config_path = app_dir.join("config.json");
        let settings_path = app_dir.join("settings.json");
        Self {
            config_path,
            settings_path,
        }
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

    pub fn load_settings(&self) -> Result<AppSettings> {
        if !self.settings_path.exists() {
            return Ok(AppSettings::default());
        }

        let content = fs::read_to_string(&self.settings_path)?;
        let settings: AppSettings = serde_json::from_str(&content)?;
        Ok(settings)
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        if let Some(parent) = self.settings_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(settings)?;
        fs::write(&self.settings_path, content)?;
        Ok(())
    }

    pub fn config_exists(&self) -> bool {
        self.config_path.exists()
    }
}
