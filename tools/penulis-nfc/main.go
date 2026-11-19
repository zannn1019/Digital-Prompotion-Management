// Penulis NFC: a small helper that lets the Poster Digital NFC admin page write card addresses with a USB NFC
// reader (ACS ACR122U) on this computer. Windows: tray icon (ui_windows.go). macOS: runs in the background,
// opening it again shows its menu (ui_darwin.go).
package main

import (
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

func main() {
	listeners, err := listen()
	if err != nil {
		alreadyRunning()
		return
	}
	dir := dataDir()
	_, statErr := os.Stat(dir)
	firstRun := os.IsNotExist(statErr)
	_ = os.MkdirAll(dir, 0o755)
	logf("start %s (%s/%s)", version, runtime.GOOS, runtime.GOARCH)

	srv := &server{w: &writer{}, origins: loadOrigins(filepath.Join(dir, "situs-diizinkan.txt")), quit: make(chan struct{})}
	for _, l := range listeners {
		hs := &http.Server{Handler: srv, ReadHeaderTimeout: 10 * time.Second}
		go func() { _ = hs.Serve(l) }()
	}
	if firstRun {
		setAutostart(true)
	}
	runUI(srv, firstRun)
	logf("exit")
}

// stop ends the program (from the tray menu on Windows, from the menu shown on re-opening on macOS).
func (s *server) stop() { s.quitOnce.Do(func() { close(s.quit) }) }

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
