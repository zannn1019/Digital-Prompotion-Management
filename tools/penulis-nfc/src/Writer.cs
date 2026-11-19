// Waits for a card on the reader and runs one operation on it. One operation at a time.
using System;
using System.Collections.Generic;
using System.Threading;

namespace PenulisNfc
{
    class Writer
    {
        readonly object gate = new object();
        bool busy;
        volatile bool cancelled;
        /// <summary>What a running operation waits for: "card", "remove_previous", or null.</summary>
        public volatile string Waiting;

        public Dictionary<string, object> Status()
        {
            var s = new Dictionary<string, object>();
            s["busy"] = busy;
            s["waiting"] = Waiting;
            IntPtr context;
            try { context = SCard.Open(); }
            catch (NfcError)
            {
                s["service"] = false;
                s["readers"] = new string[0];
                s["reader"] = null;
                s["card"] = false;
                return s;
            }
            try
            {
                s["service"] = true;
                List<string> readers = SCard.Readers(context);
                string reader = SCard.PickReader(readers);
                s["readers"] = readers.ToArray();
                s["reader"] = reader;
                uint state = reader == null ? 0 : SCard.State(context, reader);
                s["card"] = (state & SCard.StatePresent) != 0 && (state & SCard.StateMute) == 0;
            }
            finally { SCard.SCardReleaseContext(context); }
            return s;
        }

        public void Cancel()
        {
            cancelled = true;
        }

        /// <summary>
        /// Waits up to <paramref name="timeoutMs"/> for a card, skipping the card with UID
        /// <paramref name="skipUid"/> (the one just written, still lying on the reader), then runs <paramref name="op"/>.
        /// </summary>
        public T WithCard<T>(Func<Tag, T> op, string skipUid, int timeoutMs)
        {
            lock (gate)
            {
                if (busy) throw new NfcError("busy", "Penulis NFC sedang menulis kartu lain.");
                busy = true;
                cancelled = false;
            }
            IntPtr context = IntPtr.Zero;
            try
            {
                context = SCard.Open();
                string reader = SCard.PickReader(SCard.Readers(context));
                if (reader == null)
                    throw new NfcError("no_reader", "Pembaca NFC (ACR122U) tidak terdeteksi. Colokkan ke USB komputer ini.");
                Waiting = "card";
                Log.Write("wait for card on " + reader + (skipUid != null ? " (skip " + skipUid + ")" : ""));
                int lastRc = 0;
                uint lastState = 0;
                DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
                while (true)
                {
                    if (cancelled) throw new NfcError("cancelled", "Dibatalkan.");
                    if (DateTime.UtcNow > deadline)
                    {
                        Log.Write("timeout; last state " + lastState.ToString("X") + ", last connect " + lastRc.ToString("X8"));
                        throw new NfcError("timeout", lastRc != 0
                            ? "Kartu terdeteksi tetapi tidak bisa dibuka (" + lastRc.ToString("X8") + "). Angkat kartu, tempelkan lagi di tengah pembaca, lalu coba lagi."
                            : "Tidak ada kartu yang ditempelkan. Coba lagi.");
                    }
                    uint state = SCard.State(context, reader);
                    if (state != lastState) { Log.Write("reader state " + state.ToString("X") + " atr " + Ndef.Hex(SCard.Atr(context, reader))); lastState = state; }
                    if (state == 0 && !SCard.Readers(context).Contains(reader))
                        throw new NfcError("no_reader", "Pembaca NFC dicabut. Colokkan lagi, lalu coba lagi.");
                    if ((state & SCard.StatePresent) != 0 && (state & SCard.StateMute) == 0)
                    {
                        IntPtr card;
                        uint protocol;
                        int rc = SCard.SCardConnect(context, reader, SCard.ShareShared, SCard.ProtocolT0T1, out card, out protocol);
                        if (rc != lastRc) { Log.Write("connect " + rc.ToString("X8") + " protocol " + protocol); lastRc = rc; }
                        if (rc == SCard.SharingViolation)
                            throw new NfcError("reader_in_use", "Pembaca sedang dipakai program lain. Tutup program NFC lain, lalu coba lagi.");
                        if (rc == SCard.Success)
                        {
                            try
                            {
                                var tag = Tag.Open(card, protocol, SCard.Atr(context, reader));
                                if (skipUid != null && string.Equals(tag.Uid(), skipUid, StringComparison.OrdinalIgnoreCase))
                                {
                                    Waiting = "remove_previous";
                                }
                                else
                                {
                                    Waiting = null;
                                    return op(tag);
                                }
                            }
                            catch (NfcError e)
                            {
                                Log.Write("error " + e.Code + ": " + e.Message);
                                // A card pulled away while being identified: keep waiting for it.
                                if (e.Code != "card_removed" || Waiting == null) throw;
                            }
                            finally { SCard.SCardDisconnect(card, SCard.LeaveCard); }
                        }
                    }
                    else if (Waiting == "remove_previous")
                    {
                        Waiting = "card";
                    }
                    Thread.Sleep(150);
                }
            }
            finally
            {
                Waiting = null;
                if (context != IntPtr.Zero) SCard.SCardReleaseContext(context);
                lock (gate) busy = false;
            }
        }
    }
}
