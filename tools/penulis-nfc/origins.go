package main

// The websites allowed to use the reader, asked once per site and saved per user in situs-diizinkan.txt
// (the same file the earlier Windows version used, so its permissions carry over).

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"

	"github.com/ncruces/zenity"
)

var originPattern = regexp.MustCompile(`(?i)^https?://[a-z0-9.\-\[\]:]+$`)

func validOrigin(o string) bool { return originPattern.MatchString(o) }

type origins struct {
	mu      sync.Mutex
	file    string
	allowed map[string]bool
	denied  map[string]bool
	asking  map[string]bool
}

func loadOrigins(file string) *origins {
	o := &origins{file: file, allowed: map[string]bool{}, denied: map[string]bool{}, asking: map[string]bool{}}
	if b, err := os.ReadFile(file); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			if l := strings.TrimSpace(line); validOrigin(l) {
				o.allowed[strings.ToLower(l)] = true
			}
		}
	}
	return o
}

// check returns "allowed", "asking" (the question is on screen) or "denied".
func (o *origins) check(origin string) string {
	if !validOrigin(origin) {
		return "denied"
	}
	key := strings.ToLower(origin)
	o.mu.Lock()
	defer o.mu.Unlock()
	switch {
	case o.allowed[key]:
		return "allowed"
	case o.denied[key]:
		return "denied"
	case o.asking[key]:
		return "asking"
	}
	o.asking[key] = true
	go o.ask(key)
	return "asking"
}

func (o *origins) ask(origin string) {
	err := zenity.Question(
		"Situs ini ingin memakai pembaca NFC di komputer ini untuk menulis kartu:\n\n"+origin+
			"\n\nIzinkan hanya bila ini alamat Panel Admin Poster Digital NFC Anda.",
		zenity.Title("Penulis NFC · Izinkan situs?"),
		zenity.OKLabel("Izinkan"),
		zenity.CancelLabel("Tolak"),
		zenity.DefaultCancel(),
	)
	o.answer(origin, err == nil)
}

func (o *origins) answer(origin string, yes bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	delete(o.asking, origin)
	if yes {
		o.allowed[origin] = true
		o.save()
	} else {
		o.denied[origin] = true
	}
	logf("site %s allowed=%v", origin, yes)
}

func (o *origins) list() []string {
	o.mu.Lock()
	defer o.mu.Unlock()
	var l []string
	for k := range o.allowed {
		l = append(l, k)
	}
	sort.Strings(l)
	return l
}

func (o *origins) remove(origin string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	delete(o.allowed, origin)
	delete(o.denied, origin)
	o.save()
}

// clearAll removes every allowed site.
func (o *origins) clearAll() {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.allowed = map[string]bool{}
	o.denied = map[string]bool{}
	o.save()
}

// forgetDenied lets a site refused in this session ask again.
func (o *origins) forgetDenied() {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.denied = map[string]bool{}
}

func (o *origins) save() {
	var l []string
	for k := range o.allowed {
		l = append(l, k)
	}
	sort.Strings(l)
	_ = os.MkdirAll(filepath.Dir(o.file), 0o755)
	_ = os.WriteFile(o.file, []byte(strings.Join(l, "\n")+"\n"), 0o644)
}
