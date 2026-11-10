package imaging

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	"github.com/gusibi/moli-tutu/internal/model"
)

func testPNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetNRGBA(x, y, color.NRGBA{R: uint8(x * 3), G: uint8(y * 5), B: 120, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func testJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x * 3), G: uint8(y * 5), B: 120, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestCompressJPEGAndResize(t *testing.T) {
	cfg := model.DefaultCompressConfig()
	res, err := Compress(testPNG(t, 200, 100), cfg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Format != "jpeg" || res.Width != 200 || res.Height != 100 {
		t.Fatalf("result = %+v", res)
	}
	if res.CompressedSize == 0 || len(res.Data) == 0 {
		t.Fatal("empty output")
	}
	cfg.Resize = true
	cfg.ResizePreset = "50%"
	res, err = Compress(testPNG(t, 200, 100), cfg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Width != 100 || res.Height != 50 {
		t.Fatalf("resized = %dx%d", res.Width, res.Height)
	}
}

func TestCompressWebP(t *testing.T) {
	cfg := model.DefaultCompressConfig()
	cfg.Format = "webp"
	res, err := Compress(testJPEG(t, 64, 48), cfg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Format != "webp" {
		t.Fatalf("format = %q", res.Format)
	}
	img, _, err := image.Decode(bytes.NewReader(res.Data))
	if err != nil {
		t.Fatal(err)
	}
	if img.Bounds().Dx() != 64 || img.Bounds().Dy() != 48 {
		t.Fatalf("bounds = %v", img.Bounds())
	}
}

func TestCompressPNGPalette(t *testing.T) {
	cfg := model.DefaultCompressConfig()
	cfg.Format = "oxipng"
	cfg.ReducePalette = true
	cfg.PaletteColors = 8
	cfg.Dithering = 1
	res, err := Compress(testPNG(t, 32, 32), cfg)
	if err != nil {
		t.Fatal(err)
	}
	img, _, err := image.Decode(bytes.NewReader(res.Data))
	if err != nil {
		t.Fatal(err)
	}
	pal, ok := img.(*image.Paletted)
	if !ok {
		t.Fatalf("decoded %T, want *image.Paletted", img)
	}
	if len(pal.Palette) == 0 || len(pal.Palette) > 8 {
		t.Fatalf("palette = %d", len(pal.Palette))
	}
}

func TestOrientationSwapsDimensions(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 2, 1))
	src.SetNRGBA(0, 0, color.NRGBA{R: 255, A: 255})
	src.SetNRGBA(1, 0, color.NRGBA{G: 255, A: 255})
	out := applyOrientation(src, 6)
	if out.Bounds().Dx() != 1 || out.Bounds().Dy() != 2 {
		t.Fatalf("bounds = %v", out.Bounds())
	}
}

func TestCompressAspectResize(t *testing.T) {
	cfg := model.DefaultCompressConfig()
	cfg.Resize = true
	cfg.ResizePreset = "custom"
	cfg.ResizeWidth, cfg.ResizeHeight = 100, 100
	cfg.MaintainAspectRatio = true
	res, err := Compress(testPNG(t, 200, 100), cfg)
	if err != nil {
		t.Fatal(err)
	}
	if res.Width != 100 || res.Height != 50 {
		t.Fatalf("size = %dx%d", res.Width, res.Height)
	}
}
