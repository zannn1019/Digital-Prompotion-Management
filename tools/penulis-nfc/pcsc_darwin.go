package main

// PC/SC on macOS: Apple's PCSC.framework, loaded at run time with purego. No cgo, so the Mac app is built on
// any computer (build.cmd). macOS types (PCSC/wintypes.h, pcsclite.h): DWORD and LONG are 32-bit, SCARDCONTEXT
// and SCARDHANDLE are int32, and SCARD_READERSTATE is packed with a 33-byte ATR. The Go struct below has the
// same field offsets (8-byte pointers first, then 32-bit fields, then bytes); only its tail padding differs,
// which does not matter for an array of one.

import (
	"runtime"
	"sync"
	"unsafe"

	"github.com/ebitengine/purego"
)

const pcscFramework = "/System/Library/Frameworks/PCSC.framework/PCSC"

type ioRequest struct {
	protocol  uint32
	pciLength uint32
}

type readerStateMac struct {
	reader   uintptr // const char *
	userData uintptr
	current  uint32
	event    uint32
	atrLen   uint32
	atr      [33]byte
}

var (
	pcscOnce    sync.Once
	pcscLoadErr error

	fEstablish  func(scope uint32, r1, r2 uintptr, ctx *int32) int32
	fRelease    func(ctx int32) int32
	fList       func(ctx int32, groups uintptr, readers uintptr, length *uint32) int32
	fConnect    func(ctx int32, reader string, share, protocols uint32, card *int32, active *uint32) int32
	fReconnect  func(card int32, share, protocols, init uint32, active *uint32) int32
	fDisconnect func(card int32, disposition uint32) int32
	fTransmit   func(card int32, send *ioRequest, buf uintptr, n uint32, recv uintptr, out uintptr, outLen *uint32) int32
	fStatus     func(ctx int32, timeout uint32, states *readerStateMac, n uint32) int32
)

func loadPCSC() error {
	pcscOnce.Do(func() {
		lib, err := purego.Dlopen(pcscFramework, purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			pcscLoadErr = err
			logf("load PCSC.framework: %v", err)
			return
		}
		purego.RegisterLibFunc(&fEstablish, lib, "SCardEstablishContext")
		purego.RegisterLibFunc(&fRelease, lib, "SCardReleaseContext")
		purego.RegisterLibFunc(&fList, lib, "SCardListReaders")
		purego.RegisterLibFunc(&fConnect, lib, "SCardConnect")
		purego.RegisterLibFunc(&fReconnect, lib, "SCardReconnect")
		purego.RegisterLibFunc(&fDisconnect, lib, "SCardDisconnect")
		purego.RegisterLibFunc(&fTransmit, lib, "SCardTransmit")
		purego.RegisterLibFunc(&fStatus, lib, "SCardGetStatusChange")
	})
	return pcscLoadErr
}

type macContext struct{ ctx int32 }

func establish() (pcContext, uint32) {
	if loadPCSC() != nil {
		return nil, scardInternalError
	}
	var ctx int32
	if rc := uint32(fEstablish(2 /* SCARD_SCOPE_SYSTEM */, 0, 0, &ctx)); rc != scardOK {
		return nil, rc
	}
	return &macContext{ctx}, scardOK
}

func (m *macContext) release() { fRelease(m.ctx) }

func (m *macContext) readers() []string {
	var n uint32
	if rc := uint32(fList(m.ctx, 0, 0, &n)); rc != scardOK || n == 0 {
		return nil
	}
	buf := make([]byte, n)
	if rc := uint32(fList(m.ctx, 0, uintptr(unsafe.Pointer(&buf[0])), &n)); rc != scardOK {
		return nil
	}
	runtime.KeepAlive(buf)
	var out []string
	start := 0
	for i := 0; i < int(n) && i < len(buf); i++ {
		if buf[i] == 0 {
			if i > start {
				out = append(out, string(buf[start:i]))
			}
			start = i + 1
		}
	}
	return out
}

func (m *macContext) state(reader string) (uint32, []byte) {
	name := append([]byte(reader), 0)
	rs := readerStateMac{reader: uintptr(unsafe.Pointer(&name[0])), current: stateUnaware}
	rc := uint32(fStatus(m.ctx, 0, &rs, 1))
	runtime.KeepAlive(name)
	if rc != scardOK && rc != scardTimeout {
		return 0, nil
	}
	n := int(rs.atrLen)
	if n > len(rs.atr) {
		n = len(rs.atr)
	}
	return rs.event, append([]byte(nil), rs.atr[:n]...)
}

func (m *macContext) connect(reader string) (pcCard, uint32) {
	var card int32
	var active uint32
	if rc := uint32(fConnect(m.ctx, reader, shareShared, protocolAny, &card, &active)); rc != scardOK {
		return nil, rc
	}
	return &macCard{card: card, protocol: active}, scardOK
}

type macCard struct {
	card     int32
	protocol uint32
}

func (m *macCard) transmit(apdu []byte) ([]byte, uint32) {
	send := ioRequest{protocol: m.protocol, pciLength: 8}
	out := make([]byte, 264)
	n := uint32(len(out))
	rc := uint32(fTransmit(m.card, &send, uintptr(unsafe.Pointer(&apdu[0])), uint32(len(apdu)), 0, uintptr(unsafe.Pointer(&out[0])), &n))
	runtime.KeepAlive(apdu)
	runtime.KeepAlive(out)
	if rc != scardOK {
		return nil, rc
	}
	return out[:n], scardOK
}

func (m *macCard) reconnect() uint32 {
	var active uint32
	rc := uint32(fReconnect(m.card, shareShared, protocolAny, dispositionReset, &active))
	if rc == scardOK {
		m.protocol = active
	}
	return rc
}

func (m *macCard) disconnect() { fDisconnect(m.card, dispositionLeave) }
