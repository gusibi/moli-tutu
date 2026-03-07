use crate::types::{AppSettings, R2Config, StorageConfig, StorageConfigList};
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

    /// Load the full config list, with auto-migration from legacy formats
    pub fn load_config_list(&self) -> Result<StorageConfigList> {
        if !self.config_path.exists() {
            return Ok(StorageConfigList {
                configs: vec![],
                active_id: String::new(),
            });
        }

        let content = fs::read_to_string(&self.config_path)?;

        // 1. Try to parse as new StorageConfigList
        if let Ok(list) = serde_json::from_str::<StorageConfigList>(&content) {
            return Ok(list);
        }

        // 2. Try to parse as a single StorageConfig (previous format) and wrap into list
        if let Ok(single_config) = serde_json::from_str::<StorageConfig>(&content) {
            println!("[ConfigManager] Migrating single StorageConfig to StorageConfigList...");
            let id = single_config.id.clone();
            let list = StorageConfigList {
                configs: vec![single_config],
                active_id: id,
            };
            self.save_config_list(&list)?;
            println!("[ConfigManager] Migration successful");
            return Ok(list);
        }

        // 3. Try to parse as legacy R2Config
        if let Ok(legacy) = serde_json::from_str::<R2Config>(&content) {
            println!("[ConfigManager] Migrating legacy R2Config to StorageConfigList...");
            let new_config = legacy.to_storage_config();
            let id = new_config.id.clone();
            let list = StorageConfigList {
                configs: vec![new_config],
                active_id: id,
            };
            self.save_config_list(&list)?;
            println!("[ConfigManager] Migration from R2Config successful");
            return Ok(list);
        }

        println!("[ConfigManager] Warning: Could not parse config file");
        Ok(StorageConfigList {
            configs: vec![],
            active_id: String::new(),
        })
    }

    /// Get the currently active config
    pub fn load_active_config(&self) -> Result<Option<StorageConfig>> {
        let list = self.load_config_list()?;
        if list.active_id.is_empty() || list.configs.is_empty() {
            return Ok(None);
        }
        Ok(list.configs.into_iter().find(|c| c.id == list.active_id))
    }

    /// For backward compatibility: load_config returns the active config
    pub fn load_config(&self) -> Result<Option<StorageConfig>> {
        self.load_active_config()
    }

    pub fn save_config_list(&self, list: &StorageConfigList) -> Result<()> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(list)?;
        fs::write(&self.config_path, content)?;
        Ok(())
    }

    /// For backward compatibility: save a single config
    /// Adds/updates it in the list and sets it as active
    pub fn save_config(&self, config: &StorageConfig) -> Result<()> {
        let mut list = self.load_config_list()?;

        // Upsert: find existing by id, or add new
        if let Some(existing) = list.configs.iter_mut().find(|c| c.id == config.id) {
            *existing = config.clone();
        } else {
            list.configs.push(config.clone());
        }
        list.active_id = config.id.clone();

        self.save_config_list(&list)
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
