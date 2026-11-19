package main

// PC/SC on Windows: winscard.dll through github.com/ebfe/scard (plain syscalls, no C compiler needed).

import (
	"time"

	"github.com/ebfe/scard"
)

func rcOf(err error) uint32 {
	if err == nil {
		return scardOK
	}
	if e, ok := err.(scard.Error); ok {
		return uint32(e)
	}
	return scardInternalError
}

type winContext struct{ ctx *scard.Context }

func establish() (pcContext, uint32) {
	ctx, err := scard.EstablishContext()
	if err != nil {
		return nil, rcOf(err)
	}
	return &winContext{ctx}, scardOK
}

func (w *winContext) release() { _ = w.ctx.Release() }

func (w *winContext) readers() []string {
	r, err := w.ctx.ListReaders()
	if err != nil {
		return nil
	}
	return r
}

func (w *winContext) state(reader string) (uint32, []byte) {
	rs := []scard.ReaderState{{Reader: reader, CurrentState: scard.StateUnaware}}
	if err := w.ctx.GetStatusChange(rs, 0*time.Millisecond); err != nil && rcOf(err) != scardTimeout {
		return 0, nil
	}
	return uint32(rs[0].EventState), rs[0].Atr
}

func (w *winContext) connect(reader string) (pcCard, uint32) {
	card, err := w.ctx.Connect(reader, scard.ShareShared, scard.ProtocolAny)
	if err != nil {
		return nil, rcOf(err)
	}
	return &winCard{card}, scardOK
}

type winCard struct{ card *scard.Card }

func (w *winCard) transmit(apdu []byte) ([]byte, uint32) {
	r, err := w.card.Transmit(apdu)
	return r, rcOf(err)
}

func (w *winCard) reconnect() uint32 {
	return rcOf(w.card.Reconnect(scard.ShareShared, scard.ProtocolAny, scard.ResetCard))
}

func (w *winCard) disconnect() { _ = w.card.Disconnect(scard.LeaveCard) }
