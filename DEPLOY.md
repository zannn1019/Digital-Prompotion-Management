# Deploying to a staging server (Nginx)

Step by step for an **Ubuntu 22.04 / 24.04** server you can reach over SSH with sudo. Replace `staging.example.co.id` with your staging domain everywhere.

What this sets up: the Nuxt server runs as a systemd service on `127.0.0.1:3000`, and Nginx in front of it handles HTTPS, compression, the upload size limit and (optionally) a password for the admin side.

Before you start, know that this V1 keeps **all data in memory**: every restart or redeploy resets posters, cards, users and passwords to the seed data. Run **one** Node process only.

## 1. Point the domain at the server

Create a DNS **A record** `staging.example.co.id` → the server's public IP. Check it before step 8:

```bash
dig +short staging.example.co.id
```

## 2. Install Node 24, Nginx and Certbot

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
```

```bash
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx git apache2-utils
```

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Port 3000 stays closed to the outside: the app only listens on `127.0.0.1`.

## 3. Create a user and folders for the app

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin poster
```

```bash
sudo mkdir -p /opt/poster-nfc/releases && sudo chown -R poster:poster /opt/poster-nfc
```

Each deploy goes into its own folder under `releases/`, and `/opt/poster-nfc/current` points at the live one. That makes rolling back a one-line change (step 10).

## 4. Build a release

**Option A, build on the server (needs the repo on a git remote):**

```bash
cd /opt/poster-nfc/releases && sudo -u poster git clone <your-repo-url> 20261112-1
```

```bash
cd /opt/poster-nfc/releases/20261112-1 && sudo -u poster npm ci && sudo -u poster npm test && sudo -u poster npm run build
```

`npm ci` also downloads ffmpeg for the demo-video tool. It is unused on the server, the install is just slower.

**Option B, build on your PC:** run `npm run build`, then copy only the `.output/` folder to `/opt/poster-nfc/releases/20261112-1/.output` (WinSCP, or `scp -r .output user@server:/tmp/` and `sudo mv` it into place, then `sudo chown -R poster:poster` the release folder). `.output` is self-contained and needs no `npm install` on the server.

Then point `current` at the release:

```bash
sudo -u poster ln -sfn /opt/poster-nfc/releases/20261112-1 /opt/poster-nfc/current
```

## 5. Create the settings file

```bash
sudo nano /etc/poster-nfc.env
```

```ini
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
NUXT_PUBLIC_SITE_URL=https://staging.example.co.id
NUXT_SEED_PASSWORD=<at least 10 characters, shared only with the team>
NUXT_PUBLIC_DEMO_LOGIN=false
NUXT_TRUST_PROXY=true
```

```bash
sudo chown root:poster /etc/poster-nfc.env && sudo chmod 640 /etc/poster-nfc.env
```

- `NUXT_PUBLIC_SITE_URL` must be the exact address people open. It goes onto the NFC cards (`<site>/k/<code>`) and it is the only origin allowed to save changes. **Set it before writing real cards**: a written card keeps its address.
- `NUXT_SEED_PASSWORD` is the password of every seeded account (rina, dimas, agus.it, …). The server refuses to start if it is shorter than 10 characters.
- `NUXT_TRUST_PROXY=true` is correct here because Nginx is in front. Never set it when the app is reachable without Nginx.

## 6. Run the app as a service

```bash
sudo nano /etc/systemd/system/poster-nfc.service
```

```ini
[Unit]
Description=Poster Digital NFC (Nuxt)
After=network.target

[Service]
User=poster
Group=poster
WorkingDirectory=/opt/poster-nfc/current
EnvironmentFile=/etc/poster-nfc.env
ExecStart=/usr/bin/node /opt/poster-nfc/current/.output/server/index.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now poster-nfc
```

```bash
curl -sI http://127.0.0.1:3000/k/K7Q2M9XA | head -1
```

You should see `HTTP/1.1 200 OK`. If not, read the log: `sudo journalctl -u poster-nfc -n 50`. A warning about "the public demo password" means `NUXT_SEED_PASSWORD` was not picked up.

## 7. Configure Nginx

Shared proxy settings, used by every location below:

```bash
sudo nano /etc/nginx/snippets/poster-nfc-proxy.conf
```

```nginx
proxy_pass http://127.0.0.1:3000;
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host $host;
# Nginx appends the real client address; the app reads the right-most entry.
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host $host;
# Internal header of the app; never accept it from outside.
proxy_set_header X-Nfc-Visitor "";
proxy_hide_header X-Powered-By;
```

The site:

```bash
sudo nano /etc/nginx/sites-available/poster-nfc
```

```nginx
# At most 10 login attempts a minute per address, on top of the app's own limit.
limit_req_zone $binary_remote_addr zone=poster_login:10m rate=10r/m;

server {
    listen 80;
    listen [::]:80;
    server_name staging.example.co.id;

    # Uploads are max 5 MB; a little extra for the form data. The app checks again.
    client_max_body_size 6m;

    gzip on;
    gzip_vary on;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types text/css application/javascript text/javascript application/json image/svg+xml;

    location = /api/auth/login {
        limit_req zone=poster_login burst=5 nodelay;
        include snippets/poster-nfc-proxy.conf;
    }

    location / {
        include snippets/poster-nfc-proxy.conf;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/poster-nfc /etc/nginx/sites-enabled/poster-nfc
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Optional (recommended for a public staging): a password in front of the admin side

Visitors' poster pages stay open; everything else asks for a shared username and password before the app's own login. Create the password file (it asks for the password):

```bash
sudo htpasswd -c /etc/nginx/.poster-staging tim
```

Then add these lines inside the `server { … }` block, above the existing `location` blocks:

```nginx
    auth_basic "Staging";
    auth_basic_user_file /etc/nginx/.poster-staging;

    # Public parts: poster pages, contact links, their data, files and assets.
    location /k/          { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /go/         { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /api/public/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /api/uploads/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /_nuxt/      { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /brand/      { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /dummy/      { auth_basic off; include snippets/poster-nfc-proxy.conf; }
```

Uploaded poster images and brochures stay protected by the app itself: visitors only get files of live posters. Check and reload again:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Turn on HTTPS

HTTPS is required: the session cookie is `Secure` (sign-in does not work over plain http), and Web NFC only works on https pages.

```bash
sudo certbot --nginx -d staging.example.co.id --redirect
```

Certbot adds the certificate and the http → https redirect to the same file, and renews it automatically. The app itself already sends HSTS and the other security headers.

## 9. Check that it works

```bash
curl -sI https://staging.example.co.id/k/K7Q2M9XA
```

Expect `HTTP/2 200`, a `content-security-policy` header and **no** `x-powered-by`. For compression, open the page in the browser's DevTools → Network: the `.js` and `.css` files should show `content-encoding: gzip`.

In the browser:

1. `https://staging.example.co.id/k/K7Q2M9XA` shows the Sleep Lab poster (no password prompt).
2. `https://staging.example.co.id/admin/login` shows the login without demo buttons; sign in with `rina@rs-bethesda.test` and the seed password.
3. **Kartu NFC**: card addresses start with `https://staging.example.co.id/k/`.
4. Upload a poster image and save: it should work. A file over 5 MB is refused with a clear message.

Live log: `sudo journalctl -u poster-nfc -f`.

## 10. Updating and rolling back

Deploy a new version into a new release folder (step 4 with a new name, e.g. `20261113-1`), then switch and restart:

```bash
sudo -u poster ln -sfn /opt/poster-nfc/releases/20261113-1 /opt/poster-nfc/current && sudo systemctl restart poster-nfc
```

Roll back the same way, pointing `current` at the previous folder. Remember that every restart resets the in-memory data. Delete old release folders now and then.

## 11. If something goes wrong

| Symptom                                            | Likely cause                                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 502 Bad Gateway                                    | The service is not running: `sudo systemctl status poster-nfc` and the journal                        |
| Service stops right after start                    | `NUXT_SEED_PASSWORD` shorter than 10 characters (the journal says so), or a wrong path in `ExecStart` |
| Login seems to work but you are sent back to login | Site opened over http instead of https (the `Secure` cookie is not stored)                            |
| Saving anything answers 403 "Permintaan ditolak."  | The admin was opened through another address (an IP, another hostname) than `NUXT_PUBLIC_SITE_URL`    |
| Upload answers 413                                 | The file is over 5 MB (or `client_max_body_size` is missing in Nginx)                                 |
| Every login answers 429                            | Too many attempts from that address; wait a minute                                                    |
| Cards show `poster.rs-bethesda.test`               | `NUXT_PUBLIC_SITE_URL` is not set for the service; check `/etc/poster-nfc.env` and restart            |
