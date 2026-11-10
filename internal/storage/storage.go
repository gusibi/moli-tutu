// Package storage uploads images to the configured provider.
package storage

import (
	"context"
	"fmt"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/gusibi/moli-tutu/internal/model"
)

// Progress reports bytes sent. total is 0 when unknown.
type Progress func(sent, total int64)

// Uploader puts one object and returns its public URL.
type Uploader interface {
	Upload(ctx context.Context, data []byte, filename, contentType string, progress Progress) (string, error)
}

// Manager dispatches to the uploader for one configuration.
type Manager struct {
	cfg      model.StorageConfig
	uploader Uploader
}

// NewManager validates cfg and builds its uploader. client may be nil.
func NewManager(cfg model.StorageConfig, client *http.Client) (*Manager, error) {
	if missing, ok := cfg.Validate(); !ok {
		return nil, fmt.Errorf("missing %s", missing)
	}
	if client == nil {
		client = &http.Client{Timeout: 2 * time.Minute}
	}
	var u Uploader
	var err error
	switch {
	case cfg.Kind.IsS3Compatible():
		u, err = newS3Uploader(cfg, client)
	case cfg.Kind == model.Imgur:
		u = &imgurUploader{client: client, clientID: cfg.ImgurClientID}
	case cfg.Kind == model.SmMs:
		u = &smmsUploader{client: client, token: cfg.SmmsAPIToken}
	case cfg.Kind == model.GitHub:
		u = &githubUploader{
			client: client, token: cfg.GitHubToken, owner: cfg.GitHubOwner,
			repo: cfg.GitHubRepo, branch: cfg.GitHubBranch, path: cfg.GitHubPath, cdn: cfg.GitHubCDNURL,
		}
	case cfg.Kind == model.Upyun:
		u = &upyunUploader{
			client: client, bucket: cfg.UpyunBucket, operator: cfg.UpyunOperator,
			password: cfg.UpyunPassword, domain: cfg.UpyunDomain,
		}
	default:
		err = fmt.Errorf("unsupported provider %q", cfg.Kind)
	}
	if err != nil {
		return nil, err
	}
	return &Manager{cfg: cfg, uploader: u}, nil
}

// Upload puts one object.
func (m *Manager) Upload(ctx context.Context, data []byte, filename, contentType string, progress Progress) (string, error) {
	if contentType == "" {
		contentType = ContentType(filename, data)
	}
	return m.uploader.Upload(ctx, data, filename, contentType, progress)
}

// ContentType guesses an image's MIME type from its name and bytes.
func ContentType(filename string, data []byte) string {
	if ext := strings.ToLower(filepath.Ext(filename)); ext != "" {
		if t := mime.TypeByExtension(ext); t != "" {
			return t
		}
	}
	return http.DetectContentType(data)
}

func randomID() string { return model.NewID() }

func extensionOf(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		return ".jpg"
	}
	return ext
}
