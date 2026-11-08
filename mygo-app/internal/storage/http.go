package storage

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"path"
	"strings"
)

type imgurUploader struct {
	client   *http.Client
	clientID string
	baseURL  string
}

func (u *imgurUploader) Upload(ctx context.Context, data []byte, filename, contentType string, _ Progress) (string, error) {
	base := u.baseURL
	if base == "" {
		base = "https://api.imgur.com"
	}
	form := url.Values{}
	form.Set("image", base64.StdEncoding.EncodeToString(data))
	form.Set("type", "base64")
	form.Set("name", filename)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/3/image", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Client-ID "+u.clientID)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var body struct {
		Success bool `json:"success"`
		Data    struct {
			Link  string `json:"link"`
			Error string `json:"error"`
		} `json:"data"`
	}
	if err := doJSON(u.client, req, &body); err != nil {
		return "", err
	}
	if !body.Success || body.Data.Link == "" {
		if body.Data.Error == "" {
			body.Data.Error = "unknown error"
		}
		return "", fmt.Errorf("Imgur upload failed: %s", body.Data.Error)
	}
	return body.Data.Link, nil
}

type smmsUploader struct {
	client  *http.Client
	token   string
	baseURL string
}

func (u *smmsUploader) Upload(ctx context.Context, data []byte, filename, contentType string, _ Progress) (string, error) {
	base := u.baseURL
	if base == "" {
		base = "https://sm.ms"
	}
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreatePart(textProto(filename, contentType))
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/v2/upload", &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", u.token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	var body struct {
		Success bool   `json:"success"`
		Code    string `json:"code"`
		Message string `json:"message"`
		Images  string `json:"images"`
		Data    struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := doJSON(u.client, req, &body); err != nil {
		return "", err
	}
	if body.Success && body.Data.URL != "" {
		return body.Data.URL, nil
	}
	if body.Code == "image_repeated" && body.Images != "" {
		return body.Images, nil
	}
	if body.Message == "" {
		body.Message = "unknown error"
	}
	return "", fmt.Errorf("SM.MS upload failed: %s", body.Message)
}

type githubUploader struct {
	client *http.Client
	token  string
	owner  string
	repo   string
	branch string
	path   string
	cdn    string
	apiURL string
}

func (u *githubUploader) Upload(ctx context.Context, data []byte, filename, contentType string, _ Progress) (string, error) {
	base := u.apiURL
	if base == "" {
		base = "https://api.github.com"
	}
	dir := strings.Trim(u.path, "/")
	if dir == "" {
		dir = "images"
	}
	key := strings.Trim(dir, "/") + "/" + randomID() + extensionOf(filename)
	payload := map[string]string{
		"message": "Upload image: " + filename,
		"content": base64.StdEncoding.EncodeToString(data),
		"branch":  u.branch,
	}
	if payload["branch"] == "" {
		payload["branch"] = "main"
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut,
		fmt.Sprintf("%s/repos/%s/%s/contents/%s", strings.TrimRight(base, "/"),
			url.PathEscape(u.owner), url.PathEscape(u.repo), escapePath(key)), bytes.NewReader(b))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+u.token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "MoliTutu-ImageUploader")
	var body struct {
		Message string `json:"message"`
	}
	if err := doJSON(u.client, req, &body); err != nil {
		return "", err
	}
	if body.Message != "" {
		return "", fmt.Errorf("GitHub upload failed: %s", body.Message)
	}
	if u.cdn != "" {
		return strings.TrimRight(u.cdn, "/") + "/" + key, nil
	}
	return fmt.Sprintf("https://raw.githubusercontent.com/%s/%s/%s/%s", u.owner, u.repo, u.branch, key), nil
}

type upyunUploader struct {
	client   *http.Client
	bucket   string
	operator string
	password string
	domain   string
	apiURL   string
}

func (u *upyunUploader) Upload(ctx context.Context, data []byte, filename, contentType string, progress Progress) (string, error) {
	base := u.apiURL
	if base == "" {
		base = "https://v0.api.upyun.com"
	}
	remote := "/images/" + randomID() + extensionOf(filename)
	target := strings.TrimRight(base, "/") + "/" + url.PathEscape(u.bucket) + remote
	var body io.Reader = bytes.NewReader(data)
	if progress != nil {
		body = &progressReader{r: bytes.NewReader(data), total: int64(len(data)), progress: progress}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, target, body)
	if err != nil {
		return "", err
	}
	req.ContentLength = int64(len(data))
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(u.operator+":"+u.password)))
	req.Header.Set("Content-Type", contentType)
	resp, err := u.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("Upyun upload request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
		return "", fmt.Errorf("Upyun upload failed (%d): %s", resp.StatusCode, strings.TrimSpace(string(msg)))
	}
	return strings.TrimRight(u.domain, "/") + remote, nil
}

func doJSON(client *http.Client, req *http.Request, out any) error {
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("%s %s failed (%d): %s", req.Method, req.URL.Path, resp.StatusCode, strings.TrimSpace(string(b)))
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(b, out); err != nil {
		return fmt.Errorf("invalid response: %w", err)
	}
	return nil
}

func textProto(filename, contentType string) textproto.MIMEHeader {
	return textproto.MIMEHeader{
		"Content-Disposition": {fmt.Sprintf(`form-data; name="smfile"; filename="%s"`, path.Base(filename))},
		"Content-Type":        {contentType},
	}
}
