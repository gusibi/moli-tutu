use std::sync::Mutex;
use tauri::{Manager, State};
use uuid::Uuid;
use base64;

mod types;
mod r2_uploader;
mod database;
mod config;

use types::{R2Config, UploadRecord, UploadResult};
use r2_uploader::R2Uploader;
use database::Database;
use config::ConfigManager;

struct AppState {
    db: Mutex<Option<Database>>,
    config_manager: Mutex<ConfigManager>,
    uploader: Mutex<Option<R2Uploader>>,
}

#[tauri::command]
async fn save_r2_config(
    config: R2Config,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!("[Backend] Saving R2 config: endpoint={}, bucket={}", config.endpoint, config.bucket_name);
    
    // Save config
    {
        let config_manager = state.config_manager.lock().unwrap();
        config_manager.save_config(&config).map_err(|e| {
            println!("[Backend] Failed to save config: {}", e);
            e.to_string()
        })?;
    }
    
    // Initialize uploader
    println!("[Backend] Initializing R2 uploader...");
    let uploader = R2Uploader::new(config).await.map_err(|e| {
        println!("[Backend] Failed to initialize uploader: {}", e);
        e.to_string()
    })?;
    {
        let mut uploader_guard = state.uploader.lock().unwrap();
        *uploader_guard = Some(uploader);
    }
    
    println!("[Backend] R2 config saved and uploader initialized successfully");
    Ok(())
}

#[tauri::command]
async fn get_r2_config(
    state: State<'_, AppState>,
) -> Result<Option<R2Config>, String> {
    println!("[Backend] Getting R2 config...");
    let config_manager = state.config_manager.lock().unwrap();
    let result = config_manager.load_config().map_err(|e| {
        println!("[Backend] Failed to load config: {}", e);
        e.to_string()
    });
    
    match &result {
        Ok(Some(_)) => println!("[Backend] R2 config found"),
        Ok(None) => println!("[Backend] No R2 config found"),
        Err(e) => println!("[Backend] Error loading config: {}", e),
    }
    
    result
}

#[tauri::command]
async fn upload_image(
    file_data: Vec<u8>,
    filename: String,
    state: State<'_, AppState>,
) -> Result<UploadResult, String> {
    println!("[Backend] Upload request: filename={}, size={} bytes", filename, file_data.len());
    
    // Check if uploader is initialized and get a copy
    let uploader = {
        let uploader_guard = state.uploader.lock().unwrap();
        match uploader_guard.as_ref() {
            Some(uploader) => {
                println!("[Backend] Uploader found, proceeding with upload");
                uploader.clone()
            },
            None => {
                println!("[Backend] No uploader configured, returning error");
                return Ok(UploadResult {
                    success: false,
                    url: None,
                    error: Some("R2 configuration not set".to_string()),
                    from_cache: false,
                });
            }
        }
    };
    
    // Calculate file hash
    println!("[Backend] Calculating file hash...");
    let file_hash = R2Uploader::calculate_hash(&file_data);
    println!("[Backend] File hash calculated: {}", file_hash);
    
    // Check if file already exists in database
    {
        println!("[Backend] Checking database for existing file...");
        let db_guard = state.db.lock().unwrap();
        if let Some(ref db) = *db_guard {
            if let Ok(Some(existing_record)) = db.find_by_hash(&file_hash) {
                println!("[Backend] Found existing file in cache, returning cached URL: {}", existing_record.url);
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
    
    // Upload to R2
    println!("[Backend] Starting R2 upload...");
    let url = match uploader.upload_file(file_data.clone(), &filename, &content_type).await {
        Ok(url) => {
            println!("[Backend] R2 upload successful: {}", url);
            url
        },
        Err(e) => {
            println!("[Backend] R2 upload failed: {}", e);
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
async fn get_upload_history(
    state: State<'_, AppState>,
) -> Result<Vec<UploadRecord>, String> {
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
        },
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
            println!("[Backend] Found image in clipboard: {}x{}", image_data.width, image_data.height);
            
            // Convert RGBA data to PNG format
            use image::{ImageBuffer, RgbaImage, ImageFormat};
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
                    println!("[Backend] Successfully converted clipboard image to PNG: {} bytes", png_data.len());
                    return Ok(Some(png_data));
                },
                Err(e) => {
                    println!("[Backend] Failed to encode image as PNG: {}", e);
                    return Err(format!("Failed to encode image: {}", e));
                }
            }
        },
        Err(e) => {
            println!("[Backend] No image in clipboard or failed to get image: {}", e);
        }
    }
    
    // Fallback: try to get text and see if it's a file path or base64 data
    match clipboard.get_text() {
        Ok(contents) => {
            println!("[Backend] Clipboard text contents length: {}", contents.len());
            
            // Check if it looks like a base64 encoded image
            if contents.starts_with("data:image/") {
                println!("[Backend] Found data URL in clipboard");
                
                // Extract base64 part after the comma
                if let Some(comma_pos) = contents.find(',') {
                    let base64_data = &contents[comma_pos + 1..];
                    use base64::{Engine as _, engine::general_purpose};
                    match general_purpose::STANDARD.decode(base64_data) {
                        Ok(image_data) => {
                            println!("[Backend] Successfully decoded base64 image: {} bytes", image_data.len());
                            return Ok(Some(image_data));
                        },
                        Err(e) => {
                            println!("[Backend] Failed to decode base64: {}", e);
                        }
                    }
                }
            }
            
            // Check if it's a file path to an image
            if contents.len() < 1000 && (contents.ends_with(".png") || contents.ends_with(".jpg") || contents.ends_with(".jpeg") || contents.ends_with(".gif") || contents.ends_with(".webp")) {
                println!("[Backend] Found image file path in clipboard: {}", contents);
                
                use std::path::Path;
                let path = Path::new(&contents);
                if path.exists() && path.is_file() {
                    match std::fs::read(path) {
                        Ok(data) => {
                            println!("[Backend] Successfully read image file: {} bytes", data.len());
                            return Ok(Some(data));
                        },
                        Err(e) => {
                            println!("[Backend] Failed to read image file: {}", e);
                        }
                    }
                }
            }
            
            println!("[Backend] No image data found in clipboard text");
            Ok(None)
        },
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
        },
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
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("failed to create app data dir");
            
            let config_manager = ConfigManager::new(app_dir.clone());
            let db_path = app_dir.join("uploads.db");
            let db = Database::new(db_path).expect("failed to initialize database");
            
            // Try to load existing config and initialize uploader
            let uploader = if let Ok(Some(config)) = config_manager.load_config() {
                tauri::async_runtime::block_on(async {
                    R2Uploader::new(config).await.ok()
                })
            } else {
                None
            };
            
            let state = AppState {
                db: Mutex::new(Some(db)),
                config_manager: Mutex::new(config_manager),
                uploader: Mutex::new(uploader),
            };
            
            app.manage(state);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_r2_config,
            get_r2_config,
            upload_image,
            get_upload_history,
            get_clipboard_image,
            read_file_from_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
