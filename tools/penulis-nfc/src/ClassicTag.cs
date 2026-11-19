// MIFARE Classic 1K with NDEF, the layout Android and NFC Tools use (NXP AN1305):
//   sector 0     MAD1 in blocks 1-2, key A A0A1A2A3A4A5
//   sectors 1-15 NDEF data in blocks 0-2 of each sector, key A D3F7D3F7D3F7 (reads and writes data)
// A blank card (factory keys FFFFFFFFFFFF) is formatted to that layout first. The NDEF bytes are the same
// TLV as on Type 2 cards (03 len record FE), spread over the data blocks, skipping the sector trailers.
// ACR122U commands: FF 82 (load key), FF 86 (authenticate), FF B0/FF D6 with 16-byte blocks.
using System;
using System.Collections.Generic;

namespace PenulisNfc
{
    class ClassicTag : Tag
    {
        static readonly byte[] KeyDefault = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };
        static readonly byte[] KeyMad = { 0xA0, 0xA1, 0xA2, 0xA3, 0xA4, 0xA5 };
        static readonly byte[] KeyNdef = { 0xD3, 0xF7, 0xD3, 0xF7, 0xD3, 0xF7 };
        const byte KeyA = 0x60;
        const int Sectors = 16;
        const int DataBytes = 15 * 48; // sectors 1-15, 3 data blocks of 16 bytes

        bool formatted;

        public ClassicTag(IntPtr card, uint protocol) : base(card, protocol) { }

        /// <summary>Authenticates the sector of <paramref name="block"/>. A wrong key halts the card, so it is woken again.</summary>
        bool Auth(int block, byte[] key)
        {
            var load = new byte[11];
            load[0] = 0xFF; load[1] = 0x82; load[2] = 0x00; load[3] = 0x00; load[4] = 0x06;
            Array.Copy(key, 0, load, 5, 6);
            Command(load);
            try
            {
                Command(new byte[] { 0xFF, 0x86, 0x00, 0x00, 0x05, 0x01, 0x00, (byte)block, KeyA, 0x00 });
                return true;
            }
            catch (NfcError e)
            {
                if (e.Code == "card_removed") throw;
                uint active;
                int rc = SCard.SCardReconnect(card, SCard.ShareShared, SCard.ProtocolT0T1, SCard.ResetCard, out active);
                if (rc != SCard.Success)
                    throw new NfcError("card_removed", "Kartu bergeser atau diangkat sebelum selesai.");
                protocol = active;
                return false;
            }
        }

        byte[] ReadBlock(int block)
        {
            byte[] data = Command(new byte[] { 0xFF, 0xB0, 0x00, (byte)block, 0x10 });
            if (data.Length < 16) throw new NfcError("io", "Kartu tidak terbaca lengkap.");
            return data;
        }

        void WriteBlock(int block, byte[] data, int offset)
        {
            var apdu = new byte[21];
            apdu[0] = 0xFF; apdu[1] = 0xD6; apdu[2] = 0x00; apdu[3] = (byte)block; apdu[4] = 0x10;
            Array.Copy(data, offset, apdu, 5, 16);
            try { Command(apdu); }
            catch (NfcError e)
            {
                if (e.Code == "card_removed") throw;
                throw new NfcError("write_failed", "Kartu menolak ditulis di blok " + block + ". Sektor kartu ini mungkin dikunci dengan kunci lain.");
            }
        }

        /// <summary>The data blocks (in order) that hold NDEF: blocks 0-2 of sectors 1-15.</summary>
        static List<int> DataBlocks()
        {
            var list = new List<int>();
            for (int s = 1; s < Sectors; s++)
                for (int b = 0; b < 3; b++) list.Add(s * 4 + b);
            return list;
        }

        public override TagInfo Inspect()
        {
            var info = new TagInfo { Uid = Uid(), Type = "MIFARE Classic 1K", DataBytes = DataBytes };
            if (Auth(4, KeyNdef))
            {
                formatted = true;
                info.Url = ReadMessageUrl();
                return info;
            }
            if (Auth(4, KeyDefault))
            {
                formatted = false; // blank: formatted on the first write
                return info;
            }
            throw new NfcError("unsupported", "Kartu MIFARE Classic ini memakai kunci lain, jadi tidak bisa ditulis. Pakai kartu kosong.");
        }

        string ReadMessageUrl()
        {
            List<int> blocks = DataBlocks();
            var data = new List<byte>();
            int need = 48; // read sector by sector until the whole TLV is in
            int sector = -1;
            for (int i = 0; i < blocks.Count && data.Count < need; i++)
            {
                int s = blocks[i] / 4;
                if (s != sector)
                {
                    if (!Auth(blocks[i], KeyNdef)) break;
                    sector = s;
                }
                data.AddRange(ReadBlock(blocks[i]));
                if (data.Count >= 4 && need == 48) need = Math.Min(DataBytes, TlvEnd(data.ToArray()));
            }
            try { return Ndef.ReadUri(data.ToArray()); }
            catch { return null; }
        }

        /// <summary>Bytes needed to hold the first NDEF TLV (from its length field), at least one sector.</summary>
        static int TlvEnd(byte[] data)
        {
            int i = 0;
            while (i < data.Length && data[i] == 0x00) i++;
            if (i + 1 >= data.Length || data[i] != 0x03) return 48;
            int len = data[i + 1];
            int start = i + 2;
            if (len == 0xFF)
            {
                if (i + 3 >= data.Length) return 48;
                len = (data[i + 2] << 8) | data[i + 3];
                start = i + 4;
            }
            return Math.Max(48, start + len + 1);
        }

        void Format()
        {
            Log.Write("format MIFARE Classic to NDEF");
            if (!Auth(3, KeyDefault)) throw new NfcError("write_failed", "Sektor 0 kartu ini tidak bisa dibuka dengan kunci bawaan pabrik.");
            byte[] mad = Ndef.Mad1();
            WriteBlock(1, mad, 0);
            WriteBlock(2, mad, 16);
            // Sector 0 trailer: key A = MAD key, access bits 78 77 88, GPB C1 (MAD v1, multi-application), key B default.
            WriteBlock(3, Trailer(KeyMad, new byte[] { 0x78, 0x77, 0x88, 0xC1 }), 0);
            for (int s = 1; s < Sectors; s++)
            {
                int trailer = s * 4 + 3;
                if (!Auth(trailer, KeyDefault))
                    throw new NfcError("write_failed", "Sektor " + s + " kartu ini tidak bisa dibuka dengan kunci bawaan pabrik.");
                // NDEF sector trailer: key A = NFC Forum key, access bits 7F 07 88, GPB 40 (NDEF v1, read/write).
                WriteBlock(trailer, Trailer(KeyNdef, new byte[] { 0x7F, 0x07, 0x88, 0x40 }), 0);
            }
            formatted = true;
        }

        static byte[] Trailer(byte[] keyA, byte[] access)
        {
            var t = new byte[16];
            Array.Copy(keyA, 0, t, 0, 6);
            Array.Copy(access, 0, t, 6, 4);
            Array.Copy(KeyDefault, 0, t, 10, 6);
            return t;
        }

        public override WriteResult WriteUrl(TagInfo info, string url, bool lockCard)
        {
            byte[] tlv = Ndef.TypeTwoTlv(Ndef.UriRecord(url));
            if (tlv.Length > DataBytes)
                throw new NfcError("too_small", "Alamat terlalu panjang untuk kartu ini (" + tlv.Length + " dari " + DataBytes + " byte).");
            var data = new byte[(tlv.Length + 15) / 16 * 16];
            Array.Copy(tlv, data, tlv.Length);
            if (!formatted) Format();

            List<int> blocks = DataBlocks();
            int count = data.Length / 16;
            // Empty message first, the rest, then the first block last: a card pulled away mid-write ends up
            // empty instead of holding a broken address.
            var empty = new byte[16];
            empty[0] = 0x03; empty[1] = 0x00; empty[2] = 0xFE;
            WriteSector(blocks[0], empty, 0);
            int sector = 1;
            for (int i = 1; i < count; i++)
            {
                int s = blocks[i] / 4;
                if (s != sector)
                {
                    if (!Auth(blocks[i], KeyNdef)) throw new NfcError("write_failed", "Sektor " + s + " kartu ini tidak bisa dibuka.");
                    sector = s;
                }
                WriteBlock(blocks[i], data, i * 16);
            }
            WriteSector(blocks[0], data, 0);

            // Read back.
            sector = -1;
            for (int i = 0; i < count; i++)
            {
                int s = blocks[i] / 4;
                if (s != sector)
                {
                    if (!Auth(blocks[i], KeyNdef)) throw new NfcError("verify_failed", "Isi kartu tidak bisa dibaca ulang. Tulis ulang kartu ini.");
                    sector = s;
                }
                byte[] back = ReadBlock(blocks[i]);
                for (int k = 0; k < 16; k++)
                    if (back[k] != data[i * 16 + k])
                        throw new NfcError("verify_failed", "Isi kartu tidak sama setelah ditulis. Tulis ulang kartu ini.");
            }

            info.Url = url;
            var result = new WriteResult { Tag = info, Locked = false };
            if (lockCard)
                result.LockSkipped = "Kartu MIFARE Classic tidak dikunci (hanya kartu NTAG yang bisa dikunci di sini). Alamat sudah tertulis.";
            return result;
        }

        void WriteSector(int block, byte[] data, int offset)
        {
            if (!Auth(block, KeyNdef)) throw new NfcError("write_failed", "Sektor " + (block / 4) + " kartu ini tidak bisa dibuka.");
            WriteBlock(block, data, offset);
        }
    }
}
