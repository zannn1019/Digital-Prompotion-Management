package main

// Waits for a card on the reader and runs one operation on it. One operation at a time.

import (
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ebfe/scard"
)

type writer struct {
	mu        sync.Mutex
	busy      bool
	cancelled atomic.Bool
	waiting   atomic.Value // "", "card" or "remove_previous"
}

func (w *writer) waitingFor() any {
	if s, _ := w.waiting.Load().(string); s != "" {
		return s
	}
	return nil
}

func (w *writer) status() map[string]any {
	w.mu.Lock()
	busy := w.busy
	w.mu.Unlock()
	s := map[string]any{"busy": busy, "waiting": w.waitingFor(), "service": false, "readers": []string{}, "reader": nil, "card": false}
	ctx, err := openContext()
	if err != nil {
		return s
	}
	defer ctx.Release()
	readers := listReaders(ctx)
	s["service"] = true
	if readers != nil {
		s["readers"] = readers
	}
	if r := pickReader(readers); r != "" {
		s["reader"] = r
		state, _ := readerState(ctx, r)
		s["card"] = cardPresent(state)
	}
	return s
}

func (w *writer) cancel() { w.cancelled.Store(true) }

// withCard waits up to timeout for a card, skipping the card with UID skipUID (the one just written, still
// lying on the reader), then runs op on it.
func withCard[T any](w *writer, skipUID string, timeout time.Duration, op func(tag) (T, error)) (T, error) {
	var zero T
	w.mu.Lock()
	if w.busy {
		w.mu.Unlock()
		return zero, fail("busy", "Penulis NFC sedang menulis kartu lain.")
	}
	w.busy = true
	w.cancelled.Store(false)
	w.mu.Unlock()
	defer func() {
		w.waiting.Store("")
		w.mu.Lock()
		w.busy = false
		w.mu.Unlock()
	}()

	ctx, err := openContext()
	if err != nil {
		return zero, err
	}
	defer ctx.Release()
	reader := pickReader(listReaders(ctx))
	if reader == "" {
		return zero, fail("no_reader", msgNoReader)
	}
	w.waiting.Store("card")
	logf("wait for card on %s (skip %q)", reader, skipUID)
	deadline := time.Now().Add(timeout)
	var lastState scard.StateFlag
	var lastErr error
	for {
		if w.cancelled.Load() {
			return zero, fail("cancelled", "Dibatalkan.")
		}
		if time.Now().After(deadline) {
			logf("timeout; last state %X, last connect %v", lastState, lastErr)
			if lastErr != nil {
				return zero, fail("timeout", "Kartu terdeteksi tetapi tidak bisa dibuka ("+lastErr.Error()+"). Angkat kartu, tempelkan lagi di tengah pembaca, lalu coba lagi.")
			}
			return zero, fail("timeout", "Tidak ada kartu yang ditempelkan. Coba lagi.")
		}
		state, atr := readerState(ctx, reader)
		if state != lastState {
			logf("reader state %X atr %s", state, hexUpper(atr))
			lastState = state
		}
		if state == 0 && !contains(listReaders(ctx), reader) {
			return zero, fail("no_reader", "Pembaca NFC dicabut. Colokkan lagi, lalu coba lagi.")
		}
		if cardPresent(state) {
			card, err := ctx.Connect(reader, scard.ShareShared, scard.ProtocolAny)
			if err == scard.ErrSharingViolation {
				return zero, fail("reader_in_use", "Pembaca sedang dipakai program lain. Tutup program NFC lain, lalu coba lagi.")
			}
			if err != nil {
				if lastErr == nil || lastErr.Error() != err.Error() {
					logf("connect %v", err)
				}
				lastErr = err
			} else {
				lastErr = nil
				c := &conn{card: card}
				uid, err := c.uid()
				switch {
				case err != nil && errCode(err) == "card_removed":
					// Pulled away while being identified: keep waiting for it.
				case err != nil:
					card.Disconnect(scard.LeaveCard)
					return zero, err
				case skipUID != "" && strings.EqualFold(uid, skipUID):
					w.waiting.Store("remove_previous")
				default:
					w.waiting.Store("")
					t, err := openTag(c, atr)
					if err != nil {
						card.Disconnect(scard.LeaveCard)
						return zero, err
					}
					result, err := op(t)
					card.Disconnect(scard.LeaveCard)
					if err != nil {
						logf("error %s: %s", errCode(err), err.Error())
					}
					return result, err
				}
				card.Disconnect(scard.LeaveCard)
			}
		} else if w.waitingFor() == "remove_previous" {
			w.waiting.Store("card")
		}
		time.Sleep(150 * time.Millisecond)
	}
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	if neg {
		return "-" + string(b)
	}
	return string(b)
}
