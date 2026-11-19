package main

// A card on the reader. openTag picks the card family from the ATR (PC/SC part 3: bytes 13-14 name the
// card): NFC Forum Type 2 (NTAG213/215/216, Ultralight) here, MIFARE Classic 1K in classic.go.

type tagInfo struct {
	UID       string
	Type      string
	DataBytes int
	ReadOnly  bool
	URL       string // "" when the card holds no address
}

type writeResult struct {
	Info        *tagInfo
	Locked      bool
	LockSkipped string // why the card was not locked although that was asked
}

type tag interface {
	inspect() (*tagInfo, error)
	writeURL(info *tagInfo, url string, lock bool) (*writeResult, error)
}

func openTag(c *conn, atr []byte) (tag, error) {
	name := -1
	if len(atr) >= 15 && atr[4] == 0x80 && atr[5] == 0x4F {
		name = int(atr[13])<<8 | int(atr[14])
	}
	switch name {
	case 0x0001:
		return &classicTag{c: c}, nil
	case 0x0002:
		return nil, fail("unsupported", "Kartu MIFARE Classic 4K belum didukung. Pakai kartu NTAG213/215/216 atau MIFARE Classic 1K.")
	}
	return &type2Tag{c: c}, nil
}

// type2Tag is an NFC Forum Type 2 card: 4-byte pages, read 4 pages at a time.
type type2Tag struct{ c *conn }

func (t *type2Tag) read(page int) ([]byte, error) {
	d, err := t.c.command([]byte{0xFF, 0xB0, 0x00, byte(page), 0x10})
	if err != nil {
		return nil, err
	}
	if len(d) < 16 {
		return nil, fail("io", "Kartu tidak terbaca lengkap.")
	}
	return d, nil
}

func (t *type2Tag) write(page int, four []byte) error {
	apdu := append([]byte{0xFF, 0xD6, 0x00, byte(page), 0x04}, four[:4]...)
	if _, err := t.c.command(apdu); err != nil {
		if errCode(err) == "card_removed" {
			return err
		}
		return fail("write_failed", "Kartu menolak ditulis di halaman "+itoa(page)+". Kartu mungkin terkunci atau dilindungi kata sandi.")
	}
	return nil
}

func typeName(ccSize byte) string {
	switch ccSize {
	case 0x12:
		return "NTAG213"
	case 0x3E:
		return "NTAG215"
	case 0x6D:
		return "NTAG216"
	case 0x06:
		return "MIFARE Ultralight"
	}
	return "NFC Tipe 2"
}

// No GET_VERSION: sent through the ACR122U it can leave the card idle (later commands fail with 63 00).
// The capability container says enough.
func (t *type2Tag) inspect() (*tagInfo, error) {
	uid, err := t.c.uid()
	if err != nil {
		return nil, err
	}
	head, err := t.read(0) // pages 0-3: UID, lock bytes (page 2), capability container (page 3)
	if err != nil {
		return nil, err
	}
	cc0, cc2, cc3 := head[12], head[14], head[15]
	if cc0 == 0 && head[13] == 0 && cc2 == 0 && cc3 == 0 {
		return nil, fail("unsupported", "Kartu ini belum diformat untuk NFC (NDEF). Format dulu dengan aplikasi NFC Tools, atau pakai kartu NTAG213/215/216 baru.")
	}
	if cc0 != 0xE1 {
		return nil, fail("unsupported", "Kartu ini bukan kartu NFC yang bisa ditulis alamat (pakai NTAG213/215/216).")
	}
	info := &tagInfo{UID: uid, Type: typeName(cc2), DataBytes: int(cc2) * 8}
	// Read-only: the CC says so, or the static lock bits cover pages 4-15.
	info.ReadOnly = cc3 != 0 || head[10]&0xF0 != 0 || head[11] != 0
	length := info.DataBytes
	if length > 256 {
		length = 256
	}
	data := make([]byte, 0, length)
	for i := 0; i < length; i += 16 {
		block, err := t.read(4 + i/4)
		if err != nil {
			return nil, err
		}
		data = append(data, block...)
	}
	if len(data) > length {
		data = data[:length]
	}
	info.URL = readURI(data)
	return info, nil
}

func (t *type2Tag) writeURL(info *tagInfo, url string, lock bool) (*writeResult, error) {
	if info.ReadOnly {
		return nil, fail("read_only", "Kartu ini sudah terkunci, jadi tidak bisa ditulis ulang. Pakai kartu lain.")
	}
	data := typeTwoTLV(uriRecord(url))
	if len(data) > info.DataBytes {
		return nil, fail("too_small", "Alamat terlalu panjang untuk kartu ini ("+itoa(len(data))+" dari "+itoa(info.DataBytes)+" byte).")
	}
	// Empty message first, then the rest, then page 4 last: a card pulled away mid-write ends up empty
	// instead of holding a broken address.
	if err := t.write(4, []byte{0x03, 0x00, 0xFE, 0x00}); err != nil {
		return nil, err
	}
	for i := 4; i < len(data); i += 4 {
		if err := t.write(4+i/4, data[i:i+4]); err != nil {
			return nil, err
		}
	}
	if err := t.write(4, data[0:4]); err != nil {
		return nil, err
	}
	for i := 0; i < len(data); i += 16 {
		block, err := t.read(4 + i/4)
		if err != nil {
			return nil, err
		}
		for k := 0; k < 16 && i+k < len(data); k++ {
			if block[k] != data[i+k] {
				return nil, fail("verify_failed", "Isi kartu tidak sama setelah ditulis. Tulis ulang kartu ini.")
			}
		}
	}
	info.URL = url
	res := &writeResult{Info: info}
	if !lock {
		return res, nil
	}
	// Only the static lock bits: they cover pages 3-15, where the address is. A longer message would also
	// need the per-model dynamic lock bits, so it is left unlocked.
	if len(data) > 48 {
		res.LockSkipped = "Alamat lebih panjang dari 48 byte, jadi kartu tidak dikunci."
		return res, nil
	}
	head, err := t.read(0)
	if err == nil {
		err = t.write(3, []byte{0xE1, head[13], head[14], 0x0F}) // CC: read-only access
	}
	if err == nil {
		err = t.write(2, []byte{head[8], head[9], 0xFF, 0xFF}) // static lock bytes
	}
	switch {
	case err == nil:
		res.Locked = true
		info.ReadOnly = true
	case errCode(err) == "card_removed":
		res.LockSkipped = "Kartu diangkat sebelum dikunci. Alamat sudah tertulis, tetapi kartu belum terkunci."
	default:
		res.LockSkipped = "Alamat sudah tertulis, tetapi kartu gagal dikunci."
	}
	return res, nil
}
