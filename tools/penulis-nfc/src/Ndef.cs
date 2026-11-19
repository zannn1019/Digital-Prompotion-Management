// NDEF encoding for one URI record, wrapped in the NFC Forum Type 2 TLV that NTAG21x cards use.
// Pure code (no card, no Windows APIs), so the self-test can check it byte by byte.
using System;
using System.Collections.Generic;
using System.Text;

namespace PenulisNfc
{
    public static class Ndef
    {
        // URI identifier codes (NFC Forum URI RTD), longest prefixes first.
        static readonly string[] Prefixes = { "https://www.", "http://www.", "https://", "http://" };
        static readonly byte[] Codes = { 0x02, 0x01, 0x04, 0x03 };

        /// <summary>The NDEF message for one URI record (no TLV).</summary>
        public static byte[] UriRecord(string url)
        {
            byte code = 0x00;
            string rest = url;
            for (int i = 0; i < Prefixes.Length; i++)
            {
                if (url.StartsWith(Prefixes[i], StringComparison.Ordinal))
                {
                    code = Codes[i];
                    rest = url.Substring(Prefixes[i].Length);
                    break;
                }
            }
            byte[] text = Encoding.UTF8.GetBytes(rest);
            int payloadLength = text.Length + 1;
            var record = new List<byte>();
            if (payloadLength < 256)
            {
                // MB | ME | SR, TNF = well-known (1)
                record.Add(0xD1);
                record.Add(0x01); // type length
                record.Add((byte)payloadLength);
            }
            else
            {
                record.Add(0xC1); // MB | ME, TNF = 1, 4-byte payload length
                record.Add(0x01);
                record.Add((byte)(payloadLength >> 24));
                record.Add((byte)(payloadLength >> 16));
                record.Add((byte)(payloadLength >> 8));
                record.Add((byte)payloadLength);
            }
            record.Add((byte)'U');
            record.Add(code);
            record.AddRange(text);
            return record.ToArray();
        }

        /// <summary>The bytes written from page 4: NDEF TLV, terminator TLV, padded to whole 4-byte pages.</summary>
        public static byte[] TypeTwoTlv(byte[] message)
        {
            var data = new List<byte>();
            data.Add(0x03);
            if (message.Length < 0xFF)
            {
                data.Add((byte)message.Length);
            }
            else
            {
                data.Add(0xFF);
                data.Add((byte)(message.Length >> 8));
                data.Add((byte)message.Length);
            }
            data.AddRange(message);
            data.Add(0xFE);
            while (data.Count % 4 != 0) data.Add(0x00);
            return data.ToArray();
        }

        /// <summary>Reads the URI back from Type 2 data starting at page 4, or null when there is none.</summary>
        public static string ReadUri(byte[] data)
        {
            int i = 0;
            while (i < data.Length)
            {
                byte t = data[i];
                if (t == 0x00) { i++; continue; } // NULL TLV
                if (t == 0xFE) return null; // terminator before any NDEF TLV
                if (i + 1 >= data.Length) return null;
                int len = data[i + 1];
                int start = i + 2;
                if (len == 0xFF)
                {
                    if (i + 3 >= data.Length) return null;
                    len = (data[i + 2] << 8) | data[i + 3];
                    start = i + 4;
                }
                if (t != 0x03) { i = start + len; continue; }
                if (len < 5 || start + len > data.Length) return null;
                byte header = data[start];
                bool shortRecord = (header & 0x10) != 0;
                int typeLength = data[start + 1];
                int payloadLength;
                int p = start + 2;
                if (shortRecord) { payloadLength = data[p]; p += 1; }
                else
                {
                    payloadLength = (data[p] << 24) | (data[p + 1] << 16) | (data[p + 2] << 8) | data[p + 3];
                    p += 4;
                }
                if ((header & 0x08) != 0) p += 1 + data[p]; // ID length present
                if ((header & 0x07) != 0x01 || typeLength != 1 || data[p] != (byte)'U') return null;
                p += 1;
                if (payloadLength < 1 || p + payloadLength > data.Length) return null;
                byte code = data[p];
                string prefix = "";
                for (int k = 0; k < Codes.Length; k++) if (Codes[k] == code) prefix = Prefixes[k];
                return prefix + Encoding.UTF8.GetString(data, p + 1, payloadLength - 1);
            }
            return null;
        }

/// <summary>
        /// MAD1 for a MIFARE Classic 1K with NDEF in sectors 1-15 (blocks 1 and 2 of sector 0): CRC, info byte,
        /// then the NDEF application ID (03 E1) for each sector. CRC-8, polynomial 0x1D, initial value 0xC7.
        /// </summary>
        public static byte[] Mad1()
        {
            var mad = new byte[32];
            mad[1] = 0x01;
            for (int s = 1; s <= 15; s++)
            {
                mad[s * 2] = 0x03;
                mad[s * 2 + 1] = 0xE1;
            }
            int crc = 0xC7;
            for (int i = 1; i < 32; i++)
            {
                crc ^= mad[i];
                for (int b = 0; b < 8; b++) crc = (crc & 0x80) != 0 ? ((crc << 1) ^ 0x1D) & 0xFF : (crc << 1) & 0xFF;
            }
            mad[0] = (byte)crc;
            return mad;
        }

        public static string Hex(byte[] bytes)
        {
            var sb = new StringBuilder();
            foreach (byte b in bytes) sb.Append(b.ToString("X2"));
            return sb.ToString();
        }
    }
}
