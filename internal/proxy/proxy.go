// Package proxy serves the local upload endpoint used by external tools.
package proxy

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gusibi/moli-tutu/internal/model"
)

// UploadFunc handles one file from the proxy.
type UploadFunc func(ctx context.Context, data []byte, filename, contentType string) (model.UploadResult, error)

// Server is the localhost upload API.
type Server struct {
	mu       sync.Mutex
	port     uint16
	server   *http.Server
	listener net.Listener
	upload   UploadFunc
	running  bool
}

// New returns a server configured for port, not yet listening. Port 0 asks
// the system for a free port, which Port reports after Start.
func New(port uint16) *Server {
	return &Server{port: port}
}

// SetUpload sets the handler used for uploads.
func (s *Server) SetUpload(fn UploadFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.upload = fn
}

// Start begins listening on 127.0.0.1:port.
func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		return nil
	}
	addr := fmt.Sprintf("127.0.0.1:%d", s.port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to bind API proxy on %s: %w", addr, err)
	}
	actual := ln.Addr().(*net.TCPAddr).Port
	s.port = uint16(actual)
	mux := http.NewServeMux()
	mux.HandleFunc("/upload", s.handleUpload)
	srv := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	s.server = srv
	s.listener = ln
	s.running = true
	go func() {
		_ = srv.Serve(ln)
	}()
	return nil
}

// Stop shuts the server down and releases the port.
func (s *Server) Stop() error {
	s.mu.Lock()
	srv := s.server
	ln := s.listener
	s.server = nil
	s.listener = nil
	s.running = false
	s.mu.Unlock()
	if srv != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}
	if ln != nil {
		_ = ln.Close()
	}
	return nil
}

// Running reports whether the server is listening.
func (s *Server) Running() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

// Port returns the current or last bound port.
func (s *Server) Port() uint16 {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.port
}

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeResult(w, http.StatusBadRequest, model.UploadResult{Error: "invalid multipart data: " + err.Error()})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		// Accept the first file field, like the old proxy.
		for _, files := range r.MultipartForm.File {
			if len(files) > 0 {
				header = files[0]
				file, err = header.Open()
				break
			}
		}
	}
	if err != nil || file == nil {
		writeResult(w, http.StatusBadRequest, model.UploadResult{Error: "no file found in multipart payload"})
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 100<<20))
	if err != nil {
		writeResult(w, http.StatusBadRequest, model.UploadResult{Error: "failed to read upload data: " + err.Error()})
		return
	}
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	s.mu.Lock()
	fn := s.upload
	s.mu.Unlock()
	if fn == nil {
		writeResult(w, http.StatusServiceUnavailable, model.UploadResult{Error: "storage configuration not set"})
		return
	}
	result, err := fn(r.Context(), data, header.Filename, contentType)
	if err != nil {
		writeResult(w, http.StatusInternalServerError, model.UploadResult{Error: err.Error()})
		return
	}
	if !result.Success {
		writeResult(w, http.StatusInternalServerError, result)
		return
	}
	writeResult(w, http.StatusOK, result)
}

func writeResult(w http.ResponseWriter, status int, result model.UploadResult) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(result)
}
