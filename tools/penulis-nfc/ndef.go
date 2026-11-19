package main

// NDEF encoding for one URI record, wrapped in the TLV that NTAG21x and MIFARE Classic cards use, and the
// MIFARE Application Directory for Classic cards. Pure code, covered by ndef_test.go.

import (
	"encoding/hex"
	"strings"
)

// URI identifier codes (NFC Forum URI RTD), longest prefixes first.
var uriPrefixes = []struct {
	prefix string
	code   byte
}{
	{"https://www.", 0x02},
	{"http://www.", 0x01},
	{"https://", 0x04},
	{"http://", 0x03},
}

// uriRecord is the NDEF message for one URI record (no TLV).
func uriRecord(url string) []byte {
	code := byte(0x00)
	rest := url
	for _, p := range uriPrefixes {
		if strings.HasPrefix(url, p.prefix) {
			code = p.code
			rest = url[len(p.prefix):]
			break
		}
	}
	text := []byte(rest)
	payload := len(text) + 1
	var rec []byte
	if payload < 256 {
		rec = append(rec, 0xD1, 0x01, byte(payload)) // MB | ME | SR, TNF well-known
	} else {
		rec = append(rec, 0xC1, 0x01, byte(payload>>24), byte(payload>>16), byte(payload>>8), byte(payload))
	}
	rec = append(rec, 'U', code)
	return append(rec, text...)
}

// typeTwoTLV is the data written from the first data block: NDEF TLV, terminator, padded to 4-byte pages.
func typeTwoTLV(message []byte) []byte {
	data := []byte{0x03}
	if len(message) < 0xFF {
		data = append(data, byte(len(message)))
	} else {
		data = append(data, 0xFF, byte(len(message)>>8), byte(len(message)))
	}
	data = append(data, message...)
	data = append(data, 0xFE)
	for len(data)%4 != 0 {
		data = append(data, 0x00)
	}
	return data
}

// readURI reads the URI back from TLV data, or "" when there is none.
func readURI(data []byte) string {
	i := 0
	for i < len(data) {
		t := data[i]
		if t == 0x00 { // NULL TLV
			i++
			continue
		}
		if t == 0xFE || i+1 >= len(data) {
			return ""
		}
		length := int(data[i+1])
		start := i + 2
		if length == 0xFF {
			if i+3 >= len(data) {
				return ""
			}
			length = int(data[i+2])<<8 | int(data[i+3])
			start = i + 4
		}
		if t != 0x03 {
			i = start + length
			continue
		}
		if length < 5 || start+length > len(data) {
			return ""
		}
		header := data[start]
		typeLength := int(data[start+1])
		p := start + 2
		var payload int
		if header&0x10 != 0 {
			payload = int(data[p])
			p++
		} else {
			payload = int(data[p])<<24 | int(data[p+1])<<16 | int(data[p+2])<<8 | int(data[p+3])
			p += 4
		}
		if header&0x08 != 0 { // ID length present
			p += 1 + int(data[p])
		}
		if header&0x07 != 0x01 || typeLength != 1 || p >= len(data) || data[p] != 'U' {
			return ""
		}
		p++
		if payload < 1 || p+payload > len(data) {
			return ""
		}
		prefix := ""
		for _, u := range uriPrefixes {
			if u.code == data[p] {
				prefix = u.prefix
			}
		}
		return prefix + string(data[p+1:p+payload])
	}
	return ""
}

// mad1 is the MIFARE Application Directory for a Classic 1K with NDEF in sectors 1-15 (blocks 1 and 2 of
// sector 0): CRC, info byte, then the NDEF application ID (03 E1) per sector. CRC-8 poly 0x1D, init 0xC7.
func mad1() []byte {
	mad := make([]byte, 32)
	mad[1] = 0x01
	for s := 1; s <= 15; s++ {
		mad[s*2] = 0x03
		mad[s*2+1] = 0xE1
	}
	crc := 0xC7
	for _, b := range mad[1:] {
		crc ^= int(b)
		for k := 0; k < 8; k++ {
			if crc&0x80 != 0 {
				crc = (crc<<1 ^ 0x1D) & 0xFF
			} else {
				crc = crc << 1 & 0xFF
			}
		}
	}
	mad[0] = byte(crc)
	return mad
}

func hexUpper(b []byte) string { return strings.ToUpper(hex.EncodeToString(b)) }
