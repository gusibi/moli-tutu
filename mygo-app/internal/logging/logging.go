// Package logging writes the app log to the user's log directory with a
// small size-based rotation. It never logs configuration values itself.
package logging

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
)

const (
	maxSize = 5 << 20
	keep    = 3
)

// Setup routes the standard logger to stderr and a rotating file in dir.
func Setup(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	w, err := newRotatingWriter(filepath.Join(dir, "moli-tutu.log"), maxSize, keep)
	if err != nil {
		return err
	}
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	log.SetOutput(io.MultiWriter(os.Stderr, w))
	return nil
}

type rotatingWriter struct {
	mu   sync.Mutex
	path string
	max  int64
	keep int
	file *os.File
	size int64
}

func newRotatingWriter(path string, max int64, keep int) (*rotatingWriter, error) {
	w := &rotatingWriter{path: path, max: max, keep: keep}
	if err := w.open(); err != nil {
		return nil, err
	}
	return w, nil
}

func (w *rotatingWriter) open() error {
	f, err := os.OpenFile(w.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return err
	}
	w.file = f
	w.size = st.Size()
	return nil
}

func (w *rotatingWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		if err := w.open(); err != nil {
			return 0, err
		}
	}
	if w.size+int64(len(p)) > w.max {
		if err := w.rotate(); err != nil {
			return 0, err
		}
	}
	n, err := w.file.Write(p)
	w.size += int64(n)
	return n, err
}

func (w *rotatingWriter) rotate() error {
	_ = w.file.Close()
	for i := w.keep - 1; i >= 1; i-- {
		_ = os.Rename(w.path+"."+fmt.Sprint(i), w.path+"."+fmt.Sprint(i+1))
	}
	_ = os.Remove(w.path + ".1")
	_ = os.Rename(w.path, w.path+".1")
	w.file = nil
	w.size = 0
	return w.open()
}
