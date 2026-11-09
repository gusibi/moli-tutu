package service

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"

	"github.com/gusibi/moli-tutu/mygo-app/internal/imaging"
	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
	"github.com/gusibi/moli-tutu/mygo-app/internal/proxy"
	"github.com/gusibi/moli-tutu/mygo-app/internal/storage"
	"github.com/gusibi/moli-tutu/mygo-app/internal/store"
)

// Real is the production Service.
type Real struct {
	mu         sync.Mutex
	managerMu  sync.RWMutex
	store      *store.Store
	compress   *store.CompressStore
	proxy      *proxy.Server
	settings   model.AppSettings
	manager    *storage.Manager
	managerErr error
	client     *http.Client
	win        *mygo.Window
	migration  store.MigrationResult
}

// Options controls startup.
type Options struct {
	// Migrate copies the old Tauri app's data on first launch.
	Migrate bool
}

// New opens the app's data and starts what settings ask for, migrating the
// old app's data on first launch.
func New(dataDir string) (*Real, error) {
	return NewWithOptions(dataDir, Options{Migrate: true})
}

// NewWithOptions opens the app with explicit startup options.
func NewWithOptions(dataDir string, opts Options) (*Real, error) {
	var migration store.MigrationResult
	if opts.Migrate {
		var migrateErr error
		migration, migrateErr = store.Migrate(store.LegacyTauriDir(), dataDir)
		if migrateErr != nil {
			return nil, fmt.Errorf("migrate old data: %w", migrateErr)
		}
	}
	st, err := store.Open(dataDir)
	if err != nil {
		return nil, err
	}
	settings, err := st.LoadSettings()
	if err != nil {
		st.Close()
		return nil, err
	}
	r := &Real{
		store:     st,
		compress:  store.NewCompressStore(dataDir),
		proxy:     proxy.New(settings.APIProxyPort),
		settings:  settings,
		client:    &http.Client{Timeout: 2 * time.Minute},
		migration: migration,
	}
	r.proxy.SetUpload(func(ctx context.Context, data []byte, filename, contentType string) (model.UploadResult, error) {
		return r.Upload(ctx, data, filename, nil)
	})
	r.refreshManager()
	if settings.APIProxyEnabled {
		if err := r.proxy.Start(); err != nil {
			settings.APIProxyEnabled = false
			_ = st.SaveSettings(settings)
		}
		r.settings = settings
	}
	return r, nil
}

// SetWindow attaches the window used as a parent for native dialogs.
func (r *Real) SetWindow(w *mygo.Window) {
	r.mu.Lock()
	r.win = w
	r.mu.Unlock()
}

// Close releases the proxy and database.
func (r *Real) Close() {
	_ = r.proxy.Stop()
	_ = r.store.Close()
}

func (r *Real) refreshManager() {
	cfg, err := r.store.ActiveConfig()
	if err != nil {
		r.managerMu.Lock()
		r.manager, r.managerErr = nil, err
		r.managerMu.Unlock()
		return
	}
	if cfg == nil {
		r.managerMu.Lock()
		r.manager, r.managerErr = nil, nil
		r.managerMu.Unlock()
		return
	}
	m, err := storage.NewManager(*cfg, r.client)
	r.managerMu.Lock()
	r.manager, r.managerErr = m, err
	r.managerMu.Unlock()
}

func (r *Real) managerSnapshot() (*storage.Manager, error) {
	r.managerMu.RLock()
	defer r.managerMu.RUnlock()
	if r.managerErr != nil {
		return nil, r.managerErr
	}
	return r.manager, nil
}

func (r *Real) Configs() (model.StorageConfigList, error) {
	return r.store.LoadConfigList()
}

func (r *Real) SaveConfig(cfg model.StorageConfig) error {
	if err := r.store.SaveConfig(cfg); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.refreshManager()
	return r.managerErr
}

func (r *Real) DeleteConfig(id string) (model.StorageConfigList, error) {
	list, err := r.store.DeleteConfig(id)
	if err != nil {
		return list, err
	}
	r.mu.Lock()
	r.refreshManager()
	r.mu.Unlock()
	return list, nil
}

func (r *Real) SetActiveConfig(id string) (model.StorageConfigList, error) {
	list, err := r.store.SetActive(id)
	if err != nil {
		return list, err
	}
	r.mu.Lock()
	r.refreshManager()
	r.mu.Unlock()
	if r.managerErr != nil {
		return list, r.managerErr
	}
	return list, nil
}

func (r *Real) Upload(ctx context.Context, data []byte, filename string, progress func(sent, total int64)) (model.UploadResult, error) {
	if len(data) == 0 {
		return model.UploadResult{Error: "empty file"}, nil
	}
	hash := sha256Hex(data)
	if rec, err := r.store.FindByHash(hash); err == nil && rec != nil {
		// A repeated image is still a new use: move it to the top of the
		// history so the list reflects what the user just did.
		_ = r.store.TouchRecord(rec.ID, time.Now().Unix())
		return model.UploadResult{Success: true, URL: rec.URL, FromCache: true}, nil
	}
	m, err := r.managerSnapshot()
	if err != nil {
		return model.UploadResult{Error: err.Error()}, nil
	}
	if m == nil {
		return model.UploadResult{Error: "Storage configuration not set. Please configure a storage provider."}, nil
	}
	contentType := storage.ContentType(filename, data)
	url, err := m.Upload(ctx, data, filename, contentType, progress)
	if err != nil {
		return model.UploadResult{Error: err.Error()}, nil
	}
	rec := model.UploadRecord{
		ID:               store.NewID(),
		OriginalFilename: filename,
		FileHash:         hash,
		FileSize:         uint64(len(data)),
		URL:              url,
		UploadTime:       time.Now().Unix(),
	}
	_ = r.store.InsertRecord(rec)
	return model.UploadResult{Success: true, URL: url}, nil
}

func (r *Real) UploadURL(ctx context.Context, raw string) (model.UploadResult, error) {
	raw = strings.TrimSpace(raw)
	parsed, err := url.Parse(raw)
	if err != nil {
		return model.UploadResult{Error: "invalid URL"}, nil
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return model.UploadResult{Error: "only HTTP and HTTPS URLs are supported"}, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return model.UploadResult{Error: err.Error()}, nil
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return model.UploadResult{Error: "fetch URL failed: " + err.Error()}, nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return model.UploadResult{Error: fmt.Sprintf("fetch URL failed: %d %s", resp.StatusCode, resp.Status)}, nil
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 100<<20))
	if err != nil {
		return model.UploadResult{Error: "read URL failed: " + err.Error()}, nil
	}
	if len(data) == 0 {
		return model.UploadResult{Error: "URL returned an empty body"}, nil
	}
	name := path.Base(parsed.Path)
	if name == "." || name == "/" || name == "" {
		name = fmt.Sprintf("image-%d", time.Now().Unix())
	}
	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		// Some hosts omit the header; let the bytes decide.
		contentType = storage.ContentType(name, data)
	}
	if !strings.HasPrefix(contentType, "image/") {
		return model.UploadResult{Error: "URL is not an image"}, nil
	}
	if filepath.Ext(name) == "" {
		name += extensionForType(contentType)
	}
	return r.Upload(ctx, data, name, nil)
}

func (r *Real) Download(ctx context.Context, rawURL string) ([]byte, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("invalid download URL")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := r.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("download failed: %d %s", resp.StatusCode, resp.Status)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 100<<20))
}

// ReadFile reads a local file for the view.
func (r *Real) ReadFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

// Thumbnail returns image bytes for a remote URL, from a small disk cache
// when possible. Failed downloads are retried once.
func (r *Real) Thumbnail(ctx context.Context, rawURL string) ([]byte, error) {
	if rawURL == "" {
		return nil, errors.New("empty URL")
	}
	dir := filepath.Join(r.store.Dir(), "thumbnails")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	path := filepath.Join(dir, sha256Hex([]byte(rawURL))+".img")
	if st, err := os.Stat(path); err == nil && time.Since(st.ModTime()) < 7*24*time.Hour {
		if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
			return b, nil
		}
	}
	var data []byte
	var err error
	for attempt := 0; attempt < 2; attempt++ {
		data, err = r.Download(ctx, rawURL)
		if err == nil && len(data) > 0 {
			break
		}
	}
	if err != nil {
		return nil, err
	}
	if len(data) > 10<<20 {
		return nil, errors.New("thumbnail is too large")
	}
	_ = os.WriteFile(path, data, 0o644)
	r.pruneThumbnails(dir)
	return data, nil
}

func (r *Real) pruneThumbnails(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) <= 200 {
		return
	}
	type item struct {
		name string
		time time.Time
	}
	items := make([]item, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if info, err := e.Info(); err == nil {
			items = append(items, item{e.Name(), info.ModTime()})
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].time.Before(items[j].time) })
	for i := 0; i < len(items)-200; i++ {
		_ = os.Remove(filepath.Join(dir, items[i].name))
	}
}

func (r *Real) History() ([]model.UploadRecord, error) { return r.store.Recent(100) }

func (r *Real) DeleteRecord(id string) error { return r.store.DeleteRecord(id) }

func (r *Real) ClearHistory() error { return r.store.ClearHistory() }

func (r *Real) Compress(data []byte, cfg model.CompressConfig) (model.CompressResult, error) {
	return imaging.Compress(data, cfg)
}

func (r *Real) CompressHistory() ([]model.CompressRecord, error) { return r.compress.Load() }

func (r *Real) SaveCompressRecord(original, compressed []byte, name string, cfg model.CompressConfig, ratio float64, source string) (model.CompressRecord, error) {
	return r.compress.Save(original, compressed, name, cfg, ratio, source)
}

func (r *Real) ReadCompress(rec model.CompressRecord) ([]byte, []byte, error) {
	return r.compress.Read(rec)
}

func (r *Real) DeleteCompressRecord(id string) error { return r.compress.Delete(id) }

func (r *Real) ClearCompressHistory() error { return r.compress.Clear() }

func (r *Real) ProxyStatus() model.APIProxyStatus {
	r.mu.Lock()
	defer r.mu.Unlock()
	return model.APIProxyStatus{
		Enabled: r.settings.APIProxyEnabled,
		Running: r.proxy.Running(),
		Port:    r.proxy.Port(),
	}
}

func (r *Real) SetProxy(enabled bool, port uint16) (model.APIProxyStatus, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if enabled {
		if port == 0 {
			port = r.settings.APIProxyPort
		}
		if port == 0 {
			port = 38123
		}
		if port < 1 {
			return model.APIProxyStatus{Enabled: r.settings.APIProxyEnabled, Running: r.proxy.Running(), Port: r.proxy.Port()},
				errors.New("port must be between 1 and 65535")
		}
		if m, err := r.managerSnapshot(); err != nil {
			return model.APIProxyStatus{Enabled: r.settings.APIProxyEnabled, Running: r.proxy.Running(), Port: r.proxy.Port()}, err
		} else if m == nil {
			return model.APIProxyStatus{Enabled: r.settings.APIProxyEnabled, Running: r.proxy.Running(), Port: r.proxy.Port()},
				errors.New("storage configuration not set")
		}
		if r.proxy.Running() && r.proxy.Port() != port {
			return model.APIProxyStatus{Enabled: r.settings.APIProxyEnabled, Running: r.proxy.Running(), Port: r.proxy.Port()},
				errors.New("proxy is running; stop it before changing ports")
		}
		if !r.proxy.Running() {
			r.proxy = proxy.New(port)
			r.proxy.SetUpload(func(ctx context.Context, data []byte, filename, contentType string) (model.UploadResult, error) {
				return r.Upload(ctx, data, filename, nil)
			})
			if err := r.proxy.Start(); err != nil {
				return model.APIProxyStatus{Enabled: r.settings.APIProxyEnabled, Running: r.proxy.Running(), Port: r.proxy.Port()}, err
			}
		}
		r.settings.APIProxyEnabled = true
		r.settings.APIProxyPort = r.proxy.Port()
	} else {
		_ = r.proxy.Stop()
		r.settings.APIProxyEnabled = false
	}
	if err := r.store.SaveSettings(r.settings); err != nil {
		return model.APIProxyStatus{Enabled: r.settings.APIProxyEnabled, Running: r.proxy.Running(), Port: r.proxy.Port()}, err
	}
	return model.APIProxyStatus{Enabled: r.settings.APIProxyEnabled, Running: r.proxy.Running(), Port: r.proxy.Port()}, nil
}

func (r *Real) Settings() model.AppSettings {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.settings
}

func (r *Real) SaveSettings(s model.AppSettings) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if s.APIProxyPort == 0 {
		s.APIProxyPort = r.settings.APIProxyPort
	}
	r.settings = s
	return r.store.SaveSettings(s)
}

func (r *Real) Migration() store.MigrationResult { return r.migration }

// PickImages asks the system for image files.
func (r *Real) PickImages() ([]string, error) {
	r.mu.Lock()
	win := r.win
	r.mu.Unlock()
	return mygo.Dialog.Open(mygo.OpenDialogOptions{
		Parent:   win,
		Title:    "Select images",
		Filters:  []mygo.FileFilter{{Name: "Images", MIMETypes: []string{"image/*"}}},
		Multiple: true,
	})
}

// SaveFile asks the system where to save data.
func (r *Real) SaveFile(defaultName string, data []byte) (string, error) {
	r.mu.Lock()
	win := r.win
	r.mu.Unlock()
	if win != nil {
		win.Focus()
	}
	name, err := mygo.Dialog.Save(mygo.SaveDialogOptions{Parent: win, DefaultPath: defaultName})
	if err != nil || name == "" {
		return "", err
	}
	if err := os.WriteFile(name, data, 0o644); err != nil {
		return "", err
	}
	return name, nil
}

// ReadClipboardImage returns PNG bytes from the clipboard.
func (r *Real) ReadClipboardImage() ([]byte, error) {
	if b := mygo.Clipboard.ReadImage(); len(b) > 0 {
		return b, nil
	}
	if files, err := mygo.Clipboard.ReadFiles(); err == nil && len(files) > 0 {
		return os.ReadFile(files[0])
	}
	if text := strings.TrimSpace(mygo.Clipboard.ReadText()); text != "" {
		if strings.HasPrefix(text, "data:image/") {
			if i := strings.IndexByte(text, ','); i >= 0 {
				return decodeDataURL(text[i+1:])
			}
		}
		if isImageFile(text) {
			if b, err := os.ReadFile(text); err == nil && len(b) > 0 {
				return b, nil
			}
		}
	}
	return nil, errors.New("no image in clipboard")
}

func (r *Real) CopyText(s string) { mygo.Clipboard.WriteText(s) }

func (r *Real) OpenURL(s string) { _ = mygo.Shell.OpenExternal(s) }

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func isImageFile(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp":
		return true
	}
	return false
}

func extensionForType(contentType string) string {
	switch strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0])) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "image/bmp":
		return ".bmp"
	case "image/svg+xml":
		return ".svg"
	default:
		return ".jpg"
	}
}

func decodeDataURL(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}
