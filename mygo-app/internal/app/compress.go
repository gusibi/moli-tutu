package app

import (
	"context"
	"path/filepath"
	"strings"
	"time"

	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
)

var (
	formatLabels = []string{"JPEG", "PNG", "WebP", "AVIF (WebP)"}
	formatValues = []string{"mozjpeg", "oxipng", "webp", "avif"}
	presetLabels = []string{"100%", "75%", "50%", "25%", "custom"}
)

func (a *App) compressView(c *ui.Context) {
	t := c.Theme()
	if c.Shortcut(ui.Cmd, ui.KeyO) {
		go a.chooseCompressImage()
	}
	if c.Shortcut(ui.Cmd|ui.Shift, ui.KeyV) {
		go a.pasteCompressImage()
	}
	a.pageHeader(c, a.tr("图片压缩", "Image compression"), a.tr("在本地压缩、缩放并预览，再保存或直接上传。", "Compress, resize and compare locally, then save or upload."))
	ui.Box(c).Height(12)
	if len(a.compOriginal) == 0 {
		zone := ui.Column(c).Height(280).Padding(24).Gap(12).Radius(12).Border(2, t.Border).
			AlignItems(ui.Center).Justify(ui.Center)
		if files := zone.DroppedFiles(); files != nil && len(files) > 0 {
			go a.loadCompressPath(files[0], "drag")
		}
		if zone.FileDragOver() {
			zone.Border(2, t.Accent)
		}
		zone.Children(func() {
			ui.Text(c, a.tr("拖入一张图片开始压缩", "Drop an image to compress")).FontSize(18).Bold()
			ui.Text(c, a.tr("支持 JPEG、PNG、WebP、GIF、BMP", "JPEG, PNG, WebP, GIF and BMP are supported")).FontSize(13).TextColor(t.TextMuted)
			ui.Row(c).Gap(10).Children(func() {
				if ui.PrimaryButton(c, a.tr("选择图片", "Choose image")).Tooltip("⌘O").Clicked() {
					go a.chooseCompressImage()
				}
				if ui.Button(c, a.tr("从剪贴板粘贴", "Paste from clipboard")).Tooltip("⇧⌘V").Clicked() {
					go a.pasteCompressImage()
				}
			})
		})
		return
	}

	ui.Row(c).Gap(18).Fill().AlignItems(ui.Stretch).Children(func() {
		ui.Column(c).Width(320).Shrink(0).Children(func() {
			ui.Scroll(c).Grow(1).Children(func() {
				a.compressSettings(c)
			})
			ui.Box(c).Height(10)
			ui.Row(c).Gap(8).Children(func() {
				if ui.Button(c, a.tr("重来", "Reset")).Clicked() {
					a.resetCompress()
				}
				if ui.Button(c, a.tr("保存", "Save")).Disabled(a.compResult == nil).Clicked() {
					if res := a.compResult; res != nil {
						name, original, cfg, source := a.compName, a.compOriginal, a.compCfg, a.compSource
						go a.saveCompressed(res, name, original, cfg, source)
					}
				}
				if ui.PrimaryButton(c, a.tr("上传", "Upload")).Disabled(a.compResult == nil || a.compBusy).Clicked() {
					if res := a.compResult; res != nil {
						name, original, cfg, source := a.compName, a.compOriginal, a.compCfg, a.compSource
						go a.uploadCompressed(res, name, original, cfg, source)
					}
				}
			})
			if a.compBusy {
				ui.Box(c).Height(8)
				ui.Text(c, a.tr("压缩中…", "Compressing…")).FontSize(12).TextColor(t.Accent)
			}
			if a.compError != "" {
				ui.Box(c).Height(8)
				ui.Text(c, a.compError).FontSize(12).TextColor(t.Danger)
			}
		})

		ui.Column(c).Grow(1).MinWidth(0).Children(func() {
			ui.Split(c, &a.compSplit, func() {
				a.previewPane(c, a.tr("原图", "Original"), a.compOriginalBmp)
			}, func() {
				a.previewPane(c, a.tr("压缩后", "Compressed"), a.compResultBmp)
			}).Grow(1)
			ui.Box(c).Height(8)
			ui.Row(c).Gap(24).Children(func() {
				ui.Text(c, a.tr("原始大小", "Original")+": "+formatSize(int64(len(a.compOriginal)))).FontSize(12).TextColor(t.TextMuted)
				if a.compResult != nil {
					ui.Text(c, a.tr("压缩后", "Compressed")+": "+formatSize(a.compResult.CompressedSize)).FontSize(12).TextColor(t.TextMuted)
					ui.Text(c, a.tr("节省", "Saved")+": "+ratioText(a.compResult.CompressionRatio)).FontSize(12).TextColor(t.Accent)
					ui.Text(c, dimsText(a.compResult.Width, a.compResult.Height)).FontSize(12).TextColor(t.TextMuted)
				}
			})
		})
	})
}

func (a *App) previewPane(c *ui.Context, label string, src ui.ImageSource) {
	t := c.Theme()
	ui.Column(c).Fill().Background(t.Surface).Radius(8).Children(func() {
		ui.Row(c).Padding(10, 12).Children(func() {
			ui.Text(c, label).FontSize(12).Bold().TextColor(t.TextMuted)
		})
		if src != nil {
			ui.Image(c, src).Fill().Fit(ui.Contain)
		} else {
			ui.Column(c).Grow(1).AlignItems(ui.Center).Justify(ui.Center).Children(func() {
				ui.Text(c, a.tr("等待压缩…", "Waiting…")).TextColor(t.TextMuted)
			})
		}
	})
}

func (a *App) compressSettings(c *ui.Context) {
	t := c.Theme()
	ui.Column(c).Gap(10).Children(func() {
		ui.Text(c, a.tr("格式", "Format")).FontSize(13).Bold()
		label := formatLabels[0]
		for i, v := range formatValues {
			if v == a.compCfg.Format {
				label = formatLabels[i]
			}
		}
		if ui.Select(c, &label, formatLabels).Label(a.tr("输出格式", "Output format")).Changed() {
			for i, l := range formatLabels {
				if l == label {
					a.compCfg.Format = formatValues[i]
				}
			}
			a.scheduleCompress(false)
		}
		if a.compCfg.Format != "oxipng" {
			q := float64(a.compCfg.Quality)
			if ui.Slider(c, &q, 1, 100).Label(a.tr("质量", "Quality")).Changed() {
				a.compCfg.Quality = int(q)
				a.scheduleCompress(false)
			}
			ui.Text(c, itoa(a.compCfg.Quality)+"%").FontSize(12).TextColor(t.TextMuted)
		}
		ui.Text(c, a.tr("缩放", "Resize")).FontSize(13).Bold()
		preset := a.compCfg.ResizePreset
		if ui.Select(c, &preset, presetLabels).Label(a.tr("缩放预设", "Resize preset")).Changed() {
			a.compCfg.ResizePreset = preset
			a.compCfg.Resize = preset != "100%"
			a.scheduleCompress(false)
		}
		w, h := a.compWidth, a.compHeight
		row := ui.Row(c).Gap(8)
		row.Children(func() {
			if ui.NumberInput(c, &w, 1, 20000, 1).Label(a.tr("宽", "Width")).Disabled(a.compCfg.ResizePreset != "custom").Changed() {
				a.compWidth = w
				a.compCfg.ResizeWidth = int(w)
				a.compCfg.Resize = true
				a.scheduleCompress(false)
			}
			if ui.NumberInput(c, &h, 1, 20000, 1).Label(a.tr("高", "Height")).Disabled(a.compCfg.ResizePreset != "custom").Changed() {
				a.compHeight = h
				a.compCfg.ResizeHeight = int(h)
				a.compCfg.Resize = true
				a.scheduleCompress(false)
			}
		})
		if switchRow(c, a.tr("保持宽高比", "Keep aspect ratio"), &a.compCfg.MaintainAspectRatio) {
			a.scheduleCompress(false)
		}
		ui.Text(c, dimsText(int(a.compWidth), int(a.compHeight))).FontSize(12).TextColor(t.TextMuted)

		ui.Text(c, a.tr("高级", "Advanced")).FontSize(13).Bold()
		if switchRow(c, a.tr("预乘 Alpha", "Premultiply alpha"), &a.compCfg.PremultiplyAlpha) {
			a.scheduleCompress(false)
		}
		if switchRow(c, a.tr("线性 RGB", "Linear RGB"), &a.compCfg.LinearRGB) {
			a.scheduleCompress(false)
		}
		if a.compCfg.Format == "oxipng" {
			if switchRow(c, a.tr("减少调色板", "Reduce palette"), &a.compCfg.ReducePalette) {
				a.scheduleCompress(false)
			}
			if a.compCfg.ReducePalette {
				pc := float64(a.compCfg.PaletteColors)
				if ui.Slider(c, &pc, 2, 256).Label(a.tr("颜色数", "Colors")).Changed() {
					a.compCfg.PaletteColors = int(pc)
					a.scheduleCompress(false)
				}
				if ui.Slider(c, &a.compCfg.Dithering, 0, 1).Label(a.tr("抖动", "Dithering")).Changed() {
					a.scheduleCompress(false)
				}
			}
		}
		ui.Text(c, a.compName).FontSize(11).TextColor(t.TextMuted).SingleLine()
	})
}

func (a *App) chooseCompressImage() {
	a.update(func() { a.pushInfo(a.tr("正在打开文件选择器…", "Opening the file picker…")) })
	paths, err := a.svc.PickImages()
	if err != nil || len(paths) == 0 {
		return
	}
	a.loadCompressPath(paths[0], "file")
}

func (a *App) pasteCompressImage() {
	a.update(func() { a.pushInfo(a.tr("正在读取剪贴板…", "Reading the clipboard…")) })
	data, err := a.svc.ReadClipboardImage()
	if err != nil || len(data) == 0 {
		a.update(func() { a.pushToast(a.tr("剪贴板里没有图片", "No image in the clipboard")) })
		return
	}
	a.update(func() { a.loadCompressData(data, "clipboard.png", "clipboard") })
}

func (a *App) loadCompressPath(path, source string) {
	data, err := a.svc.ReadFile(path)
	if err != nil {
		a.update(func() { a.pushError(err.Error()) })
		return
	}
	a.update(func() { a.loadCompressData(data, filepath.Base(path), source) })
}

func (a *App) loadCompressData(data []byte, name, source string) {
	a.compGen++
	a.compOriginal = data
	a.compName = name
	a.compSource = source
	a.compResult = nil
	a.compResultBmp = nil
	a.compError = ""
	if bmp, err := ui.DecodeBitmap(data); err == nil {
		a.compOriginalBmp = bmp
		if w, h := ui.ImageSize(bmp); w > 0 && h > 0 {
			a.compWidth, a.compHeight = float64(w), float64(h)
			a.compCfg.ResizeWidth, a.compCfg.ResizeHeight = int(w), int(h)
		}
	}
	a.compCfg.Resize = a.compCfg.ResizePreset != "100%"
	a.scheduleCompress(true)
}

func (a *App) resetCompress() {
	a.compGen++
	a.compOriginal = nil
	a.compOriginalBmp = nil
	a.compResult = nil
	a.compResultBmp = nil
	a.compName = ""
	a.compError = ""
	a.compBusy = false
}

func (a *App) scheduleCompress(immediate bool) {
	if len(a.compOriginal) == 0 {
		return
	}
	a.compGen++
	gen := a.compGen
	data := a.compOriginal
	cfg := a.compCfg
	a.compBusy = true
	a.compError = ""
	delay := 250 * time.Millisecond
	if immediate {
		delay = 0
	}
	time.AfterFunc(delay, func() {
		res, err := a.svc.Compress(data, cfg)
		a.update(func() {
			if gen != a.compGen {
				return
			}
			a.compBusy = false
			if err != nil {
				a.compError = err.Error()
				return
			}
			a.compResult = &res
			if b, decErr := ui.DecodeBitmap(res.Data); decErr == nil {
				a.compResultBmp = b
			}
		})
	})
}

func (a *App) saveCompressed(res *model.CompressResult, originalName string, original []byte, cfg model.CompressConfig, source string) {
	if res == nil {
		return
	}
	ext := ".jpg"
	switch res.Format {
	case "png":
		ext = ".png"
	case "webp":
		ext = ".webp"
	}
	base := strings.TrimSuffix(originalName, filepath.Ext(originalName))
	name := base + "_compressed" + ext
	path, err := a.svc.SaveFile(name, res.Data)
	a.update(func() {
		if err != nil {
			a.pushError(err.Error())
		} else if path != "" {
			_, _ = a.svc.SaveCompressRecord(original, res.Data, originalName, cfg, res.CompressionRatio, source)
			a.loadCompressHistory()
			a.pushToast(a.tr("压缩图片已保存", "Compressed image saved"))
		}
	})
}

func (a *App) uploadCompressed(result *model.CompressResult, originalName string, original []byte, cfg model.CompressConfig, source string) {
	if result == nil {
		return
	}
	name := strings.TrimSuffix(originalName, filepath.Ext(originalName)) + "_compressed"
	switch result.Format {
	case "png":
		name += ".png"
	case "webp":
		name += ".webp"
	default:
		name += ".jpg"
	}
	res, err := a.svc.Upload(context.Background(), result.Data, name, nil)
	a.update(func() {
		if err != nil {
			a.pushError(err.Error())
			return
		}
		if !res.Success {
			a.pushError(res.Error)
			return
		}
		_, _ = a.svc.SaveCompressRecord(original, result.Data, originalName, cfg, result.CompressionRatio, source)
		a.loadHistory()
		a.loadCompressHistory()
		if res.FromCache {
			a.pushToast(a.tr("图片已存在，使用缓存链接", "Already uploaded; using the cached link"))
		} else {
			a.pushToast(a.tr("压缩图片已上传", "Compressed image uploaded"))
		}
	})
}

func ratioText(r float64) string {
	if r <= 0 {
		return "0%"
	}
	return "-" + itoa(int(r+0.5)) + "%"
}

func dimsText(w, h int) string {
	return itoa(w) + " × " + itoa(h)
}
