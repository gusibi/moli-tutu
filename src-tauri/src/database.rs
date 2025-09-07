use crate::types::UploadRecord;
use anyhow::Result;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        
        conn.execute(
            "CREATE TABLE IF NOT EXISTS uploads (
                id TEXT PRIMARY KEY,
                original_filename TEXT NOT NULL,
                file_hash TEXT NOT NULL UNIQUE,
                file_size INTEGER NOT NULL,
                url TEXT NOT NULL,
                upload_time INTEGER NOT NULL
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_file_hash ON uploads(file_hash)",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_upload_time ON uploads(upload_time)",
            [],
        )?;

        Ok(Self { conn })
    }

    pub fn insert_upload_record(&self, record: &UploadRecord) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO uploads (id, original_filename, file_hash, file_size, url, upload_time)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                record.id,
                record.original_filename,
                record.file_hash,
                record.file_size as i64,
                record.url,
                record.upload_time,
            ],
        )?;
        
        // Keep only the latest 100 records
        self.conn.execute(
            "DELETE FROM uploads 
             WHERE id NOT IN (
                 SELECT id FROM uploads 
                 ORDER BY upload_time DESC 
                 LIMIT 100
             )",
            [],
        )?;
        
        Ok(())
    }

    pub fn find_by_hash(&self, file_hash: &str) -> Result<Option<UploadRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, original_filename, file_hash, file_size, url, upload_time 
             FROM uploads WHERE file_hash = ?1",
        )?;
        
        let record = stmt.query_row(params![file_hash], |row| {
            Ok(UploadRecord {
                id: row.get(0)?,
                original_filename: row.get(1)?,
                file_hash: row.get(2)?,
                file_size: row.get::<_, i64>(3)? as u64,
                url: row.get(4)?,
                upload_time: row.get(5)?,
            })
        });
        
        match record {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    pub fn get_recent_uploads(&self, limit: usize) -> Result<Vec<UploadRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, original_filename, file_hash, file_size, url, upload_time 
             FROM uploads ORDER BY upload_time DESC LIMIT ?1",
        )?;
        
        let rows = stmt.query_map(params![limit], |row| {
            Ok(UploadRecord {
                id: row.get(0)?,
                original_filename: row.get(1)?,
                file_hash: row.get(2)?,
                file_size: row.get::<_, i64>(3)? as u64,
                url: row.get(4)?,
                upload_time: row.get(5)?,
            })
        })?;
        
        let mut records = Vec::new();
        for row in rows {
            records.push(row?);
        }
        
        Ok(records)
    }

    pub fn get_current_timestamp() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64
    }
}