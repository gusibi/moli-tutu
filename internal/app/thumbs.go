package app

import (
	"context"
	"sync"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"
)

// ThumbCache loads remote thumbnails through the service and keeps decoded
// bitmaps in memory.
type ThumbCache struct {
	mu      sync.Mutex
	win     *mygo.Window
	fetch   func(context.Context, string) ([]byte, error)
	bitmaps map[string]ui.ImageSource
	failed  map[string]bool
	loading map[string]bool
	sem     chan struct{}
}

// NewThumbCache returns a cache that fetches bytes through fetch.
func NewThumbCache(win *mygo.Window, fetch func(context.Context, string) ([]byte, error)) *ThumbCache {
	return &ThumbCache{
		win:     win,
		fetch:   fetch,
		bitmaps: map[string]ui.ImageSource{},
		failed:  map[string]bool{},
		loading: map[string]bool{},
		sem:     make(chan struct{}, 4),
	}
}

// Get returns a bitmap if it is cached, and otherwise starts loading it.
// It must be called on the main thread, from the view.
func (t *ThumbCache) Get(rawURL string) ui.ImageSource {
	if rawURL == "" || t.fetch == nil {
		return nil
	}
	t.mu.Lock()
	if b, ok := t.bitmaps[rawURL]; ok {
		t.mu.Unlock()
		return b
	}
	if t.failed[rawURL] || t.loading[rawURL] {
		t.mu.Unlock()
		return nil
	}
	t.loading[rawURL] = true
	t.mu.Unlock()

	go t.load(rawURL)
	return nil
}

func (t *ThumbCache) load(rawURL string) {
	t.sem <- struct{}{}
	defer func() { <-t.sem }()
	data, err := t.fetch(context.Background(), rawURL)
	if t.win == nil {
		return
	}
	t.win.Update(func() {
		t.mu.Lock()
		defer t.mu.Unlock()
		delete(t.loading, rawURL)
		if err != nil || len(data) == 0 {
			t.failed[rawURL] = true
			return
		}
		bmp, decErr := ui.DecodeBitmap(data)
		if decErr != nil {
			t.failed[rawURL] = true
			return
		}
		t.bitmaps[rawURL] = bmp
		if len(t.bitmaps) > 64 {
			for key := range t.bitmaps {
				if key != rawURL {
					delete(t.bitmaps, key)
					break
				}
			}
		}
	})
}
