package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gusibi/moli-tutu/internal/model"
)

const maxCompressRecords = 10

// CompressStore keeps the last ten compression results as files plus a JSON
// index. It replaces the old IndexedDB-backed history.
type CompressStore struct {
	dir string
}

// NewCompressStore returns a store under the user-data directory.
func NewCompressStore(dir string) *CompressStore {
	return &CompressStore{dir: filepath.Join(dir, "compress-history")}
}

func (s *CompressStore) indexPath() string { return filepath.Join(s.dir, "index.json") }

// Load reads the index, newest first.
func (s *CompressStore) Load() ([]model.CompressRecord, error) {
	b, err := os.ReadFile(s.indexPath())
	if errors.Is(err, os.ErrNotExist) {
		return []model.CompressRecord{}, nil
	}
	if err != nil {
		return nil, err
	}
	var records []model.CompressRecord
	if err := json.Unmarshal(b, &records); err != nil {
		return []model.CompressRecord{}, nil
	}
	if records == nil {
		records = []model.CompressRecord{}
	}
	return records, nil
}

// Save writes the original and compressed bytes and inserts a record. The
// history keeps at most ten entries.
func (s *CompressStore) Save(original, compressed []byte, originalName string, cfg model.CompressConfig, ratio float64, source string) (model.CompressRecord, error) {
	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return model.CompressRecord{}, err
	}
	records, _ := s.Load()
	id := model.NewID()
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == "" {
		ext = ".img"
	}
	originalPath := filepath.Join(s.dir, "original_"+id+ext)
	compressedExt := ".jpg"
	switch cfg.Format {
	case "oxipng":
		compressedExt = ".png"
	case "webp", "avif":
		compressedExt = ".webp"
	}
	compressedPath := filepath.Join(s.dir, "compressed_"+id+compressedExt)
	if err := os.WriteFile(originalPath, original, 0o600); err != nil {
		return model.CompressRecord{}, err
	}
	if err := os.WriteFile(compressedPath, compressed, 0o600); err != nil {
		os.Remove(originalPath)
		return model.CompressRecord{}, err
	}
	rec := model.CompressRecord{
		ID:               id,
		OriginalName:     originalName,
		OriginalSize:     int64(len(original)),
		CompressedSize:   int64(len(compressed)),
		CompressionRatio: ratio,
		CompressTime:     time.Now().Unix(),
		Config:           cfg,
		OriginalPath:     originalPath,
		CompressedPath:   compressedPath,
		SourceType:       source,
	}
	records = append([]model.CompressRecord{rec}, records...)
	for len(records) > maxCompressRecords {
		last := records[len(records)-1]
		_ = os.Remove(last.OriginalPath)
		_ = os.Remove(last.CompressedPath)
		records = records[:len(records)-1]
	}
	return rec, s.saveIndex(records)
}

// Read returns one record's bytes.
func (s *CompressStore) Read(rec model.CompressRecord) ([]byte, []byte, error) {
	original, err := os.ReadFile(rec.OriginalPath)
	if err != nil {
		return nil, nil, err
	}
	compressed, err := os.ReadFile(rec.CompressedPath)
	if err != nil {
		return nil, nil, err
	}
	return original, compressed, nil
}

// Delete removes a record and its files.
func (s *CompressStore) Delete(id string) error {
	records, _ := s.Load()
	out := records[:0]
	for _, rec := range records {
		if rec.ID == id {
			_ = os.Remove(rec.OriginalPath)
			_ = os.Remove(rec.CompressedPath)
			continue
		}
		out = append(out, rec)
	}
	return s.saveIndex(out)
}

// Clear removes every record and its files.
func (s *CompressStore) Clear() error {
	records, _ := s.Load()
	for _, rec := range records {
		_ = os.Remove(rec.OriginalPath)
		_ = os.Remove(rec.CompressedPath)
	}
	return s.saveIndex([]model.CompressRecord{})
}

func (s *CompressStore) saveIndex(records []model.CompressRecord) error {
	b, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return err
	}
	return writeFileAtomic(s.indexPath(), b, 0o600)
}
