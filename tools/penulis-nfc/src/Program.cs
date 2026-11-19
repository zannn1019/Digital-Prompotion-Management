// Penulis NFC: a small tray program that lets the Poster Digital NFC admin page write card addresses
// with a USB NFC reader (ACS ACR122U) on this computer.
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace PenulisNfc
{
    /// <summary>The websites allowed to use the reader, asked once per site and saved per Windows user.</summary>
    class Origins
    {
        readonly string file;
        readonly HashSet<string> allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        readonly HashSet<string> denied = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        readonly HashSet<string> asking = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        readonly object gate = new object();
        public Action<string> Ask; // shows the question on the UI thread; calls Answer later

        static readonly Regex Valid = new Regex(@"^https?://[a-z0-9.\-\[\]:]+$", RegexOptions.IgnoreCase);

        public Origins(string file)
        {
            this.file = file;
            if (File.Exists(file))
                foreach (string line in File.ReadAllLines(file))
                    if (Valid.IsMatch(line.Trim())) allowed.Add(line.Trim());
        }

        /// <summary>"allowed", "asking" (the question is on screen) or "denied".</summary>
        public string Check(string origin)
        {
            if (!Valid.IsMatch(origin)) return "denied";
            lock (gate)
            {
                if (allowed.Contains(origin)) return "allowed";
                if (denied.Contains(origin)) return "denied";
                if (asking.Contains(origin)) return "asking";
                asking.Add(origin);
            }
            Ask(origin);
            return "asking";
        }

        public void Answer(string origin, bool yes)
        {
            lock (gate)
            {
                asking.Remove(origin);
                if (yes) { allowed.Add(origin); Save(); }
                else denied.Add(origin);
            }
        }

        public string[] List()
        {
            lock (gate) return allowed.OrderBy(o => o).ToArray();
        }

        public void Remove(string origin)
        {
            lock (gate) { allowed.Remove(origin); denied.Remove(origin); Save(); }
        }

        /// <summary>Lets a site that was refused in this session ask again.</summary>
        public void ForgetDenied()
        {
            lock (gate) denied.Clear();
        }

        void Save()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(file));
            File.WriteAllLines(file, allowed.OrderBy(o => o).ToArray());
        }
    }

    class Tray : ApplicationContext
    {
        const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
        const string RunName = "PenulisNFC";
        readonly NotifyIcon icon = new NotifyIcon();
        readonly Control ui = new Control();
        readonly Origins origins;
        readonly Server server;
        readonly ToolStripMenuItem statusItem = new ToolStripMenuItem { Enabled = false };
        readonly ToolStripMenuItem sitesItem = new ToolStripMenuItem("Situs yang diizinkan");
        readonly ToolStripMenuItem startupItem = new ToolStripMenuItem("Jalankan saat Windows mulai");

        public Tray()
        {
            ui.CreateControl(); // a handle on the UI thread, for BeginInvoke from the server threads
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "PenulisNFC");
            bool firstRun = !Directory.Exists(dir);
            Directory.CreateDirectory(dir);
            origins = new Origins(Path.Combine(dir, "situs-diizinkan.txt"));
            origins.Ask = origin => ui.BeginInvoke((Action)(() => AskSite(origin)));
            server = new Server(origins);

            var menu = new ContextMenuStrip();
            menu.Items.Add(statusItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(sitesItem);
            menu.Items.Add(startupItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Keluar", null, (s, e) => Quit());
            startupItem.Click += (s, e) => SetStartup(!startupItem.Checked);
            menu.Opening += (s, e) => RefreshMenu();

            icon.Icon = MakeIcon();
            icon.Text = "Penulis NFC";
            icon.ContextMenuStrip = menu;
            icon.Visible = true;

            try { server.Start(); }
            catch (HttpListenerException)
            {
                MessageBox.Show("Port " + Server.Port + " sudah dipakai. Penulis NFC mungkin sudah berjalan.", "Penulis NFC",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                Quit();
                return;
            }
            if (firstRun) SetStartup(true);
            icon.ShowBalloonTip(4000, "Penulis NFC aktif",
                "Buka Panel Admin → Kartu NFC → Tulis ke kartu. Ikon ini tetap di taskbar.", ToolTipIcon.Info);
        }

        void AskSite(string origin)
        {
            DialogResult answer = MessageBox.Show(
                "Situs ini ingin memakai pembaca NFC di komputer ini untuk menulis kartu:\n\n" + origin +
                "\n\nIzinkan hanya bila ini alamat Panel Admin Poster Digital NFC Anda.",
                "Penulis NFC · Izinkan situs?", MessageBoxButtons.YesNo, MessageBoxIcon.Question,
                MessageBoxDefaultButton.Button2, MessageBoxOptions.DefaultDesktopOnly);
            origins.Answer(origin, answer == DialogResult.Yes);
        }

        void RefreshMenu()
        {
            Dictionary<string, object> s = server.ReaderStatus();
            string reader = s["reader"] as string;
            statusItem.Text = !(bool)s["service"] ? "Pembaca NFC belum dicolokkan"
                : reader == null ? "Pembaca NFC belum dicolokkan"
                : "Siap · " + reader + ((bool)s["card"] ? " · ada kartu" : "");
            sitesItem.DropDownItems.Clear();
            string[] sites = origins.List();
            if (sites.Length == 0) sitesItem.DropDownItems.Add(new ToolStripMenuItem("Belum ada") { Enabled = false });
            foreach (string site in sites)
            {
                string captured = site;
                sitesItem.DropDownItems.Add("Hapus izin " + site, null, (o, e) => origins.Remove(captured));
            }
            sitesItem.DropDownItems.Add(new ToolStripSeparator());
            sitesItem.DropDownItems.Add("Tanya lagi situs yang ditolak", null, (o, e) => origins.ForgetDenied());
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RunKey))
                startupItem.Checked = key != null && key.GetValue(RunName) != null;
        }

        void SetStartup(bool on)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(RunKey))
            {
                if (on) key.SetValue(RunName, "\"" + Application.ExecutablePath + "\"");
                else key.DeleteValue(RunName, false);
            }
        }

        static Icon MakeIcon()
        {
            var bmp = new Bitmap(32, 32);
            using (Graphics g = Graphics.FromImage(bmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (var path = new GraphicsPath())
                {
                    path.AddArc(0, 0, 12, 12, 180, 90);
                    path.AddArc(19, 0, 12, 12, 270, 90);
                    path.AddArc(19, 19, 12, 12, 0, 90);
                    path.AddArc(0, 19, 12, 12, 90, 90);
                    path.CloseFigure();
                    using (var fill = new SolidBrush(Color.FromArgb(0x2F, 0x31, 0x8B))) g.FillPath(fill, path);
                }
                using (var pen = new Pen(Color.White, 2.6f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                {
                    g.DrawArc(pen, 4, 9, 14, 14, -50, 100);
                    g.DrawArc(pen, 2, 5, 22, 22, -50, 100);
                    g.DrawArc(pen, 0, 1, 30, 30, -50, 100);
                }
                using (var dot = new SolidBrush(Color.White)) g.FillEllipse(dot, 7, 13, 6, 6);
            }
            return Icon.FromHandle(bmp.GetHicon());
        }

        void Quit()
        {
            server.Stop();
            icon.Visible = false;
            ExitThread();
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            bool created;
            using (var mutex = new Mutex(true, @"Local\PenulisNFC", out created))
            {
                if (!created)
                {
                    MessageBox.Show("Penulis NFC sudah berjalan. Lihat ikonnya di taskbar (dekat jam).", "Penulis NFC");
                    return;
                }
                AppDomain.CurrentDomain.UnhandledException += (o, e) => Log.Write("crash: " + e.ExceptionObject);
                Application.ThreadException += (o, e) => Log.Write("ui error: " + e.Exception);
                Application.ApplicationExit += (o, e) => Log.Write("exit");
                Log.Write("start " + Server.Version);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new Tray());
            }
        }
    }
}
