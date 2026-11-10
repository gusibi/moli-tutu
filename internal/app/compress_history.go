package app

import (
	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/internal/model"
)

func (a *App) compressHistoryView(c *ui.Context) {
	t := c.Theme()
	a.pageHeader(c, a.tr("压缩历史", "Compression history"), a.tr("最近 10 条压缩记录，文件保存在应用数据目录。", "The last 10 compressions, kept in the app data directory."))
	ui.Box(c).Height(12)
	ui.Row(c).AlignItems(ui.Center).Children(func() {
		ui.Text(c, a.tr("记录", "Records")).FontSize(15).Bold().Grow(1)
		if ui.Button(c, a.tr("清空", "Clear")).Clicked() {
			a.ask(a.tr("清空压缩历史？", "Clear compression history?"),
				a.tr("这会删除全部压缩记录和对应的本地文件。", "This removes every record and its local files."),
				func() {
					if err := a.svc.ClearCompressHistory(); err != nil {
						a.pushError(err.Error())
						return
					}
					a.loadCompressHistory()
					a.pushToast(a.tr("压缩历史已清空", "Compression history cleared"))
				})
		}
	})
	ui.Box(c).Height(8)
	if len(a.compressHistory) == 0 {
		ui.Column(c).Grow(1).Padding(32).AlignItems(ui.Center).Justify(ui.Center).Children(func() {
			ui.Text(c, a.tr("还没有压缩记录", "No compressions yet")).FontSize(16).Bold()
			ui.Text(c, a.tr("压缩一张图片后，记录会出现在这里。", "Compress an image and it will show up here.")).FontSize(13).TextColor(t.TextMuted)
		})
		return
	}
	cols := []ui.TableColumn{
		{Title: a.tr("文件名", "Name")},
		{Title: a.tr("原始", "Original"), Width: 92, Align: ui.End},
		{Title: a.tr("压缩后", "Compressed"), Width: 96, Align: ui.End},
		{Title: a.tr("节省", "Saved"), Width: 80, Align: ui.End},
		{Title: a.tr("时间", "Time"), Width: 150},
		{Title: a.tr("操作", "Actions"), Width: 190, Align: ui.End},
	}
	a.compressHistoryState.Key = func(i int) any { return a.compressHistory[i].ID }
	a.compressHistoryState.Label = func(i int) string { return a.compressHistory[i].OriginalName }
	ui.Table(c, &a.compressHistoryState, cols, len(a.compressHistory), func(row, col int) {
		rec := a.compressHistory[row]
		switch col {
		case 0:
			ui.Text(c, rec.OriginalName).SingleLine()
		case 1:
			ui.Text(c, formatSize(rec.OriginalSize)).TextColor(t.TextMuted)
		case 2:
			ui.Text(c, formatSize(rec.CompressedSize)).TextColor(t.TextMuted)
		case 3:
			ui.Text(c, ratioText(rec.CompressionRatio)).TextColor(t.Accent)
		case 4:
			ui.Text(c, formatTime(rec.CompressTime)).TextColor(t.TextMuted)
		case 5:
			ui.Row(c).Gap(4).Justify(ui.End).Children(func() {
				if ui.Button(c.Key(rec.ID+":preview"), a.tr("预览", "Preview")).Clicked() {
					a.loadCompressPreview(rec)
				}
				if ui.Button(c.Key(rec.ID+":restore"), a.tr("恢复", "Restore")).Clicked() {
					a.restoreCompress(rec)
				}
				if ui.Button(c.Key(rec.ID+":delete"), a.tr("删除", "Delete")).Clicked() {
					a.ask(a.tr("删除这条压缩记录？", "Delete this compression?"), rec.OriginalName, func() {
						if err := a.svc.DeleteCompressRecord(rec.ID); err != nil {
							a.pushError(err.Error())
							return
						}
						a.loadCompressHistory()
					})
				}
			})
		}
	}).Grow(1).Label(a.tr("压缩记录", "Compressions"))
	a.compressPreviewModal(c)
}

func (a *App) loadCompressPreview(rec model.CompressRecord) {
	go func() {
		original, compressed, err := a.svc.ReadCompress(rec)
		a.update(func() {
			if err != nil {
				a.pushError(err.Error())
				return
			}
			ob, _ := ui.DecodeBitmap(original)
			cb, _ := ui.DecodeBitmap(compressed)
			a.compPreview = &rec
			a.compPreviewOrig = ob
			a.compPreviewComp = cb
			a.compPreviewOpen = true
		})
	}()
}

func (a *App) restoreCompress(rec model.CompressRecord) {
	go func() {
		original, compressed, err := a.svc.ReadCompress(rec)
		a.update(func() {
			if err != nil {
				a.pushError(err.Error())
				return
			}
			a.compGen++
			a.compOriginal = original
			a.compName = rec.OriginalName
			a.compSource = rec.SourceType
			a.compCfg = rec.Config
			a.compResult = &model.CompressResult{
				Data:             compressed,
				OriginalSize:     rec.OriginalSize,
				CompressedSize:   rec.CompressedSize,
				CompressionRatio: rec.CompressionRatio,
				Format:           formatForConfig(rec.Config.Format),
			}
			a.compOriginalBmp, _ = ui.DecodeBitmap(original)
			a.compResultBmp, _ = ui.DecodeBitmap(compressed)
			a.compWidth = float64(rec.Config.ResizeWidth)
			a.compHeight = float64(rec.Config.ResizeHeight)
			a.page = pageCompress
		})
	}()
}

func (a *App) compressPreviewModal(c *ui.Context) {
	if !a.compPreviewOpen || a.compPreview == nil {
		return
	}
	rec := a.compPreview
	t := c.Theme()
	ui.Modal(c, &a.compPreviewOpen, func() {
		ui.Column(c).Gap(10).Children(func() {
			ui.Text(c, rec.OriginalName).FontSize(18).Bold().SingleLine()
			ui.Text(c, formatSize(rec.OriginalSize)+" → "+formatSize(rec.CompressedSize)+" · "+ratioText(rec.CompressionRatio)).
				FontSize(12).TextColor(t.TextMuted)
			ui.Split(c, &a.compPreviewSplit, func() {
				a.previewPane(c, a.tr("原图", "Original"), a.compPreviewOrig)
			}, func() {
				a.previewPane(c, a.tr("压缩后", "Compressed"), a.compPreviewComp)
			}).Height(360).Width(700)
			ui.Row(c).Gap(8).Justify(ui.End).Children(func() {
				if ui.Button(c, a.tr("恢复编辑", "Restore")).Clicked() {
					a.compPreviewOpen = false
					a.restoreCompress(*rec)
				}
				if ui.PrimaryButton(c, a.tr("关闭", "Close")).Clicked() {
					a.compPreviewOpen = false
				}
			})
		})
	})
}

func formatForConfig(format string) string {
	switch format {
	case "oxipng":
		return "png"
	case "webp", "avif":
		return "webp"
	default:
		return "jpeg"
	}
}
