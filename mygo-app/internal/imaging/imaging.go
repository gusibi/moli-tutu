// Package imaging decodes, resizes and re-encodes images for the compressor.
package imaging

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	"image/png"
	"math"
	"sort"

	"github.com/gen2brain/webp"
	"github.com/rwcarlsen/goexif/exif"
	_ "golang.org/x/image/bmp"
	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
)

// MaxPixels caps the decoded image size, about 50 megapixels.
const MaxPixels = 50_000_000

// Compress decodes data, applies the configuration and encodes the result.
func Compress(data []byte, cfg model.CompressConfig) (model.CompressResult, error) {
	if len(data) == 0 {
		return model.CompressResult{}, errors.New("empty image")
	}
	conf, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return model.CompressResult{}, fmt.Errorf("unsupported image: %w", err)
	}
	if conf.Width <= 0 || conf.Height <= 0 || int64(conf.Width)*int64(conf.Height) > MaxPixels {
		return model.CompressResult{}, fmt.Errorf("image is too large (%dx%d)", conf.Width, conf.Height)
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return model.CompressResult{}, fmt.Errorf("decode image: %w", err)
	}
	img = applyOrientation(img, jpegOrientation(data))
	if cfg.PremultiplyAlpha {
		img = premultiply(img)
	} else {
		img = unpremultiply(img)
	}

	w, h := targetSize(img.Bounds().Dx(), img.Bounds().Dy(), cfg)
	if w != img.Bounds().Dx() || h != img.Bounds().Dy() {
		img = resize(img, w, h, cfg)
	}

	if cfg.Format == "oxipng" && cfg.ReducePalette {
		img = quantize(img, cfg)
	}

	var out bytes.Buffer
	format := "jpeg"
	switch cfg.Format {
	case "oxipng":
		format = "png"
		enc := png.Encoder{CompressionLevel: png.BestCompression}
		if err := enc.Encode(&out, img); err != nil {
			return model.CompressResult{}, fmt.Errorf("encode PNG: %w", err)
		}
	case "webp", "avif":
		format = "webp"
		if err := webp.Encode(&out, img, webp.Options{Quality: clamp(cfg.Quality, 1, 100), Method: 4}); err != nil {
			return model.CompressResult{}, fmt.Errorf("encode WebP: %w", err)
		}
	default:
		quality := clamp(cfg.Quality, 1, 100)
		if err := jpeg.Encode(&out, flatten(img), &jpeg.Options{Quality: quality}); err != nil {
			return model.CompressResult{}, fmt.Errorf("encode JPEG: %w", err)
		}
	}
	result := model.CompressResult{
		Data:           out.Bytes(),
		OriginalSize:   int64(len(data)),
		CompressedSize: int64(out.Len()),
		Width:          img.Bounds().Dx(),
		Height:         img.Bounds().Dy(),
		Format:         format,
	}
	if result.OriginalSize > 0 {
		result.CompressionRatio = float64(result.OriginalSize-result.CompressedSize) / float64(result.OriginalSize) * 100
	}
	return result, nil
}

func targetSize(w, h int, cfg model.CompressConfig) (int, int) {
	if !cfg.Resize || cfg.ResizePreset == "100%" {
		return w, h
	}
	if cfg.ResizePreset != "" && cfg.ResizePreset != "custom" {
		var pct int
		if _, err := fmt.Sscanf(cfg.ResizePreset, "%d%%", &pct); err == nil && pct > 0 {
			return max(1, w*pct/100), max(1, h*pct/100)
		}
	}
	tw, th := cfg.ResizeWidth, cfg.ResizeHeight
	if tw <= 0 && th <= 0 {
		return w, h
	}
	if cfg.MaintainAspectRatio {
		if tw <= 0 {
			tw = int(math.Round(float64(th) * float64(w) / float64(h)))
		}
		if th <= 0 {
			th = int(math.Round(float64(tw) * float64(h) / float64(w)))
		}
		ratio := float64(w) / float64(h)
		if float64(tw)/float64(th) > ratio {
			tw = int(math.Round(float64(th) * ratio))
		} else {
			th = int(math.Round(float64(tw) / ratio))
		}
	}
	if tw <= 0 {
		tw = w
	}
	if th <= 0 {
		th = h
	}
	return tw, th
}

func resize(src image.Image, w, h int, cfg model.CompressConfig) image.Image {
	if cfg.LinearRGB {
		src = toLinear(src)
	}
	var dst draw.Image
	if cfg.PremultiplyAlpha {
		dst = image.NewRGBA(image.Rect(0, 0, w, h))
	} else {
		dst = image.NewNRGBA(image.Rect(0, 0, w, h))
	}
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Src, nil)
	if cfg.LinearRGB {
		return fromLinear(dst)
	}
	return dst
}

func toLinear(src image.Image) image.Image {
	return mapImage(src, func(r, g, b, a uint8) (uint8, uint8, uint8, uint8) {
		return linearLUT[r], linearLUT[g], linearLUT[b], a
	})
}

func fromLinear(src image.Image) image.Image {
	return mapImage(src, func(r, g, b, a uint8) (uint8, uint8, uint8, uint8) {
		return srgbLUT[r], srgbLUT[g], srgbLUT[b], a
	})
}

var linearLUT, srgbLUT = makeLUTs()

func makeLUTs() ([256]uint8, [256]uint8) {
	var lin, srgb [256]uint8
	for i := 0; i < 256; i++ {
		v := float64(i) / 255
		if v <= 0.04045 {
			v /= 12.92
		} else {
			v = math.Pow((v+0.055)/1.055, 2.4)
		}
		lin[i] = uint8(math.Round(v * 255))
		s := float64(i) / 255
		if s <= 0.0031308 {
			s *= 12.92
		} else {
			s = 1.055*math.Pow(s, 1/2.4) - 0.055
		}
		srgb[i] = uint8(math.Round(s * 255))
	}
	return lin, srgb
}

func mapImage(src image.Image, fn func(r, g, b, a uint8) (uint8, uint8, uint8, uint8)) image.Image {
	b := src.Bounds()
	dst := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	for y := 0; y < b.Dy(); y++ {
		for x := 0; x < b.Dx(); x++ {
			r, g, bl, a := src.At(b.Min.X+x, b.Min.Y+y).RGBA()
			nr, ng, nb, na := fn(uint8(r>>8), uint8(g>>8), uint8(bl>>8), uint8(a>>8))
			dst.SetNRGBA(x, y, color.NRGBA{R: nr, G: ng, B: nb, A: na})
		}
	}
	return dst
}

func premultiply(src image.Image) image.Image {
	b := src.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), src, b.Min, draw.Src)
	return dst
}

func unpremultiply(src image.Image) image.Image {
	b := src.Bounds()
	dst := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), src, b.Min, draw.Src)
	return dst
}

func flatten(src image.Image) image.Image {
	b := src.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), image.Black, image.Point{}, draw.Src)
	draw.Draw(dst, dst.Bounds(), src, b.Min, draw.Over)
	return dst
}

func quantize(src image.Image, cfg model.CompressConfig) image.Image {
	n := cfg.PaletteColors
	if n <= 0 {
		n = 256
	}
	if n > 256 {
		n = 256
	}
	pal := medianCutPalette(src, n)
	b := src.Bounds()
	dst := image.NewPaletted(image.Rect(0, 0, b.Dx(), b.Dy()), pal)
	if cfg.Dithering <= 0 {
		for y := 0; y < b.Dy(); y++ {
			for x := 0; x < b.Dx(); x++ {
				dst.Set(x, y, nearest(pal, src.At(b.Min.X+x, b.Min.Y+y)))
			}
		}
		return dst
	}
	// Floyd-Steinberg error diffusion on 8-bit channels.
	type errColor struct{ r, g, b float64 }
	errs := make([]errColor, b.Dx()+2)
	for y := 0; y < b.Dy(); y++ {
		next := make([]errColor, b.Dx()+2)
		for x := 0; x < b.Dx(); x++ {
			r, g, bb, _ := src.At(b.Min.X+x, b.Min.Y+y).RGBA()
			cr := float64(r>>8) + errs[x+1].r
			cg := float64(g>>8) + errs[x+1].g
			cb := float64(bb>>8) + errs[x+1].b
			c := nearestRGB(pal, cr, cg, cb)
			dst.Set(x, y, c)
			pr, pg, pb, _ := c.RGBA()
			dr := cr - float64(pr>>8)
			dg := cg - float64(pg>>8)
			db := cb - float64(pb>>8)
			add := func(i int, f float64) {
				next[i].r += dr * f
				next[i].g += dg * f
				next[i].b += db * f
			}
			add(x+2, 7.0/16) // right
			if x > 0 {
				add(x, 3.0/16) // left, next row
			}
			add(x+1, 5.0/16) // down
			add(x+2, 1.0/16) // right, next row
		}
		errs = next
	}
	return dst
}

func medianCutPalette(src image.Image, n int) color.Palette {
	b := src.Bounds()
	const maxSamples = 100_000
	step := max(1, (b.Dx()*b.Dy())/maxSamples)
	var pixels []color.RGBA
	for y := 0; y < b.Dy(); y++ {
		for x := 0; x < b.Dx(); x += step {
			r, g, bl, a := src.At(b.Min.X+x, b.Min.Y+y).RGBA()
			pixels = append(pixels, color.RGBA{uint8(r >> 8), uint8(g >> 8), uint8(bl >> 8), uint8(a >> 8)})
		}
	}
	if len(pixels) == 0 {
		return color.Palette{color.Black}
	}
	boxes := [][]color.RGBA{pixels}
	for len(boxes) < n {
		best := -1
		bestRange := 0
		for i, box := range boxes {
			if len(box) < 2 {
				continue
			}
			r := boxRange(box)
			if r > bestRange {
				best, bestRange = i, r
			}
		}
		if best < 0 {
			break
		}
		box := boxes[best]
		ch := boxChannel(box)
		sort.Slice(box, func(i, j int) bool {
			return channelValue(box[i], ch) < channelValue(box[j], ch)
		})
		mid := len(box) / 2
		boxes = append(boxes[:best], append([][]color.RGBA{box[:mid], box[mid:]}, boxes[best+1:]...)...)
	}
	pal := make(color.Palette, 0, len(boxes))
	for _, box := range boxes {
		var r, g, b, a uint64
		for _, p := range box {
			r += uint64(p.R)
			g += uint64(p.G)
			b += uint64(p.B)
			a += uint64(p.A)
		}
		l := uint64(len(box))
		pal = append(pal, color.RGBA{uint8(r / l), uint8(g / l), uint8(b / l), uint8(a / l)})
	}
	return pal
}

func boxRange(box []color.RGBA) int {
	return max3(channelRange(box, 0), channelRange(box, 1), channelRange(box, 2))
}

func boxChannel(box []color.RGBA) int {
	r0, r1 := channelRange(box, 0), channelRange(box, 1)
	b := channelRange(box, 2)
	if r0 >= r1 && r0 >= b {
		return 0
	}
	if r1 >= b {
		return 1
	}
	return 2
}

func channelRange(box []color.RGBA, ch int) int {
	lo, hi := 255, 0
	for _, p := range box {
		v := channelValue(p, ch)
		lo = min(lo, v)
		hi = max(hi, v)
	}
	return hi - lo
}

func channelValue(p color.RGBA, ch int) int {
	switch ch {
	case 0:
		return int(p.R)
	case 1:
		return int(p.G)
	default:
		return int(p.B)
	}
}

func nearest(pal color.Palette, c color.Color) color.Color {
	r, g, b, _ := c.RGBA()
	return nearestRGB(pal, float64(r>>8), float64(g>>8), float64(b>>8))
}

func nearestRGB(pal color.Palette, r, g, b float64) color.Color {
	best := pal[0]
	bestD := math.MaxFloat64
	for _, p := range pal {
		pr, pg, pb, _ := p.RGBA()
		dr, dg, db := r-float64(pr>>8), g-float64(pg>>8), b-float64(pb>>8)
		d := dr*dr + dg*dg + db*db
		if d < bestD {
			bestD, best = d, p
		}
	}
	return best
}

func applyOrientation(src image.Image, orientation int) image.Image {
	if orientation <= 1 || orientation > 8 {
		return src
	}
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if orientation >= 5 {
		w, h = h, w
	}
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < b.Dy(); y++ {
		for x := 0; x < b.Dx(); x++ {
			var dx, dy int
			switch orientation {
			case 2:
				dx, dy = w-1-x, y
			case 3:
				dx, dy = w-1-x, h-1-y
			case 4:
				dx, dy = x, h-1-y
			case 5:
				dx, dy = y, x
			case 6:
				dx, dy = h-1-y, x
			case 7:
				dx, dy = h-1-y, w-1-x
			case 8:
				dx, dy = y, w-1-x
			default:
				dx, dy = x, y
			}
			dst.Set(dx, dy, src.At(b.Min.X+x, b.Min.Y+y))
		}
	}
	return dst
}

func jpegOrientation(data []byte) int {
	x, err := exif.Decode(bytes.NewReader(data))
	if err != nil {
		return 1
	}
	tag, err := x.Get(exif.Orientation)
	if err != nil {
		return 1
	}
	v, err := tag.Int(0)
	if err != nil {
		return 1
	}
	return v
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func max3(a, b, c int) int { return max(a, max(b, c)) }
