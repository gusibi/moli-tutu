package store

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
)

func TestLegacyR2ConfigMigration(t *testing.T) {
	dir := t.TempDir()
	legacy := `{
		"access_key_id": "key",
		"secret_access_key": "secret",
		"endpoint": "https://example.r2.cloudflarestorage.com",
		"bucket_name": "images",
		"public_url_base": "https://cdn.example.com"
	}`
	if err := os.WriteFile(filepath.Join(dir, "config.json"), []byte(legacy), 0o600); err != nil {
		t.Fatal(err)
	}
	s, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	list, err := s.LoadConfigList()
	if err != nil {
		t.Fatal(err)
	}
	if len(list.Configs) != 1 || list.Configs[0].Kind != model.CloudflareR2 {
		t.Fatalf("configs = %+v", list)
	}
	if list.ActiveID != list.Configs[0].ID {
		t.Fatalf("active = %q, config = %q", list.ActiveID, list.Configs[0].ID)
	}
	if list.Configs[0].BucketName != "images" {
		t.Fatalf("bucket = %q", list.Configs[0].BucketName)
	}
}

func TestConfigCRUD(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	a := model.NewStorageConfig(model.AWSS3)
	a.ID = "a"
	a.Name = "A"
	a.AccessKeyID, a.SecretAccessKey = "k", "s"
	a.Endpoint, a.BucketName, a.PublicURLBase = "https://s3.example.com", "bucket", "https://cdn.example.com"
	if err := s.SaveConfig(a); err != nil {
		t.Fatal(err)
	}
	b := model.NewStorageConfig(model.Imgur)
	b.ID = "b"
	b.Name = "B"
	b.ImgurClientID = "client"
	if err := s.SaveConfig(b); err != nil {
		t.Fatal(err)
	}
	list, _ := s.LoadConfigList()
	if len(list.Configs) != 2 || list.ActiveID != "b" {
		t.Fatalf("list = %+v", list)
	}
	if _, err := s.SetActive("a"); err != nil {
		t.Fatal(err)
	}
	list, _ = s.LoadConfigList()
	if list.ActiveID != "a" {
		t.Fatalf("active = %q", list.ActiveID)
	}
	list, err = s.DeleteConfig("a")
	if err != nil {
		t.Fatal(err)
	}
	if len(list.Configs) != 1 || list.ActiveID != "b" {
		t.Fatalf("after delete = %+v", list)
	}
}

func TestHistoryCacheAndCap(t *testing.T) {
	s, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	for i := 0; i < 105; i++ {
		rec := model.UploadRecord{
			ID:               fmt.Sprintf("id-%d", i),
			OriginalFilename: fmt.Sprintf("file-%d.jpg", i),
			FileHash:         fmt.Sprintf("hash-%d", i),
			FileSize:         uint64(i + 1),
			URL:              fmt.Sprintf("https://cdn/%d.jpg", i),
			UploadTime:       int64(i + 1),
		}
		if err := s.InsertRecord(rec); err != nil {
			t.Fatal(err)
		}
	}
	recent, err := s.Recent(200)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 100 {
		t.Fatalf("len = %d, want 100", len(recent))
	}
	if recent[0].ID != "id-104" {
		t.Fatalf("newest = %q", recent[0].ID)
	}
	got, err := s.FindByHash("hash-104")
	if err != nil || got == nil || got.URL != "https://cdn/104.jpg" {
		t.Fatalf("find = %+v, %v", got, err)
	}
	if err := s.DeleteRecord("id-104"); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.FindByHash("hash-104"); got != nil {
		t.Fatal("record still there")
	}
	if err := s.ClearHistory(); err != nil {
		t.Fatal(err)
	}
	if recent, _ := s.Recent(10); len(recent) != 0 {
		t.Fatalf("after clear: %d", len(recent))
	}
}

func TestCompressStoreCapAndDelete(t *testing.T) {
	dir := t.TempDir()
	cs := NewCompressStore(dir)
	cfg := model.DefaultCompressConfig()
	for i := 0; i < 12; i++ {
		name := fmt.Sprintf("photo-%d.png", i)
		if _, err := cs.Save([]byte("original"), []byte("compressed"), name, cfg, 50, "file"); err != nil {
			t.Fatal(err)
		}
	}
	records, err := cs.Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 10 {
		t.Fatalf("records = %d, want 10", len(records))
	}
	entries, _ := os.ReadDir(filepath.Join(dir, "compress-history"))
	// index + 2 files per record
	if len(entries) != 21 {
		t.Fatalf("entries = %d, want 21", len(entries))
	}
	if err := cs.Delete(records[0].ID); err != nil {
		t.Fatal(err)
	}
	records, _ = cs.Load()
	if len(records) != 9 {
		t.Fatalf("after delete = %d", len(records))
	}
	if err := cs.Clear(); err != nil {
		t.Fatal(err)
	}
	entries, _ = os.ReadDir(filepath.Join(dir, "compress-history"))
	if len(entries) != 1 {
		t.Fatalf("after clear entries = %d, want 1 (index)", len(entries))
	}
}

func TestMigrateCopiesOnlyMissingFiles(t *testing.T) {
	oldDir := t.TempDir()
	newDir := t.TempDir()
	for _, name := range []string{"config.json", "settings.json", "uploads.db"} {
		if err := os.WriteFile(filepath.Join(oldDir, name), []byte(name), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(newDir, "config.json"), []byte("new"), 0o600); err != nil {
		t.Fatal(err)
	}
	result, err := Migrate(oldDir, newDir)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Migrated || len(result.Files) != 2 {
		t.Fatalf("result = %+v", result)
	}
	if b, _ := os.ReadFile(filepath.Join(newDir, "config.json")); string(b) != "new" {
		t.Fatalf("config was overwritten: %q", b)
	}
	result, err = Migrate(oldDir, newDir)
	if err != nil || result.Migrated {
		t.Fatalf("second migrate = %+v, %v", result, err)
	}
}
