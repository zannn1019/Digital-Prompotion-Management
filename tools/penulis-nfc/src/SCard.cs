// The Windows smart-card API (winscard.dll, built into Windows). The ACR122U uses the normal
// Windows CCID driver, so nothing else has to be installed.
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace PenulisNfc
{
    public class NfcError : Exception
    {
        public readonly string Code;
        public NfcError(string code, string message) : base(message) { Code = code; }
    }

    static class SCard
    {
        public const uint ScopeUser = 0;
        public const uint ShareShared = 2;
        public const uint ProtocolT0T1 = 3;
        public const uint LeaveCard = 0;
        public const uint StateUnaware = 0x0;
        public const uint StatePresent = 0x20;
        public const uint StateMute = 0x200;
        public const uint StateInUse = 0x100;

        public const int Success = 0;
        public const int Timeout = unchecked((int)0x8010000A);
        public const int NoSmartcard = unchecked((int)0x8010000C);
        public const int NoService = unchecked((int)0x8010001D);
        public const int ServiceStopped = unchecked((int)0x8010001E);
        public const int NoReaders = unchecked((int)0x8010002E);
        public const int UnresponsiveCard = unchecked((int)0x80100066);
        public const int RemovedCard = unchecked((int)0x80100069);
        public const int SharingViolation = unchecked((int)0x8010000B);
        public const int ReaderUnavailable = unchecked((int)0x80100017);
        public const int UnknownReader = unchecked((int)0x80100009);

        [StructLayout(LayoutKind.Sequential)]
        public struct IoRequest
        {
            public uint Protocol;
            public uint PciLength;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct ReaderState
        {
            [MarshalAs(UnmanagedType.LPWStr)] public string Reader;
            public IntPtr UserData;
            public uint CurrentState;
            public uint EventState;
            public uint AtrLength;
            [MarshalAs(UnmanagedType.ByValArray, SizeConst = 36)] public byte[] Atr;
        }

        [DllImport("winscard.dll")]
        public static extern int SCardEstablishContext(uint scope, IntPtr r1, IntPtr r2, out IntPtr context);

        [DllImport("winscard.dll")]
        public static extern int SCardReleaseContext(IntPtr context);

        [DllImport("winscard.dll", EntryPoint = "SCardListReadersW", CharSet = CharSet.Unicode)]
        static extern int SCardListReaders(IntPtr context, string groups, char[] readers, ref int length);

        [DllImport("winscard.dll", EntryPoint = "SCardConnectW", CharSet = CharSet.Unicode)]
        public static extern int SCardConnect(IntPtr context, string reader, uint share, uint protocols, out IntPtr card, out uint activeProtocol);

        [DllImport("winscard.dll")]
        public static extern int SCardDisconnect(IntPtr card, uint disposition);

        public const uint ResetCard = 1;

        [DllImport("winscard.dll")]
        public static extern int SCardReconnect(IntPtr card, uint share, uint protocols, uint initialization, out uint activeProtocol);

        [DllImport("winscard.dll")]
        static extern int SCardTransmit(IntPtr card, ref IoRequest sendPci, byte[] send, int sendLength, IntPtr recvPci, byte[] recv, ref int recvLength);

        [DllImport("winscard.dll", EntryPoint = "SCardGetStatusChangeW", CharSet = CharSet.Unicode)]
        public static extern int SCardGetStatusChange(IntPtr context, uint timeout, [In, Out] ReaderState[] states, int count);

        public static IntPtr Open()
        {
            IntPtr context;
            int rc = SCardEstablishContext(ScopeUser, IntPtr.Zero, IntPtr.Zero, out context);
            // Windows starts its smart-card service only while a reader is plugged in.
            if (rc == NoService || rc == ServiceStopped)
                throw new NfcError("no_reader", "Pembaca NFC (ACR122U) tidak terdeteksi. Colokkan ke USB komputer ini.");
            if (rc != Success) throw new NfcError("no_service", "Layanan kartu pintar Windows tidak bisa dibuka (" + rc.ToString("X8") + ").");
            return context;
        }

        public static List<string> Readers(IntPtr context)
        {
            var list = new List<string>();
            int length = 0;
            int rc = SCardListReaders(context, null, null, ref length);
            if (rc == NoReaders || length == 0) return list;
            if (rc != Success) return list;
            var buffer = new char[length];
            rc = SCardListReaders(context, null, buffer, ref length);
            if (rc != Success) return list;
            foreach (string name in new string(buffer, 0, length).Split('\0'))
                if (name.Length > 0) list.Add(name);
            return list;
        }

        /// <summary>The reader to use: an ACS ACR122U first, else the first reader with "PICC"/"NFC" in its name, else the first.</summary>
        public static string PickReader(List<string> readers)
        {
            foreach (string r in readers) if (r.IndexOf("ACR122", StringComparison.OrdinalIgnoreCase) >= 0) return r;
            foreach (string r in readers)
                if (r.IndexOf("PICC", StringComparison.OrdinalIgnoreCase) >= 0 || r.IndexOf("NFC", StringComparison.OrdinalIgnoreCase) >= 0) return r;
            return readers.Count > 0 ? readers[0] : null;
        }

        /// <summary>Card state of a reader right now: present, and whether another program holds it.</summary>
        public static uint State(IntPtr context, string reader)
        {
            var states = new ReaderState[1];
            states[0].Reader = reader;
            states[0].CurrentState = StateUnaware;
            states[0].Atr = new byte[36];
            int rc = SCardGetStatusChange(context, 0, states, 1);
            if (rc != Success && rc != Timeout) return 0;
            return states[0].EventState;
        }

        /// <summary>The ATR of the card on the reader (empty when none). Byte 13-14 name the card standard on PC/SC readers.</summary>
        public static byte[] Atr(IntPtr context, string reader)
        {
            var states = new ReaderState[1];
            states[0].Reader = reader;
            states[0].CurrentState = StateUnaware;
            states[0].Atr = new byte[36];
            int rc = SCardGetStatusChange(context, 0, states, 1);
            if (rc != Success && rc != Timeout) return new byte[0];
            int n = (int)Math.Min(states[0].AtrLength, 36);
            var atr = new byte[n];
            Array.Copy(states[0].Atr, atr, n);
            return atr;
        }

        public static byte[] Transmit(IntPtr card, uint protocol, byte[] apdu)
        {
            var pci = new IoRequest { Protocol = protocol, PciLength = 8 };
            var recv = new byte[262];
            int recvLength = recv.Length;
            int rc = SCardTransmit(card, ref pci, apdu, apdu.Length, IntPtr.Zero, recv, ref recvLength);
            if (rc == RemovedCard || rc == NoSmartcard || rc == UnresponsiveCard)
                throw new NfcError("card_removed", "Kartu bergeser atau diangkat sebelum selesai.");
            if (rc != Success)
                throw new NfcError("io", "Pembaca tidak menjawab (" + rc.ToString("X8") + ").");
            var result = new byte[recvLength];
            Array.Copy(recv, result, recvLength);
            return result;
        }
    }
}
