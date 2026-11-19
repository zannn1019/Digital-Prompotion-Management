package main

// Windows: an icon in the taskbar's notification area with a small menu.

import (
	"time"

	"fyne.io/systray"
	"github.com/ncruces/zenity"
)

func alreadyRunning() {
	_ = zenity.Info("Penulis NFC sudah berjalan. Lihat ikonnya di taskbar (dekat jam).", zenity.Title("Penulis NFC"))
}

func runUI(srv *server, firstRun bool) {
	go func() {
		<-srv.quit
		systray.Quit()
	}()
	systray.Run(func() { onReady(srv) }, func() {})
}

const siteSlots = 8

func onReady(srv *server) {
	systray.SetIcon(trayIcon())
	systray.SetTooltip("Penulis NFC")

	status := systray.AddMenuItem("Memeriksa pembaca…", "")
	status.Disable()
	systray.AddSeparator()
	sites := systray.AddMenuItem("Situs yang diizinkan", "")
	none := sites.AddSubMenuItem("Belum ada", "")
	none.Disable()
	slots := make([]*systray.MenuItem, siteSlots)
	slotSite := make([]string, siteSlots)
	for i := range slots {
		slots[i] = sites.AddSubMenuItem("", "Hapus izin situs ini")
		slots[i].Hide()
	}
	again := sites.AddSubMenuItem("Tanya lagi situs yang ditolak", "")
	startup := systray.AddMenuItemCheckbox("Jalankan saat Windows mulai", "", autostartEnabled())
	systray.AddSeparator()
	quit := systray.AddMenuItem("Keluar", "")

	refresh := func() {
		st := srv.w.status()
		reader, _ := st["reader"].(string)
		switch {
		case reader == "":
			status.SetTitle("Pembaca NFC belum dicolokkan")
		case st["card"] == true:
			status.SetTitle("Siap · " + reader + " · ada kartu")
		default:
			status.SetTitle("Siap · " + reader)
		}
		list := srv.origins.list()
		if len(list) == 0 {
			none.Show()
		} else {
			none.Hide()
		}
		for i := range slots {
			if i < len(list) {
				slotSite[i] = list[i]
				slots[i].SetTitle("Hapus izin " + list[i])
				slots[i].Show()
			} else {
				slotSite[i] = ""
				slots[i].Hide()
			}
		}
		if autostartEnabled() {
			startup.Check()
		} else {
			startup.Uncheck()
		}
	}
	refresh()
	go func() {
		for range time.Tick(3 * time.Second) {
			refresh()
		}
	}()
	for i := range slots {
		go func(i int) {
			for range slots[i].ClickedCh {
				if slotSite[i] != "" {
					srv.origins.remove(slotSite[i])
					refresh()
				}
			}
		}(i)
	}
	go func() {
		for {
			select {
			case <-again.ClickedCh:
				srv.origins.forgetDenied()
			case <-startup.ClickedCh:
				setAutostart(!autostartEnabled())
				refresh()
			case <-quit.ClickedCh:
				srv.stop()
				return
			}
		}
	}()
	_ = zenity.Notify("Buka Panel Admin → Kartu NFC → Tulis ke kartu. Ikon Penulis NFC ada di taskbar (dekat jam).",
		zenity.Title("Penulis NFC aktif"))
}
