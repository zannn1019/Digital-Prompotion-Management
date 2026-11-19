package main

// MIFARE Classic 1K with NDEF, the layout Android and NFC Tools use (NXP AN1305):
//   sector 0     MAD1 in blocks 1-2, key A A0A1A2A3A4A5
//   sectors 1-15 NDEF data in blocks 0-2 of each sector, key A D3F7D3F7D3F7 (reads and writes data)
// A blank card (factory keys FFFFFFFFFFFF) is formatted to that layout first. The NDEF bytes are the same
// TLV as on Type 2 cards, spread over the data blocks, skipping the sector trailers.
// ACR122U commands: FF 82 (load key), FF 86 (authenticate), FF B0/FF D6 with 16-byte blocks.

var (
	keyDefault = []byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}
	keyMAD     = []byte{0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5}
	keyNDEF    = []byte{0xD3, 0xF7, 0xD3, 0xF7, 0xD3, 0xF7}
)

const classicData = 15 * 48 // sectors 1-15, 3 data blocks of 16 bytes

type classicTag struct {
	c         *conn
	formatted bool
}

// auth opens the sector of block with key A. A wrong key halts the card, so it is woken again.
func (t *classicTag) auth(block int, key []byte) (bool, error) {
	if _, err := t.c.command(append([]byte{0xFF, 0x82, 0x00, 0x00, 0x06}, key...)); err != nil {
		return false, err
	}
	_, err := t.c.command([]byte{0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, byte(block), 0x60, 0x00})
	if err == nil {
		return true, nil
	}
	if errCode(err) == "card_removed" {
		return false, err
	}
	return false, t.c.wake()
}

func (t *classicTag) mustAuth(block int, key []byte, code, msg string) error {
	ok, err := t.auth(block, key)
	if err != nil {
		return err
	}
	if !ok {
		return fail(code, msg)
	}
	return nil
}

func (t *classicTag) readBlock(block int) ([]byte, error) {
	d, err := t.c.command([]byte{0xFF, 0xB0, 0x00, byte(block), 0x10})
	if err != nil {
		return nil, err
	}
	if len(d) < 16 {
		return nil, fail("io", "Kartu tidak terbaca lengkap.")
	}
	return d, nil
}

func (t *classicTag) writeBlock(block int, sixteen []byte) error {
	apdu := append([]byte{0xFF, 0xD6, 0x00, byte(block), 0x10}, sixteen[:16]...)
	if _, err := t.c.command(apdu); err != nil {
		if errCode(err) == "card_removed" {
			return err
		}
		return fail("write_failed", "Kartu menolak ditulis di blok "+itoa(block)+". Sektor kartu ini mungkin dikunci dengan kunci lain.")
	}
	return nil
}

// dataBlocks are the blocks that hold NDEF, in order: blocks 0-2 of sectors 1-15.
func dataBlocks() []int {
	var list []int
	for s := 1; s < 16; s++ {
		for b := 0; b < 3; b++ {
			list = append(list, s*4+b)
		}
	}
	return list
}

func (t *classicTag) inspect() (*tagInfo, error) {
	uid, err := t.c.uid()
	if err != nil {
		return nil, err
	}
	info := &tagInfo{UID: uid, Type: "MIFARE Classic 1K", DataBytes: classicData}
	if ok, err := t.auth(4, keyNDEF); err != nil {
		return nil, err
	} else if ok {
		t.formatted = true
		info.URL, err = t.readMessageURL()
		return info, err
	}
	if ok, err := t.auth(4, keyDefault); err != nil {
		return nil, err
	} else if ok {
		return info, nil // blank: formatted on the first write
	}
	return nil, fail("unsupported", "Kartu MIFARE Classic ini memakai kunci lain, jadi tidak bisa ditulis. Pakai kartu kosong.")
}

// readMessageURL reads sector by sector until the whole first NDEF TLV is in.
func (t *classicTag) readMessageURL() (string, error) {
	blocks := dataBlocks()
	var data []byte
	need, sector := 48, -1
	for i := 0; i < len(blocks) && len(data) < need; i++ {
		if s := blocks[i] / 4; s != sector {
			ok, err := t.auth(blocks[i], keyNDEF)
			if err != nil {
				return "", err
			}
			if !ok {
				break
			}
			sector = s
		}
		b, err := t.readBlock(blocks[i])
		if err != nil {
			return "", err
		}
		data = append(data, b...)
		if need == 48 {
			need = tlvEnd(data)
		}
	}
	return readURI(data), nil
}

// tlvEnd is the number of bytes holding the first NDEF TLV (from its length field), at least one sector.
func tlvEnd(data []byte) int {
	i := 0
	for i < len(data) && data[i] == 0 {
		i++
	}
	if i+1 >= len(data) || data[i] != 0x03 {
		return 48
	}
	length, start := int(data[i+1]), i+2
	if length == 0xFF {
		if i+3 >= len(data) {
			return 48
		}
		length, start = int(data[i+2])<<8|int(data[i+3]), i+4
	}
	end := start + length + 1
	if end < 48 {
		end = 48
	}
	if end > classicData {
		end = classicData
	}
	return end
}

func trailer(keyA, access []byte) []byte {
	t := append(append([]byte{}, keyA...), access...)
	return append(t, keyDefault...)
}

func (t *classicTag) format() error {
	logf("format MIFARE Classic to NDEF")
	if err := t.mustAuth(3, keyDefault, "write_failed", "Sektor 0 kartu ini tidak bisa dibuka dengan kunci bawaan pabrik."); err != nil {
		return err
	}
	mad := mad1()
	if err := t.writeBlock(1, mad[:16]); err != nil {
		return err
	}
	if err := t.writeBlock(2, mad[16:]); err != nil {
		return err
	}
	// Sector 0 trailer: key A = MAD key, access bits 78 77 88, GPB C1 (MAD v1, multi-application).
	if err := t.writeBlock(3, trailer(keyMAD, []byte{0x78, 0x77, 0x88, 0xC1})); err != nil {
		return err
	}
	for s := 1; s < 16; s++ {
		tb := s*4 + 3
		if err := t.mustAuth(tb, keyDefault, "write_failed", "Sektor "+itoa(s)+" kartu ini tidak bisa dibuka dengan kunci bawaan pabrik."); err != nil {
			return err
		}
		// NDEF sector trailer: key A = NFC Forum key, access bits 7F 07 88, GPB 40 (NDEF v1, read/write).
		if err := t.writeBlock(tb, trailer(keyNDEF, []byte{0x7F, 0x07, 0x88, 0x40})); err != nil {
			return err
		}
	}
	t.formatted = true
	return nil
}

func (t *classicTag) writeURL(info *tagInfo, url string, lock bool) (*writeResult, error) {
	tlv := typeTwoTLV(uriRecord(url))
	if len(tlv) > classicData {
		return nil, fail("too_small", "Alamat terlalu panjang untuk kartu ini ("+itoa(len(tlv))+" dari "+itoa(classicData)+" byte).")
	}
	data := make([]byte, (len(tlv)+15)/16*16)
	copy(data, tlv)
	if !t.formatted {
		if err := t.format(); err != nil {
			return nil, err
		}
	}
	blocks := dataBlocks()
	count := len(data) / 16
	open := func(i int) error {
		return t.mustAuth(blocks[i], keyNDEF, "write_failed", "Sektor "+itoa(blocks[i]/4)+" kartu ini tidak bisa dibuka.")
	}
	// Empty message first, the rest, then the first block last: a card pulled away mid-write ends up
	// empty instead of holding a broken address.
	empty := make([]byte, 16)
	copy(empty, []byte{0x03, 0x00, 0xFE})
	if err := open(0); err != nil {
		return nil, err
	}
	if err := t.writeBlock(blocks[0], empty); err != nil {
		return nil, err
	}
	sector := 1
	for i := 1; i < count; i++ {
		if s := blocks[i] / 4; s != sector {
			if err := open(i); err != nil {
				return nil, err
			}
			sector = s
		}
		if err := t.writeBlock(blocks[i], data[i*16:i*16+16]); err != nil {
			return nil, err
		}
	}
	if err := open(0); err != nil {
		return nil, err
	}
	if err := t.writeBlock(blocks[0], data[:16]); err != nil {
		return nil, err
	}
	// Read back.
	sector = -1
	for i := 0; i < count; i++ {
		if s := blocks[i] / 4; s != sector {
			if err := t.mustAuth(blocks[i], keyNDEF, "verify_failed", "Isi kartu tidak bisa dibaca ulang. Tulis ulang kartu ini."); err != nil {
				return nil, err
			}
			sector = s
		}
		back, err := t.readBlock(blocks[i])
		if err != nil {
			return nil, err
		}
		for k := 0; k < 16; k++ {
			if back[k] != data[i*16+k] {
				return nil, fail("verify_failed", "Isi kartu tidak sama setelah ditulis. Tulis ulang kartu ini.")
			}
		}
	}
	info.URL = url
	res := &writeResult{Info: info}
	if lock {
		res.LockSkipped = "Kartu MIFARE Classic tidak dikunci (hanya kartu NTAG yang bisa dikunci di sini). Alamat sudah tertulis."
	}
	return res, nil
}
