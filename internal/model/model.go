// Package model holds the data shared by the app, the stores and the
// upload drivers. Its JSON shapes stay compatible with the Tauri version.
package model

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// StorageProvider names a storage backend.
type StorageProvider string

const (
	CloudflareR2       StorageProvider = "cloudflare_r2"
	AWSS3              StorageProvider = "aws_s3"
	BackblazeB2        StorageProvider = "backblaze_b2"
	DigitalOceanSpaces StorageProvider = "digitalocean_spaces"
	MinIO              StorageProvider = "min_io"
	Wasabi             StorageProvider = "wasabi"
	AliyunOSS          StorageProvider = "aliyun_oss"
	TencentCOS         StorageProvider = "tencent_cos"
	QiniuKodo          StorageProvider = "qiniu_kodo"
	CustomS3           StorageProvider = "custom_s3"
	Imgur              StorageProvider = "imgur"
	SmMs               StorageProvider = "sm_ms"
	GitHub             StorageProvider = "git_hub"
	Upyun              StorageProvider = "upyun"
)

// StorageConfig is one storage configuration. Field names and JSON tags
// match the Rust backend so config.json keeps working.
type StorageConfig struct {
	ID   string          `json:"id"`
	Name string          `json:"name"`
	Kind StorageProvider `json:"provider"`

	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	Endpoint        string `json:"endpoint"`
	BucketName      string `json:"bucket_name"`
	PublicURLBase   string `json:"public_url_base"`
	Region          string `json:"region"`
	PathPrefix      string `json:"path_prefix"`

	ImgurClientID string `json:"imgur_client_id"`
	SmmsAPIToken  string `json:"smms_api_token"`

	GitHubToken  string `json:"github_token"`
	GitHubOwner  string `json:"github_owner"`
	GitHubRepo   string `json:"github_repo"`
	GitHubBranch string `json:"github_branch"`
	GitHubPath   string `json:"github_path"`
	GitHubCDNURL string `json:"github_cdn_url"`

	UpyunBucket   string `json:"upyun_bucket"`
	UpyunOperator string `json:"upyun_operator"`
	UpyunPassword string `json:"upyun_password"`
	UpyunDomain   string `json:"upyun_domain"`
}

// StorageConfigList is config.json's shape: all configurations and the
// active one.
type StorageConfigList struct {
	Configs  []StorageConfig `json:"configs"`
	ActiveID string          `json:"active_id"`
}

// AppSettings is settings.json's shape.
type AppSettings struct {
	APIProxyEnabled bool   `json:"api_proxy_enabled"`
	APIProxyPort    uint16 `json:"api_proxy_port"`
	Theme           string `json:"theme,omitempty"`
	Language        string `json:"language,omitempty"`
}

// DefaultSettings returns the settings a new install starts with.
func DefaultSettings() AppSettings {
	return AppSettings{APIProxyPort: 38123, Theme: "system", Language: ""}
}

// UploadRecord is one row of the uploads database.
type UploadRecord struct {
	ID               string `json:"id"`
	OriginalFilename string `json:"original_filename"`
	FileHash         string `json:"file_hash"`
	FileSize         uint64 `json:"file_size"`
	URL              string `json:"url"`
	UploadTime       int64  `json:"upload_time"`
}

// UploadResult is the outcome of an upload.
type UploadResult struct {
	Success   bool   `json:"success"`
	URL       string `json:"url,omitempty"`
	Error     string `json:"error,omitempty"`
	FromCache bool   `json:"from_cache"`
}

// APIProxyStatus is the local upload proxy's state.
type APIProxyStatus struct {
	Enabled bool   `json:"enabled"`
	Running bool   `json:"running"`
	Port    uint16 `json:"port"`
}

// CompressConfig holds the compression parameters shown in the editor.
type CompressConfig struct {
	Format              string  `json:"format"`
	Quality             int     `json:"quality"`
	Resize              bool    `json:"resize"`
	ResizePreset        string  `json:"resize_preset"`
	ResizeWidth         int     `json:"resize_width"`
	ResizeHeight        int     `json:"resize_height"`
	MaintainAspectRatio bool    `json:"maintain_aspect_ratio"`
	PremultiplyAlpha    bool    `json:"premultiply_alpha"`
	LinearRGB           bool    `json:"linear_rgb"`
	ReducePalette       bool    `json:"reduce_palette"`
	PaletteColors       int     `json:"palette_colors"`
	Dithering           float64 `json:"dithering"`
}

// DefaultCompressConfig mirrors the old default: JPEG at quality 75.
func DefaultCompressConfig() CompressConfig {
	return CompressConfig{
		Format:              "mozjpeg",
		Quality:             75,
		ResizePreset:        "100%",
		ResizeWidth:         0,
		ResizeHeight:        0,
		MaintainAspectRatio: true,
		PaletteColors:       256,
		Dithering:           1,
	}
}

// CompressResult is the output of one compression.
type CompressResult struct {
	Data             []byte
	OriginalSize     int64
	CompressedSize   int64
	CompressionRatio float64
	Width            int
	Height           int
	Format           string
}

// CompressRecord is one entry of the compression history.
type CompressRecord struct {
	ID               string         `json:"id"`
	OriginalName     string         `json:"original_name"`
	OriginalSize     int64          `json:"original_size"`
	CompressedSize   int64          `json:"compressed_size"`
	CompressionRatio float64        `json:"compression_ratio"`
	CompressTime     int64          `json:"compress_time"`
	Config           CompressConfig `json:"config"`
	OriginalPath     string         `json:"original_path"`
	CompressedPath   string         `json:"compressed_path"`
	SourceType       string         `json:"source_type"`
}

// IsS3Compatible reports whether the provider uses the S3 protocol.
func (p StorageProvider) IsS3Compatible() bool {
	switch p {
	case CloudflareR2, AWSS3, BackblazeB2, DigitalOceanSpaces, MinIO,
		Wasabi, AliyunOSS, TencentCOS, QiniuKodo, CustomS3:
		return true
	}
	return false
}

// Label is the provider name users see.
func (p StorageProvider) Label() string {
	if s, ok := ProviderLabels[p]; ok {
		return s
	}
	return string(p)
}

// ProviderLabels maps providers to their display names.
var ProviderLabels = map[StorageProvider]string{
	CloudflareR2:       "Cloudflare R2",
	AWSS3:              "AWS S3",
	BackblazeB2:        "Backblaze B2",
	DigitalOceanSpaces: "DigitalOcean Spaces",
	MinIO:              "MinIO",
	Wasabi:             "Wasabi",
	AliyunOSS:          "阿里云 OSS",
	TencentCOS:         "腾讯云 COS",
	QiniuKodo:          "七牛云 Kodo",
	CustomS3:           "Custom S3",
	Imgur:              "Imgur",
	SmMs:               "SM.MS",
	GitHub:             "GitHub",
	Upyun:              "又拍云",
}

// ProviderGroups drives the provider picker.
var ProviderGroups = []struct {
	Label     string
	Providers []StorageProvider
}{
	{"S3 Compatible", []StorageProvider{CloudflareR2, AWSS3, BackblazeB2, DigitalOceanSpaces, MinIO, Wasabi, AliyunOSS, TencentCOS, QiniuKodo, CustomS3}},
	{"Image Hosting", []StorageProvider{Imgur, SmMs}},
	{"Other", []StorageProvider{GitHub, Upyun}},
}

// EndpointHints are placeholders for the endpoint field.
var EndpointHints = map[StorageProvider]string{
	CloudflareR2:       "https://<account-id>.r2.cloudflarestorage.com",
	AWSS3:              "https://s3.<region>.amazonaws.com",
	BackblazeB2:        "https://s3.<region>.backblazeb2.com",
	DigitalOceanSpaces: "https://<region>.digitaloceanspaces.com",
	MinIO:              "http(s)://<host>:<port>",
	Wasabi:             "https://s3.<region>.wasabisys.com",
	AliyunOSS:          "https://oss-<region>.aliyuncs.com",
	TencentCOS:         "https://cos.<region>.myqcloud.com",
	QiniuKodo:          "https://s3-<region>.qiniucs.com",
	CustomS3:           "https://your-s3-endpoint.com",
}

// NewStorageConfig returns an empty config with the given provider.
func NewStorageConfig(p StorageProvider) StorageConfig {
	return StorageConfig{
		Kind:         p,
		BucketName:   "",
		Region:       "",
		GitHubBranch: "main",
		GitHubPath:   "images",
	}
}

// Validate reports whether the configuration has everything its provider
// needs. It returns a key naming the first missing field.
func (c StorageConfig) Validate() (string, bool) {
	if strings.TrimSpace(c.Name) == "" {
		return "Name", false
	}
	if c.Kind.IsS3Compatible() {
		switch {
		case c.AccessKeyID == "":
			return "Access Key ID", false
		case c.SecretAccessKey == "":
			return "Secret Access Key", false
		case c.Endpoint == "":
			return "Endpoint", false
		case c.BucketName == "":
			return "Bucket Name", false
		case c.PublicURLBase == "":
			return "Public URL Base", false
		}
		return "", true
	}
	switch c.Kind {
	case Imgur:
		if c.ImgurClientID == "" {
			return "Client ID", false
		}
		return "", true
	case SmMs:
		if c.SmmsAPIToken == "" {
			return "API Token", false
		}
		return "", true
	case GitHub:
		switch {
		case c.GitHubToken == "":
			return "Token", false
		case c.GitHubOwner == "":
			return "Owner", false
		case c.GitHubRepo == "":
			return "Repo", false
		}
		return "", true
	case Upyun:
		switch {
		case c.UpyunBucket == "":
			return "Bucket", false
		case c.UpyunOperator == "":
			return "Operator", false
		case c.UpyunPassword == "":
			return "Password", false
		case c.UpyunDomain == "":
			return "Domain", false
		}
		return "", true
	}
	return "Provider", false
}

// NewID returns a random identifier for configurations and records.
func NewID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b[:])
}
