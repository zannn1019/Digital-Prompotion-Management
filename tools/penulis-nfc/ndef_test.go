package main

import (
	"strings"
	"testing"
)

func TestURIRecord(t *testing.T) {
	cases := []struct{ url, want string }{
		// prefix 04, "a.id/k/7AFP3EJR" (15 bytes), payload 16
		{"https://a.id/k/7AFP3EJR", "D101105504612E69642F6B2F3741465033454A52"},
		{"https://www.x.id/", "D101065502782E69642F"},
		{"http://x.id/", "D101065503782E69642F"},
	}
	for _, c := range cases {
		if got := hexUpper(uriRecord(c.url)); got != c.want {
			t.Errorf("%s: got %s want %s", c.url, got, c.want)
		}
	}
}

func TestTypeTwoTLV(t *testing.T) {
	tlv := typeTwoTLV(uriRecord("https://a.id/k/7AFP3EJR"))
	if got := hexUpper(tlv); got != "0314D101105504612E69642F6B2F3741465033454A52FE00" {
		t.Fatalf("tlv %s", got)
	}
	if len(tlv)%4 != 0 {
		t.Fatal("not padded to pages")
	}
	if got := readURI(tlv); got != "https://a.id/k/7AFP3EJR" {
		t.Fatalf("read back %q", got)
	}
}

func TestLongRecord(t *testing.T) {
	long := "https://x.id/" + strings.Repeat("a", 300)
	tlv := typeTwoTLV(uriRecord(long))
	if got := hexUpper(tlv[:4]); got != "03FF0139" {
		t.Fatalf("header %s", got)
	}
	if got := readURI(tlv); got != long {
		t.Fatal("long read back")
	}
}

func TestEmptyCard(t *testing.T) {
	if got := readURI([]byte{0x03, 0x00, 0xFE, 0x00}); got != "" {
		t.Fatalf("empty card read %q", got)
	}
}

// The MAD every Android-formatted MIFARE Classic 1K carries: 14 01 03 E1 03 E1 ...
func TestMAD(t *testing.T) {
	m := mad1()
	if got := hexUpper(m[:6]); got != "140103E103E1" {
		t.Fatalf("block 1 %s", got)
	}
	if got := hexUpper([]byte{m[16], m[17], m[30], m[31]}); got != "03E103E1" {
		t.Fatalf("block 2 %s", got)
	}
}

func TestOriginRules(t *testing.T) {
	for _, ok := range []string{"https://event.dasa.my.id", "http://localhost:3000"} {
		if !validOrigin(ok) {
			t.Errorf("%s should be valid", ok)
		}
	}
	for _, bad := range []string{"null", "https://x.id/path", "file://", "javascript:alert(1)"} {
		if validOrigin(bad) {
			t.Errorf("%s should be invalid", bad)
		}
	}
}

func TestHostCheck(t *testing.T) {
	for _, ok := range []string{"localhost:47811", "127.0.0.1:47811", "[::1]:47811"} {
		if !localHost(ok) {
			t.Errorf("%s should be accepted", ok)
		}
	}
	// A DNS-rebinding page reaches the helper with its own host name.
	for _, bad := range []string{"evil.test:47811", "localhost.evil.test:47811", ""} {
		if localHost(bad) {
			t.Errorf("%s should be refused", bad)
		}
	}
}
