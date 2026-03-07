use base64;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};
use uuid::Uuid;

mod config;
mod database;
mod github_uploader;
mod imgur_uploader;
mod proxy_server;
mod s3_uploader;
mod smms_uploader;
mod storage_manager;
mod types;
mod upyun_uploader;

use config::ConfigManager;
use database::Database;
use proxy_server::ProxyServer;
use storage_manager::StorageManager;
use types::{
    ApiProxyStatus, AppSettings, StorageConfig, StorageConfigList, UploadRecord, UploadResult,
};

struct AppState {
    db: Arc<Mutex<Option<Database>>>,
    config_manager: Mutex<ConfigManager>,
    uploader: Arc<Mutex<Option<StorageManager>>>,
    proxy: Mutex<ProxyServer>,
    settings: Mutex<AppSettings>,
}

#[tauri::command]
async fn save_storage_config(
    config: StorageConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!(
        "[Backend] Saving storage config: provider={}, endpoint={}",
        config.provider, config.endpoint
    );

    // Save config
    {
        let config_manager = state.config_manager.lock().unwrap();
        config_manager.save_config(&config).map_err(|e| {
            println!("[Backend] Failed to save config: {}", e);
            e.to_string()
        })?;
    }

    // Initialize uploader
    println!("[Backend] Initializing storage uploader...");
    let uploader = StorageManager::new(config).await.map_err(|e| {
        println!("[Backend] Failed to initialize uploader: {}", e);
        e.to_string()
    })?;
    {
        let mut uploader_guard = state.uploader.lock().unwrap();
        *uploader_guard = Some(uploader);
    }

    println!("[Backend] Storage config saved and uploader initialized successfully");
    Ok(())
}

// Keep backward compatible command name for existing frontend
#[tauri::command]
async fn save_r2_config(config: StorageConfig, state: State<'_, AppState>) -> Result<(), String> {
    save_storage_config(config, state).await
}

#[tauri::command]
async fn get_storage_config(state: State<'_, AppState>) -> Result<Option<StorageConfig>, String> {
    println!("[Backend] Getting storage config...");
    let config_manager = state.config_manager.lock().unwrap();
    let result = config_manager.load_config().map_err(|e| {
        println!("[Backend] Failed to load config: {}", e);
        e.to_string()
    });

    match &result {
        Ok(Some(c)) => println!("[Backend] Storage config found: provider={}", c.provider),
        Ok(None) => println!("[Backend] No storage config found"),
        Err(e) => println!("[Backend] Error loading config: {}", e),
    }

    result
}

// Keep backward compatible command name for existing frontend
#[tauri::command]
async fn get_r2_config(state: State<'_, AppState>) -> Result<Option<StorageConfig>, String> {
    get_storage_config(state).await
}

/// Get the full config list (all configs + active_id)
#[tauri::command]
async fn get_storage_config_list(state: State<'_, AppState>) -> Result<StorageConfigList, String> {
    let config_manager = state.config_manager.lock().unwrap();
    config_manager.load_config_list().map_err(|e| e.to_string())
}

/// Delete a storage config by id
#[tauri::command]
async fn delete_storage_config(
    id: String,
    state: State<'_, AppState>,
) -> Result<StorageConfigList, String> {
    println!("[Backend] Deleting storage config: {}", id);

    let (list, was_active) = {
        let config_manager = state.config_manager.lock().unwrap();
        let mut list = config_manager
            .load_config_list()
            .map_err(|e| e.to_string())?;
        list.configs.retain(|c| c.id != id);
        let was_active = list.active_id == id;
        if was_active {
            list.active_id = list
                .configs
                .first()
                .map(|c| c.id.clone())
                .unwrap_or_default();
        }
        config_manager
            .save_config_list(&list)
            .map_err(|e| e.to_string())?;
        (list, was_active)
    };

    // Re-initialize uploader if we deleted the active one
    if was_active {
        if let Some(new_active) = list.configs.first() {
            let new_config = new_active.clone();
            if let Ok(uploader) = StorageManager::new(new_config).await {
                let mut uploader_guard = state.uploader.lock().unwrap();
                *uploader_guard = Some(uploader);
            }
        } else {
            let mut uploader_guard = state.uploader.lock().unwrap();
            *uploader_guard = None;
        }
    }

    Ok(list)
}

/// Set the active storage config and re-initialize the uploader
#[tauri::command]
async fn set_active_storage_config(
    id: String,
    state: State<'_, AppState>,
) -> Result<StorageConfigList, String> {
    println!("[Backend] Setting active storage config: {}", id);

    let (list, target) = {
        let config_manager = state.config_manager.lock().unwrap();
        let mut list = config_manager
            .load_config_list()
            .map_err(|e| e.to_string())?;

        let target = list
            .configs
            .iter()
            .find(|c| c.id == id)
            .ok_or_else(|| format!("Config with id {} not found", id))?
            .clone();

        list.active_id = id;
        config_manager
            .save_config_list(&list)
            .map_err(|e| e.to_string())?;
        (list, target)
    };

    // Re-initialize uploader (no lock held here)
    let uploader = StorageManager::new(target)
        .await
        .map_err(|e| e.to_string())?;
    {
        let mut uploader_guard = state.uploader.lock().unwrap();
        *uploader_guard = Some(uploader);
    }

    Ok(list)
}

#[tauri::command]
async fn upload_image(
    file_data: Vec<u8>,
    filename: String,
    state: State<'_, AppState>,
) -> Result<UploadResult, String> {
    println!(
        "[Backend] Upload request: filename={}, size={} bytes",
        filename,
        file_data.len()
    );

    // Check if uploader is initialized and get a copy
    let uploader = {
        let uploader_guard = state.uploader.lock().unwrap();
        match uploader_guard.as_ref() {
            Some(uploader) => {
                println!("[Backend] Uploader found, proceeding with upload");
                uploader.clone()
            }
            None => {
                println!("[Backend] No uploader configured, returning error");
                return Ok(UploadResult {
                    success: false,
                    url: None,
                    error: Some(
                        "Storage configuration not set. Please configure a storage provider."
                            .to_string(),
                    ),
                    from_cache: false,
                });
            }
        }
    };

    // Calculate file hash
    println!("[Backend] Calculating file hash...");
    let file_hash = StorageManager::calculate_hash(&file_data);
    println!("[Backend] File hash calculated: {}", file_hash);

    // Check if file already exists in database
    {
        println!("[Backend] Checking database for existing file...");
        let db_guard = state.db.lock().unwrap();
        if let Some(ref db) = *db_guard {
            if let Ok(Some(existing_record)) = db.find_by_hash(&file_hash) {
                println!(
                    "[Backend] Found existing file in cache, returning cached URL: {}",
                    existing_record.url
                );
                return Ok(UploadResult {
                    success: true,
                    url: Some(existing_record.url),
                    error: None,
                    from_cache: true,
                });
            }
        }
        println!("[Backend] File not found in cache, proceeding with upload");
    }

    // Determine content type
    let content_type = mime_guess::from_path(&filename)
        .first_or_octet_stream()
        .to_string();
    println!("[Backend] Detected content type: {}", content_type);

    // Upload
    println!("[Backend] Starting upload...");
    let url = match uploader
        .upload_file(file_data.clone(), &filename, &content_type)
        .await
    {
        Ok(url) => {
            println!("[Backend] Upload successful: {}", url);
            url
        }
        Err(e) => {
            println!("[Backend] Upload failed: {}", e);
            return Ok(UploadResult {
                success: false,
                url: None,
                error: Some(e.to_string()),
                from_cache: false,
            });
        }
    };

    // Save to database
    println!("[Backend] Saving upload record to database...");
    let record = UploadRecord {
        id: Uuid::new_v4().to_string(),
        original_filename: filename.clone(),
        file_hash,
        file_size: file_data.len() as u64,
        url: url.clone(),
        upload_time: Database::get_current_timestamp(),
    };

    {
        let db_guard = state.db.lock().unwrap();
        if let Some(ref db) = *db_guard {
            match db.insert_upload_record(&record) {
                Ok(_) => println!("[Backend] Upload record saved successfully"),
                Err(e) => println!("[Backend] Failed to save upload record: {}", e),
            }
        }
    }

    println!("[Backend] Upload completed successfully: {}", url);
    Ok(UploadResult {
        success: true,
        url: Some(url),
        error: None,
        from_cache: false,
    })
}

#[tauri::command]
fn get_api_proxy_status(state: State<'_, AppState>) -> Result<ApiProxyStatus, String> {
    let settings = state.settings.lock().unwrap();
    let proxy = state.proxy.lock().unwrap();
    Ok(ApiProxyStatus {
        enabled: settings.api_proxy_enabled,
        running: proxy.is_running(),
        port: proxy.port(),
    })
}

#[tauri::command]
fn set_api_proxy_enabled(
    enabled: bool,
    port: Option<u16>,
    state: State<'_, AppState>,
) -> Result<ApiProxyStatus, String> {
    let uploader = state.uploader.clone();
    let db = state.db.clone();
    let mut settings = state.settings.lock().unwrap();
    let mut proxy = state.proxy.lock().unwrap();

    if enabled {
        if let Some(port) = port {
            if port == 0 {
                return Err("Port must be between 1 and 65535".to_string());
            }
            if proxy.is_running() && proxy.port() != port {
                return Err("Proxy is running; stop it before changing ports".to_string());
            }
            proxy.set_port(port);
            settings.api_proxy_port = port;
        }
        tauri::async_runtime::block_on(proxy.start(uploader, db))?;
        settings.api_proxy_enabled = true;
    } else {
        proxy.stop()?;
        settings.api_proxy_enabled = false;
    }

    settings.api_proxy_port = proxy.port();
    let config_manager = state.config_manager.lock().unwrap();
    config_manager
        .save_settings(&settings)
        .map_err(|e| e.to_string())?;

    Ok(ApiProxyStatus {
        enabled: settings.api_proxy_enabled,
        running: proxy.is_running(),
        port: proxy.port(),
    })
}

#[tauri::command]
async fn get_upload_history(state: State<'_, AppState>) -> Result<Vec<UploadRecord>, String> {
    println!("[Backend] Getting upload history...");
    let db_guard = state.db.lock().unwrap();
    match db_guard.as_ref() {
        Some(db) => {
            let result = db.get_recent_uploads(100).map_err(|e| {
                println!("[Backend] Failed to get upload history: {}", e);
                e.to_string()
            });
            if let Ok(ref records) = result {
                println!("[Backend] Retrieved {} upload records", records.len());
            }
            result
        }
        None => {
            println!("[Backend] No database available");
            Ok(vec![])
        }
    }
}

#[tauri::command]
fn get_clipboard_image() -> Result<Option<Vec<u8>>, String> {
    println!("[Backend] Getting clipboard image...");

    use arboard::Clipboard;

    // Try to get clipboard context
    let mut clipboard = match Clipboard::new() {
        Ok(clipboard) => clipboard,
        Err(e) => {
            println!("[Backend] Failed to create clipboard context: {}", e);
            return Err(format!("Failed to access clipboard: {}", e));
        }
    };

    // First, try to get image directly from clipboard
    match clipboard.get_image() {
        Ok(image_data) => {
            println!(
                "[Backend] Found image in clipboard: {}x{}",
                image_data.width, image_data.height
            );

            // Convert RGBA data to PNG format
            use image::{ImageBuffer, ImageFormat, RgbaImage};
            use std::io::Cursor;

            let img: RgbaImage = match ImageBuffer::from_raw(
                image_data.width as u32,
                image_data.height as u32,
                image_data.bytes.into_owned(),
            ) {
                Some(img) => img,
                None => {
                    println!("[Backend] Failed to create image buffer from clipboard data");
                    return Err("Failed to process clipboard image data".to_string());
                }
            };

            // Encode as PNG
            let mut png_data = Vec::new();
            let mut cursor = Cursor::new(&mut png_data);

            match img.write_to(&mut cursor, ImageFormat::Png) {
                Ok(_) => {
                    println!(
                        "[Backend] Successfully converted clipboard image to PNG: {} bytes",
                        png_data.len()
                    );
                    return Ok(Some(png_data));
                }
                Err(e) => {
                    println!("[Backend] Failed to encode image as PNG: {}", e);
                    return Err(format!("Failed to encode image: {}", e));
                }
            }
        }
        Err(e) => {
            println!(
                "[Backend] No image in clipboard or failed to get image: {}",
                e
            );
        }
    }

    // Fallback: try to get text and see if it's a file path or base64 data
    match clipboard.get_text() {
        Ok(contents) => {
            println!(
                "[Backend] Clipboard text contents length: {}",
                contents.len()
            );

            // Check if it looks like a base64 encoded image
            if contents.starts_with("data:image/") {
                println!("[Backend] Found data URL in clipboard");

                // Extract base64 part after the comma
                if let Some(comma_pos) = contents.find(',') {
                    let base64_data = &contents[comma_pos + 1..];
                    use base64::{engine::general_purpose, Engine as _};
                    match general_purpose::STANDARD.decode(base64_data) {
                        Ok(image_data) => {
                            println!(
                                "[Backend] Successfully decoded base64 image: {} bytes",
                                image_data.len()
                            );
                            return Ok(Some(image_data));
                        }
                        Err(e) => {
                            println!("[Backend] Failed to decode base64: {}", e);
                        }
                    }
                }
            }

            // Check if it's a file path to an image
            if contents.len() < 1000
                && (contents.ends_with(".png")
                    || contents.ends_with(".jpg")
                    || contents.ends_with(".jpeg")
                    || contents.ends_with(".gif")
                    || contents.ends_with(".webp"))
            {
                println!("[Backend] Found image file path in clipboard: {}", contents);

                use std::path::Path;
                let path = Path::new(&contents);
                if path.exists() && path.is_file() {
                    match std::fs::read(path) {
                        Ok(data) => {
                            println!(
                                "[Backend] Successfully read image file: {} bytes",
                                data.len()
                            );
                            return Ok(Some(data));
                        }
                        Err(e) => {
                            println!("[Backend] Failed to read image file: {}", e);
                        }
                    }
                }
            }

            println!("[Backend] No image data found in clipboard text");
            Ok(None)
        }
        Err(e) => {
            println!("[Backend] Failed to get clipboard text: {}", e);
            Ok(None)
        }
    }
}

#[tauri::command]
async fn read_file_from_path(file_path: String) -> Result<Option<Vec<u8>>, String> {
    println!("[Backend] Reading file from path: {}", file_path);

    use std::path::Path;

    let path = Path::new(&file_path);

    // Check if file exists
    if !path.exists() {
        println!("[Backend] File does not exist: {}", file_path);
        return Ok(None);
    }

    // Check if it's a file (not a directory)
    if !path.is_file() {
        println!("[Backend] Path is not a file: {}", file_path);
        return Ok(None);
    }

    // Read the file
    match std::fs::read(path) {
        Ok(data) => {
            println!("[Backend] File read successfully: {} bytes", data.len());
            Ok(Some(data))
        }
        Err(e) => {
            println!("[Backend] Failed to read file: {}", e);
            Err(format!("Failed to read file: {}", e))
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");

            let config_manager = ConfigManager::new(app_dir.clone());
            let mut settings = config_manager.load_settings().unwrap_or_default();
            let db_path = app_dir.join("uploads.db");
            let db = Database::new(db_path).expect("failed to initialize database");

            // Try to load existing config and initialize uploader (with auto-migration)
            let uploader = if let Ok(Some(config)) = config_manager.load_config() {
                println!(
                    "[Backend] Found storage config for provider: {}",
                    config.provider
                );
                tauri::async_runtime::block_on(async { StorageManager::new(config).await.ok() })
            } else {
                None
            };

            let db = Arc::new(Mutex::new(Some(db)));
            let uploader = Arc::new(Mutex::new(uploader));
            let mut proxy = ProxyServer::new(settings.api_proxy_port);
            if settings.api_proxy_enabled {
                if let Err(err) =
                    tauri::async_runtime::block_on(proxy.start(uploader.clone(), db.clone()))
                {
                    println!("[Backend] Failed to start API proxy: {}", err);
                    settings.api_proxy_enabled = false;
                    let _ = config_manager.save_settings(&settings);
                }
            }

            let state = AppState {
                db,
                config_manager: Mutex::new(config_manager),
                uploader,
                proxy: Mutex::new(proxy),
                settings: Mutex::new(settings),
            };

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_r2_config,
            get_r2_config,
            save_storage_config,
            get_storage_config,
            get_storage_config_list,
            delete_storage_config,
            set_active_storage_config,
            upload_image,
            get_upload_history,
            get_api_proxy_status,
            set_api_proxy_enabled,
            get_clipboard_image,
            read_file_from_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
