# Poster Digital NFC — V1 (dummy data)

Nuxt 4 + Tailwind 4 + shadcn-vue, in the RS Bethesda brand (palette sampled from the logo, Lato font, logo in `public/brand/logo.png`). V1 scope (agreed with the client): finished poster images (PNG/JPG/PDF, max 5 MB) with a full visitor page (title, category, price, list of points, brochure, terms, contact buttons), an important-announcement bar, NFC cards, analytics, users, audit log, settings. The canvas editor is built but switched off (see below). Fill-in templates come in V2.

The matching designs are on the "Final V1" page of the design board.

All data is fake and kept in memory (`server/utils/db.ts`). It resets when the dev server restarts. "Today" is fixed at **27 Okt 2026** so schedules behave the same on every run.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000/admin/login and use a demo button, or sign in with an account below. Every seeded account has the password **`demo123`** (stored as a hash, like any other password).

| Account                  | Role                                                |
| ------------------------ | --------------------------------------------------- |
| rina@rs-bethesda.test    | Super Admin                                         |
| dimas@rs-bethesda.test   | Staff Konten (no Pengguna / Audit Log / Pengaturan) |
| agus.it@rs-bethesda.test | Super Admin                                         |
| sari@rs-bethesda.test    | Locked account                                      |
| budi@rs-bethesda.test    | Deactivated account                                 |

Five wrong passwords in a row lock an account. New users and password resets get a temporary password, shown once to the Super Admin; at the first sign-in the user must choose a new one (at least 10 characters) at `/admin/ganti-sandi` before anything else works. Anyone can change their own password from the user menu.

### Settings for a deployment

| Variable                 | Default   | What it does                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NUXT_PUBLIC_SITE_URL`   | (empty)   | The site's public address, e.g. `https://poster.rs-bethesda.co.id`. Used for the "continue on your phone" QR code, the address written onto NFC cards (`<site>/k/<code>`), and as the only accepted `Origin` for API writes. Without it, production shows no QR code and cards get the placeholder `https://poster.rs-bethesda.test/k/`. Set it **before** writing real cards: a written card keeps its address. |
| `NUXT_SEED_PASSWORD`     | `demo123` | Password of every seeded account (at least 10 characters; the server refuses to start with a shorter one). Data is in memory, so accounts go back to it on every restart. Set it on any server others can reach; the server logs a warning when it runs with `demo123`.                                                                                                                                          |
| `NUXT_PUBLIC_DEMO_LOGIN` | `true`    | Shows the demo buttons on the login page. Set `false` for anything other than a demo (the buttons only work with `demo123`).                                                                                                                                                                                                                                                                                     |
| `NUXT_TRUST_PROXY`       | `false`   | Only behind our own proxy: use the right-most `X-Forwarded-For` entry (rate limits, tap counting) and `X-Forwarded-Host`.                                                                                                                                                                                                                                                                                        |

**Public staging:** HTTPS (the session cookie is `Secure`), `NUXT_PUBLIC_SITE_URL`, `NUXT_SEED_PASSWORD`, `NUXT_PUBLIC_DEMO_LOGIN=false`, a single Node process (sessions and data live in its memory), and at the proxy `client_max_body_size 6m` plus gzip. Consider basic auth or an IP allowlist for `/admin` and the admin API; keep `/k/*`, `/go/*`, `/api/public/*`, `/api/uploads/*`, `/_nuxt/*`, `/brand/*` and `/dummy/*` open.

## Public poster pages

| URL           | What it shows                          |
| ------------- | -------------------------------------- |
| `/k/K7Q2M9XA` | Active card → full poster page         |
| `/k/H3LPQSTX` | Deactivated card → general page        |
| `/k/P4NTRY3Q` | Unmapped card → general page           |
| `/k/ZZZZ9999` | Unknown code → friendly 404 (HTTP 404) |

Poster pages are server-rendered, send `noindex` and set no cookies. Layout ("promo detail"): the page's first poster is shown in full — image, category and "Berlaku s/d" chips, title, short text, price, list of points, brochure button, folded terms — and the page's other posters become "Info lainnya" cards that open their own detail via `?p=<id>`. A contact bar stays at the bottom of the phone screen: the first contact button is the big one, the rest are icons. Empty optional fields are not shown, and the text stays readable if the image fails.

On a laptop (page wider than 768 px) the same page switches to two columns: poster image on the left (click to open it full size), the detail card and buttons on the right, quick contact links in the header, and a scannable QR code (`PosterQr`, generated on the server with `uqr`) to continue on a phone. The switch uses container queries, so the admin phone previews always show the phone layout. Contact buttons go through `/go/:poster/:button`, which counts the click and redirects; the brochure button opens the poster's own PDF or the default brochure from Settings.

## Where things live

```
app/pages/admin/          admin screens (client-side, routeRules ssr:false)
app/pages/k/[code].vue    public poster (server-rendered)
app/components/admin/     admin building blocks: TextField, NativeSelect, ConfirmDialog,
                          DataState (loading/error/empty), FileDropzone, charts, forms;
                          PosterForm (2 steps) + FormSection, PointsField, BrochureField, ScheduleStep
app/components/card/      Kartu NFC dialogs (map, register, QR)
app/components/poster/    PosterView, PosterDetail, ContactLink, PosterQr — shared by /k and the admin previews
app/components/ui/        shadcn-vue components (generated, not hand-edited)
app/composables/          useSession, useCards, useWebNfc, useDirtyGuard, usePosterPreview…
server/api/               dummy REST API — replace these handlers with the real backend
server/middleware/        security headers + same-origin check for API writes
server/routes/go/         click logger + redirect (targets come from Settings only)
server/utils/validation.ts strict zod schemas for every write endpoint
server/utils/session.ts   random session tokens, 30-minute idle timeout
server/utils/db.ts        in-memory dummy data
shared/                   types, constants (labels, themes, upload rules), date helpers
tests/                    unit tests (vitest)
```

## Scripts

| Command                             | What it does                        |
| ----------------------------------- | ----------------------------------- |
| `npm run dev`                       | Dev server on http://localhost:3000 |
| `npm run build`                     | Production build into `.output/`    |
| `npm run lint` / `npm run lint:fix` | ESLint (Nuxt config)                |
| `npm run typecheck`                 | vue-tsc over app + server           |
| `npm test`                          | Unit tests                          |
| `npm run video:dev`                 | Demo video studio on port 3100      |
| `npm run video:render`              | Export the demo video to MP4        |

## Security measures (prototype level)

- **Sessions:** the cookie holds a random 256-bit token (HttpOnly, SameSite=Lax, Secure in production), rotated at login, 30-minute idle timeout. Deactivating a user, changing their role or resetting their password ends their sessions.
- **Passwords:** scrypt hashes with a random 16-byte salt per password, compared in constant time; kept in a store of their own (`db.credentials`), never on the user object, so no API response can include them. Unknown emails are checked against a stand-in hash, so they take as long as a wrong password. Temporary passwords (new user, reset) are stored as hashes and must be changed at the first sign-in: until then every API route except the password change answers 403. New passwords need at least 10 characters. The demo buttons can be switched off with `NUXT_PUBLIC_DEMO_LOGIN=false`.
- **Login:** 5 failed attempts lock the account for 15 minutes (new sign-ins only: an open session keeps working, and a deactivated account is never re-activated by the timer). Unknown and deactivated emails get the same answers, lock included, so emails can't be checked. Rate limit per IP: the socket address, or with `NUXT_TRUST_PROXY=true` (only behind our own proxy) the right-most `X-Forwarded-For` entry.
- **Input:** every write goes through a strict schema — unknown fields are rejected (no mass assignment), and lengths, enums, dates and URLs are checked server-side.
- **Uploads:** max 5 MB; the type is detected from the file's bytes, not the browser's claim; served with `nosniff`. File addresses are random (128-bit). Visitors only get files of live posters and the logo; drafts open for signed-in staff only.
- **Request size:** API writes over 1 MB (uploads: 5 MB + form overhead) are refused from their `Content-Length` before the body is read.
- **Headers:** CSP without `'unsafe-inline'` for scripts (each page's own inline scripts are allowed by their sha256 hash, `server/plugins/csp.ts`), HSTS (production), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy; no `X-Powered-By`. API writes from another origin (or `Origin: null`) are refused; the own origin comes from `NUXT_PUBLIC_SITE_URL` when set, and `X-Forwarded-Host` only counts with `NUXT_TRUST_PROXY=true`.
- **Tap and click counts:** one tap or click per visitor, card and button within 30 seconds; browser prefetches are not counted, and link-preview bots (WhatsApp, Facebook, Telegram, Slack, crawlers) go to the `bots` column.
- **Public data:** poster pages receive an allow-list of poster fields (no internal name, author or file names).
- **Privacy:** fonts are self-hosted, so poster visitors never contact Google; no cookies on poster pages; posters are `noindex`.
- **CSV export:** cells starting with `= + - @` are neutralised so Excel cannot run them as formulas.

## Canvas editor (off in V1)

The client's V1 is upload-only, so the editor is switched off: `runtimeConfig.public.canvasEditor` is `false`, "Buat poster" goes straight to the upload form, and the editor pages redirect there. Turn it on with `NUXT_PUBLIC_CANVAS_EDITOR=true`; then `/admin/poster/buat` lets staff choose between uploading a finished poster and designing one at `/admin/poster/desain`.

- Built on Konva via vue-konva; the editor code is split into its own chunk, so public poster pages never load it.
- Phone portrait 4:5 only (1080 × 1350). Starter designs live in `app/utils/designStarters.ts`.
- The logo and "Informasi" blocks are drawn from Settings and locked: they cannot be moved, edited or deleted.
- "Selesai" exports a WebP (PNG where WebP is unsupported) through the normal upload route and returns to the poster form, which fills "Tulis ulang isi poster" from the design's text.
- The design JSON is saved with the poster (`Poster.design`) so it can be edited again. It is validated by `designSchema` (own-upload photos only, hex colours, minimum font size, element limit) and stripped from the public API.
- Undo/redo, keyboard shortcuts (Delete, Ctrl+Z, Ctrl+Y, Esc), and an autosave in the browser that the start screen offers to resume.

| Where                                 | What                                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `shared/design.ts`                    | Design types, sizes, brand palette, helpers                                                                                |
| `app/components/design/`              | `DesignEditor` (shell, history), `DesignCanvas` (Konva stage, export), `DesignTools`, `DesignProperties`, `DesignSwatches` |
| `app/composables/useDesignDraft.ts`   | Hand-off between the poster form and the editor; browser autosave                                                          |
| `app/composables/useDesignHistory.ts` | Undo/redo snapshots                                                                                                        |

## Product demo video

A 58-second, 1920 × 1080, 30 fps demo of the app for the client, built from the real admin screens and components with the dummy data. It lives apart from the app: the `/video` page only exists when `NUXT_PUBLIC_VIDEO_STUDIO=true` (set by `.env.video`), and its sign-in route (`/api/_video/session`) only works in dev with that flag on.

```bash
npm run video:dev       # studio on http://localhost:3100/video (play, pause, scrub)
npm run video:render    # with video:dev running: writes video/demo-poster-nfc.mp4 (H.264)
```

`npm run video:render -- --stills 8.5,20,31` saves PNG frames in `video/stills/` instead, for a quick check. The export opens `/video?capture=1` in headless Chrome (or Edge; set `CHROME_PATH` to choose), steps the timeline frame by frame and pipes the frames to ffmpeg (`ffmpeg-static`), so every run gives the same video.

| Where                               | What                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `app/video/timeline.ts`             | Scene order and lengths in seconds, fps, stage size, shared easing. Change a duration here and later scenes shift.                      |
| `app/video/motion.ts`               | Helpers: word reveal, number count-up, typing, camera moves, measuring an element for the spotlight                                     |
| `app/components/video/scenes/*.vue` | One file per scene. Each exposes `build(tl, at)` that adds its tweens to the paused GSAP timeline, and `ready()` when it waits for data |
| `app/components/video/Window.vue`   | Laptop window that hosts a real admin page inside the real admin layout                                                                 |
| `app/pages/video.vue`               | The stage, preview controls, and `window.__video` for the export script                                                                 |
| `scripts/render-video.mjs`          | Frame-by-frame export to MP4                                                                                                            |

**When the app changes:** scenes import the real pages (`~/pages/admin/...`) and components, so most changes appear in the video by themselves after a re-render. If a screen's layout changes, check the selectors in that scene (for example the KPI numbers in `Dash.vue`, the form sections `[aria-labelledby="s1"]` in `Posters.vue`) and the camera targets, then render stills to check. New text on screen goes in the scene's template; scene lengths go in `timeline.ts`. Numbers come from `server/utils/db.ts` and are labelled "Data contoh" on screen.

## NFC writing

`/admin/tulis-nfc` writes card URLs with Web NFC. That only works in **Chrome on Android over https**. Elsewhere the page explains why and offers a simulation, so the flow can be demoed on a laptop.

## Not done yet (dummy only)

- A database and file storage: users, password hashes, sessions and counters all live in memory and reset on restart.
- Production-grade authentication on top of the hashing that exists now: Argon2id (or bcrypt) once a dependency is acceptable, a self-service password reset by email, and TOTP for Super Admins.
- The lockout is still a hard 15-minute lock per account (anyone can lock a known account); backoff or CAPTCHA belongs to the real auth work.
- Unknown card codes still get their own "Halaman tidak tersedia" page with HTTP 404, so a code's existence can be told apart from an inactive card (see AUDIT_REPORT.md, SEC-13).
- CSV import of cards (FR-21) and Pustaka Media (FR-15) — planned, not built yet.
- Health-check endpoint and backups (module 14).
- Converting PDF posters to an image (a placeholder is shown) and resizing uploads to WebP.
- Real contact details: the WhatsApp number, phone and email in Settings are placeholders.
- A real, scannable QR code in the admin Kartu NFC screens (`AdminQrPlaceholder` is a visual stand-in; the public page already uses `PosterQr`).
- Canvas editor: snapping guides, double-click text editing on the canvas, and a contrast check (only the text-size check exists).
