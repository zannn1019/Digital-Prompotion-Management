// Penulis NFC: a small tray / menu-bar program that lets the Poster Digital NFC admin page write card
// addresses with a USB NFC reader (ACS ACR122U) on this computer. Windows and macOS.
package main

import (
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"fyne.io/systray"
	"github.com/ncruces/zenity"
)

func main() {
	listeners, err := listen()
	if err != nil {
		_ = zenity.Info("Penulis NFC sudah berjalan. Lihat ikonnya di "+trayPlace()+".", zenity.Title("Penulis NFC"))
		return
	}
	dir := dataDir()
	_, statErr := os.Stat(dir)
	firstRun := os.IsNotExist(statErr)
	_ = os.MkdirAll(dir, 0o755)
	logf("start %s (%s/%s)", version, runtime.GOOS, runtime.GOARCH)

	srv := &server{w: &writer{}, origins: loadOrigins(filepath.Join(dir, "situs-diizinkan.txt"))}
	for _, l := range listeners {
		hs := &http.Server{Handler: srv, ReadHeaderTimeout: 10 * time.Second}
		go func() { _ = hs.Serve(l) }()
	}
	if firstRun {
		setAutostart(true)
	}
	systray.Run(func() { onReady(srv) }, func() { logf("exit") })
}

func trayPlace() string {
	if runtime.GOOS == "darwin" {
		return "bilah menu (kanan atas layar)"
	}
	return "taskbar (dekat jam)"
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
	startup := systray.AddMenuItemCheckbox("Jalankan saat komputer mulai", "", autostartEnabled())
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
				systray.Quit()
				return
			}
		}
	}()
	_ = zenity.Notify("Buka Panel Admin → Kartu NFC → Tulis ke kartu. Ikon Penulis NFC ada di "+trayPlace()+".",
		zenity.Title("Penulis NFC aktif"))
}

// executable is the path to start at login: the .app bundle's binary on macOS, the .exe on Windows.
func executable() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	if r, err := filepath.EvalSymlinks(exe); err == nil {
		exe = r
	}
	return exe
}

// appBundle is the .app folder around the binary on macOS, or "".
func appBundle(exe string) string {
	if i := strings.Index(exe, ".app/"); i >= 0 {
		return exe[:i+4]
	}
	return ""
}
