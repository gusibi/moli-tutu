package app

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/internal/model"
	"github.com/gusibi/moli-tutu/internal/store"
)

type fakeService struct {
	configs      model.StorageConfigList
	history      []model.UploadRecord
	compress     []model.CompressRecord
	settings     model.AppSettings
	proxy        model.APIProxyStatus
	copied       []string
	opened       []string
	uploaded     []string
	compressData model.CompressResult
	pickCalls    chan struct{}
	clipCalls    chan struct{}
}

func newFake() *fakeService {
	return &fakeService{
		settings: model.AppSettings{APIProxyPort: 38123, Theme: "system", Language: "en"},
		proxy:    model.APIProxyStatus{Port: 38123},
		compressData: model.CompressResult{
			Data: []byte("compressed"), OriginalSize: 100, CompressedSize: 50,
			CompressionRatio: 50, Format: "jpeg", Width: 10, Height: 10,
		},
		pickCalls: make(chan struct{}, 1),
		clipCalls: make(chan struct{}, 1),
	}
}

func (f *fakeService) Configs() (model.StorageConfigList, error) { return f.configs, nil }
func (f *fakeService) SaveConfig(c model.StorageConfig) error {
	found := false
	for i := range f.configs.Configs {
		if f.configs.Configs[i].ID == c.ID {
			f.configs.Configs[i] = c
			found = true
		}
	}
	if !found {
		f.configs.Configs = append(f.configs.Configs, c)
	}
	f.configs.ActiveID = c.ID
	return nil
}
func (f *fakeService) DeleteConfig(id string) (model.StorageConfigList, error) {
	return f.configs, nil
}
func (f *fakeService) SetActiveConfig(id string) (model.StorageConfigList, error) {
	f.configs.ActiveID = id
	return f.configs, nil
}
func (f *fakeService) Upload(_ context.Context, data []byte, filename string, progress func(sent, total int64)) (model.UploadResult, error) {
	f.uploaded = append(f.uploaded, filename)
	if progress != nil {
		progress(int64(len(data)), int64(len(data)))
	}
	return model.UploadResult{Success: true, URL: "https://cdn/" + filename}, nil
}
func (f *fakeService) ReadFile(path string) ([]byte, error) {
	return []byte("file"), nil
}
func (f *fakeService) Thumbnail(context.Context, string) ([]byte, error) {
	return nil, errors.New("no thumbnail")
}
func (f *fakeService) UploadURL(_ context.Context, raw string) (model.UploadResult, error) {
	return model.UploadResult{Success: true, URL: raw}, nil
}
func (f *fakeService) Download(context.Context, string) ([]byte, error) {
	return []byte("image"), nil
}
func (f *fakeService) History() ([]model.UploadRecord, error) { return f.history, nil }
func (f *fakeService) DeleteRecord(id string) error {
	out := f.history[:0]
	for _, r := range f.history {
		if r.ID != id {
			out = append(out, r)
		}
	}
	f.history = out
	return nil
}
func (f *fakeService) ClearHistory() error { f.history = nil; return nil }
func (f *fakeService) Compress([]byte, model.CompressConfig) (model.CompressResult, error) {
	return f.compressData, nil
}
func (f *fakeService) CompressHistory() ([]model.CompressRecord, error) { return f.compress, nil }
func (f *fakeService) SaveCompressRecord(original, compressed []byte, name string, cfg model.CompressConfig, ratio float64, source string) (model.CompressRecord, error) {
	return model.CompressRecord{ID: "c1", OriginalName: name}, nil
}
func (f *fakeService) ReadCompress(model.CompressRecord) ([]byte, []byte, error) {
	return []byte("original"), []byte("compressed"), nil
}
func (f *fakeService) DeleteCompressRecord(string) error { return nil }
func (f *fakeService) ClearCompressHistory() error       { f.compress = nil; return nil }
func (f *fakeService) ProxyStatus() model.APIProxyStatus { return f.proxy }
func (f *fakeService) SetProxy(enabled bool, port uint16) (model.APIProxyStatus, error) {
	f.proxy.Enabled = enabled
	f.proxy.Running = enabled
	if port != 0 {
		f.proxy.Port = port
	}
	return f.proxy, nil
}
func (f *fakeService) Settings() model.AppSettings { return f.settings }
func (f *fakeService) SaveSettings(s model.AppSettings) error {
	f.settings = s
	return nil
}
func (f *fakeService) Migration() store.MigrationResult { return store.MigrationResult{} }
func (f *fakeService) PickImages() ([]string, error) {
	select {
	case f.pickCalls <- struct{}{}:
	default:
	}
	return nil, errors.New("not in tests")
}
func (f *fakeService) SaveFile(string, []byte) (string, error) {
	return "saved", nil
}
func (f *fakeService) ReadClipboardImage() ([]byte, error) {
	select {
	case f.clipCalls <- struct{}{}:
	default:
	}
	return nil, errors.New("no image")
}
func (f *fakeService) CopyText(s string) { f.copied = append(f.copied, s) }
func (f *fakeService) OpenURL(s string)  { f.opened = append(f.opened, s) }

func TestUploadPageRenders(t *testing.T) {
	f := newFake()
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 700)
	if !tt.HasText("Image upload") || !tt.HasText("Drop images here") {
		t.Fatalf("texts = %q", tt.Texts())
	}
	if err := tt.Click("View all"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("Upload history") {
		t.Fatalf("after View all: %q", tt.Texts())
	}
}

func TestHistoryCopyAndPreview(t *testing.T) {
	f := newFake()
	f.history = []model.UploadRecord{{
		ID: "1", OriginalFilename: "photo.png", FileHash: "h", FileSize: 1024,
		URL: "https://cdn/photo.png", UploadTime: 1700000000,
	}}
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 700)
	if err := tt.Click("History"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("photo.png") {
		t.Fatalf("texts = %q", tt.Texts())
	}
	if err := tt.Click("Copy"); err != nil {
		t.Fatal(err)
	}
	if len(f.copied) != 1 || f.copied[0] != "https://cdn/photo.png" {
		t.Fatalf("copied = %v", f.copied)
	}
}

func TestSettingsAddConfigOpensModal(t *testing.T) {
	f := newFake()
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 900)
	if err := tt.Click("Settings"); err != nil {
		t.Fatal(err)
	}
	if err := tt.Click("Add config"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("Add configuration") {
		t.Fatalf("texts = %q", tt.Texts())
	}
}

func TestCompressEmptyState(t *testing.T) {
	f := newFake()
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 700)
	if err := tt.Click("Compress"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("Drop an image to compress") {
		t.Fatalf("texts = %q", tt.Texts())
	}
}

func TestLanguageToggleWithoutAppReady(t *testing.T) {
	f := newFake()
	f.settings.Language = "zh"
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 700)
	if !tt.HasText("图片上传") {
		t.Fatalf("texts = %q", tt.Texts())
	}
	if err := tt.Click("中文"); err != nil {
		t.Fatal(err)
	}
	if !tt.HasText("Image upload") {
		t.Fatalf("after toggle: %q", tt.Texts())
	}
}

func TestChooseAndPasteButtonsReact(t *testing.T) {
	f := newFake()
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 700)
	if err := tt.Click("Choose images"); err != nil {
		t.Fatal(err)
	}
	select {
	case <-f.pickCalls:
	case <-time.After(2 * time.Second):
		t.Fatal("choose button did not call PickImages")
	}
	if err := tt.Click("Paste from clipboard"); err != nil {
		t.Fatal(err)
	}
	select {
	case <-f.clipCalls:
	case <-time.After(2 * time.Second):
		t.Fatal("paste button did not call ReadClipboardImage")
	}
}

func TestChooseAndPasteShortcuts(t *testing.T) {
	f := newFake()
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 700)
	tt.Key(ui.Cmd, ui.KeyO)
	select {
	case <-f.pickCalls:
	case <-time.After(2 * time.Second):
		t.Fatal("Cmd+O did not call PickImages")
	}
	tt.Key(ui.Cmd|ui.Shift, ui.KeyV)
	select {
	case <-f.clipCalls:
	case <-time.After(2 * time.Second):
		t.Fatal("Cmd+Shift+V did not call ReadClipboardImage")
	}
}

func TestRefreshPicksUpNewHistory(t *testing.T) {
	f := newFake()
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 700)
	f.history = []model.UploadRecord{{
		ID: "new", OriginalFilename: "new.png", FileHash: "h", FileSize: 10,
		URL: "https://cdn/new.png", UploadTime: 1794233726,
	}}
	a.Refresh()
	tt.Frame()
	if !tt.HasText("new.png") {
		t.Fatalf("refresh did not update the table: %q", tt.Texts())
	}
}

func TestRefreshShortcut(t *testing.T) {
	f := newFake()
	a := New(f)
	tt := ui.NewTester(a.View, 1000, 700)
	f.history = []model.UploadRecord{{
		ID: "shortcut", OriginalFilename: "shortcut.png", FileHash: "h", FileSize: 10,
		URL: "https://cdn/shortcut.png", UploadTime: 1794233726,
	}}
	tt.Key(ui.Cmd, ui.KeyR)
	tt.Frame()
	if !tt.HasText("shortcut.png") {
		t.Fatalf("Cmd+R did not refresh: %q", tt.Texts())
	}
}
