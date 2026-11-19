package main

// macOS: no menu-bar icon (that would need Apple's toolchain to build). Penulis NFC runs in the background;
// opening it again shows a small menu, which reaches the running copy through its local /control endpoint.

import (
	"bytes"
	"net/http"
	"time"

	"github.com/ncruces/zenity"
)

const (
	choiceKeep     = "Biarkan berjalan"
	choiceQuit     = "Keluar dari Penulis NFC"
	choiceSites    = "Hapus izin semua situs"
	choiceLoginOn  = "Jalankan saat login"
	choiceLoginOff = "Jangan jalankan saat login"
)

func alreadyRunning() {
	login := choiceLoginOn
	if autostartEnabled() {
		login = choiceLoginOff
	}
	items := []string{choiceKeep, choiceQuit, choiceSites, login}
	choice, err := zenity.List(
		"Penulis NFC sudah berjalan di latar belakang. Pilih:",
		items,
		zenity.Title("Penulis NFC"),
		zenity.DefaultItems(choiceKeep),
	)
	if err != nil {
		return
	}
	action := ""
	switch choice {
	case choiceQuit:
		action = "quit"
	case choiceSites:
		action = "forget-sites"
	case choiceLoginOn:
		setAutostart(true)
	case choiceLoginOff:
		setAutostart(false)
	}
	if action == "" {
		return
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Post("http://localhost:"+port+"/control", "application/json",
		bytes.NewReader([]byte(`{"action":"`+action+`"}`)))
	if err == nil {
		resp.Body.Close()
	}
	if action == "quit" {
		_ = zenity.Notify("Penulis NFC dihentikan. Buka lagi bila ingin menulis kartu.", zenity.Title("Penulis NFC"))
	}
}

func runUI(srv *server, firstRun bool) {
	msg := "Penulis NFC berjalan di latar belakang (tanpa ikon). Buka Panel Admin → Kartu NFC → Tulis ke kartu di Chrome.\n\n" +
		"Untuk menghentikan atau mengatur, buka Penulis NFC lagi."
	if firstRun {
		go func() { _ = zenity.Info(msg, zenity.Title("Penulis NFC aktif")) }()
	} else {
		_ = zenity.Notify("Buka Panel Admin → Kartu NFC → Tulis ke kartu.", zenity.Title("Penulis NFC aktif"))
	}
	<-srv.quit
	time.Sleep(200 * time.Millisecond) // let the /control answer go out
}
