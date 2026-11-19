// packmac turns the two macOS builds of Penulis NFC (Apple Silicon and Intel) into PenulisNFC-mac.zip: one
// universal binary inside PenulisNFC.app, zipped with Unix permissions so the app stays runnable after
// unzipping. Runs on any system (build.cmd uses it on Windows).
//
//	go run ./cmd/packmac <version> <arm64 binary> <amd64 binary> <out.zip>
package main

import (
	"archive/zip"
	"bytes"
	"debug/macho"
	"encoding/binary"
	"fmt"
	"os"
	"time"
)

func main() {
	if len(os.Args) != 5 {
		fmt.Fprintln(os.Stderr, "usage: packmac <version> <arm64> <amd64> <out.zip>")
		os.Exit(2)
	}
	version, out := os.Args[1], os.Args[4]
	fat, err := universal(os.Args[2], os.Args[3])
	check(err)
	check(writeZip(out, version, fat))
	fmt.Printf("Built %s (%s, %d bytes universal binary)\n", out, version, len(fat))
}

// universal joins Mach-O slices into a fat binary (each slice keeps its own signature).
func universal(paths ...string) ([]byte, error) {
	const align = 14 // 2^14 = 16 KiB, the page size on Apple Silicon
	type slice struct {
		cpu, sub uint32
		data     []byte
	}
	var slices []slice
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		f, err := macho.NewFile(bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", p, err)
		}
		slices = append(slices, slice{uint32(f.Cpu), f.SubCpu, data})
		f.Close()
	}
	var b bytes.Buffer
	_ = binary.Write(&b, binary.BigEndian, []uint32{0xCAFEBABE, uint32(len(slices))})
	offset := uint32(1 << align)
	offsets := make([]uint32, len(slices))
	for i, s := range slices {
		offsets[i] = offset
		_ = binary.Write(&b, binary.BigEndian, []uint32{s.cpu, s.sub, offset, uint32(len(s.data)), align})
		offset += uint32(len(s.data))
		offset = (offset + (1<<align - 1)) &^ (1<<align - 1)
	}
	for i, s := range slices {
		b.Write(make([]byte, int(offsets[i])-b.Len()))
		b.Write(s.data)
	}
	return b.Bytes(), nil
}

func infoPlist(version string) []byte {
	return []byte(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Penulis NFC</string>
  <key>CFBundleDisplayName</key><string>Penulis NFC</string>
  <key>CFBundleIdentifier</key><string>id.rsbethesda.penulisnfc</string>
  <key>CFBundleExecutable</key><string>PenulisNFC</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>` + version + `</string>
  <key>CFBundleShortVersionString</key><string>` + version + `</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
`)
}

func writeZip(out, version string, binaryData []byte) error {
	f, err := os.Create(out)
	if err != nil {
		return err
	}
	defer f.Close()
	z := zip.NewWriter(f)
	now := time.Now()
	add := func(name string, mode os.FileMode, data []byte) error {
		h := &zip.FileHeader{Name: name, Method: zip.Deflate, Modified: now}
		h.SetMode(mode) // also marks the entry as made on Unix, so Archive Utility keeps the mode
		if mode.IsDir() {
			h.Method = zip.Store
		}
		w, err := z.CreateHeader(h)
		if err != nil || data == nil {
			return err
		}
		_, err = w.Write(data)
		return err
	}
	for _, e := range []struct {
		name string
		mode os.FileMode
		data []byte
	}{
		{"PenulisNFC.app/", os.ModeDir | 0o755, nil},
		{"PenulisNFC.app/Contents/", os.ModeDir | 0o755, nil},
		{"PenulisNFC.app/Contents/Info.plist", 0o644, infoPlist(version)},
		{"PenulisNFC.app/Contents/MacOS/", os.ModeDir | 0o755, nil},
		{"PenulisNFC.app/Contents/MacOS/PenulisNFC", 0o755, binaryData},
	} {
		if err := add(e.name, e.mode, e.data); err != nil {
			return err
		}
	}
	return z.Close()
}

func check(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
