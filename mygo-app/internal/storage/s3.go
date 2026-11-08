package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
)

// s3Uploader implements the S3 PutObject call with AWS Signature Version 4.
// It deliberately avoids the AWS SDK: the app only needs one request, and a
// small pure-Go signer keeps the binary and cross-compilation simple.
type s3Uploader struct {
	cfg    model.StorageConfig
	client *http.Client
}

func newS3Uploader(cfg model.StorageConfig, client *http.Client) (*s3Uploader, error) {
	if cfg.Endpoint == "" || cfg.BucketName == "" {
		return nil, fmt.Errorf("S3 endpoint and bucket are required")
	}
	return &s3Uploader{cfg: cfg, client: client}, nil
}

func (u *s3Uploader) Upload(ctx context.Context, data []byte, filename, contentType string, progress Progress) (string, error) {
	key := randomID() + extensionOf(filename)
	if prefix := strings.Trim(cfgPathPrefix(u.cfg.PathPrefix), "/"); prefix != "" {
		key = prefix + "/" + key
	}
	endpoint := u.cfg.Endpoint
	if !strings.Contains(endpoint, "://") {
		endpoint = "https://" + endpoint
	}
	base, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("invalid endpoint: %w", err)
	}
	host := base.Host
	if host == "" {
		return "", fmt.Errorf("invalid endpoint host")
	}
	hostName := base.Hostname()
	virtual := strings.HasSuffix(hostName, ".amazonaws.com") && !strings.Contains(u.cfg.BucketName, ".")
	keyPath := escapePath(key)
	var canonicalURI string
	basePath := strings.TrimRight(base.EscapedPath(), "/")
	bucketPath := "/" + url.PathEscape(u.cfg.BucketName)
	if virtual {
		host = u.cfg.BucketName + "." + host
		canonicalURI = joinURLPath(basePath, keyPath)
	} else if strings.HasSuffix(basePath, bucketPath) {
		// Some R2/custom endpoints already include the bucket in the path.
		canonicalURI = joinURLPath(basePath, keyPath)
	} else {
		canonicalURI = joinURLPath(basePath, bucketPath, keyPath)
	}
	decoded, err := url.PathUnescape(canonicalURI)
	if err != nil {
		return "", err
	}
	target := &url.URL{Scheme: base.Scheme, Host: host, Path: decoded, RawPath: canonicalURI}
	region := strings.TrimSpace(u.cfg.Region)
	if region == "" {
		if u.cfg.Kind == model.CloudflareR2 {
			region = "auto"
		} else {
			region = "us-east-1"
		}
	}
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	date := now.Format("20060102")
	payloadHash := sha256Hex(data)

	headers := map[string]string{
		"content-type":         contentType,
		"host":                 host,
		"x-amz-content-sha256": payloadHash,
		"x-amz-date":           amzDate,
	}
	names := make([]string, 0, len(headers))
	for name := range headers {
		names = append(names, name)
	}
	sort.Strings(names)
	var canonicalHeaders strings.Builder
	for _, name := range names {
		canonicalHeaders.WriteString(name)
		canonicalHeaders.WriteString(":")
		canonicalHeaders.WriteString(strings.TrimSpace(headers[name]))
		canonicalHeaders.WriteString("\n")
	}
	signedHeaders := strings.Join(names, ";")
	canonicalRequest := strings.Join([]string{
		http.MethodPut,
		canonicalURI,
		"",
		canonicalHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")
	scope := date + "/" + region + "/s3/aws4_request"
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")
	signingKey := hmacSHA256([]byte("AWS4"+u.cfg.SecretAccessKey), date)
	signingKey = hmacSHA256(signingKey, region)
	signingKey = hmacSHA256(signingKey, "s3")
	signingKey = hmacSHA256(signingKey, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(signingKey, stringToSign))
	authorization := fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		u.cfg.AccessKeyID, scope, signedHeaders, signature,
	)

	var body io.Reader = bytes.NewReader(data)
	if progress != nil {
		body = &progressReader{r: bytes.NewReader(data), total: int64(len(data)), progress: progress}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, target.String(), body)
	if err != nil {
		return "", err
	}
	req.Host = host
	req.ContentLength = int64(len(data))
	for name, value := range headers {
		if name != "host" {
			req.Header.Set(name, value)
		}
	}
	req.Header.Set("Authorization", authorization)

	resp, err := u.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("S3 upload request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
		return "", fmt.Errorf("S3 upload failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	return strings.TrimRight(u.cfg.PublicURLBase, "/") + "/" + key, nil
}

func cfgPathPrefix(prefix string) string {
	return strings.Trim(prefix, "/")
}

func joinURLPath(parts ...string) string {
	out := ""
	for _, part := range parts {
		if part == "" {
			continue
		}
		if out == "" {
			out = part
		} else {
			out = strings.TrimRight(out, "/") + "/" + strings.TrimLeft(part, "/")
		}
	}
	if out == "" {
		return "/"
	}
	if !strings.HasPrefix(out, "/") {
		out = "/" + out
	}
	return out
}

func escapePath(key string) string {
	parts := strings.Split(key, "/")
	for i := range parts {
		parts[i] = url.PathEscape(parts[i])
	}
	return strings.Join(parts, "/")
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key []byte, data string) []byte {
	h := hmac.New(sha256.New, key)
	h.Write([]byte(data))
	return h.Sum(nil)
}

type progressReader struct {
	r        io.Reader
	total    int64
	sent     int64
	progress Progress
}

func (p *progressReader) Read(b []byte) (int, error) {
	n, err := p.r.Read(b)
	if n > 0 {
		p.sent += int64(n)
		p.progress(p.sent, p.total)
	}
	return n, err
}
