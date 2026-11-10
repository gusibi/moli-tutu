// Package service is the single seam between the native view and the app's
// behavior. The view never touches disk, network, dialogs or the clipboard
// directly; tests replace this interface with an in-memory fake.
package service

import (
	"context"

	"github.com/gusibi/moli-tutu/internal/model"
	"github.com/gusibi/moli-tutu/internal/store"
)

// Service is everything the view can ask the app to do.
type Service interface {
	Configs() (model.StorageConfigList, error)
	SaveConfig(model.StorageConfig) error
	DeleteConfig(id string) (model.StorageConfigList, error)
	SetActiveConfig(id string) (model.StorageConfigList, error)

	Upload(ctx context.Context, data []byte, filename string, progress func(sent, total int64)) (model.UploadResult, error)
	UploadURL(ctx context.Context, rawURL string) (model.UploadResult, error)
	Download(ctx context.Context, rawURL string) ([]byte, error)
	Thumbnail(ctx context.Context, rawURL string) ([]byte, error)
	ReadFile(path string) ([]byte, error)
	History() ([]model.UploadRecord, error)
	DeleteRecord(id string) error
	ClearHistory() error

	Compress(data []byte, cfg model.CompressConfig) (model.CompressResult, error)
	CompressHistory() ([]model.CompressRecord, error)
	SaveCompressRecord(original, compressed []byte, name string, cfg model.CompressConfig, ratio float64, source string) (model.CompressRecord, error)
	ReadCompress(rec model.CompressRecord) ([]byte, []byte, error)
	DeleteCompressRecord(id string) error
	ClearCompressHistory() error

	ProxyStatus() model.APIProxyStatus
	SetProxy(enabled bool, port uint16) (model.APIProxyStatus, error)

	Settings() model.AppSettings
	SaveSettings(model.AppSettings) error
	Migration() store.MigrationResult

	PickImages() ([]string, error)
	SaveFile(defaultName string, data []byte) (string, error)
	ReadClipboardImage() ([]byte, error)
	CopyText(string)
	OpenURL(string)
}
