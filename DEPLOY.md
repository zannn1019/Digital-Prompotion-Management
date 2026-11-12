# Deploying to a staging server (Docker + Nginx)

Step by step for an **Ubuntu 22.04 / 24.04** server you can reach over SSH with sudo. Replace `staging.example.co.id` with your staging domain everywhere.

What this sets up:

- The app (Nuxt: pages and API in one) runs in **one Docker container**, reachable only from the server itself on `127.0.0.1:3000`.
- **Nginx** on the server sits in front of it: HTTPS, compression, the upload size limit, a limit on login attempts and (optionally) a password for the admin side.

Before you start, know that this V1 keeps **all data in memory**: every restart or redeploy of the container resets posters, cards, users and passwords to the seed data. Run **one** container only (no replicas).

Files in the repository: `Dockerfile` (builds, runs the tests, then a small run image), `docker-compose.yml` (the one service, hardened), `.dockerignore`, `.env.example` (settings template).

## 1. Point the domain at the server

Create a DNS **A record** `staging.example.co.id` → the server's public IP. Check it before step 8:

```bash
dig +short staging.example.co.id
```

## 2. Install Docker, Nginx and Certbot

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx git apache2-utils
```

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

Docker opens published ports past `ufw`; that is why the compose file publishes the app on `127.0.0.1` only. Don't change that to `3000:3000`.

## 3. Put the project on the server

From git (if the project has a remote):

```bash
sudo mkdir -p /opt/poster-nfc && sudo chown $USER /opt/poster-nfc && git clone <your-repo-url> /opt/poster-nfc
```

Without a remote, copy the project folder from your PC to `/opt/poster-nfc` (WinSCP, or `scp -r`), leaving out `node_modules`, `.nuxt` and `.output`. The image is built from the source.

## 4. Create the settings file

```bash
cd /opt/poster-nfc && cp .env.example .env && chmod 600 .env && nano .env
```

```ini
NUXT_PUBLIC_SITE_URL=https://staging.example.co.id
NUXT_SEED_PASSWORD=<at least 10 characters, shared only with the team>
NUXT_PUBLIC_DEMO_LOGIN=false
NUXT_TRUST_PROXY=true
```

- `NUXT_PUBLIC_SITE_URL` must be the exact address people open. It goes onto the NFC cards (`<site>/k/<code>`) and it is the only origin allowed to save changes. **Set it before writing real cards**: a written card keeps its address.
- `NUXT_SEED_PASSWORD` is the password of the only seeded account, the Super Admin `admin@rs-bethesda.test`. The app starts with no posters, pages or cards. The app refuses to start if it is shorter than 10 characters, so the placeholder in `.env.example` must be replaced.
- `NUXT_TRUST_PROXY=true` is correct because Nginx is in front and the container is only reachable through it.
- `.env` is never committed (it is in `.gitignore` and `.dockerignore`).

## 5. Build and start the container

```bash
cd /opt/poster-nfc && sudo docker compose up -d --build
```

The build installs the dependencies, **runs the unit tests** (a failing test stops the build) and builds the app; the run image only contains Node and the built `.output` folder. It takes a few minutes the first time.

Check it:

```bash
sudo docker compose ps
```

```bash
curl -s http://127.0.0.1:3000/api/health
```

`STATUS` should say `healthy` after a few seconds, and the health check answers `{"ok":true}`. Logs: `sudo docker compose logs -f`. If the container keeps restarting, the log says why (most often `NUXT_SEED_PASSWORD must be at least 10 characters.`).

If port 3000 is already used on the server, add `APP_PORT=3001` to `.env` and use that port in the Nginx config below.

## 6. Configure Nginx

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
    location /k/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /go/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /api/public/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /api/uploads/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location = /api/health { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /_nuxt/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /brand/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
    location /dummy/ { auth_basic off; include snippets/poster-nfc-proxy.conf; }
```

Uploaded poster images and brochures stay protected by the app itself: visitors only get files of live posters. Check and reload again:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Turn on HTTPS

HTTPS is required: the session cookie is `Secure` (sign-in does not work over plain http), and Web NFC only works on https pages.

```bash
sudo certbot --nginx -d staging.example.co.id --redirect
```

Certbot adds the certificate and the http → https redirect to the same file, and renews it automatically. The app itself already sends HSTS and the other security headers.

## 8. Check that it works

The app starts empty, so first check the public side with an unknown card code:

```bash
curl -sI https://staging.example.co.id/k/ZZZZ9999
```

Expect `HTTP/2 404` (the friendly "Halaman tidak tersedia" page), a `content-security-policy` header and **no** `x-powered-by`. For compression, open the page in the browser's DevTools → Network: the `.js` and `.css` files should show `content-encoding: gzip`.

In the browser:

1. `https://staging.example.co.id/admin/login` shows the login without demo buttons; sign in with `admin@rs-bethesda.test` and the seed password.
2. **Halaman**: create a page. **Poster & Pengumuman**: upload a poster image (a file over 5 MB is refused with a clear message), publish it and put it on that page. Publish the page.
3. **Kartu NFC**: register a card and map it to the page. Its address starts with `https://staging.example.co.id/k/`.
4. Open that address on a phone (no password prompt): it shows the poster. The header's **Lihat poster** button opens the same view.

## 9. Updating

Keep the running image as `previous`, then build and start the new version:

```bash
cd /opt/poster-nfc && sudo docker tag poster-nfc:latest poster-nfc:previous && git pull && sudo docker compose up -d --build
```

(Without git, copy the new source over the folder instead of `git pull`.) The new container replaces the old one; the in-memory data starts over. Clean up old images now and then: `sudo docker image prune`.

## 10. Rolling back

```bash
cd /opt/poster-nfc && sudo docker tag poster-nfc:previous poster-nfc:latest && sudo docker compose up -d --no-build
```

## Building on your PC instead (optional)

If the server is small or has no access to the repository, build the image on your PC (Docker Desktop) and copy it over:

```bash
docker compose build && docker save poster-nfc:latest | gzip > poster-nfc.tar.gz
```

Copy `poster-nfc.tar.gz`, `docker-compose.yml` and `.env.example` to `/opt/poster-nfc` on the server, then:

```bash
gunzip -c poster-nfc.tar.gz | sudo docker load && sudo docker compose up -d --no-build
```

The image is built for the PC's CPU type (normally x86-64). For an ARM server, build with `docker buildx build --platform linux/arm64 -t poster-nfc:latest --load .` instead.

## If something goes wrong

| Symptom                                            | Likely cause                                                                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 502 Bad Gateway                                    | The container isn't running or isn't healthy: `sudo docker compose ps` and `sudo docker compose logs`             |
| Container keeps restarting                         | `NUXT_SEED_PASSWORD` missing a real value (shorter than 10 characters); the log says so                           |
| Build stops at `npm test`                          | A unit test failed: the log shows which; fix it before deploying                                                  |
| Login seems to work but you are sent back to login | Site opened over http instead of https (the `Secure` cookie is not stored)                                        |
| Saving anything answers 403 "Permintaan ditolak."  | The admin was opened through another address (an IP, another hostname) than `NUXT_PUBLIC_SITE_URL`                |
| Upload answers 413                                 | The file is over 5 MB (or `client_max_body_size` is missing in Nginx)                                             |
| Every login answers 429                            | Too many attempts from that address; wait a minute                                                                |
| Cards show `poster.rs-bethesda.test`               | `NUXT_PUBLIC_SITE_URL` is not set in `.env`; fix it and run `sudo docker compose up -d` (recreates the container) |
| `port is already allocated` on start               | Another program uses port 3000: set `APP_PORT` in `.env` and the same port in the Nginx snippet                   |
