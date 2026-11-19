// The local HTTP API the admin page calls: http://localhost:47811
//   GET  /status  reader and card state
//   POST /write   { url, lock, skipUid }  waits for a card, writes the address, reads it back, locks it if asked
//   POST /read    waits for a card and returns what is on it
//   POST /cancel  stops a waiting /write or /read
// Only websites the person allowed (asked once per site, in a Windows dialog) may use it.
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;

namespace PenulisNfc
{
    class Server
    {
        public const int Port = 47811;
        public const string Version = "1.0.0";
        const int WaitMs = 30000;

        readonly HttpListener listener = new HttpListener();
        readonly Writer writer = new Writer();
        readonly Origins origins;
        readonly JavaScriptSerializer json = new JavaScriptSerializer();

        public Server(Origins origins)
        {
            this.origins = origins;
            // "localhost" needs no administrator rights (127.0.0.1 would).
            listener.Prefixes.Add("http://localhost:" + Port + "/");
        }

        public void Start()
        {
            listener.Start();
            var thread = new Thread(Loop) { IsBackground = true, Name = "http" };
            thread.Start();
        }

        public void Stop()
        {
            try { listener.Stop(); } catch { }
        }

        public Dictionary<string, object> ReaderStatus()
        {
            return writer.Status();
        }

        void Loop()
        {
            while (listener.IsListening)
            {
                HttpListenerContext ctx;
                try { ctx = listener.GetContext(); }
                catch { return; }
                ThreadPool.QueueUserWorkItem(_ => Handle(ctx));
            }
        }

        void Handle(HttpListenerContext ctx)
        {
            try { HandleCore(ctx); }
            catch (Exception e)
            {
                try { Send(ctx, 500, Error("internal", "Penulis NFC mengalami galat: " + e.Message)); } catch { }
            }
        }

        void HandleCore(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var res = ctx.Response;
            string origin = req.Headers["Origin"];
            if (origin != null)
            {
                res.AddHeader("Access-Control-Allow-Origin", origin);
                res.AddHeader("Vary", "Origin");
                res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.AddHeader("Access-Control-Allow-Headers", "Content-Type");
                // Chrome's Private/Local Network Access preflight for a public site calling localhost.
                res.AddHeader("Access-Control-Allow-Private-Network", "true");
                res.AddHeader("Access-Control-Max-Age", "600");
            }
            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 204;
                res.Close();
                return;
            }
            string path = req.Url.AbsolutePath.TrimEnd('/');

            // A website must be allowed by the person at this computer. Requests without an Origin come
            // from programs on this computer, which could use the reader directly anyway.
            if (origin != null)
            {
                string answer = origins.Check(origin);
                if (answer != "allowed")
                {
                    var denied = Error("not_allowed", answer == "asking"
                        ? "Izinkan situs ini di jendela Penulis NFC yang muncul di layar."
                        : "Situs ini tidak diizinkan memakai Penulis NFC. Izinkan dari menu ikon Penulis NFC di taskbar.");
                    denied["app"] = "penulis-nfc";
                    denied["version"] = Version;
                    denied["asking"] = answer == "asking";
                    Send(ctx, 403, denied);
                    return;
                }
            }

            if (req.HttpMethod == "GET" && (path == "/status" || path == ""))
            {
                var s = writer.Status();
                s["ok"] = true;
                s["app"] = "penulis-nfc";
                s["version"] = Version;
                Send(ctx, 200, s);
                return;
            }
            if (req.HttpMethod != "POST")
            {
                Send(ctx, 404, Error("not_found", "Tidak ada."));
                return;
            }
            if (path == "/cancel")
            {
                writer.Cancel();
                Send(ctx, 200, Ok());
                return;
            }
            Dictionary<string, object> body = ReadBody(req);
            if (body == null)
            {
                Send(ctx, 400, Error("bad_request", "Permintaan tidak valid."));
                return;
            }
            if (path == "/write") Write(ctx, body);
            else if (path == "/read") Read(ctx);
            else Send(ctx, 404, Error("not_found", "Tidak ada."));
        }

        static readonly Regex UrlPattern = new Regex(@"^https?://[^\s/]+/\S*$");

        void Write(HttpListenerContext ctx, Dictionary<string, object> body)
        {
            string url = body.ContainsKey("url") ? body["url"] as string : null;
            bool lockCard = body.ContainsKey("lock") && body["lock"] is bool && (bool)body["lock"];
            string skipUid = body.ContainsKey("skipUid") ? body["skipUid"] as string : null;
            if (url == null || url.Length > 500 || !UrlPattern.IsMatch(url))
            {
                Send(ctx, 400, Error("bad_request", "Alamat kartu tidak valid."));
                return;
            }
            try
            {
                WriteResult r = writer.WithCard(tag =>
                {
                    TagInfo info = tag.Inspect();
                    return tag.WriteUrl(info, url, lockCard);
                }, skipUid, WaitMs);
                var d = Ok();
                d["uid"] = r.Tag.Uid;
                d["type"] = r.Tag.Type;
                d["url"] = r.Tag.Url;
                d["locked"] = r.Locked;
                d["lockSkipped"] = r.LockSkipped;
                Send(ctx, 200, d);
            }
            catch (NfcError e)
            {
                Send(ctx, e.Code == "busy" ? 409 : 200, Error(e.Code, e.Message));
            }
        }

        void Read(HttpListenerContext ctx)
        {
            try
            {
                TagInfo info = writer.WithCard(tag => tag.Inspect(), null, WaitMs);
                var d = Ok();
                d["uid"] = info.Uid;
                d["type"] = info.Type;
                d["url"] = info.Url;
                d["readOnly"] = info.ReadOnly;
                d["dataBytes"] = info.DataBytes;
                Send(ctx, 200, d);
            }
            catch (NfcError e)
            {
                Send(ctx, e.Code == "busy" ? 409 : 200, Error(e.Code, e.Message));
            }
        }

        Dictionary<string, object> ReadBody(HttpListenerRequest req)
        {
            if (req.ContentLength64 > 4096) return null;
            string text;
            using (var reader = new StreamReader(req.InputStream, Encoding.UTF8)) text = reader.ReadToEnd();
            if (text.Length == 0) return new Dictionary<string, object>();
            try { return json.Deserialize<Dictionary<string, object>>(text); }
            catch { return null; }
        }

        static Dictionary<string, object> Ok()
        {
            var d = new Dictionary<string, object>();
            d["ok"] = true;
            return d;
        }

        static Dictionary<string, object> Error(string code, string message)
        {
            var d = new Dictionary<string, object>();
            d["ok"] = false;
            d["error"] = code;
            d["message"] = message;
            return d;
        }

        void Send(HttpListenerContext ctx, int status, Dictionary<string, object> body)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(json.Serialize(body));
            ctx.Response.StatusCode = status;
            ctx.Response.ContentType = "application/json; charset=utf-8";
            ctx.Response.AddHeader("Cache-Control", "no-store");
            ctx.Response.ContentLength64 = bytes.Length;
            ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
            ctx.Response.Close();
        }
    }
}
