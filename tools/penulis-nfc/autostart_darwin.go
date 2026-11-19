package main

// Start at login on macOS: a per-user LaunchAgent that opens the app bundle.

import (
	"os"
	"path/filepath"
)

const agentLabel = "id.rsbethesda.penulisnfc"

func agentPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "LaunchAgents", agentLabel+".plist")
}

func autostartEnabled() bool {
	_, err := os.Stat(agentPath())
	return err == nil
}

func setAutostart(on bool) {
	if !on {
		_ = os.Remove(agentPath())
		return
	}
	exe := executable()
	args := `<string>` + xmlEscape(exe) + `</string>`
	if app := appBundle(exe); app != "" {
		args = `<string>/usr/bin/open</string><string>-a</string><string>` + xmlEscape(app) + `</string>`
	}
	plist := `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>` + agentLabel + `</string>
  <key>ProgramArguments</key><array>` + args + `</array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`
	_ = os.MkdirAll(filepath.Dir(agentPath()), 0o755)
	_ = os.WriteFile(agentPath(), []byte(plist), 0o644)
}

func xmlEscape(s string) string {
	out := []rune{}
	for _, r := range s {
		switch r {
		case '&':
			out = append(out, []rune("&amp;")...)
		case '<':
			out = append(out, []rune("&lt;")...)
		case '>':
			out = append(out, []rune("&gt;")...)
		default:
			out = append(out, r)
		}
	}
	return string(out)
}
