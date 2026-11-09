package service

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
)

func TestRealUploadCacheHistory(t *testing.T) {
	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		_, _ = io.Copy(io.Discard, r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	dir := t.TempDir()
	r, err := NewWithOptions(dir, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	cfg := model.StorageConfig{
		ID: "r2", Name: "test", Kind: model.CloudflareR2,
		AccessKeyID: "key", SecretAccessKey: "secret",
		Endpoint: srv.URL, BucketName: "bucket",
		PublicURLBase: "https://cdn.example.com", Region: "auto",
	}
	if err := r.SaveConfig(cfg); err != nil {
		t.Fatal(err)
	}
	data := []byte("same image bytes")
	first, err := r.Upload(context.Background(), data, "a.png", nil)
	if err != nil || !first.Success || first.FromCache {
		t.Fatalf("first = %+v, %v", first, err)
	}
	second, err := r.Upload(context.Background(), data, "a.png", nil)
	if err != nil || !second.Success || !second.FromCache {
		t.Fatalf("second = %+v, %v", second, err)
	}
	if requests.Load() != 1 {
		t.Fatalf("requests = %d, want 1", requests.Load())
	}
	history, err := r.History()
	if err != nil || len(history) != 1 {
		t.Fatalf("history = %+v, %v", history, err)
	}
	if history[0].URL != first.URL || history[0].OriginalFilename != "a.png" {
		t.Fatalf("record = %+v", history[0])
	}
	// A cache hit moves the record to the top instead of adding a row.
	if err := r.store.TouchRecord(history[0].ID, 100); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Upload(context.Background(), data, "a.png", nil); err != nil {
		t.Fatal(err)
	}
	history, err = r.History()
	if err != nil || len(history) != 1 {
		t.Fatalf("after cache hit = %+v, %v", history, err)
	}
	if history[0].UploadTime <= 100 {
		t.Fatalf("cache hit did not move record: %+v", history[0])
	}
	if err := r.DeleteRecord(history[0].ID); err != nil {
		t.Fatal(err)
	}
	if h, _ := r.History(); len(h) != 0 {
		t.Fatalf("after delete = %d", len(h))
	}
	if err := r.ClearHistory(); err != nil {
		t.Fatal(err)
	}
}

func TestRealConfigAndCompressHistory(t *testing.T) {
	dir := t.TempDir()
	r, err := NewWithOptions(dir, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	cfg := model.NewStorageConfig(model.Imgur)
	cfg.ID = "imgur"
	cfg.Name = "imgur"
	cfg.ImgurClientID = "cid"
	if err := r.SaveConfig(cfg); err != nil {
		t.Fatal(err)
	}
	list, _ := r.Configs()
	if len(list.Configs) != 1 || list.ActiveID != "imgur" {
		t.Fatalf("list = %+v", list)
	}
	rec, err := r.SaveCompressRecord([]byte("o"), []byte("c"), "a.png", model.DefaultCompressConfig(), 50, "file")
	if err != nil {
		t.Fatal(err)
	}
	got, err := r.CompressHistory()
	if err != nil || len(got) != 1 || got[0].ID != rec.ID {
		t.Fatalf("compress history = %+v, %v", got, err)
	}
	if _, _, err := r.ReadCompress(got[0]); err != nil {
		t.Fatal(err)
	}
	if err := r.DeleteCompressRecord(rec.ID); err != nil {
		t.Fatal(err)
	}
	if got, _ := r.CompressHistory(); len(got) != 0 {
		t.Fatalf("after delete = %d", len(got))
	}
}

func TestRealProxyLifetime(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := uint16(ln.Addr().(*net.TCPAddr).Port)
	ln.Close()

	dir := t.TempDir()
	r, err := NewWithOptions(dir, Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	cfg := model.NewStorageConfig(model.Imgur)
	cfg.ID = "imgur"
	cfg.Name = "imgur"
	cfg.ImgurClientID = "cid"
	if err := r.SaveConfig(cfg); err != nil {
		t.Fatal(err)
	}
	status, err := r.SetProxy(true, port)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Enabled || !status.Running || status.Port != port {
		t.Fatalf("start = %+v", status)
	}
	status, err = r.SetProxy(false, port)
	if err != nil {
		t.Fatal(err)
	}
	if status.Enabled || status.Running {
		t.Fatalf("stop = %+v", status)
	}
}

func TestProxyRequiresStorage(t *testing.T) {
	r, err := NewWithOptions(t.TempDir(), Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	if _, err := r.SetProxy(true, 38123); err == nil {
		t.Fatal("expected an error without storage")
	}
}

func TestThumbnailCacheAndReadFile(t *testing.T) {
	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		_, _ = w.Write([]byte("thumb-bytes"))
	}))
	defer srv.Close()
	r, err := NewWithOptions(t.TempDir(), Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	first, err := r.Thumbnail(context.Background(), srv.URL+"/a.png")
	if err != nil || string(first) != "thumb-bytes" {
		t.Fatalf("first = %q, %v", first, err)
	}
	second, err := r.Thumbnail(context.Background(), srv.URL+"/a.png")
	if err != nil || string(second) != "thumb-bytes" {
		t.Fatalf("second = %q, %v", second, err)
	}
	if requests.Load() != 1 {
		t.Fatalf("requests = %d, want 1", requests.Load())
	}
	path := filepath.Join(t.TempDir(), "a.txt")
	if err := os.WriteFile(path, []byte("local"), 0o600); err != nil {
		t.Fatal(err)
	}
	if b, err := r.ReadFile(path); err != nil || string(b) != "local" {
		t.Fatalf("read = %q, %v", b, err)
	}
}
