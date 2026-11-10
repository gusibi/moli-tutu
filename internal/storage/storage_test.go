package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gusibi/moli-tutu/internal/model"
)

func TestS3UploadSignsAndBuildsURL(t *testing.T) {
	var gotPath, gotAuth, gotHash, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		gotHash = r.Header.Get("x-amz-content-sha256")
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	cfg := model.StorageConfig{
		Kind:            model.CloudflareR2,
		Endpoint:        srv.URL,
		BucketName:      "images",
		PublicURLBase:   "https://cdn.example.com",
		AccessKeyID:     "access",
		SecretAccessKey: "secret",
		Region:          "auto",
	}
	u, err := newS3Uploader(cfg, srv.Client())
	if err != nil {
		t.Fatal(err)
	}
	data := []byte("hello image")
	url, err := u.Upload(context.Background(), data, "photo.png", "image/png", nil)
	if err != nil {
		t.Fatal(err)
	}
	if gotBody != string(data) {
		t.Fatalf("body = %q", gotBody)
	}
	if !strings.HasPrefix(gotPath, "/images/") {
		t.Fatalf("path = %q", gotPath)
	}
	if !strings.Contains(gotAuth, "AWS4-HMAC-SHA256 Credential=access/") {
		t.Fatalf("auth = %q", gotAuth)
	}
	sum := sha256.Sum256(data)
	if gotHash != hex.EncodeToString(sum[:]) {
		t.Fatalf("hash = %q", gotHash)
	}
	if !strings.HasPrefix(url, "https://cdn.example.com/") || !strings.HasSuffix(url, ".png") {
		t.Fatalf("url = %q", url)
	}
}

func TestImgurUpload(t *testing.T) {
	var auth, body string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		b, _ := io.ReadAll(r.Body)
		body = string(b)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"data":    map[string]string{"link": "https://i.imgur.com/a.png"},
		})
	}))
	defer srv.Close()
	u := &imgurUploader{client: srv.Client(), clientID: "cid", baseURL: srv.URL}
	url, err := u.Upload(context.Background(), []byte("abc"), "a.png", "image/png", nil)
	if err != nil {
		t.Fatal(err)
	}
	if auth != "Client-ID cid" || !strings.Contains(body, "image=YWJj") {
		t.Fatalf("auth=%q body=%q", auth, body)
	}
	if url != "https://i.imgur.com/a.png" {
		t.Fatalf("url = %q", url)
	}
}

func TestSMUpload(t *testing.T) {
	var token, filename string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token = r.Header.Get("Authorization")
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Error(err)
		}
		f, h, err := r.FormFile("smfile")
		if err != nil {
			t.Error(err)
		} else {
			f.Close()
			filename = h.Filename
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"success": true,
			"data":    map[string]string{"url": "https://s2.loli.net/a.png"},
		})
	}))
	defer srv.Close()
	u := &smmsUploader{client: srv.Client(), token: "tok", baseURL: srv.URL}
	url, err := u.Upload(context.Background(), []byte("abc"), "a.png", "image/png", nil)
	if err != nil {
		t.Fatal(err)
	}
	if token != "tok" || filename != "a.png" || url != "https://s2.loli.net/a.png" {
		t.Fatalf("token=%q filename=%q url=%q", token, filename, url)
	}
}

func TestGitHubUpload(t *testing.T) {
	var path, auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"content":{"name":"x"}}`))
	}))
	defer srv.Close()
	u := &githubUploader{
		client: srv.Client(), token: "tok", owner: "o", repo: "r",
		branch: "main", path: "images", apiURL: srv.URL,
	}
	url, err := u.Upload(context.Background(), []byte("abc"), "a.png", "image/png", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(path, "/repos/o/r/contents/images/") || auth != "Bearer tok" {
		t.Fatalf("path=%q auth=%q", path, auth)
	}
	if !strings.Contains(url, "raw.githubusercontent.com/o/r/main/images/") {
		t.Fatalf("url = %q", url)
	}
}

func TestUpyunUpload(t *testing.T) {
	var path, auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, auth = r.URL.Path, r.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	u := &upyunUploader{
		client: srv.Client(), bucket: "b", operator: "op", password: "pw",
		domain: "https://cdn.example.com", apiURL: srv.URL,
	}
	url, err := u.Upload(context.Background(), []byte("abc"), "a.png", "image/png", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(path, "/b/images/") || !strings.HasPrefix(auth, "Basic ") {
		t.Fatalf("path=%q auth=%q", path, auth)
	}
	if !strings.HasPrefix(url, "https://cdn.example.com/") || !strings.HasSuffix(url, ".png") {
		t.Fatalf("url = %q", url)
	}
}

func TestContentType(t *testing.T) {
	if got := ContentType("a.png", nil); got != "image/png" {
		t.Fatalf("got %q", got)
	}
}

func TestS3EndpointPathWithBucket(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	cfg := model.StorageConfig{
		Kind: model.CloudflareR2, Endpoint: srv.URL + "/images",
		BucketName: "images", PublicURLBase: "https://cdn.example.com",
		AccessKeyID: "a", SecretAccessKey: "s", Region: "auto",
	}
	u, _ := newS3Uploader(cfg, srv.Client())
	if _, err := u.Upload(context.Background(), []byte("x"), "a.png", "image/png", nil); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(gotPath, "/images/") || strings.HasPrefix(gotPath, "/images/images/") {
		t.Fatalf("path = %q", gotPath)
	}
}
