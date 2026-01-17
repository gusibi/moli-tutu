use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};

use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use tokio::sync::oneshot;

use crate::database::Database;
use crate::r2_uploader::R2Uploader;
use crate::types::{UploadRecord, UploadResult};
use uuid::Uuid;

#[derive(Clone)]
struct ProxyState {
    uploader: Arc<Mutex<Option<R2Uploader>>>,
    db: Arc<Mutex<Option<Database>>>,
}

pub struct ProxyServer {
    port: u16,
    shutdown_tx: Option<oneshot::Sender<()>>,
    handle: Option<tauri::async_runtime::JoinHandle<()>>,
}

impl ProxyServer {
    pub fn new(port: u16) -> Self {
        Self {
            port,
            shutdown_tx: None,
            handle: None,
        }
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn is_running(&self) -> bool {
        self.handle.is_some()
    }

    pub fn set_port(&mut self, port: u16) {
        self.port = port;
    }

    pub async fn start(
        &mut self,
        uploader: Arc<Mutex<Option<R2Uploader>>>,
        db: Arc<Mutex<Option<Database>>>,
    ) -> Result<(), String> {
        if self.is_running() {
            return Ok(());
        }

        let has_uploader = uploader.lock().unwrap().is_some();
        if !has_uploader {
            return Err("R2 configuration not set".to_string());
        }

        let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), self.port);
        let listener = tokio::net::TcpListener::bind(addr)
            .await
            .map_err(|e| format!("Failed to bind API proxy on {}: {}", addr, e))?;

        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let state = ProxyState { uploader, db };
        let app = Router::new().route("/upload", post(upload_handler)).with_state(state);

        let server = axum::serve(listener, app).with_graceful_shutdown(async {
            let _ = shutdown_rx.await;
        });

        let handle = tauri::async_runtime::spawn(async move {
            if let Err(err) = server.await {
                eprintln!("[ProxyServer] Server error: {}", err);
            }
        });

        self.shutdown_tx = Some(shutdown_tx);
        self.handle = Some(handle);
        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }

        if let Some(handle) = self.handle.take() {
            tauri::async_runtime::spawn(async move {
                let _ = handle.await;
            });
        }

        Ok(())
    }
}

async fn upload_handler(
    State(state): State<ProxyState>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut filename: Option<String> = None;
    let mut content_type: Option<String> = None;
    let mut file_data: Option<Vec<u8>> = None;

    loop {
        let field = match multipart.next_field().await {
            Ok(Some(field)) => field,
            Ok(None) => break,
            Err(err) => {
                let result = UploadResult {
                    success: false,
                    url: None,
                    error: Some(format!("Invalid multipart data: {}", err)),
                    from_cache: false,
                };
                return (StatusCode::BAD_REQUEST, Json(result));
            }
        };

        if field.file_name().is_some() {
            filename = field.file_name().map(|name| name.to_string());
            content_type = field.content_type().map(|value| value.to_string());
            match field.bytes().await {
                Ok(bytes) => {
                    file_data = Some(bytes.to_vec());
                }
                Err(err) => {
                    let result = UploadResult {
                        success: false,
                        url: None,
                        error: Some(format!("Failed to read upload data: {}", err)),
                        from_cache: false,
                    };
                    return (StatusCode::BAD_REQUEST, Json(result));
                }
            }
            break;
        }
    }

    let file_data = match file_data {
        Some(data) => data,
        None => {
            let result = UploadResult {
                success: false,
                url: None,
                error: Some("No file found in multipart payload".to_string()),
                from_cache: false,
            };
            return (StatusCode::BAD_REQUEST, Json(result));
        }
    };

    let filename = filename.unwrap_or_else(|| "upload.bin".to_string());
    let content_type = content_type.unwrap_or_else(|| "application/octet-stream".to_string());

    let uploader = {
        let guard = state.uploader.lock().unwrap();
        match guard.as_ref() {
            Some(uploader) => uploader.clone(),
            None => {
                let result = UploadResult {
                    success: false,
                    url: None,
                    error: Some("R2 configuration not set".to_string()),
                    from_cache: false,
                };
                return (StatusCode::SERVICE_UNAVAILABLE, Json(result));
            }
        }
    };

    let file_hash = R2Uploader::calculate_hash(&file_data);
    {
        let db_guard = state.db.lock().unwrap();
        if let Some(ref db) = *db_guard {
            if let Ok(Some(existing_record)) = db.find_by_hash(&file_hash) {
                let result = UploadResult {
                    success: true,
                    url: Some(existing_record.url),
                    error: None,
                    from_cache: true,
                };
                return (StatusCode::OK, Json(result));
            }
        }
    }

    match uploader.upload_file(file_data.clone(), &filename, &content_type).await {
        Ok(url) => {
            let record = UploadRecord {
                id: Uuid::new_v4().to_string(),
                original_filename: filename,
                file_hash,
                file_size: file_data.len() as u64,
                url: url.clone(),
                upload_time: Database::get_current_timestamp(),
            };

            let db_guard = state.db.lock().unwrap();
            if let Some(ref db) = *db_guard {
                if let Err(err) = db.insert_upload_record(&record) {
                    eprintln!("[ProxyServer] Failed to save upload record: {}", err);
                }
            }

            let result = UploadResult {
                success: true,
                url: Some(url),
                error: None,
                from_cache: false,
            };
            (StatusCode::OK, Json(result))
        }
        Err(err) => {
            let result = UploadResult {
                success: false,
                url: None,
                error: Some(err.to_string()),
                from_cache: false,
            };
            (StatusCode::INTERNAL_SERVER_ERROR, Json(result))
        }
    }
}
