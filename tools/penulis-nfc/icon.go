//go:build windows

package main

// The tray icon, drawn in code: a navy rounded square with white contactless waves. Windows wants ICO
// bytes (a PNG inside an ICO header works since Vista); macOS takes the PNG.

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"math"
	"runtime"
)

func iconPNG(size int) []byte {
	img := image.NewNRGBA(image.Rect(0, 0, size, size))
	navy := color.NRGBA{0x2F, 0x31, 0x8B, 0xFF}
	white := color.NRGBA{0xFF, 0xFF, 0xFF, 0xFF}
	s := float64(size)
	radius := s * 0.2
	cx, cy := s*0.28, s*0.5
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			fx, fy := float64(x)+0.5, float64(y)+0.5
			// rounded square
			dx := math.Max(math.Max(radius-fx, fx-(s-radius)), 0)
			dy := math.Max(math.Max(radius-fy, fy-(s-radius)), 0)
			if dx*dx+dy*dy > radius*radius {
				continue
			}
			c := navy
			ex, ey := fx-cx, fy-cy
			d := math.Hypot(ex, ey)
			angle := math.Abs(math.Atan2(ey, ex)) * 180 / math.Pi
			if d < s*0.08 {
				c = white
			}
			for _, r := range []float64{0.2, 0.33, 0.46} {
				if angle <= 48 && math.Abs(d-r*s) < s*0.045 {
					c = white
				}
			}
			img.SetNRGBA(x, y, c)
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func trayIcon() []byte {
	if runtime.GOOS != "windows" {
		return iconPNG(44)
	}
	p := iconPNG(64)
	var b bytes.Buffer
	// ICONDIR: reserved, type 1 (icon), 1 image; ICONDIRENTRY: 64x64, 32 bpp, size, offset 22.
	_ = binary.Write(&b, binary.LittleEndian, []uint16{0, 1, 1})
	b.Write([]byte{64, 64, 0, 0})
	_ = binary.Write(&b, binary.LittleEndian, []uint16{1, 32})
	_ = binary.Write(&b, binary.LittleEndian, []uint32{uint32(len(p)), 22})
	b.Write(p)
	return b.Bytes()
}
