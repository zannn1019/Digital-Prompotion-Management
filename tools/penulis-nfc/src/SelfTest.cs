// Console self-test for the NDEF encoding (no card needed). Built and run by build.cmd.
using System;

namespace PenulisNfc
{
    static class SelfTest
    {
        static int failures;

        static void Expect(string name, string actual, string expected)
        {
            if (actual == expected) Console.WriteLine("ok   " + name);
            else
            {
                failures++;
                Console.WriteLine("FAIL " + name + "\n     got      " + actual + "\n     expected " + expected);
            }
        }

        static int Main()
        {
            // https://a.id/k/7AFP3EJR -> prefix 04, "a.id/k/7AFP3EJR" (15 bytes), payload 16
            byte[] record = Ndef.UriRecord("https://a.id/k/7AFP3EJR");
            Expect("uri record", Ndef.Hex(record), "D101105504612E69642F6B2F3741465033454A52");
            byte[] tlv = Ndef.TypeTwoTlv(record);
            Expect("type 2 tlv", Ndef.Hex(tlv), "0314D101105504612E69642F6B2F3741465033454A52FE00");
            Expect("read back", Ndef.ReadUri(tlv), "https://a.id/k/7AFP3EJR");
            Expect("www prefix", Ndef.Hex(Ndef.UriRecord("https://www.x.id/")), "D101065502782E69642F");
            Expect("http prefix", Ndef.Hex(Ndef.UriRecord("http://x.id/")), "D101065503782E69642F");
            string longUrl = "https://x.id/" + new string('a', 300);
            byte[] longTlv = Ndef.TypeTwoTlv(Ndef.UriRecord(longUrl));
            Expect("long tlv header", Ndef.Hex(new[] { longTlv[0], longTlv[1], longTlv[2], longTlv[3] }), "03FF0139");
            Expect("long read back", Ndef.ReadUri(longTlv), longUrl);
            Expect("empty card", Ndef.ReadUri(new byte[] { 0x03, 0x00, 0xFE, 0x00 }) ?? "null", "null");
            Expect("padded to pages", (tlv.Length % 4).ToString(), "0");
            // The MAD block 1 every Android-formatted MIFARE Classic 1K card carries: 14 01 03 E1 03 E1 ...
            byte[] mad = Ndef.Mad1();
            Expect("mad block 1", Ndef.Hex(new[] { mad[0], mad[1], mad[2], mad[3], mad[4], mad[5] }), "140103E103E1");
            Expect("mad block 2", Ndef.Hex(new[] { mad[16], mad[17], mad[30], mad[31] }), "03E103E1");
            Console.WriteLine(failures == 0 ? "all passed" : failures + " failed");
            return failures == 0 ? 0 : 1;
        }
    }
}
