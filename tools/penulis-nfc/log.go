package main

// A small log next to the allowed-sites list, for finding out why a card was not written. It starts over
// above 256 KB. Windows: %APPDATA%\PenulisNFC\log.txt. macOS: ~/Library/Application Support/PenulisNFC/log.txt.

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

var (
	logMu   sync.Mutex
	logPath string
)

// dataDir is where Penulis NFC keeps its files for this user.
func dataDir() string {
	base, err := os.UserConfigDir()
	if err != nil {
		base = os.TempDir()
	}
	return filepath.Join(base, "PenulisNFC")
}

func logf(format string, args ...any) {
	logMu.Lock()
	defer logMu.Unlock()
	if logPath == "" {
		logPath = filepath.Join(dataDir(), "log.txt")
	}
	_ = os.MkdirAll(filepath.Dir(logPath), 0o755)
	if fi, err := os.Stat(logPath); err == nil && fi.Size() > 256*1024 {
		_ = os.Remove(logPath)
	}
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s  %s\n", time.Now().Format("2006-01-02 15:04:05.000"), fmt.Sprintf(format, args...))
}
