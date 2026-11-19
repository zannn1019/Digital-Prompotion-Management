package main

// The system smart-card service (PC/SC): winscard.dll on Windows, PCSC.framework on macOS. The ACR122U uses
// the system's CCID driver, so nothing else is needed (on some Macs, the free ACS driver).

import (
	"fmt"
	"strings"

	"github.com/ebfe/scard"
)

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
func openContext() (*scard.Context, error) {
	ctx, err := scard.EstablishContext()
	if err != nil {
		return nil, fail("no_reader", msgNoReader)
	}
	return ctx, nil
}

func listReaders(ctx *scard.Context) []string {
	r, err := ctx.ListReaders()
	if err != nil {
		return nil
	}
	return r
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

// readerState is the reader's state flags and the ATR of the card on it, right now.
func readerState(ctx *scard.Context, reader string) (scard.StateFlag, []byte) {
	rs := []scard.ReaderState{{Reader: reader, CurrentState: scard.StateUnaware}}
	if err := ctx.GetStatusChange(rs, 0); err != nil && err != scard.ErrTimeout {
		return 0, nil
	}
	return rs[0].EventState, rs[0].Atr
}

func cardPresent(state scard.StateFlag) bool {
	return state&scard.StatePresent != 0 && state&scard.StateMute == 0
}

// conn is one connected card, sending the ACR122U's PC/SC pseudo-APDUs.
type conn struct{ card *scard.Card }

func (c *conn) transmit(apdu []byte) ([]byte, error) {
	r, err := c.card.Transmit(apdu)
	if err != nil {
		switch err {
		case scard.ErrRemovedCard, scard.ErrNoSmartcard, scard.ErrUnresponsiveCard, scard.ErrResetCard:
			return nil, fail("card_removed", msgRemoved)
		}
		return nil, fail("io", fmt.Sprintf("Pembaca tidak menjawab (%v).", err))
	}
	return r, nil
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
	if err := c.card.Reconnect(scard.ShareShared, scard.ProtocolAny, scard.ResetCard); err != nil {
		return fail("card_removed", msgRemoved)
	}
	return nil
}
