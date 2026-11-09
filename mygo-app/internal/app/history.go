package app

import (
	"context"
	"strings"

	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
)

const historyPageSize = 10

func (a *App) historyPageView(c *ui.Context) {
	t := c.Theme()
	a.pageHeader(c, a.tr("上传历史", "Upload history"), a.tr("最近 100 条上传记录。", "The last 100 uploads."))
	ui.Box(c).Height(12)
	ui.Row(c).Gap(10).AlignItems(ui.Center).Children(func() {
		if ui.SearchField(c, &a.historySearch).Label(a.tr("搜索文件名", "Search file names")).Grow(1).Changed() {
			a.historyPage = 1
		}
		if ui.Button(c, a.tr("刷新", "Refresh")).Tooltip("⌘R").Clicked() {
			a.Refresh()
			a.pushInfo(a.tr("已刷新", "Refreshed"))
		}
		if ui.Button(c, a.tr("清空", "Clear")).Clicked() {
			a.ask(a.tr("清空上传历史？", "Clear upload history?"),
				a.tr("这会删除全部上传记录，但不会删除图床上的图片。", "This removes every upload record, not the images on the storage."),
				func() {
					if err := a.svc.ClearHistory(); err != nil {
						a.pushError(err.Error())
						return
					}
					a.loadHistory()
					a.pushToast(a.tr("上传历史已清空", "Upload history cleared"))
				})
		}
	})
	ui.Box(c).Height(10)

	filtered := a.filteredHistory()
	pages := (len(filtered) + historyPageSize - 1) / historyPageSize
	if pages < 1 {
		pages = 1
	}
	if a.historyPage > pages {
		a.historyPage = pages
	}
	if a.historyPage < 1 {
		a.historyPage = 1
	}
	start := (a.historyPage - 1) * historyPageSize
	end := min(start+historyPageSize, len(filtered))
	var page []model.UploadRecord
	if start < len(filtered) {
		page = filtered[start:end]
	}
	a.historyTable(c, page, false)
	if pages > 1 {
		ui.Box(c).Height(10)
		ui.Row(c).Gap(8).Justify(ui.Center).AlignItems(ui.Center).Children(func() {
			if ui.Button(c, "‹").Disabled(a.historyPage == 1).Clicked() {
				a.historyPage--
			}
			ui.Text(c, a.tr(
				"第 "+itoa(a.historyPage)+" / "+itoa(pages)+" 页",
				"Page "+itoa(a.historyPage)+" of "+itoa(pages),
			)).FontSize(12).TextColor(t.TextMuted)
			if ui.Button(c, "›").Disabled(a.historyPage == pages).Clicked() {
				a.historyPage++
			}
		})
	}
}

func (a *App) filteredHistory() []model.UploadRecord {
	q := strings.ToLower(strings.TrimSpace(a.historySearch))
	if q == "" {
		return a.history
	}
	out := make([]model.UploadRecord, 0, len(a.history))
	for _, rec := range a.history {
		if strings.Contains(strings.ToLower(rec.OriginalFilename), q) {
			out = append(out, rec)
		}
	}
	return out
}

func (a *App) historyTable(c *ui.Context, records []model.UploadRecord, compact bool) {
	t := c.Theme()
	if len(records) == 0 {
		ui.Column(c).Grow(1).Padding(32).AlignItems(ui.Center).Justify(ui.Center).Children(func() {
			ui.Text(c, a.tr("还没有上传记录", "No uploads yet")).FontSize(16).Bold()
			ui.Text(c, a.tr("上传图片后，记录会出现在这里。", "Upload an image and it will show up here.")).FontSize(13).TextColor(t.TextMuted)
		})
		return
	}
	actionWidth := float32(96)
	if !compact {
		actionWidth = 168
	}
	cols := []ui.TableColumn{
		{Title: "", Width: 52, Fixed: true},
		{Title: a.tr("文件名", "Name")},
		{Title: a.tr("大小", "Size"), Width: 92, Align: ui.End},
		{Title: a.tr("时间", "Time"), Width: 150},
		{Title: a.tr("操作", "Actions"), Width: actionWidth, Align: ui.End},
	}
	a.historyState.Key = func(i int) any { return records[i].ID }
	a.historyState.Label = func(i int) string { return records[i].OriginalFilename }
	tableCtx := c.Key("history-table-" + itoa(a.historyVersion))
	ui.Table(tableCtx, &a.historyState, cols, len(records), func(row, col int) {
		rec := records[row]
		switch col {
		case 0:
			btn := ui.Button(c.Key(rec.ID+":thumb"), "").Label(a.tr("预览", "Preview")).Padding(0).Width(40).Height(40)
			btn.Children(func() { a.thumb(c, rec.URL, 36) })
			if btn.Clicked() {
				a.preview = &rec
				a.previewOpen = true
			}
		case 1:
			ui.Text(c, rec.OriginalFilename).SingleLine().Tooltip(rec.URL)
		case 2:
			ui.Text(c, formatSize(int64(rec.FileSize))).TextColor(t.TextMuted)
		case 3:
			ui.Text(c, formatTime(rec.UploadTime)).TextColor(t.TextMuted)
		case 4:
			ui.Row(c).Gap(4).Justify(ui.End).Children(func() {
				if ui.Button(c.Key(rec.ID+":copy"), a.tr("复制", "Copy")).Clicked() {
					a.svc.CopyText(rec.URL)
					a.pushToast(a.tr("链接已复制", "Link copied"))
				}
				if !compact {
					if ui.Button(c.Key(rec.ID+":open"), a.tr("打开", "Open")).Clicked() {
						a.svc.OpenURL(rec.URL)
					}
					if ui.Button(c.Key(rec.ID+":del"), a.tr("删除", "Delete")).Clicked() {
						a.ask(a.tr("删除这条记录？", "Delete this record?"), rec.OriginalFilename, func() {
							if err := a.svc.DeleteRecord(rec.ID); err != nil {
								a.pushError(err.Error())
								return
							}
							a.loadHistory()
						})
					}
				}
			})
		}
	}).Grow(1).Label(a.tr("上传记录", "Uploads"))
	a.previewModal(c)
}

func (a *App) thumb(c *ui.Context, url string, size float32) {
	var src ui.ImageSource
	if a.thumbs != nil {
		src = a.thumbs.Get(url)
	}
	if src == nil {
		ui.Box(c).Size(size, size).Radius(4).Background(c.Theme().Surface).Border(1, c.Theme().Border)
		return
	}
	ui.Image(c, src).Size(size, size).Fit(ui.Cover).Radius(4)
}

func (a *App) previewModal(c *ui.Context) {
	if !a.previewOpen || a.preview == nil {
		return
	}
	rec := a.preview
	t := c.Theme()
	ui.Modal(c, &a.previewOpen, func() {
		ui.Column(c).Gap(10).Children(func() {
			ui.Text(c, rec.OriginalFilename).FontSize(18).Bold().SingleLine()
			ui.Text(c, formatSize(int64(rec.FileSize))+" · "+formatTime(rec.UploadTime)).FontSize(12).TextColor(t.TextMuted)
			ui.Box(c).Height(360).Width(620).Background(t.Surface).Radius(8).Children(func() {
				if a.thumbs != nil {
					if src := a.thumbs.Get(rec.URL); src != nil {
						ui.Image(c, src).Fill().Fit(ui.Contain)
					} else {
						ui.Column(c).Fill().AlignItems(ui.Center).Justify(ui.Center).Children(func() {
							ui.Text(c, a.tr("图片加载中…", "Loading image…")).TextColor(t.TextMuted)
						})
					}
				}
			})
			ui.Text(c, rec.URL).FontSize(12).TextColor(t.TextMuted).SingleLine().Tooltip(rec.URL)
			ui.Row(c).Gap(8).Justify(ui.End).Children(func() {
				if ui.Button(c, a.tr("复制链接", "Copy link")).Clicked() {
					a.svc.CopyText(rec.URL)
					a.pushToast(a.tr("链接已复制", "Link copied"))
				}
				if ui.Button(c, a.tr("浏览器打开", "Open in browser")).Clicked() {
					a.svc.OpenURL(rec.URL)
				}
				if ui.PrimaryButton(c, a.tr("保存图片", "Save image")).Clicked() {
					go a.download(rec.URL, rec.OriginalFilename)
				}
				if ui.Button(c, a.tr("关闭", "Close")).Clicked() {
					a.previewOpen = false
				}
			})
		})
	})
}

func (a *App) download(url, name string) {
	data, err := a.svc.Download(context.Background(), url)
	if err != nil {
		a.update(func() { a.pushError(err.Error()) })
		return
	}
	path, err := a.svc.SaveFile(imageName(name), data)
	a.update(func() {
		if err != nil {
			a.pushError(err.Error())
		} else if path != "" {
			a.pushToast(a.tr("已保存", "Saved"))
		}
	})
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
