// Package app is the native view of Moli TuTu.
package app

import (
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"time"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/mygo-app/internal/model"
	"github.com/gusibi/moli-tutu/mygo-app/internal/service"
	"github.com/gusibi/moli-tutu/mygo-app/internal/store"
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

	historySearch string
	historyPage   int
	historyState  ui.ListState
	preview       *model.UploadRecord
	previewOpen   bool

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
	confirmAction  func()

	thumbs          *ThumbCache
	toasts          []toastMsg
	migration       store.MigrationResult
	migrationNotice bool
}

type toastMsg struct {
	Text string
	Type string
}

// New loads the initial state from the service.
func New(svc service.Service) *App {
	a := &App{
		svc:              svc,
		page:             pageUpload,
		settings:         svc.Settings(),
		proxy:            svc.ProxyStatus(),
		historyPage:      1,
		compSplit:        180,
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
	a.history = h
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
	a.toasts = append(a.toasts, toastMsg{Text: msg})
}

func (a *App) pushError(msg string) {
	a.toasts = append(a.toasts, toastMsg{Text: a.localizeError(msg), Type: "error"})
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
	if a.migrationNotice {
		c.AddToast(ui.Toast{
			Title:       a.tr("已从旧版本迁移配置和上传历史", "Configuration and uploads migrated from the old app"),
			Description: a.tr("旧版压缩历史保存在旧版 WebView 中，不会自动迁移。", "Old compression history lives in the old WebView and was not migrated."),
			Timeout:     8 * time.Second,
		})
		a.migrationNotice = false
	}
	for _, msg := range a.toasts {
		c.AddToast(ui.Toast{Title: msg.Text, Type: msg.Type})
	}
	a.toasts = nil
	ui.Row(c).Fill().AlignItems(ui.Stretch).Background(t.Background).Children(func() {
		a.sidebar(c)
		ui.Column(c).Grow(1).MinWidth(0).Children(func() {
			a.titlebar(c)
			ui.Column(c).Grow(1).Padding(24, 24).MinWidth(0).Children(func() {
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
	top := c.TitleBar().Height
	if top < 12 {
		top = 12
	}
	ui.Column(c).Width(220).Shrink(0).Background(t.Surface).Children(func() {
		ui.Row(c).Height(top+44).Padding(16, 16).AlignItems(ui.End).DragWindow().Children(func() {
			ui.Text(c, "Moli TuTu").FontSize(18).Bold()
		})
		ui.Sidebar(c, &a.page, func() {
			ui.SidebarItem(c, pageUpload, iconUpload, a.tr("图片上传", "Upload"))
			ui.SidebarItem(c, pageHistory, iconHistory, a.tr("上传历史", "History"))
			ui.SidebarItem(c, pageCompress, iconZap, a.tr("图片压缩", "Compress"))
			ui.SidebarItem(c, pageCompressHistory, iconHistory, a.tr("压缩历史", "Compressed"))
			ui.SidebarItem(c, pageSettings, iconSettings, a.tr("设置", "Settings"))
		}).Grow(1).Label("Navigation")
		ui.Column(c).Padding(12).Gap(6).Children(func() {
			if ui.Button(c, a.tr("中文 / English", "English / 中文")).Clicked() {
				if a.lang == "zh" {
					a.setLanguage("en")
				} else {
					a.setLanguage("zh")
				}
			}
			label := map[string]string{
				"system": a.tr("主题：跟随系统", "Theme: System"),
				"light":  a.tr("主题：浅色", "Theme: Light"),
				"dark":   a.tr("主题：深色", "Theme: Dark"),
			}[a.theme]
			if ui.Button(c, label).Clicked() {
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
	})
}

func (a *App) titlebar(c *ui.Context) {
	t := c.Theme()
	ui.Row(c).Height(34).Padding(0, 24).AlignItems(ui.Center).DragWindow().Children(func() {
		ui.Text(c, a.pageTitle()).FontSize(12).TextColor(t.TextMuted)
	})
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
	if ui.AlertDialog(c, &a.confirmOpen, a.confirmTitle, a.confirmMessage,
		a.tr("取消", "Cancel"), a.tr("确定", "Confirm")) == 1 {
		if a.confirmAction != nil {
			a.confirmAction()
		}
	}
}

func (a *App) ask(title, message string, action func()) {
	a.confirmTitle = title
	a.confirmMessage = message
	a.confirmAction = action
	a.confirmOpen = true
}

func (a *App) pageHeader(c *ui.Context, title, subtitle string) {
	t := c.Theme()
	ui.Column(c).Gap(4).Children(func() {
		ui.Text(c, title).FontSize(24).Bold()
		if subtitle != "" {
			ui.Text(c, subtitle).FontSize(13).TextColor(t.TextMuted)
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
