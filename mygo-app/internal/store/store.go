// Package store persists configurations, settings, uploads and compression
// history. It has no dependency on the UI or on mygo.
package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
)

// Store owns the app's user-data directory.
type Store struct {
	dir string
	db  *sql.DB
}

// Open opens or creates the store in dir.
func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", filepath.Join(dir, "uploads.db"))
	if err != nil {
		return nil, err
	}
	s := &Store{dir: dir, db: db}
	if err := s.initDB(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

// Close closes the database.
func (s *Store) Close() error {
	if s.db == nil {
		return nil
	}
	return s.db.Close()
}

// Dir returns the user-data directory.
func (s *Store) Dir() string { return s.dir }

func (s *Store) initDB() error {
	stmts := []string{
		`PRAGMA journal_mode=WAL`,
		`PRAGMA busy_timeout=5000`,
		`CREATE TABLE IF NOT EXISTS uploads (
			id TEXT PRIMARY KEY,
			original_filename TEXT NOT NULL,
			file_hash TEXT NOT NULL UNIQUE,
			file_size INTEGER NOT NULL,
			url TEXT NOT NULL,
			upload_time INTEGER NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_file_hash ON uploads(file_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_upload_time ON uploads(upload_time)`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) configPath() string   { return filepath.Join(s.dir, "config.json") }
func (s *Store) settingsPath() string { return filepath.Join(s.dir, "settings.json") }

// LoadConfigList reads config.json, migrating the two older shapes.
func (s *Store) LoadConfigList() (model.StorageConfigList, error) {
	empty := model.StorageConfigList{Configs: []model.StorageConfig{}}
	b, err := os.ReadFile(s.configPath())
	if errors.Is(err, os.ErrNotExist) {
		return empty, nil
	}
	if err != nil {
		return empty, err
	}
	var list model.StorageConfigList
	if err := json.Unmarshal(b, &list); err == nil && list.Configs != nil {
		return normalizeList(list), nil
	}
	var single model.StorageConfig
	if err := json.Unmarshal(b, &single); err == nil && single.Kind != "" {
		if single.ID == "" {
			single.ID = model.NewID()
		}
		list = model.StorageConfigList{Configs: []model.StorageConfig{single}, ActiveID: single.ID}
		_ = s.SaveConfigList(list)
		return list, nil
	}
	var legacy struct {
		AccessKeyID     string `json:"access_key_id"`
		SecretAccessKey string `json:"secret_access_key"`
		Endpoint        string `json:"endpoint"`
		BucketName      string `json:"bucket_name"`
		PublicURLBase   string `json:"public_url_base"`
	}
	if err := json.Unmarshal(b, &legacy); err == nil && legacy.Endpoint != "" {
		cfg := model.NewStorageConfig(model.CloudflareR2)
		cfg.ID = model.NewID()
		cfg.Name = "Cloudflare R2"
		cfg.AccessKeyID = legacy.AccessKeyID
		cfg.SecretAccessKey = legacy.SecretAccessKey
		cfg.Endpoint = legacy.Endpoint
		cfg.BucketName = legacy.BucketName
		cfg.PublicURLBase = legacy.PublicURLBase
		list = model.StorageConfigList{Configs: []model.StorageConfig{cfg}, ActiveID: cfg.ID}
		_ = s.SaveConfigList(list)
		return list, nil
	}
	return empty, nil
}

func normalizeList(list model.StorageConfigList) model.StorageConfigList {
	if list.Configs == nil {
		list.Configs = []model.StorageConfig{}
	}
	for i := range list.Configs {
		if list.Configs[i].ID == "" {
			list.Configs[i].ID = model.NewID()
		}
	}
	if list.ActiveID == "" && len(list.Configs) > 0 {
		list.ActiveID = list.Configs[0].ID
	}
	return list
}

// SaveConfigList writes config.json atomically.
func (s *Store) SaveConfigList(list model.StorageConfigList) error {
	if list.Configs == nil {
		list.Configs = []model.StorageConfig{}
	}
	b, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(s.configPath(), b, 0o600)
}

// SaveConfig upserts one configuration and makes it active.
func (s *Store) SaveConfig(cfg model.StorageConfig) error {
	list, err := s.LoadConfigList()
	if err != nil {
		return err
	}
	if cfg.ID == "" {
		cfg.ID = model.NewID()
	}
	found := false
	for i := range list.Configs {
		if list.Configs[i].ID == cfg.ID {
			list.Configs[i] = cfg
			found = true
			break
		}
	}
	if !found {
		list.Configs = append(list.Configs, cfg)
	}
	list.ActiveID = cfg.ID
	return s.SaveConfigList(list)
}

// DeleteConfig removes a configuration and picks a new active one.
func (s *Store) DeleteConfig(id string) (model.StorageConfigList, error) {
	list, err := s.LoadConfigList()
	if err != nil {
		return list, err
	}
	out := list.Configs[:0]
	for _, cfg := range list.Configs {
		if cfg.ID != id {
			out = append(out, cfg)
		}
	}
	list.Configs = out
	if list.ActiveID == id {
		list.ActiveID = ""
		if len(list.Configs) > 0 {
			list.ActiveID = list.Configs[0].ID
		}
	}
	return list, s.SaveConfigList(list)
}

// SetActive marks one configuration as active.
func (s *Store) SetActive(id string) (model.StorageConfigList, error) {
	list, err := s.LoadConfigList()
	if err != nil {
		return list, err
	}
	for _, cfg := range list.Configs {
		if cfg.ID == id {
			list.ActiveID = id
			return list, s.SaveConfigList(list)
		}
	}
	return list, fmt.Errorf("config %q not found", id)
}

// ActiveConfig returns the active configuration, if any.
func (s *Store) ActiveConfig() (*model.StorageConfig, error) {
	list, err := s.LoadConfigList()
	if err != nil {
		return nil, err
	}
	for i := range list.Configs {
		if list.Configs[i].ID == list.ActiveID {
			return &list.Configs[i], nil
		}
	}
	return nil, nil
}

// LoadSettings reads settings.json, using defaults when it is missing.
func (s *Store) LoadSettings() (model.AppSettings, error) {
	settings := model.DefaultSettings()
	b, err := os.ReadFile(s.settingsPath())
	if errors.Is(err, os.ErrNotExist) {
		return settings, nil
	}
	if err != nil {
		return settings, err
	}
	if err := json.Unmarshal(b, &settings); err != nil {
		return model.DefaultSettings(), nil
	}
	if settings.APIProxyPort == 0 {
		settings.APIProxyPort = 38123
	}
	if settings.Theme == "" {
		settings.Theme = "system"
	}
	return settings, nil
}

// SaveSettings writes settings.json atomically.
func (s *Store) SaveSettings(settings model.AppSettings) error {
	b, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(s.settingsPath(), b, 0o600)
}

// Recent returns the newest uploads.
func (s *Store) Recent(limit int) ([]model.UploadRecord, error) {
	rows, err := s.db.Query(`SELECT id, original_filename, file_hash, file_size, url, upload_time
		FROM uploads ORDER BY upload_time DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.UploadRecord{}
	for rows.Next() {
		var r model.UploadRecord
		var size int64
		if err := rows.Scan(&r.ID, &r.OriginalFilename, &r.FileHash, &size, &r.URL, &r.UploadTime); err != nil {
			return nil, err
		}
		r.FileSize = uint64(size)
		out = append(out, r)
	}
	return out, rows.Err()
}

// FindByHash returns the cached record for a content hash.
func (s *Store) FindByHash(hash string) (*model.UploadRecord, error) {
	var r model.UploadRecord
	var size int64
	err := s.db.QueryRow(`SELECT id, original_filename, file_hash, file_size, url, upload_time
		FROM uploads WHERE file_hash = ?`, hash).
		Scan(&r.ID, &r.OriginalFilename, &r.FileHash, &size, &r.URL, &r.UploadTime)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.FileSize = uint64(size)
	return &r, nil
}

// InsertRecord stores an upload and trims the history to 100 rows.
func (s *Store) InsertRecord(r model.UploadRecord) error {
	if r.ID == "" {
		r.ID = model.NewID()
	}
	if r.UploadTime == 0 {
		r.UploadTime = time.Now().Unix()
	}
	_, err := s.db.Exec(`INSERT OR REPLACE INTO uploads
		(id, original_filename, file_hash, file_size, url, upload_time)
		VALUES (?, ?, ?, ?, ?, ?)`,
		r.ID, r.OriginalFilename, r.FileHash, int64(r.FileSize), r.URL, r.UploadTime)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`DELETE FROM uploads WHERE id NOT IN (
		SELECT id FROM uploads ORDER BY upload_time DESC LIMIT 100)`)
	return err
}

// TouchRecord moves a cached record to the top of the history.
func (s *Store) TouchRecord(id string, when int64) error {
	_, err := s.db.Exec(`UPDATE uploads SET upload_time = ? WHERE id = ?`, when, id)
	return err
}

// DeleteRecord removes one upload.
func (s *Store) DeleteRecord(id string) error {
	_, err := s.db.Exec(`DELETE FROM uploads WHERE id = ?`, id)
	return err
}

// ClearHistory removes every upload.
func (s *Store) ClearHistory() error {
	_, err := s.db.Exec(`DELETE FROM uploads`)
	return err
}

// NewID returns a random identifier in the same spirit as the old UUIDs.
func NewID() string { return model.NewID() }

func writeFileAtomic(path string, data []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".tmp-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(mode); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
