package main

// The system smart-card service (PC/SC): winscard.dll on Windows (pcsc_windows.go), PCSC.framework on macOS
// (pcsc_darwin.go, loaded at run time so the Mac app builds without Apple's toolchain). The ACR122U uses the
// system's CCID driver (on some Macs, the free ACS driver).

import (
	"fmt"
	"strings"
)

// PC/SC return codes and reader state flags (the same values on Windows and macOS).
const (
	scardOK               = 0x00000000
	scardTimeout          = 0x8010000A
	scardSharingViolation = 0x8010000B
	scardNoSmartcard      = 0x8010000C
	scardUnresponsiveCard = 0x80100066
	scardResetCard        = 0x80100068
	scardRemovedCard      = 0x80100069
	scardInternalError    = 0x80100001
	stateUnaware          = 0x0000
	statePresent          = 0x0020
	stateMute             = 0x0200
	shareShared           = 2
	protocolAny           = 3 // T0 | T1
	dispositionLeave      = 0
	dispositionReset      = 1
)

// pcContext and pcCard are the few PC/SC calls the helper needs, per system.
type pcContext interface {
	release()
	readers() []string
	state(reader string) (flags uint32, atr []byte)
	connect(reader string) (pcCard, uint32)
}

type pcCard interface {
	transmit(apdu []byte) ([]byte, uint32)
	reconnect() uint32
	disconnect()
}

// nfcError is a failure the admin page shows: a code for the page's logic and an Indonesian message.
type nfcError struct{ Code, Msg string }

func (e *nfcError) Error() string { return e.Msg }

func fail(code, msg string) error { return &nfcError{code, msg} }

func errCode(err error) string {
	if e, ok := err.(*nfcError); ok {
		return e.Code
	}
	return "internal"
}

const msgNoReader = "Pembaca NFC (ACR122U) tidak terdeteksi. Colokkan ke USB komputer ini."
const msgRemoved = "Kartu bergeser atau diangkat sebelum selesai."

// openContext opens the smart-card service. Windows only runs it while a reader is plugged in.
func openContext() (pcContext, error) {
	ctx, rc := establish()
	if rc != scardOK || ctx == nil {
		return nil, fail("no_reader", msgNoReader)
	}
	return ctx, nil
}

// pickReader prefers an ACS ACR122U, then any reader named PICC or NFC, then the first.
func pickReader(readers []string) string {
	for _, r := range readers {
		if strings.Contains(strings.ToUpper(r), "ACR122") {
			return r
		}
	}
	for _, r := range readers {
		u := strings.ToUpper(r)
		if strings.Contains(u, "PICC") || strings.Contains(u, "NFC") {
			return r
		}
	}
	if len(readers) > 0 {
		return readers[0]
	}
	return ""
}

func cardPresent(state uint32) bool {
	return state&statePresent != 0 && state&stateMute == 0
}

// conn is one connected card, sending the ACR122U's PC/SC pseudo-APDUs.
type conn struct{ card pcCard }

func (c *conn) transmit(apdu []byte) ([]byte, error) {
	r, rc := c.card.transmit(apdu)
	switch rc {
	case scardOK:
		return r, nil
	case scardRemovedCard, scardNoSmartcard, scardUnresponsiveCard, scardResetCard:
		return nil, fail("card_removed", msgRemoved)
	}
	return nil, fail("io", fmt.Sprintf("Pembaca tidak menjawab (%08X).", rc))
}

// command sends an APDU and returns its data when the card answers 90 00.
func (c *conn) command(apdu []byte) ([]byte, error) {
	r, err := c.transmit(apdu)
	if err != nil {
		return nil, err
	}
	if len(r) < 2 {
		return nil, fail("io", "Jawaban pembaca tidak lengkap.")
	}
	sw1, sw2 := r[len(r)-2], r[len(r)-1]
	if sw1 != 0x90 || sw2 != 0x00 {
		logf("apdu %s -> %s", hexUpper(apdu), hexUpper(r))
		return nil, fail("io", fmt.Sprintf("Kartu menolak perintah (%02X%02X).", sw1, sw2))
	}
	return r[:len(r)-2], nil
}

func (c *conn) uid() (string, error) {
	r, err := c.command([]byte{0xFF, 0xCA, 0x00, 0x00, 0x00})
	if err != nil {
		return "", err
	}
	return hexUpper(r), nil
}

// wake re-activates a card that halted (a MIFARE Classic card does after a wrong key).
func (c *conn) wake() error {
	if rc := c.card.reconnect(); rc != scardOK {
		return fail("card_removed", msgRemoved)
	}
	return nil
}
