package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net"
	"net/http"
	"net/textproto"
	"testing"
	"time"

	"github.com/gusibi/moli-tutu/internal/model"
)

func TestProxyUpload(t *testing.T) {
	s := New(0)
	s.SetUpload(func(_ context.Context, data []byte, filename, contentType string) (model.UploadResult, error) {
		if string(data) != "image-bytes" || filename != "a.png" || contentType != "image/png" {
			return model.UploadResult{}, fmt.Errorf("unexpected %q %q %q", data, filename, contentType)
		}
		return model.UploadResult{Success: true, URL: "https://cdn/a.png"}, nil
	})
	if err := s.Start(); err != nil {
		t.Fatal(err)
	}
	defer s.Stop()
	url := fmt.Sprintf("http://127.0.0.1:%d/upload", s.Port())

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, err := w.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="file"; filename="a.png"`},
		"Content-Type":        {"image/png"},
	})
	if err != nil {
		t.Fatal(err)
	}
	part.Write([]byte("image-bytes"))
	w.Close()
	req, _ := http.NewRequest(http.MethodPost, url, &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	var result model.UploadResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if !result.Success || result.URL != "https://cdn/a.png" {
		t.Fatalf("result = %+v", result)
	}
}

func TestProxyWithoutUploader(t *testing.T) {
	s := New(0)
	if err := s.Start(); err != nil {
		t.Fatal(err)
	}
	defer s.Stop()
	url := fmt.Sprintf("http://127.0.0.1:%d/upload", s.Port())
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, _ := w.CreateFormFile("file", "a.png")
	part.Write([]byte("x"))
	w.Close()
	req, _ := http.NewRequest(http.MethodPost, url, &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("status = %d", resp.StatusCode)
	}
}

func TestProxyStopReleasesPort(t *testing.T) {
	s := New(0)
	if err := s.Start(); err != nil {
		t.Fatal(err)
	}
	port := s.Port()
	if err := s.Stop(); err != nil {
		t.Fatal(err)
	}
	// The port should be bindable again; let the OS settle first.
	deadline := time.Now().Add(2 * time.Second)
	for {
		ln, err := netListen(port)
		if err == nil {
			ln.Close()
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("port %d still busy: %v", port, err)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func netListen(port uint16) (net.Listener, error) {
	return net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
}
