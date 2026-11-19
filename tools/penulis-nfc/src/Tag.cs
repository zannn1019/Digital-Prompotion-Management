// A card on the ACR122U, through its PC/SC pseudo-APDUs: FF CA (UID), FF B0 (read), FF D6 (write).
// Tag.Open picks the card family from the ATR: NFC Forum Type 2 (NTAG213/215/216, Ultralight) here,
// MIFARE Classic 1K in ClassicTag.cs.
using System;

namespace PenulisNfc
{
    public class TagInfo
    {
        public string Uid;
        public string Type;
        public int DataBytes; // NDEF data area from the capability container
        public bool ReadOnly;
        public string Url; // the URI on the card now, or null
    }

    public class WriteResult
    {
        public TagInfo Tag;
        public bool Locked;
        /// <summary>Why the card was not locked although that was asked, or null.</summary>
        public string LockSkipped;
    }

    abstract class Tag
    {
        protected readonly IntPtr card;
        protected uint protocol;

        protected Tag(IntPtr card, uint protocol)
        {
            this.card = card;
            this.protocol = protocol;
        }

        /// <summary>The right kind of card from its ATR (PC/SC part 3: bytes 13-14 name the card).</summary>
        public static Tag Open(IntPtr card, uint protocol, byte[] atr)
        {
            int name = atr.Length >= 15 && atr[4] == 0x80 && atr[5] == 0x4F ? (atr[13] << 8) | atr[14] : -1;
            if (name == 0x0001) return new ClassicTag(card, protocol);
            if (name == 0x0002)
                throw new NfcError("unsupported", "Kartu MIFARE Classic 4K belum didukung. Pakai kartu NTAG213/215/216 atau MIFARE Classic 1K.");
            return new Type2Tag(card, protocol);
        }

        public abstract TagInfo Inspect();
        public abstract WriteResult WriteUrl(TagInfo info, string url, bool lockCard);

        protected byte[] Command(byte[] apdu)
        {
            byte[] r = SCard.Transmit(card, protocol, apdu);
            if (r.Length < 2) throw new NfcError("io", "Jawaban pembaca tidak lengkap.");
            byte sw1 = r[r.Length - 2], sw2 = r[r.Length - 1];
            if (sw1 != 0x90 || sw2 != 0x00)
            {
                Log.Write("apdu " + Ndef.Hex(apdu) + " -> " + Ndef.Hex(r));
                throw new NfcError("io", "Kartu menolak perintah (" + sw1.ToString("X2") + sw2.ToString("X2") + ").");
            }
            var data = new byte[r.Length - 2];
            Array.Copy(r, data, data.Length);
            return data;
        }

        public string Uid()
        {
            return Ndef.Hex(Command(new byte[] { 0xFF, 0xCA, 0x00, 0x00, 0x00 }));
        }
    }

    /// <summary>NFC Forum Type 2: NTAG213/215/216, MIFARE Ultralight (4-byte pages).</summary>
    class Type2Tag : Tag
    {
        public Type2Tag(IntPtr card, uint protocol) : base(card, protocol) { }

        /// <summary>Four pages (16 bytes) from <paramref name="page"/>.</summary>
        public byte[] Read(int page)
        {
            byte[] data = Command(new byte[] { 0xFF, 0xB0, 0x00, (byte)page, 0x10 });
            if (data.Length < 16) throw new NfcError("io", "Kartu tidak terbaca lengkap.");
            return data;
        }

        public void Write(int page, byte[] four, int offset)
        {
            var apdu = new byte[] { 0xFF, 0xD6, 0x00, (byte)page, 0x04, four[offset], four[offset + 1], four[offset + 2], four[offset + 3] };
            try { Command(apdu); }
            catch (NfcError e)
            {
                if (e.Code == "card_removed") throw;
                throw new NfcError("write_failed", "Kartu menolak ditulis di halaman " + page + ". Kartu mungkin terkunci atau dilindungi kata sandi.");
            }
        }

        /// <summary>The card model from the capability-container size (NTAG21x factory values).</summary>
        static string TypeName(byte ccSize)
        {
            if (ccSize == 0x12) return "NTAG213";
            if (ccSize == 0x3E) return "NTAG215";
            if (ccSize == 0x6D) return "NTAG216";
            if (ccSize == 0x06) return "MIFARE Ultralight";
            return "NFC Tipe 2";
        }

        // No GET_VERSION: sent through the ACR122U it can leave the card idle, and every command after it
        // then fails with 6300. The capability container says enough.
        public override TagInfo Inspect()
        {
            var info = new TagInfo();
            info.Uid = Uid();
            byte[] head = Read(0); // pages 0-3: UID, lock bytes (page 2), capability container (page 3)
            byte cc0 = head[12], cc2 = head[14], cc3 = head[15];
            if (cc0 == 0x00 && head[13] == 0x00 && cc2 == 0x00 && cc3 == 0x00)
                throw new NfcError("unsupported", "Kartu ini belum diformat untuk NFC (NDEF). Format dulu dengan aplikasi NFC Tools, atau pakai kartu NTAG213/215/216 baru.");
            if (cc0 != 0xE1)
                throw new NfcError("unsupported", "Kartu ini bukan kartu NFC yang bisa ditulis alamat (pakai NTAG213/215/216).");
            info.Type = TypeName(cc2);
            info.DataBytes = cc2 * 8;
            // Read-only: the CC says so, or the static lock bits cover pages 4-15 (lock byte 0 bits 4-7, lock byte 1).
            info.ReadOnly = cc3 != 0x00 || (head[10] & 0xF0) != 0 || head[11] != 0;
            info.Url = ReadMessageUrl(info.DataBytes);
            return info;
        }

        string ReadMessageUrl(int dataBytes)
        {
            int length = Math.Min(dataBytes, 256);
            var data = new byte[length];
            for (int i = 0; i < length; i += 16)
            {
                byte[] block = Read(4 + i / 4);
                Array.Copy(block, 0, data, i, Math.Min(16, length - i));
            }
            try { return Ndef.ReadUri(data); }
            catch { return null; }
        }

        public override WriteResult WriteUrl(TagInfo info, string url, bool lockCard)
        {
            if (info.ReadOnly)
                throw new NfcError("read_only", "Kartu ini sudah terkunci, jadi tidak bisa ditulis ulang. Pakai kartu lain.");
            byte[] data = Ndef.TypeTwoTlv(Ndef.UriRecord(url));
            if (data.Length > info.DataBytes)
                throw new NfcError("too_small", "Alamat terlalu panjang untuk kartu ini (" + data.Length + " dari " + info.DataBytes + " byte).");

            // Empty message first, then the rest, then page 4 last: a card pulled away mid-write ends up
            // empty instead of holding a broken address.
            Write(4, new byte[] { 0x03, 0x00, 0xFE, 0x00 }, 0);
            for (int i = 4; i < data.Length; i += 4) Write(4 + i / 4, data, i);
            Write(4, data, 0);

            for (int i = 0; i < data.Length; i += 16)
            {
                byte[] block = Read(4 + i / 4);
                for (int k = 0; k < 16 && i + k < data.Length; k++)
                    if (block[k] != data[i + k])
                        throw new NfcError("verify_failed", "Isi kartu tidak sama setelah ditulis. Tulis ulang kartu ini.");
            }

            var result = new WriteResult { Tag = info, Locked = false };
            info.Url = url;
            if (!lockCard) return result;
            // Only the static lock bits are used: they cover pages 3-15, where the address is. A longer
            // message would also need the per-model dynamic lock bits, so it is left unlocked.
            if (data.Length > 48)
            {
                result.LockSkipped = "Alamat lebih panjang dari 48 byte, jadi kartu tidak dikunci.";
                return result;
            }
            try
            {
                byte[] head = Read(0);
                Write(3, new byte[] { 0xE1, head[13], head[14], 0x0F }, 0); // CC: read-only access
                Write(2, new byte[] { head[8], head[9], 0xFF, 0xFF }, 0); // static lock bytes
                result.Locked = true;
                info.ReadOnly = true;
            }
            catch (NfcError e)
            {
                if (e.Code == "card_removed") result.LockSkipped = "Kartu diangkat sebelum dikunci. Alamat sudah tertulis, tetapi kartu belum terkunci.";
                else result.LockSkipped = "Alamat sudah tertulis, tetapi kartu gagal dikunci.";
            }
            return result;
        }
    }
}
