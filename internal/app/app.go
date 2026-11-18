// Package app is the native view of Moli TuTu.
package app

import (
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/internal/model"
	"github.com/gusibi/moli-tutu/internal/service"
	"github.com/gusibi/moli-tutu/internal/store"
)

const (
	pageUpload          = "upload"
	pageHistory         = "history"
	pageCompress        = "compress"
	pageCompressHistory = "compress-history"
	pageSettings        = "settings"
)

// UploadStatus is one file in the upload queue.
type UploadStatus struct {
	Name  string
	State string // "waiting", "uploading", "done", "error"
	Error string
	Size  int64
	Sent  int64
	Total int64
}

// App is the whole native UI state.
type App struct {
	svc service.Service
	win *mygo.Window

	lang     string
	theme    string
	page     string
	settings model.AppSettings
	configs  model.StorageConfigList
	history  []model.UploadRecord
	proxy    model.APIProxyStatus

	urlInput   string
	uploads    []UploadStatus
	uploadBusy bool

	historySearch  string
	historyPage    int
	historyState   ui.ListState
	historyVersion int
	preview        *model.UploadRecord
	previewOpen    bool

	compOriginal     []byte
	compName         string
	compSource       string
	compCfg          model.CompressConfig
	compResult       *model.CompressResult
	compBusy         bool
	compError        string
	compGen          uint64
	compSplit        float32
	compPreviewSplit float32
	compWidth        float64
	compHeight       float64
	compOriginalBmp  ui.ImageSource
	compResultBmp    ui.ImageSource

	compressHistory      []model.CompressRecord
	compressHistoryState ui.ListState
	compPreview          *model.CompressRecord
	compPreviewOpen      bool
	compPreviewOrig      ui.ImageSource
	compPreviewComp      ui.ImageSource

	configOpen bool
	editing    model.StorageConfig
	editingNew bool
	configErr  string
	proxyPort  float64
	proxyBusy  bool
	proxyErr   string

	confirmOpen    bool
	confirmTitle   string
	confirmMessage string
	confirmLabel   string
	confirmAction  func()

	thumbs          *ThumbCache
	toastMu         sync.Mutex
	toasts          []toastMsg
	migration       store.MigrationResult
	migrationNotice bool
}

type toastMsg struct {
	Text    string
	Type    string
	Timeout time.Duration
}

// New loads the initial state from the service.
func New(svc service.Service) *App {
	a := &App{
		svc:              svc,
		page:             pageUpload,
		settings:         svc.Settings(),
		proxy:            svc.ProxyStatus(),
		historyPage:      1,
		compSplit:        300,
		compPreviewSplit: 350,
		compCfg:          model.DefaultCompressConfig(),
		editing:          model.NewStorageConfig(model.CloudflareR2),
		proxyPort:        float64(svc.ProxyStatus().Port),
	}
	if a.settings.Theme == "" {
		a.settings.Theme = "system"
	}
	a.theme = a.settings.Theme
	a.lang = a.settings.Language
	if a.lang != "en" {
		a.lang = "zh"
	}
	a.loadConfigs()
	a.loadHistory()
	a.loadCompressHistory()
	return a
}

// ApplyPreferences applies the saved theme and locale before the window
// opens.
func (a *App) ApplyPreferences() {
	if !mygo.App.IsReady() {
		return
	}
	if a.settings.Language == "" {
		if strings.HasPrefix(mygo.App.Locale(), "zh") {
			a.lang = "zh"
		} else {
			a.lang = "en"
		}
	}
	applyTheme(a.theme)
	applyLocale(a.lang)
}

func applyTheme(theme string) {
	if !mygo.App.IsReady() {
		return
	}
	switch theme {
	case "light":
		mygo.Theme.SetSource(mygo.ThemeLight)
	case "dark":
		mygo.Theme.SetSource(mygo.ThemeDark)
	default:
		mygo.Theme.SetSource(mygo.ThemeSystem)
	}
}

func applyLocale(lang string) {
	if !mygo.App.IsReady() {
		return
	}
	if lang == "en" {
		mygo.App.SetLocale("en")
	} else {
		mygo.App.SetLocale("zh-Hans")
	}
}

// SetWindow attaches the window and its thumbnail cache.
func (a *App) SetWindow(w *mygo.Window) {
	a.win = w
	a.thumbs = NewThumbCache(w, a.svc.Thumbnail)
}

func (a *App) loadConfigs() {
	list, err := a.svc.Configs()
	if err != nil {
		log.Printf("load configs: %v", err)
		return
	}
	a.configs = list
}

func (a *App) loadHistory() {
	h, err := a.svc.History()
	if err != nil {
		log.Printf("load history: %v", err)
		return
	}
	changed := len(h) != len(a.history)
	if !changed {
		for i := range h {
			if h[i].ID != a.history[i].ID || h[i].UploadTime != a.history[i].UploadTime {
				changed = true
				break
			}
		}
	}
	a.history = h
	if changed {
		a.historyVersion++
		a.historyState = ui.ListState{}
	}
}

// Refresh reloads data that another window, the proxy or an external tool
// may have changed.
func (a *App) Refresh() {
	a.loadHistory()
	a.loadConfigs()
	a.proxy = a.svc.ProxyStatus()
}

func (a *App) loadCompressHistory() {
	h, err := a.svc.CompressHistory()
	if err != nil {
		log.Printf("load compress history: %v", err)
		return
	}
	a.compressHistory = h
}

func (a *App) loadProxy() {
	a.proxy = a.svc.ProxyStatus()
	a.proxyPort = float64(a.proxy.Port)
}

// tr returns the Chinese or English text.
func (a *App) tr(zh, en string) string {
	if a.lang == "en" {
		return en
	}
	return zh
}

func (a *App) update(fn func()) {
	if a.win == nil {
		fn()
		return
	}
	a.win.Update(fn)
}

func (a *App) pushToast(msg string) {
	a.toastMu.Lock()
	a.toasts = append(a.toasts, toastMsg{Text: msg})
	a.toastMu.Unlock()
}

func (a *App) pushInfo(msg string) {
	a.toastMu.Lock()
	a.toasts = append(a.toasts, toastMsg{Text: msg, Timeout: 2 * time.Second})
	a.toastMu.Unlock()
}

func (a *App) pushError(msg string) {
	a.toastMu.Lock()
	a.toasts = append(a.toasts, toastMsg{Text: a.localizeError(msg), Type: "error"})
	a.toastMu.Unlock()
}

func (a *App) localizeError(msg string) string {
	if a.lang != "zh" {
		return msg
	}
	switch {
	case strings.Contains(msg, "Storage configuration not set"):
		return "尚未配置存储提供方，请先在设置中添加。"
	case strings.Contains(msg, "storage configuration not set"):
		return "尚未配置存储提供方，请先在设置中添加。"
	case strings.Contains(msg, "port must be between"):
		return "端口必须在 1 到 65535 之间。"
	case msg == "empty file":
		return "文件为空。"
	case msg == "no image in clipboard":
		return "剪贴板里没有图片。"
	case strings.Contains(msg, "unsupported image"):
		return "不支持的图片格式。"
	case strings.Contains(msg, "image is too large"):
		return "图片太大，无法处理。"
	}
	return msg
}

func (a *App) setLanguage(lang string) {
	a.lang = lang
	a.settings.Language = lang
	applyLocale(lang)
	_ = a.svc.SaveSettings(a.settings)
}

func (a *App) setTheme(theme string) {
	a.theme = theme
	a.settings.Theme = theme
	applyTheme(theme)
	_ = a.svc.SaveSettings(a.settings)
}

// View builds a frame.
func (a *App) View(c *ui.Context) {
	t := c.Theme()
	if c.Shortcut(ui.Cmd, ui.KeyR) {
		a.Refresh()
		a.pushInfo(a.tr("已刷新", "Refreshed"))
	}
	if a.migrationNotice {
		c.AddToast(ui.Toast{
			Title:       a.tr("已从旧版本迁移配置和上传历史", "Configuration and uploads migrated from the old app"),
			Description: a.tr("旧版压缩历史保存在旧版 WebView 中，不会自动迁移。", "Old compression history lives in the old WebView and was not migrated."),
			Timeout:     8 * time.Second,
		})
		a.migrationNotice = false
	}
	a.toastMu.Lock()
	toasts := a.toasts
	a.toasts = nil
	a.toastMu.Unlock()
	for _, msg := range toasts {
		c.AddToast(ui.Toast{Title: msg.Text, Type: msg.Type, Timeout: msg.Timeout})
	}
	prefs := c.Preferences()
	bg := t.Background
	if c.Vibrancy() && !prefs.ReduceTransparency {
		c.Root().Background(ui.Transparent)
		bg = ui.Transparent
	}
	dividerColor := t.Border.Alpha(0.35)
	if prefs.HighContrast {
		dividerColor = t.Border
	}
	ui.Row(c).Fill().AlignItems(ui.Stretch).Background(bg).Children(func() {
		a.sidebar(c)
		ui.Box(c).Width(1).Background(dividerColor)
		ui.Column(c).Grow(1).MinWidth(0).Background(t.Background).Children(func() {
			a.titlebar(c)
			page := ui.Column(c.Key(a.page)).Grow(1).Padding(24, 24).MinWidth(0)
			if prefs.ReduceMotion {
				page.Transition(ui.ElementTransition{
					Duration: 150 * time.Millisecond,
				})
			} else {
				page.Transition(ui.ElementTransition{
					Animation: &ui.Smooth,
					Enter:     &ui.Motion{Y: 6},
					Exit:      &ui.Motion{Y: -4},
				})
			}
			page.Children(func() {
				switch a.page {
				case pageHistory:
					a.historyPageView(c)
				case pageCompress:
					a.compressView(c)
				case pageCompressHistory:
					a.compressHistoryView(c)
				case pageSettings:
					a.settingsView(c)
				default:
					a.uploadView(c)
				}
			})
		})
	})
	a.confirmDialog(c)
}

func (a *App) sidebar(c *ui.Context) {
	t := c.Theme()
	prefs := c.Preferences()
	top := c.TitleBar().Height
	if top < 12 {
		top = 12
	}
	side := ui.Column(c).Width(220).Shrink(0)
	if c.Vibrancy() && !prefs.ReduceTransparency {
		// Enough tint to keep the sidebar readable while still showing the
		// desktop through the window's Liquid Glass.
		side.Background(t.Background.Alpha(0.55))
	} else {
		side.Background(t.Surface)
	}
	side.Children(func() {
		ui.Row(c).Height(top+12).Padding(0, 16).AlignItems(ui.End).DragWindow().Children(func() {
			ui.Text(c, "Moli TuTu").FontSize(18).Bold().LetterSpacing(-0.35).TextColor(t.Text)
		})
		navItems := []struct {
			id, label string
			icon      *ui.SVG
		}{
			{pageUpload, a.tr("图片上传", "Upload"), iconUpload},
			{pageHistory, a.tr("上传历史", "History"), iconHistory},
			{pageCompress, a.tr("图片压缩", "Compress"), iconZap},
			{pageCompressHistory, a.tr("压缩历史", "Compressed"), iconArchive},
		}
		ui.Box(c).Height(12)
		ui.Column(c).Grow(1).Padding(0, 10).Gap(4).Children(func() {
			for _, item := range navItems {
				a.sidebarNavItem(c, item.id, item.label, item.icon, prefs.ReduceMotion)
			}
		})
		ui.Column(c).Padding(10, 12).Gap(6).AlignItems(ui.Stretch).Children(func() {
			ui.Row(c).Gap(4).AlignItems(ui.Center).Children(func() {
				lang := a.tr("中文", "EN")
				langBtn := ui.ButtonBase(c).Grow(1).Padding(6, 8).Radius(7).Label(a.tr("切换语言", "Switch language")).
					Transition(ui.ElementTransition{Colors: true, Animation: &ui.Smooth})
				a.pressSpring(langBtn, langBtn.Pressed(), prefs.ReduceMotion)
				if langBtn.Hovered() {
					langBtn.Background(t.SurfaceHover.Alpha(0.45))
				}
				langBtn.Children(func() {
					ui.Row(c).Grow(1).Gap(5).Justify(ui.Center).AlignItems(ui.Center).Children(func() {
						ui.Icon(c, iconGlobe).FontSize(12).TextColor(t.Text)
						ui.Text(c, lang).FontSize(12).LetterSpacing(0.15).TextColor(t.Text)
					})
				})
				if langBtn.Clicked() {
					if a.lang == "zh" {
						a.setLanguage("en")
					} else {
						a.setLanguage("zh")
					}
				}
				themeIcon := iconMonitor
				switch a.theme {
				case "light":
					themeIcon = iconSun
				case "dark":
					themeIcon = iconMoon
				}
				themeLabel := map[string]string{
					"system": a.tr("系统", "System"),
					"light":  a.tr("浅色", "Light"),
					"dark":   a.tr("深色", "Dark"),
				}[a.theme]
				theme := ui.ButtonBase(c).Grow(1).Padding(6, 8).Radius(7).Label(a.tr("切换主题", "Switch theme")).
					Transition(ui.ElementTransition{Colors: true, Animation: &ui.Smooth})
				a.pressSpring(theme, theme.Pressed(), prefs.ReduceMotion)
				if theme.Hovered() {
					theme.Background(t.SurfaceHover.Alpha(0.45))
				}
				theme.Children(func() {
					ui.Row(c).Grow(1).Gap(5).Justify(ui.Center).AlignItems(ui.Center).Children(func() {
						ui.Icon(c, themeIcon).FontSize(12).TextColor(t.Text)
						ui.Text(c, themeLabel).FontSize(12).LetterSpacing(0.15).TextColor(t.Text)
					})
				})
				if theme.Clicked() {
					switch a.theme {
					case "system":
						a.setTheme("light")
					case "light":
						a.setTheme("dark")
					default:
						a.setTheme("system")
					}
				}
			})
			a.sidebarNavItem(c, pageSettings, a.tr("设置", "Settings"), iconSettings, prefs.ReduceMotion)
		})
	})
}

func (a *App) sidebarNavItem(c *ui.Context, id, label string, icon *ui.SVG, reduceMotion bool) {
	t := c.Theme()
	row := ui.ButtonBase(c.Key(id)).Padding(7, 10).Gap(10).Radius(8).Label(label).
		Transition(ui.ElementTransition{Colors: true, Animation: &ui.Smooth})
	a.pressSpring(row, row.Pressed(), reduceMotion)
	fg := t.Text
	active := a.page == id
	switch {
	case active:
		row.Background(t.Accent.Alpha(0.15))
		fg = t.Accent
	case row.Hovered():
		row.Background(t.SurfaceHover.Alpha(0.45))
	}
	row.Children(func() {
		ui.Icon(c, icon).FontSize(16).TextColor(fg)
		txt := ui.Text(c, label).FontSize(14).LetterSpacing(0.05).TextColor(fg).Grow(1)
		if active {
			txt.Bold()
		}
	})
	if row.Clicked() && !active {
		a.page = id
		a.Refresh()
	}
}

// pressSpring applies critically damped spring scale feedback on pointer-down.
func (a *App) pressSpring(e ui.Element, pressed, reduceMotion bool) {
	if reduceMotion {
		return
	}
	target := float32(1)
	if pressed {
		target = 0.975
	}
	scale := e.Spring("press", target, ui.SpringOptions{Duration: 140 * time.Millisecond})
	e.Scale(scale, scale)
}

// dropZone renders a unified drag-and-drop target with gesture-hinting feedback.
func (a *App) dropZone(c *ui.Context, height float32, title, subtitle, primaryLabel, primaryTip string, onPrimary func(), secondaryLabel, secondaryTip string, onSecondary func(), onDrop func([]string)) {
	t := c.Theme()
	prefs := c.Preferences()
	zone := ui.Column(c).Height(height).Padding(24).Gap(10).Radius(14).Border(1.5, t.Border).
		Background(t.Surface.Alpha(0.5)).
		AlignItems(ui.Center).Justify(ui.Center).
		Transition(ui.ElementTransition{Colors: true, Shadows: true, Animation: &ui.Smooth})
	if files := zone.DroppedFiles(); len(files) > 0 && onDrop != nil {
		onDrop(files)
	}
	dragOver := zone.FileDragOver()
	if !prefs.ReduceMotion {
		target := float32(1)
		if dragOver {
			target = 1.01
		}
		scale := zone.Spring("drag", target, ui.SpringOptions{Duration: 180 * time.Millisecond})
		zone.Scale(scale, scale)
	}
	if dragOver {
		zone.Border(2, t.Accent).Background(t.Accent.Alpha(0.07)).
			Shadow(0, 8, 24, 0, ui.RGBA(0, 0, 0, 0.18))
	} else {
		zone.Shadow(0, 2, 10, 0, ui.RGBA(0, 0, 0, 0.06))
	}
	zone.Children(func() {
		ui.Column(c).Size(44, 44).Radius(22).Background(t.Accent.Alpha(0.12)).
			AlignItems(ui.Center).Justify(ui.Center).Children(func() {
			ui.Icon(c, iconUpload).FontSize(20).TextColor(t.Accent)
		})
		ui.Text(c, title).FontSize(18).Bold().LetterSpacing(-0.25).LineHeight(1.2)
		ui.Text(c, subtitle).FontSize(13).LetterSpacing(0.05).TextColor(t.TextMuted)
		ui.Box(c).Height(2)
		ui.Row(c).Gap(10).Children(func() {
			if ui.PrimaryButton(c, primaryLabel).Tooltip(primaryTip).Clicked() && onPrimary != nil {
				onPrimary()
			}
			if ui.Button(c, secondaryLabel).Tooltip(secondaryTip).Clicked() && onSecondary != nil {
				onSecondary()
			}
		})
	})
}

func (a *App) titlebar(c *ui.Context) {
	ui.Row(c).Height(34).DragWindow()
}

func (a *App) pageTitle() string {
	switch a.page {
	case pageHistory:
		return a.tr("上传历史", "Upload history")
	case pageCompress:
		return a.tr("图片压缩", "Image compression")
	case pageCompressHistory:
		return a.tr("压缩历史", "Compression history")
	case pageSettings:
		return a.tr("设置", "Settings")
	default:
		return a.tr("图片上传", "Image upload")
	}
}

func switchRow(c *ui.Context, label string, value *bool) bool {
	changed := false
	ui.Row(c).AlignItems(ui.Center).Gap(8).Children(func() {
		ui.Text(c, label).Grow(1)
		if ui.Switch(c, value).Changed() {
			changed = true
		}
	})
	return changed
}

func (a *App) confirmDialog(c *ui.Context) {
	if !a.confirmOpen {
		return
	}
	confirm := a.confirmLabel
	if confirm == "" {
		confirm = a.tr("确定", "Confirm")
	}
	if ui.AlertDialog(c, &a.confirmOpen, a.confirmTitle, a.confirmMessage,
		a.tr("取消", "Cancel"), confirm) == 1 {
		if a.confirmAction != nil {
			a.confirmAction()
		}
	}
}

func (a *App) ask(title, message, confirmLabel string, action func()) {
	a.confirmTitle = title
	a.confirmMessage = message
	a.confirmLabel = confirmLabel
	a.confirmAction = action
	a.confirmOpen = true
}

func (a *App) pageHeader(c *ui.Context, title, subtitle string) {
	t := c.Theme()
	ui.Column(c).Gap(4).Children(func() {
		ui.Text(c, title).FontSize(24).Bold().LetterSpacing(-0.4).LineHeight(1.15)
		if subtitle != "" {
			ui.Text(c, subtitle).FontSize(13).LetterSpacing(0.1).LineHeight(1.4).TextColor(t.TextMuted)
		}
	})
}

func formatSize(n int64) string {
	if n <= 0 {
		return "0 B"
	}
	units := []string{"B", "KB", "MB", "GB"}
	f := float64(n)
	i := 0
	for f >= 1024 && i < len(units)-1 {
		f /= 1024
		i++
	}
	if i == 0 {
		return fmt.Sprintf("%.0f %s", f, units[i])
	}
	return fmt.Sprintf("%.1f %s", f, units[i])
}

func formatTime(ts int64) string {
	if ts <= 0 {
		return ""
	}
	return time.Unix(ts, 0).Format("2006-01-02 15:04")
}

func imageName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "image"
	}
	return filepath.Base(name)
}
