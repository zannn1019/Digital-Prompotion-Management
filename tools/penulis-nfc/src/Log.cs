// A small log next to the allowed-sites list (%APPDATA%\PenulisNFC\log.txt), for finding out why a card
// was not written. Kept short: it starts over above 256 KB.
using System;
using System.IO;

namespace PenulisNfc
{
    static class Log
    {
        static readonly object Gate = new object();
        public static readonly string File = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PenulisNFC", "log.txt");

        public static void Write(string line)
        {
            try
            {
                lock (Gate)
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(File));
                    var info = new FileInfo(File);
                    if (info.Exists && info.Length > 256 * 1024) info.Delete();
                    System.IO.File.AppendAllText(File, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + "  " + line + Environment.NewLine);
                }
            }
            catch { }
        }
    }
}
