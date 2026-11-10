package app

import (
	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/internal/model"
)

func (a *App) settingsView(c *ui.Context) {
	t := c.Theme()
	a.pageHeader(c, a.tr("设置", "Settings"), a.tr("语言、主题、本地 API 代理和存储提供方。", "Language, theme, local API proxy and storage providers."))
	ui.Box(c).Height(14)

	a.settingsCard(c, a.tr("外观与语言", "Appearance and language"), func() {
		langLabel := "中文"
		if a.lang == "en" {
			langLabel = "English"
		}
		if ui.Select(c, &langLabel, []string{"中文", "English"}).Label(a.tr("语言", "Language")).Changed() {
			if langLabel == "English" {
				a.setLanguage("en")
			} else {
				a.setLanguage("zh")
			}
		}
		themeLabels := []string{a.tr("跟随系统", "Follow system"), a.tr("浅色", "Light"), a.tr("深色", "Dark")}
		themeValues := []string{"system", "light", "dark"}
		themeLabel := themeLabels[0]
		for i, v := range themeValues {
			if v == a.theme {
				themeLabel = themeLabels[i]
			}
		}
		if ui.Select(c, &themeLabel, themeLabels).Label(a.tr("主题", "Theme")).Changed() {
			for i, label := range themeLabels {
				if label == themeLabel {
					a.setTheme(themeValues[i])
					break
				}
			}
		}
	})

	ui.Box(c).Height(12)
	a.settingsCard(c, a.tr("本地 API 代理", "Local API proxy"), func() {
		enabled := a.proxy.Enabled
		if switchRow(c, a.tr("启用代理", "Enable proxy"), &enabled) && !a.proxyBusy {
			port := uint16(a.proxyPort)
			go a.setProxy(enabled, port)
		}
		ui.Row(c).Gap(10).AlignItems(ui.End).Children(func() {
			port := a.proxyPort
			if ui.NumberInput(c, &port, 1, 65535, 1).
				Label(a.tr("端口", "Port")).Disabled(a.proxy.Running || a.proxyBusy).Changed() {
				a.proxyPort = port
				a.settings.APIProxyPort = uint16(port)
				go func() { _ = a.svc.SaveSettings(a.settings) }()
			}
			ui.Column(c).Gap(2).Children(func() {
				ui.Text(c, a.tr("端点", "Endpoint")).FontSize(11).TextColor(t.TextMuted)
				ui.Text(c, "http://127.0.0.1:"+itoa(int(a.proxyPort))+"/upload").FontSize(12).TextColor(t.Accent)
			})
		})
		status := a.tr("已停止", "Stopped")
		if a.proxy.Running {
			status = a.tr("运行中", "Running")
		}
		if a.proxyBusy {
			status = a.tr("处理中…", "Working…")
		}
		ui.Text(c, a.tr("状态：", "Status: ")+status).FontSize(12).TextColor(t.TextMuted)
		if a.proxyErr != "" {
			ui.Text(c, a.proxyErr).FontSize(12).TextColor(t.Danger)
		}
		ui.Text(c, a.tr("仅监听 127.0.0.1，其他工具可向该端点 POST multipart 文件。", "Listens on 127.0.0.1 only; other tools can POST a multipart file to this endpoint.")).FontSize(12).TextColor(t.TextMuted)
	})

	ui.Box(c).Height(12)
	ui.Row(c).AlignItems(ui.Center).Children(func() {
		ui.Text(c, a.tr("存储提供方", "Storage providers")).FontSize(16).Bold().Grow(1)
		if ui.PrimaryButton(c, a.tr("添加配置", "Add config")).Clicked() {
			a.editing = model.NewStorageConfig(model.CloudflareR2)
			a.editingNew = true
			a.configErr = ""
			a.configOpen = true
		}
	})
	ui.Box(c).Height(8)
	if len(a.configs.Configs) == 0 {
		ui.Column(c).Padding(24).Radius(10).Background(t.Surface).AlignItems(ui.Center).Children(func() {
			ui.Text(c, a.tr("还没有存储配置", "No storage configuration")).Bold()
			ui.Text(c, a.tr("添加一个 Cloudflare R2、S3、Imgur、GitHub 等提供方。", "Add Cloudflare R2, S3, Imgur, GitHub or another provider.")).FontSize(12).TextColor(t.TextMuted)
		})
	} else {
		for _, cfg := range a.configs.Configs {
			cfg := cfg
			active := cfg.ID == a.configs.ActiveID
			ui.Row(c).Gap(10).Padding(12).Radius(10).Background(t.Surface).
				Border(1, t.Border).AlignItems(ui.Center).Children(func() {
				ui.Column(c).Gap(2).Grow(1).Children(func() {
					ui.Row(c).Gap(8).AlignItems(ui.Center).Children(func() {
						ui.Text(c, cfg.Name).Bold()
						if active {
							ui.Text(c, a.tr("当前", "Active")).FontSize(11).TextColor(t.Accent)
						}
					})
					ui.Text(c, cfg.Kind.Label()).FontSize(12).TextColor(t.TextMuted)
					if cfg.Endpoint != "" {
						ui.Text(c, cfg.Endpoint).FontSize(11).TextColor(t.TextMuted).SingleLine()
					}
				})
				if !active {
					if ui.Button(c.Key(cfg.ID+":activate"), a.tr("启用", "Activate")).Clicked() {
						go a.activateConfig(cfg.ID)
					}
				}
				if ui.Button(c.Key(cfg.ID+":edit"), a.tr("编辑", "Edit")).Clicked() {
					a.editing = cfg
					a.editingNew = false
					a.configErr = ""
					a.configOpen = true
				}
				if ui.Button(c.Key(cfg.ID+":delete"), a.tr("删除", "Delete")).Clicked() {
					a.ask(a.tr("删除这个配置？", "Delete this configuration?"), cfg.Name, func() {
						if _, err := a.svc.DeleteConfig(cfg.ID); err != nil {
							a.pushError(err.Error())
							return
						}
						a.loadConfigs()
						a.pushToast(a.tr("配置已删除", "Configuration deleted"))
					})
				}
			})
			ui.Box(c).Height(6)
		}
	}
	a.configModal(c)
}

func (a *App) settingsCard(c *ui.Context, title string, fn func()) {
	t := c.Theme()
	ui.Column(c).Gap(10).Padding(16).Radius(12).Background(t.Surface).Border(1, t.Border).
		Shadow(0, 1, 4, 0, ui.RGBA(0, 0, 0, 0.06)).Children(func() {
		ui.Text(c, title).FontSize(15).Bold().LetterSpacing(-0.1)
		fn()
	})
}

func (a *App) setProxy(enabled bool, port uint16) {
	status, err := a.svc.SetProxy(enabled, port)
	a.update(func() {
		if err != nil {
			a.proxyErr = a.localizeError(err.Error())
			a.pushError(err.Error())
			return
		}
		a.proxyErr = ""
		a.proxy = status
		a.proxyPort = float64(status.Port)
		a.settings.APIProxyEnabled = status.Enabled
		a.settings.APIProxyPort = status.Port
		if status.Running {
			a.pushToast(a.tr("代理已启动", "Proxy started"))
		} else {
			a.pushToast(a.tr("代理已停止", "Proxy stopped"))
		}
	})
}

func (a *App) activateConfig(id string) {
	list, err := a.svc.SetActiveConfig(id)
	a.update(func() {
		if err != nil {
			a.pushError(err.Error())
			return
		}
		a.configs = list
		a.pushToast(a.tr("已切换存储配置", "Active storage changed"))
	})
}

func (a *App) configModal(c *ui.Context) {
	if !a.configOpen {
		return
	}
	t := c.Theme()
	ui.Modal(c, &a.configOpen, func() {
		ui.Column(c).Gap(10).Width(560).Children(func() {
			title := a.tr("编辑配置", "Edit configuration")
			if a.editingNew {
				title = a.tr("添加配置", "Add configuration")
			}
			ui.Text(c, title).FontSize(18).Bold()
			ui.Field(c, a.tr("名称", "Name"), func() {
				ui.TextInput(c, &a.editing.Name).Placeholder("My R2 / Production S3")
			})
			providerLabels := make([]string, 0)
			providerValues := make([]model.StorageProvider, 0)
			for _, group := range model.ProviderGroups {
				for _, p := range group.Providers {
					providerLabels = append(providerLabels, p.Label())
					providerValues = append(providerValues, p)
				}
			}
			current := a.editing.Kind.Label()
			if ui.Select(c, &current, providerLabels).Label(a.tr("提供方", "Provider")).Changed() {
				for i, label := range providerLabels {
					if label == current {
						a.editing.Kind = providerValues[i]
						break
					}
				}
			}
			ui.Scroll(c).Height(420).Children(func() {
				ui.Column(c).Gap(8).Children(func() {
					if a.editing.Kind.IsS3Compatible() {
						a.textField(c, &a.editing.AccessKeyID, "Access Key ID", "", false)
						a.textField(c, &a.editing.SecretAccessKey, "Secret Access Key", "", true)
						a.textField(c, &a.editing.Endpoint, "Endpoint", model.EndpointHints[a.editing.Kind], false)
						a.textField(c, &a.editing.BucketName, "Bucket Name", "", false)
						a.textField(c, &a.editing.PublicURLBase, "Public URL Base", "https://cdn.example.com", false)
						a.textField(c, &a.editing.Region, "Region", "auto / us-east-1", false)
						a.textField(c, &a.editing.PathPrefix, "Path Prefix", "images/ (optional)", false)
					} else {
						switch a.editing.Kind {
						case model.Imgur:
							a.textField(c, &a.editing.ImgurClientID, "Client ID", "Imgur Client ID", false)
						case model.SmMs:
							a.textField(c, &a.editing.SmmsAPIToken, "API Token", "SM.MS API Token", true)
						case model.GitHub:
							a.textField(c, &a.editing.GitHubToken, "Token", "ghp_xxxx", true)
							a.textField(c, &a.editing.GitHubOwner, "Owner", "your-username", false)
							a.textField(c, &a.editing.GitHubRepo, "Repo", "image-hosting", false)
							a.textField(c, &a.editing.GitHubBranch, "Branch", "main", false)
							a.textField(c, &a.editing.GitHubPath, "Path", "images", false)
							a.textField(c, &a.editing.GitHubCDNURL, "CDN URL", "https://cdn.jsdelivr.net/gh/owner/repo@branch/", false)
						case model.Upyun:
							a.textField(c, &a.editing.UpyunBucket, "Bucket", "service-name", false)
							a.textField(c, &a.editing.UpyunOperator, "Operator", "operator", false)
							a.textField(c, &a.editing.UpyunPassword, "Password", "password", true)
							a.textField(c, &a.editing.UpyunDomain, "Domain", "https://your-domain.com", false)
						}
					}
				})
			})
			if a.configErr != "" {
				ui.Text(c, a.configErr).FontSize(12).TextColor(t.Danger)
			}
			ui.Row(c).Gap(8).Justify(ui.End).Children(func() {
				if ui.Button(c, a.tr("取消", "Cancel")).Clicked() {
					a.configOpen = false
				}
				if ui.PrimaryButton(c, a.tr("保存", "Save")).Clicked() {
					if missing, ok := a.editing.Validate(); !ok {
						a.configErr = a.tr("请填写 ", "Please fill ") + missing
						return
					}
					if err := a.svc.SaveConfig(a.editing); err != nil {
						a.configErr = a.localizeError(err.Error())
						return
					}
					a.configOpen = false
					a.configErr = ""
					a.loadConfigs()
					a.pushToast(a.tr("配置已保存", "Configuration saved"))
				}
			})
		})
	})
}

func (a *App) textField(c *ui.Context, value *string, label, placeholder string, password bool) {
	ui.Field(c, label, func() {
		in := ui.TextInput(c, value).Placeholder(placeholder)
		if password {
			in.Password()
		}
	})
}
