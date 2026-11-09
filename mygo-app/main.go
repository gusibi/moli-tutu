// Moli TuTu is a native image uploader and compressor. It draws its own
// interface with mygo's ui package: no webview, no HTML, no JavaScript.
package main

import (
	"log"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/ui"

	"github.com/gusibi/moli-tutu/mygo-app/internal/app"
	"github.com/gusibi/moli-tutu/mygo-app/internal/logging"
	"github.com/gusibi/moli-tutu/mygo-app/internal/service"
)

func main() {
	mygo.App.SetName("Moli TuTu")
	mygo.App.SetVersion("0.5.0")
	mygo.App.WhenReady(func() {
		dir, err := mygo.App.Path(mygo.PathUserData)
		if err != nil {
			log.Printf("user data directory: %v", err)
			return
		}
		if logs, err := mygo.App.Path(mygo.PathLogs); err == nil {
			if err := logging.Setup(logs); err != nil {
				log.Printf("log setup: %v", err)
			}
		}
		log.Printf("starting Moli TuTu %s", mygo.App.Version())
		svc, err := service.New(dir)
		if err != nil {
			log.Printf("open data: %v", err)
			mygo.Dialog.Error("Moli TuTu", "Could not open app data: "+err.Error())
			return
		}
		a := app.New(svc)
		a.ApplyPreferences()

		mygo.App.SetMenu(mygo.NewMenu([]*mygo.MenuItem{
			{Role: mygo.RoleAppMenu},
			{Role: mygo.RoleFileMenu},
			{Role: mygo.RoleEditMenu},
			{Role: mygo.RoleWindowMenu},
		}))

		win := mygo.NewWindow(mygo.WindowOptions{
			Title:         "Moli TuTu",
			Width:         1000,
			Height:        700,
			MinWidth:      800,
			MinHeight:     560,
			StateKey:      "main",
			TitleBarStyle: mygo.TitleBarHiddenInset,
			Vibrancy:      mygo.VibrancyGlass,
			Content:       ui.View(a.View),
		})
		a.SetWindow(win)
		svc.SetWindow(win)
		win.OnFocus(a.Refresh)
		win.OnShow(a.Refresh)
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
