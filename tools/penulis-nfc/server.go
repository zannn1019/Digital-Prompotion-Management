package main

// The local HTTP API the admin page calls: http://localhost:47811
//   GET  /status  reader and card state
//   POST /write   { url, lock, skipUid }  waits for a card, writes the address, reads it back, locks it if asked
//   POST /read    waits for a card and returns what is on it
//   POST /cancel  stops a waiting /write or /read
// Only websites the person allowed (asked once per site) may use it, and only when addressed as localhost
// (a DNS-rebinding page would arrive with its own host name).

import (
	"encoding/json"
	"io"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const port = "47811"
const version = "2.0.0"
const waitFor = 30 * time.Second

type server struct {
	w       *writer
	origins *origins
}

func localHost(host string) bool {
	h, p, err := net.SplitHostPort(host)
	if err != nil || p != port {
		return false
	}
	return h == "localhost" || h == "127.0.0.1" || h == "::1"
}

func (s *server) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	if !localHost(r.Host) {
		http.Error(rw, "forbidden", http.StatusForbidden)
		return
	}
	origin := r.Header.Get("Origin")
	if origin != "" {
		h := rw.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Vary", "Origin")
		h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		h.Set("Access-Control-Allow-Headers", "Content-Type")
		// Chrome's Private/Local Network Access preflight for a public site calling localhost.
		h.Set("Access-Control-Allow-Private-Network", "true")
		h.Set("Access-Control-Max-Age", "600")
	}
	if r.Method == http.MethodOptions {
		rw.WriteHeader(http.StatusNoContent)
		return
	}
	// Requests without an Origin come from programs on this computer, which could use the reader directly anyway.
	if origin != "" {
		if answer := s.origins.check(origin); answer != "allowed" {
			msg := "Situs ini tidak diizinkan memakai Penulis NFC. Izinkan dari menu ikon Penulis NFC."
			if answer == "asking" {
				msg = "Izinkan situs ini di jendela Penulis NFC yang muncul di layar."
			}
			body := errorBody("not_allowed", msg)
			body["app"], body["version"], body["asking"] = "penulis-nfc", version, answer == "asking"
			send(rw, http.StatusForbidden, body)
			return
		}
	}
	path := strings.TrimSuffix(r.URL.Path, "/")
	switch {
	case r.Method == http.MethodGet && (path == "/status" || path == ""):
		st := s.w.status()
		st["ok"], st["app"], st["version"] = true, "penulis-nfc", version
		send(rw, http.StatusOK, st)
	case r.Method != http.MethodPost:
		send(rw, http.StatusNotFound, errorBody("not_found", "Tidak ada."))
	case path == "/cancel":
		s.w.cancel()
		send(rw, http.StatusOK, map[string]any{"ok": true})
	case path == "/write":
		s.write(rw, r)
	case path == "/read":
		s.read(rw)
	default:
		send(rw, http.StatusNotFound, errorBody("not_found", "Tidak ada."))
	}
}

var urlPattern = regexp.MustCompile(`^https?://[^\s/]+/\S*$`)

func (s *server) write(rw http.ResponseWriter, r *http.Request) {
	var body struct {
		URL     string `json:"url"`
		Lock    bool   `json:"lock"`
		SkipUID string `json:"skipUid"`
	}
	raw, _ := io.ReadAll(io.LimitReader(r.Body, 4097))
	if len(raw) > 4096 || (len(raw) > 0 && json.Unmarshal(raw, &body) != nil) || len(body.URL) > 500 || !urlPattern.MatchString(body.URL) {
		send(rw, http.StatusBadRequest, errorBody("bad_request", "Alamat kartu tidak valid."))
		return
	}
	res, err := withCard(s.w, body.SkipUID, waitFor, func(t tag) (*writeResult, error) {
		info, err := t.inspect()
		if err != nil {
			return nil, err
		}
		return t.writeURL(info, body.URL, body.Lock)
	})
	if err != nil {
		sendError(rw, err)
		return
	}
	var skipped any
	if res.LockSkipped != "" {
		skipped = res.LockSkipped
	}
	send(rw, http.StatusOK, map[string]any{
		"ok": true, "uid": res.Info.UID, "type": res.Info.Type, "url": res.Info.URL,
		"locked": res.Locked, "lockSkipped": skipped,
	})
}

func (s *server) read(rw http.ResponseWriter) {
	info, err := withCard(s.w, "", waitFor, func(t tag) (*tagInfo, error) { return t.inspect() })
	if err != nil {
		sendError(rw, err)
		return
	}
	var url any
	if info.URL != "" {
		url = info.URL
	}
	send(rw, http.StatusOK, map[string]any{
		"ok": true, "uid": info.UID, "type": info.Type, "url": url,
		"readOnly": info.ReadOnly, "dataBytes": info.DataBytes,
	})
}

func errorBody(code, msg string) map[string]any {
	return map[string]any{"ok": false, "error": code, "message": msg}
}

func sendError(rw http.ResponseWriter, err error) {
	code := errCode(err)
	status := http.StatusOK
	if code == "busy" {
		status = http.StatusConflict
	}
	send(rw, status, errorBody(code, err.Error()))
}

func send(rw http.ResponseWriter, status int, body map[string]any) {
	rw.Header().Set("Content-Type", "application/json; charset=utf-8")
	rw.Header().Set("Cache-Control", "no-store")
	rw.WriteHeader(status)
	_ = json.NewEncoder(rw).Encode(body)
}

// listen binds localhost on IPv4 and IPv6 (browsers may resolve "localhost" to either). It fails when
// another Penulis NFC already runs.
func listen() ([]net.Listener, error) {
	l4, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		return nil, err
	}
	list := []net.Listener{l4}
	if l6, err := net.Listen("tcp", "[::1]:"+port); err == nil {
		list = append(list, l6)
	}
	return list, nil
}
