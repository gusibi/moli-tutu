package app

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/internal/model"
)

func (a *App) uploadView(c *ui.Context) {
	t := c.Theme()
	if c.Shortcut(ui.Cmd, ui.KeyO) {
		go a.chooseImages()
	}
	if c.Shortcut(ui.Cmd|ui.Shift, ui.KeyV) {
		go a.pasteImage()
	}
	a.pageHeader(c, a.tr("图片上传", "Image upload"), a.tr("拖拽、选择、粘贴或输入图片链接，上传到当前启用的存储。", "Drop, pick, paste or enter an image URL. Uploads go to the active storage."))
	ui.Box(c).Height(8)

	if len(a.configs.Configs) == 0 {
		ui.Row(c).Gap(12).Padding(14).Radius(10).Background(t.Accent.Alpha(0.10)).Children(func() {
			ui.Text(c, a.tr("还没有配置存储提供方，先添加一个才能上传。", "No storage provider yet. Add one before uploading.")).Grow(1)
			if ui.PrimaryButton(c, a.tr("去设置", "Open settings")).Clicked() {
				a.page = pageSettings
			}
		})
	}

	zone := ui.Column(c).Height(190).Padding(24).Gap(12).Radius(12).Border(2, t.Border).
		AlignItems(ui.Center).Justify(ui.Center).
		Transition(ui.ElementTransition{Colors: true, Shadows: true, Duration: 160 * time.Millisecond})
	if files := zone.DroppedFiles(); files != nil {
		a.startUploadPaths(files)
	}
	if zone.FileDragOver() {
		zone.Border(2, t.Accent).Shadow(0, 8, 22, 0, ui.RGBA(0, 0, 0, 0.22))
	} else {
		zone.Shadow(0, 2, 10, 0, ui.RGBA(0, 0, 0, 0.08))
	}
	zone.Children(func() {
		ui.Text(c, a.tr("把图片拖到这里", "Drop images here")).FontSize(18).Bold()
		ui.Text(c, a.tr("或选择一个/多个文件，也可以直接粘贴截图", "Or choose one or more files, or paste a screenshot")).FontSize(13).TextColor(t.TextMuted)
		ui.Row(c).Gap(10).Children(func() {
			if ui.PrimaryButton(c, a.tr("选择图片", "Choose images")).Tooltip("⌘O").Clicked() {
				go a.chooseImages()
			}
			if ui.Button(c, a.tr("从剪贴板粘贴", "Paste from clipboard")).Tooltip("⇧⌘V").Clicked() {
				go a.pasteImage()
			}
		})
	})

	ui.Box(c).Height(12)
	ui.Row(c).Gap(10).AlignItems(ui.Center).Children(func() {
		input := ui.TextInput(c, &a.urlInput).Placeholder(a.tr("粘贴图片 URL，回车上传", "Paste an image URL and press Enter")).Grow(1).Label("Image URL")
		submit := ui.PrimaryButton(c, a.tr("上传链接", "Upload URL")).Disabled(strings.TrimSpace(a.urlInput) == "")
		if (input.Submitted() || submit.Clicked()) && strings.TrimSpace(a.urlInput) != "" {
			raw := a.urlInput
			a.urlInput = ""
			go a.uploadURL(raw)
		}
	})

	if len(a.uploads) > 0 {
		ui.Box(c).Height(12)
		ui.Column(c).Gap(4).Padding(10).Radius(8).Background(t.Surface).Children(func() {
			for i := range a.uploads {
				u := &a.uploads[i]
				row := ui.Row(c).Gap(8).AlignItems(ui.Center)
				ui.Text(c, u.Name).Grow(1).SingleLine()
				state := u.State
				color := t.TextMuted
				switch state {
				case "done":
					state, color = a.tr("完成", "Done"), t.Accent
				case "error":
					state, color = u.Error, t.Danger
				case "uploading":
					state = a.tr("上传中…", "Uploading…")
					if u.Total > 0 {
						state = itoa(int(u.Sent*100/u.Total)) + "%"
					}
				default:
					state = a.tr("等待", "Waiting")
				}
				ui.Text(c, formatSize(u.Size)).FontSize(11).TextColor(t.TextMuted)
				ui.Text(c, state).FontSize(12).TextColor(color)
				_ = row
			}
		})
	}

	ui.Box(c).Height(20)
	ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
		ui.Text(c, a.tr("最近上传", "Recent uploads")).FontSize(16).Bold().LetterSpacing(-0.2).Grow(1)
		if ui.Button(c, a.tr("刷新", "Refresh")).Tooltip("⌘R").Clicked() {
			a.Refresh()
			a.pushInfo(a.tr("已刷新", "Refreshed"))
		}
		if ui.Button(c, a.tr("查看全部", "View all")).Clicked() {
			a.page = pageHistory
		}
	})
	ui.Box(c).Height(8)
	recent := a.history
	if len(recent) > 10 {
		recent = recent[:10]
	}
	a.historyTable(c, recent, true)
}

func (a *App) chooseImages() {
	a.update(func() { a.pushInfo(a.tr("正在打开文件选择器…", "Opening the file picker…")) })
	paths, err := a.svc.PickImages()
	if err != nil || len(paths) == 0 {
		return
	}
	a.startUploadPaths(paths)
}

func (a *App) pasteImage() {
	a.update(func() { a.pushInfo(a.tr("正在读取剪贴板…", "Reading the clipboard…")) })
	data, err := a.svc.ReadClipboardImage()
	if err != nil || len(data) == 0 {
		a.update(func() { a.pushToast(a.tr("剪贴板里没有图片", "No image in the clipboard")) })
		return
	}
	a.startUploadBytes("clipboard.png", data)
}

func (a *App) uploadURL(raw string) {
	a.update(func() {
		a.uploads = append([]UploadStatus{{Name: raw, State: "uploading"}}, a.uploads...)
	})
	res, err := a.svc.UploadURL(context.Background(), raw)
	a.update(func() {
		a.finishStatus(raw, res, err)
		a.loadHistory()
		if res.Success {
			if res.FromCache {
				a.pushToast(a.tr("图片已存在，使用缓存链接", "Already uploaded; using the cached link"))
			} else {
				a.pushToast(a.tr("链接上传成功", "URL uploaded"))
			}
		}
	})
}

func (a *App) startUploadBytes(name string, data []byte) {
	a.update(func() {
		a.uploads = append([]UploadStatus{{Name: name, State: "uploading", Size: int64(len(data)), Total: int64(len(data))}}, a.uploads...)
	})
	go func() {
		res, err := a.svc.Upload(context.Background(), data, name, a.progressFunc(name))
		a.update(func() {
			a.finishStatus(name, res, err)
			a.loadHistory()
			if res.Success {
				if res.FromCache {
					a.pushToast(a.tr("图片已存在，使用缓存链接", "Already uploaded; using the cached link"))
				} else {
					a.pushToast(a.tr("上传成功", "Uploaded"))
				}
			}
		})
	}()
}

type pendingUpload struct {
	name string
	data []byte
}

func (a *App) startUploadPaths(paths []string) {
	paths = append([]string(nil), paths...)
	go func() {
		var pending []pendingUpload
		var skipped []string
		for _, p := range paths {
			name := filepath.Base(p)
			if !isImagePath(p) {
				skipped = append(skipped, name)
				continue
			}
			data, err := a.svc.ReadFile(p)
			if err != nil {
				skipped = append(skipped, name)
				continue
			}
			pending = append(pending, pendingUpload{name: name, data: data})
		}
		if len(skipped) > 0 {
			a.update(func() {
				for _, name := range skipped {
					a.uploads = append([]UploadStatus{{Name: name, State: "error", Error: a.tr("不支持的图片或无法读取", "Unsupported image or unreadable file")}}, a.uploads...)
				}
			})
		}
		if len(pending) == 0 {
			if len(skipped) > 0 {
				a.update(func() { a.pushToast(a.tr("有文件被跳过", "Some files were skipped")) })
			}
			return
		}
		a.update(func() {
			for _, p := range pending {
				a.uploads = append([]UploadStatus{{Name: p.name, State: "waiting", Size: int64(len(p.data)), Total: int64(len(p.data))}}, a.uploads...)
			}
			a.uploadBusy = true
		})
		sem := make(chan struct{}, 3)
		var wg sync.WaitGroup
		for _, p := range pending {
			p := p
			wg.Add(1)
			sem <- struct{}{}
			go func() {
				defer wg.Done()
				defer func() { <-sem }()
				a.update(func() { a.setStatus(p.name, "uploading", "") })
				res, err := a.svc.Upload(context.Background(), p.data, p.name, a.progressFunc(p.name))
				a.update(func() {
					a.finishStatus(p.name, res, err)
					a.loadHistory()
				})
			}()
		}
		wg.Wait()
		a.update(func() {
			a.uploadBusy = false
			a.loadHistory()
			a.pushToast(a.tr("批量上传完成", "Batch upload finished"))
		})
	}()
}

func (a *App) setStatus(name, state, msg string) {
	for i := range a.uploads {
		if a.uploads[i].Name == name {
			a.uploads[i].State = state
			a.uploads[i].Error = msg
			return
		}
	}
}

func (a *App) progressFunc(name string) func(sent, total int64) {
	last := time.Time{}
	return func(sent, total int64) {
		if total > 0 && sent < total && time.Since(last) < 120*time.Millisecond {
			return
		}
		last = time.Now()
		a.update(func() { a.setProgress(name, sent, total) })
	}
}

func (a *App) setProgress(name string, sent, total int64) {
	for i := range a.uploads {
		if a.uploads[i].Name == name {
			a.uploads[i].Sent = sent
			a.uploads[i].Total = total
			return
		}
	}
}

func (a *App) finishStatus(name string, res model.UploadResult, err error) {
	state, msg := "done", ""
	if err != nil {
		state, msg = "error", a.localizeError(err.Error())
	} else if !res.Success {
		state, msg = "error", a.localizeError(res.Error)
	}
	a.setStatus(name, state, msg)
}

func isImagePath(p string) bool {
	switch strings.ToLower(filepath.Ext(p)) {
	case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg":
		return true
	}
	return false
}
