# Audit Report — Poster Digital NFC (RS Bethesda) V1

Date: 11 Nov 2026 · Scope: whole repository · Mode: read-only audit (no application code changed). Sections 1–11 describe the code **as audited**; fixes made afterwards are in the fix logs (sections 13–15), and section 12 shows the current status.

## How this audit was done

| Step                   | What was run                                                                                                                                                                                           | Result                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Source review          | Every file in `server/`, `shared/`, the middleware, composables, login, public poster page and admin layout; config files; README                                                                      | Done                                                      |
| Unit tests             | `npx vitest run`                                                                                                                                                                                       | 3 files, 37 tests, **37 passed**, 0 failed                |
| Lint                   | `npx eslint .`                                                                                                                                                                                         | 0 problems                                                |
| Formatting             | `npx prettier --check .`                                                                                                                                                                               | All files formatted                                       |
| Type check             | `npx nuxt typecheck` (vue-tsc)                                                                                                                                                                         | 0 errors                                                  |
| Dependency scan        | `npm audit` and `npm audit --omit=dev`                                                                                                                                                                 | 35 total (9 high, 24 moderate, 2 low); production tree 16 |
| Secret scan            | Regex scan for keys, tokens, passwords, private keys in source and env files                                                                                                                           | No secrets found                                          |
| Production build       | `nuxt build` on a **copy** of the project in a temp folder (so the project's `.output/` was not touched)                                                                                               | Built in 51 s; 7.55 MB (1.92 MB gzip)                     |
| Runtime security probe | Scripted HTTP checks against that local build (`node .output/server/index.mjs` on 127.0.0.1). For the lockout test, a test-only preload moved `Date.now()` forward 16 minutes; no app code was changed | See findings                                              |
| Browser checks         | Built-in Chromium: login flow, public poster page at 375 px, admin pages, console errors, basic accessibility queries                                                                                  | See findings                                              |
| Not available          | Lighthouse / Core Web Vitals, axe-core, coverage tool (`@vitest/coverage-v8` not installed), OWASP ZAP, other browsers, git history (the folder is not a git repository)                               | Marked **NOT VERIFIED** where relevant                    |

Severity labels: **Confirmed**: reproduced at runtime or by running the code. **Code-confirmed**: clear from the source, not run. **Potential**: a risk that depends on how the app is deployed.

---

## 1. Executive summary

> **Current status (11 Nov 2026, after fixes):** all CRITICAL, HIGH and MEDIUM security findings below are fixed at prototype level and re-verified on a production build. Passwords are hashed (`demo123` for demo accounts), and the lockout, analytics, rate-limit, enumeration, upload, request-size, CSP and host-header issues are closed (sections 13–15). 86/86 unit tests pass. **Production readiness is still FAIL**: there is no database or shared store, no API/E2E tests, no version control, CI or deployment setup, and "today" is still fixed. The list below is what the audit found at the start.

**Overall health:** for a prototype, the code is clean and careful. It has strict input schemas, server-side role checks, sensible session cookies, upload type sniffing, security headers, CSV-injection protection, and lint, type and format checks that all pass. The README says plainly what is dummy.

**It is not production-ready, by design and because of real bugs:**

1. **Authentication is a stub (CRITICAL for any public deployment).** Any password containing "demo" signs in to any active account, and the login page has one-click demo buttons. There is no database: everything lives in memory and is lost on restart.
2. **A deactivated account can reactivate itself (HIGH, confirmed).** Fail five logins, wait 15 minutes, and the lock timer sets the account to `active`. A removed employee gets their access back.
3. **One request from any staff account freezes the whole server (HIGH, confirmed).** `GET /api/analytics?to=z` loops forever. Public poster pages stopped responding too, until the process was killed.
4. **The login rate limit can be bypassed with a forged `X-Forwarded-For` header (MEDIUM, confirmed).** Combined with the 5-attempt lockout, anyone can keep any account locked, Super Admins included.
5. **Uploaded files are public and have sequential IDs (MEDIUM, confirmed).** Draft posters and brochures can be listed by anyone.
6. **No version control, CI, health check, backups or deployment setup.** The folder is not a git repository.

**Production readiness: FAIL.** Fix the two HIGH bugs now; they are small. Build the real backend (auth, database, file storage) before any deployment.

**If a demo of this build is reachable from the internet right now:** put it behind basic auth or an IP allowlist immediately. Anyone can sign in as Super Admin with a "demo" password, and one request can take it down.

---

## 2. Project architecture

| Area           | Finding                                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language       | TypeScript (Vue SFCs + server handlers)                                                                                                                                       |
| Framework      | Nuxt 4.6.3 (Vue 3.5.44, vue-router 5.4.0), Nitro 2.13.5 / h3 1.15.11, Node 24.21                                                                                              |
| UI             | Tailwind CSS 4, shadcn-vue (reka-ui), lucide icons, vue-sonner; Konva canvas editor (switched off in V1)                                                                      |
| Rendering      | `/admin/**` client-only SPA (`ssr: false`); `/k/[code]` public poster page server-rendered with `noindex`                                                                     |
| Backend        | Nitro API routes in `server/api` (25 handlers), click-redirect route `server/routes/go/[poster]/[button]`, one global middleware (`server/middleware/security.ts`)            |
| Data           | **No database.** In-memory arrays in `server/utils/db.ts`; uploads in a `Map` of byte arrays; "today" fixed at `2026-10-27`                                                   |
| Auth           | Random 256-bit session token in an `HttpOnly; Secure; SameSite=Lax` cookie, in-memory session map, 30-min sliding idle timeout. Roles: `super`, `staff`. Dummy password check |
| Validation     | zod 4 strict schemas for every write (`server/utils/validation.ts`)                                                                                                           |
| Integrations   | Web NFC (browser), `wa.me` / `tel:` / `mailto:` redirects, server-side QR (`uqr`). No external APIs                                                                           |
| Tests          | Vitest 5, 3 unit test files (schemas, date helpers, CSV, design helpers)                                                                                                      |
| Tooling        | ESLint (`@nuxt/eslint` + prettier config), Prettier, vue-tsc                                                                                                                  |
| CI/CD / Docker | None                                                                                                                                                                          |
| Docs           | `README.md` (accurate and detailed), design PDF, requirement `.docx` files, `NFC - Modul.xlsx`                                                                                |
| Extra          | Demo-video studio (`/video`, `scripts/render-video.mjs`, puppeteer-core + ffmpeg-static), dev-only behind `NUXT_PUBLIC_VIDEO_STUDIO`                                          |

---

## 3. Security findings

### SEC-01 — Dummy authentication and demo sign-in (CRITICAL for deployment; known)

- **Affected:** `server/api/auth/login.post.ts:9`, `app/pages/admin/login.vue:51-55, 134-140`, `server/utils/users.ts:6`, `server/api/users/[id].patch.ts:19-24`
- **Description:** `passwordMatches = /demo/i.test(password)` accepts any password containing "demo" for every active account. The login page has buttons that sign in as Super Admin or Staff. Temporary passwords from "create user" and "reset password" are generated and shown, but never stored or checked. There is no password change, no password reset by email, and no MFA.
- **Evidence:** Confirmed: `dimas@…` / `demo123` and `rina@…` / `demo123` returned 200 with a session cookie. The demo button signed in as Super Admin in the browser.
- **Impact:** Anyone who knows an email address (they are shown in the README and on screen) has full admin control if this build is reachable.
- **Remediation:** Real credential store with Argon2id (or bcrypt cost ≥ 12). Store the temp password's hash and force a change at first login. Remove the demo buttons and the "demo" rule from production builds, for example behind a build flag that cannot be switched on at runtime. Consider TOTP for Super Admins.
- **OWASP:** A07:2021 Identification and Authentication Failures

### SEC-02 — Deactivated account re-activates itself through the lockout timer (HIGH, confirmed)

- **Affected:** `server/api/auth/login.post.ts:17-31`
- **Description:** A failed login on an **inactive** account still counts toward the lockout. On the 5th failure the code sets `status = 'locked'`, which overwrites `inactive`. On the next attempt after `lockedUntil`, lines 17-19 set `status = 'active'`. The account is now active again and the correct password works.
- **Evidence (runtime):** user `u5` (Budi, `inactive`) → 5 failed logins → `status: "locked"` → clock +16 min → login with a valid password returned **200** and `status: "active"`. The new session could read `/api/posters` (200).
- **Impact:** Deactivation is the way to remove a departed employee. They, or anyone who knows their password, can undo it without an admin. The log also shows no "reactivated" entry.
- **Remediation:** Keep the lock separate from the account status. Use a `lockedUntil` field or a separate `locked` flag, never write `status` from the login path, and treat `inactive` as final until a Super Admin changes it. Skip the failure counter for inactive accounts. Add a regression test.
- **OWASP:** A01:2021 Broken Access Control / A07:2021
- **Status (11 Nov 2026): FIXED.** Lock rules moved to `server/utils/lockout.ts`: only `active` accounts can be locked and only `locked` ones unlock. Tests in `tests/lockout.test.ts`. Re-run on a fresh build: inactive user, 6 failures + 16 min → still `inactive`, login 401; active accounts still lock (423) and unlock after 15 min.

### SEC-03 — Unbounded date range in analytics hangs the whole server (HIGH, confirmed)

- **Affected:** `server/api/analytics.get.ts:8-12`
- **Description:** `from` and `to` come straight from the query string. The loop `for (let d = from; d <= to; d = addDays(d, 1))` compares strings. With `to=z`, `d` walks past year 275760, becomes `"NaN-NaN-NaN"`, and `"NaN-NaN-NaN" <= "z"` stays true forever. A valid but huge range such as `2000-01-01`…`9999-12-31` builds a 2.9-million-entry object and response.
- **Evidence (runtime):** signed in as **staff**, `GET /api/analytics?to=z` never returned. A parallel anonymous `GET /k/K7Q2M9XA` timed out after 6 s, and the server answered nothing until it was killed. The same loop, reproduced with an iteration cap, hit 5,000,000 iterations.
- **Impact:** Any staff account, or a hijacked staff session, can take down the admin panel and every public poster page with one request.
- **Remediation:** Validate `from`/`to` with the existing `isoDate` schema, require `from <= to`, and cap the span (e.g. 366 days). Return 422 otherwise. Add tests for invalid and huge ranges.
- **OWASP:** A04:2021 Insecure Design · API4:2023 Unrestricted Resource Consumption
- **Status (11 Nov 2026): FIXED.** `analyticsQuerySchema` + `parseQuery` in `server/utils/validation.ts` accept only real calendar dates, `from ≤ to`, at most 366 days (also fixes CQ-04). The Analitik page shows the reason for a refused range. Re-run on a fresh build: `?to=z`, `2000…9999`, reversed and `2026-02-30` → 422 in ≤ 7 ms; public page still 200.

### SEC-04 — Rate limiting trusts a client-supplied `X-Forwarded-For`; lockout can be used to deny service (MEDIUM, confirmed)

- **Affected:** `server/utils/rateLimit.ts:8`, `server/api/auth/login.post.ts:24-31`, `server/utils/session.ts:48`
- **Description:** `getRequestIP(event, { xForwardedFor: true })` returns the **left-most** `X-Forwarded-For` value (h3 1.15 source). That value is whatever the client sends, even behind a proxy that appends its own. The 5-failure lockout is per account, and `currentUser()` rejects sessions of non-`active` users. So a lock also signs the victim out.
- **Evidence (runtime):** 22 login attempts with one fixed XFF value: the 21st and 22nd returned **429**. With a different XFF on each request: 22 × **401**, no 429. Five wrong passwords for `agus.it@…` (Super Admin) returned **423 locked**.
- **Impact:** Unlimited password guessing from one machine, if real passwords are weak. Anyone can lock any account, including every Super Admin, every 15 minutes, and end their open sessions.
- **Remediation:** Only trust forwarding headers from a known proxy (or take the right-most untrusted hop), and rate-limit at the proxy too (e.g. Nginx `limit_req`). Use per-account backoff (growing delays) instead of a hard lock that also ends sessions, or require a CAPTCHA after N failures. Keep the counters in Redis once there is more than one process.
- **OWASP:** A07:2021 · API4:2023

### SEC-05 — Account enumeration through the lockout response (MEDIUM, confirmed)

- **Affected:** `server/api/auth/login.post.ts:22-34`
- **Description:** The 401 message is the same for every case, as intended. But only real accounts can be locked, so the 6th failure returns **423** for a real email and **401** for an unknown one. A locked account (e.g. `sari@…`) also answers 423 at once.
- **Evidence (runtime):** unknown email × 6 → `401,401,401,401,401,401`; `agus.it@…` × 6 → `401,401,401,401,423,423`.
- **Impact:** Attackers can confirm which staff emails exist, which helps phishing and targeted lockouts.
- **Remediation:** Track failures for unknown emails the same way and answer identically (fake lock for unknown emails), or use backoff without a distinct status.
- **OWASP:** A07:2021

### SEC-06 — Uploads are public and have sequential IDs (MEDIUM, confirmed)

- **Affected:** `server/api/uploads/[id].get.ts:1-11`, `server/utils/db.ts:402-406` (`nextId`)
- **Description:** Upload needs a session, but download does not. IDs come from one global counter (`f101`, `f102`, …) shared with posters, pages and audit rows.
- **Evidence (runtime):** a staff upload returned `/api/uploads/f102`. An anonymous GET returned 200 with `Cache-Control: public, max-age=31536000, immutable`. An anonymous scan of `f1`…`f400` found it.
- **Impact:** Draft or scheduled poster images and brochures (e.g. unannounced prices or promotions) can be downloaded before they go live. The year-long public cache means a later deletion does not reach proxies or CDNs.
- **Remediation:** Use unguessable IDs (UUIDv4 / 128-bit random). Serve unpublished files only to signed-in users, or copy them to a public path on publish. Use `private` caching for non-public files.
- **OWASP:** A01:2021 Broken Access Control (IDOR)

### SEC-07 — No request body limit; 5 MB check happens after the full body is in memory (MEDIUM, confirmed)

- **Affected:** `server/api/uploads/index.post.ts:18-22`; no limit anywhere else (h3 `readRawBody` has none)
- **Evidence (runtime):** a 40 MB multipart upload was fully read (2.3 s) and only then rejected with 422. Every accepted file stays in an unbounded in-memory `Map`. With SEC-04, the 30/min upload limit is per forged IP.
- **Impact:** Memory exhaustion by a signed-in user; very large JSON bodies are possible on every write route too.
- **Remediation:** Set `client_max_body_size` (e.g. 6 MB) at the reverse proxy. Reject on `Content-Length` before reading, and stream to storage. Move files to disk or object storage.
- **OWASP:** API4:2023 Unrestricted Resource Consumption

### SEC-08 — Internal fields exposed on the public poster API (LOW, confirmed)

- **Affected:** `server/api/public/k/[code].get.ts:23-29, 34`
- **Description:** Only `design` is removed. Visitors receive `name` (documented as "internal to the team" in `shared/types.ts:41`), `updatedBy` (staff user ID), `updatedAt`, `imageFile` (original filename), `imageSize`, `status` and `archived`.
- **Evidence (runtime):** public response keys: `id,kind,name,status,archived,start,end,updatedAt,updatedBy,imageUrl,imageFile,imageSize,buttons,title,category,price,…`
- **Remediation:** Return an explicit allow-list of public fields.
- **OWASP:** API3:2023 Broken Object Property Level Authorization

### SEC-09 — `Origin: null` causes a 500 instead of a 403 (LOW, confirmed)

- **Affected:** `server/middleware/security.ts:37`. `new URL('null')` throws.
- **Evidence:** `POST /api/auth/logout` with `Origin: null` returned **500 Server Error**. The write is still blocked, so this is an error-handling bug, not a bypass.
- **Remediation:** Wrap the parse in try/catch and return 403.
- **OWASP:** A05:2021 Security Misconfiguration

### SEC-10 — Unbounded in-memory security state (LOW, code-confirmed)

- **Affected:** `server/utils/session.ts:14` (expired sessions are only removed when they are used again), `server/api/auth/login.post.ts:5` (failure counter keyed by any submitted email, never pruned for unknown emails), `server/utils/rateLimit.ts:5` (one window per forged IP, never pruned)
- **Impact:** Slow memory growth that an attacker can speed up. This goes away once a real store with TTLs (e.g. Redis) is used.

### SEC-11 — Tap and click analytics can be inflated (LOW, code-confirmed)

- **Affected:** `server/api/public/k/[code].get.ts:20` (GET with side effects), `server/routes/go/[poster]/[button].get.ts:20-21`
- **Description:** Anonymous, unthrottled, no bot filtering. The `bots` column is only seed data. Link-preview bots and prefetchers also count as taps.
- **Remediation:** Rate-limit per IP and card, ignore known bots or prefetch (`Sec-Purpose: prefetch`), and dedupe repeat taps within a short window.

### SEC-12 — CSP allows inline scripts (LOW, known)

- **Affected:** `server/middleware/security.ts:9` (`script-src 'self' 'unsafe-inline'`). The comment says nonces are planned.
- **Impact:** Weakens the CSP as a backstop against XSS. No XSS sink was found: there is no `v-html` in the app, and the only `innerHTML` is in the dev-only video helper (`app/video/motion.ts:10`) with static text.

### SEC-13 — Minor information disclosure (INFO)

- `X-Powered-By: Nuxt` on every response (confirmed). Remove it at the proxy or in middleware.
- The public API returns `kind: "notfound"` (HTTP 404) for unknown codes and `"fallback"` (200) for inactive or unmapped cards. That contradicts the "reveal nothing about why" comment. Real-world risk is low (32⁸ code space).

### SEC-14 — Host-header trust (potential)

- `app/pages/k/[code].vue:30` builds the QR "continue on phone" URL from `X-Forwarded-Host`, and `security.ts:36` compares `Origin` with it. This is only exploitable if a cache sits in front without varying on that header. **NOT VERIFIED** (the QR is rendered as SVG paths, so it could not be grep-checked). Recommendation: build absolute URLs from a configured `NUXT_PUBLIC_SITE_URL`.

### SEC-15 — Dependencies (LOW / INFO, confirmed by `npm audit`)

- All 9 **high** advisories are in the dev-only demo-video tool chain: `puppeteer-core` → `extract-zip`, `basic-ftp`, `proxy-agent`, and a nested old `zod` in `chromium-bidi`. The app's own `zod` is 4.6.7, which is not affected.
- The production tree has 16 advisories (14 moderate, 2 low), all build-time tooling: `minimatch`, `glob`, `archiver`, `node-forge`, `deepmerge`. None of these packages is in `.output/server/node_modules` (checked), so none ships in the runtime bundle.
- Action: `npm audit fix`, and upgrade `puppeteer-core` (breaking) when the video tool is next used.

### Verified as working well

- Super-Admin-only APIs refused staff at runtime: `/api/users`, `/api/audit`, `PUT /api/settings` and `POST /api/cards` all returned **403**, and unauthenticated calls returned **401**.
- Session cookie flags in the production build: `HttpOnly; Secure; SameSite=Lax; Max-Age=1800`. The token is rotated at login.
- Security headers in production: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, COOP. `X-Robots-Tag` is set on `/k/**`.
- Cross-origin API writes are refused: `Origin: https://evil.test` returned 403.
- Uploads: the type is detected from the file's bytes. A PNG header followed by HTML was served as `image/png` with `nosniff`. The filename `../../evil<script>.png` was stored as `evilscript.png`. PDFs are served as attachments.
- No open redirect: `/go/:poster/:button` targets come only from Settings (unknown button → 404). The login `?ke=//example.com` did not leave the site (but see FE-01).
- Strict schemas reject unknown fields, so there is no mass assignment. CSV export neutralises formulas.
- No hardcoded secrets found. `.env.video` holds only a feature flag.

---

## 4. Testing findings

| Item              | Result                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Existing tests    | `tests/validation.test.ts` (16), `tests/design.test.ts` (7), `tests/format.test.ts` (14), all pure unit tests |
| Executed          | `npx vitest run`: **37 passed, 0 failed**, 846 ms                                                             |
| Coverage          | **Not measured.** No coverage provider installed. No percentage is claimed                                    |
| API / integration | None. No handler is tested, including auth, sessions, role checks, uploads and analytics                      |
| E2E               | None                                                                                                          |
| Component tests   | None                                                                                                          |
| Flakiness / order | Tests are pure and independent; no shared state. No flakiness seen in one run                                 |

**Quality notes**

- The tests that exist are meaningful: they cover real rules such as mass assignment, own-upload URLs and https-only links, not filler.
- **Weak assertions:** most negative tests only check `success === false` (e.g. `validation.test.ts:26-34, 55-62`). A schema that fails for a different reason, such as a typo in a valid fixture, would still pass. Assert the failing path or message, as `validation.test.ts:44` already does.
- Every confirmed bug in section 3 (SEC-02, SEC-03, SEC-04, SEC-05, SEC-07, SEC-09, FE-01) lives in code with no tests.

**Recommended tests (highest value first)**

1. Login state machine: inactive accounts stay inactive after N failures and time travel (SEC-02); a lock expires only for locked accounts; reset unlocks; the same response for unknown and real emails (SEC-05).
2. Analytics query validation: invalid dates, `from > to`, span over the limit → 422 (SEC-03).
3. Authorization matrix: every `/api/*` route × {anonymous, staff, super} → expected 200/401/403. One table-driven test.
4. Uploads: wrong magic bytes → 422; oversize → 413/422 _before_ full read; anonymous read of unpublished file → 401/404 (after SEC-06 fix).
5. Session: idle expiry, rotation on login, sessions ended on deactivate, role change and password reset.
6. Public page: inactive, unmapped, unknown cards; only `tayang` posters; no internal fields (SEC-08).
7. CSRF middleware: foreign Origin → 403, `null` → 403 (SEC-09).
8. E2E (Playwright): login → upload poster → publish → card mapped → `/k/:code` shows it → contact click redirects.

Suggested tooling: `@nuxt/test-utils` (`$fetch` against a built server) for API tests, Playwright for E2E, `@vitest/coverage-v8` for coverage.

---

## 5. Code quality findings

**Static analysis:** ESLint 0 problems, Prettier clean, vue-tsc 0 errors (all executed). The code is consistent, well commented and well separated (schemas, session, DB access, shared types).

| ID    | Issue                                                                                                                                                                                                                                                                                                 | Where                                                                     | Severity                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| CQ-01 | **Fixed clock.** `TODAY = '2026-10-27'` drives scheduling, dashboards and audit stamps. `nowStamp()` mixes the fixed date with the real hour, while `lastTap` uses real UTC time. Dates are parsed in the server's local time zone, so a UTC server and WIB users disagree on the day after 17:00 WIB | `shared/utils/format.ts:3, 157-159, 222-225`; `public/k/[code].get.ts:20` | Medium (production blocker) |
| CQ-02 | Login treats a failed `navigateTo` as a failed login (see FE-01)                                                                                                                                                                                                                                      | `app/pages/admin/login.vue:34-45`                                         | Low                         |
| CQ-03 | `z.email().trim()`: the email check runs **before** trim, so `" nama@rs-bethesda.test"` is rejected instead of trimmed (confirmed with zod 4.6.7)                                                                                                                                                     | `server/utils/validation.ts:178, 210`                                     | Low                         |
| CQ-04 | `days[r.date]!` non-null assertion → 500 for malformed but in-range dates (fixed together with SEC-03)                                                                                                                                                                                                | `server/api/analytics.get.ts:28-29`                                       | Low                         |
| CQ-05 | Page names are unique on create but not on rename                                                                                                                                                                                                                                                     | `server/api/pages/index.post.ts:8` vs `pages/[id].put.ts:33`              | Low                         |
| CQ-06 | Retention settings (`retentionAudit`, `retentionTap`) are saved but nothing enforces them                                                                                                                                                                                                             | `server/utils/db.ts:364-365`                                              | Low (privacy)               |
| CQ-07 | Unused dependency `cn` (0 imports; `app/lib/utils.ts` defines its own `cn`)                                                                                                                                                                                                                           | `package.json`                                                            | Low                         |
| CQ-08 | `"vue": "latest"`, `"vue-router": "latest"`: unpinned. vue-router resolved to a new major (5.4.0). Fine with the lockfile, but `npm install` without it can change majors                                                                                                                             | `package.json`                                                            | Low                         |
| CQ-09 | Repeated lookups: `db.users.find(...)?.name` in 5 handlers; click sum `Object.values(r.clicks).reduce` in 2. Small helpers would remove the duplication                                                                                                                                               | `server/api/*.ts`                                                         | Low                         |
| CQ-10 | Hardcoded demo card link "Lihat poster" → `/k/K7Q2M9XA` in the admin header                                                                                                                                                                                                                           | `app/layouts/admin.vue:76`                                                | Low                         |
| CQ-11 | The audit log uses entity "Poster" when duplicating an announcement                                                                                                                                                                                                                                   | `server/api/posters/[id]/duplicate.post.ts:16`                            | Low                         |
| CQ-12 | No `engines` field or `.nvmrc`; the Node version is undocumented (built with Node 24.21)                                                                                                                                                                                                              | `package.json`                                                            | Low                         |

Swallowed errors: the `catch {}` blocks found are deliberate (localStorage, font loading, clipboard). `useSession.refresh()` turns any `/api/auth/me` failure, a 500 included, into "logged out", which hides server errors behind a login redirect (`app/composables/useSession.ts:9`).

---

## 6. Performance findings

| ID    | Finding                                                                                                                                                                                                                                                     | Evidence                                                                                                     | Likely impact / priority                                                                                                                                                         |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-01 | The Node server does not compress responses                                                                                                                                                                                                                 | `curl -H 'Accept-Encoding: gzip, br'` on a 230 KB JS chunk → `Content-Length: 230272`, no `Content-Encoding` | About 3× more bytes on every asset unless a proxy compresses. Fix at the proxy or with Nitro `compressPublicAssets`. **P2**                                                      |
| PF-02 | The public poster page loads admin-sized code. The SSR HTML has 14 `modulepreload` scripts (315 KB raw / 117 KB gzip), **59 `prefetch` links** covering every route chunk including admin pages, and one 100 KB (30 KB gzip) CSS file shared with the admin | Measured from `/k/K7Q2M9XA` HTML and `.output/public/_nuxt`                                                  | The page is readable before JS (SSR), but visitors on weak mobile signal download code they never use. Trim prefetching for `/k/**` and check the result with Lighthouse. **P2** |
| PF-03 | Analytics and dashboard do linear scans with lookups inside loops (`db.cards.find` per daily row; `sumRange` called 16 times over all rows)                                                                                                                 | `server/api/analytics.get.ts:22-36, 59-72`; `dashboard.get.ts:16-21`                                         | Fine for the dummy data. With a real DB this must become aggregate queries on indexed `(date)`, `(card_code, date)`. **P2** (part of the DB design)                              |
| PF-04 | Uploads are held in process memory                                                                                                                                                                                                                          | `server/utils/db.ts:415`                                                                                     | RAM grows with every upload. Replaced by storage in P1                                                                                                                           |
| PF-05 | Admin data refetches (e.g. sidebar dashboard on every layout mount) are not cached                                                                                                                                                                          | `app/layouts/admin.vue:25`                                                                                   | Minor. **P3**                                                                                                                                                                    |

**Core Web Vitals: NOT VERIFIED.** Lighthouse was not available here. Run `npx lighthouse http://<host>/k/<code> --preset=perf --form-factor=mobile` against a staging build.

---

## 7. Database findings

There is **no database**. `server/utils/db.ts` holds arrays that reset on every restart. So there is no schema, keys, constraints, indexes, migrations, transactions, soft-delete policy or backups to audit. **Status: FAIL for production, as expected for a prototype.**

Risks to design for, seen in the current data model:

- **Referential integrity:** `pages.posterIds`, `cards.pageId`, `posters.updatedBy`, `audit.userId` and `daily.card/pageId` are plain strings with no enforced links. Use FKs: `page_posters(page_id, poster_id, position)` as a join table rather than an array, `cards.page_id → pages.id ON DELETE SET NULL`.
- **Uniqueness:** `users.email` (case-insensitive), `cards.code`, `pages.name` (case-insensitive, on rename too: CQ-05), and exactly one default page (partial unique index on `is_default` where true).
- **Concurrency:** read-modify-write of arrays (e.g. `pages/[id].put.ts`, `cards/bulk.post.ts`) needs transactions once several processes or users write at once.
- **Soft delete:** posters use `archived`; users are never deleted (good for the audit trail). Keep that pattern.
- **Analytics volume:** daily rows per card per day plus a click map should become a normalised `tap_events` / `click_events` table with daily rollups, and indexes on `(date)`, `(card_code, date)`, `(poster_id, button, date)`. Retention jobs should honour the settings (CQ-06).
- **Time:** store timestamps as `timestamptz` (UTC) and convert to Asia/Jakarta for display (CQ-01).
- **Backups:** none. Plan daily backups plus a tested restore. The README lists this as module 14, not built.

---

## 8. Frontend and accessibility findings

**Checked and passing (browser):** `lang="id"`. A skip link in the admin layout. On `/admin` and `/admin/posters/upload`, 0 unlabelled inputs and 0 broken `aria-describedby`. The public poster at 375 px: no horizontal scroll, all images have `alt`, no named control smaller than 24 px, contact buttons ≥ 48 px, and the page renders without JS (SSR). The Web NFC fallback is explained in the UI.

| ID    | Issue                                                                                                                                                                                                                                                   | Where                                                       | Severity                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| FE-01 | **A successful login shows "Email atau kata sandi salah · Sisa percobaan: 0"** when `?ke=` is not an internal path. `navigateTo` throws `NUXT_E2001`, and the `catch` treats it as a failed login. The session _was_ created (confirmed in the browser) | `app/pages/admin/login.vue:35-45`                           | Low (confusing; reachable from a crafted link) |
| FE-02 | The temporary password is shown only in a toast that disappears after 15 s. It is easy to miss and fails WCAG 2.2.1 (Timing Adjustable)                                                                                                                 | `app/pages/admin/users.vue:31-33` (and the reset flow)   | Low                                            |
| FE-03 | Heading levels skip on the public page: `h1` "Sleep Lab" → `h3` "Manfaat" → `h2` "Info lainnya"                                                                                                                                                         | `app/components/poster/PosterDetail.vue` / `PosterView.vue` | Low                                            |
| FE-04 | Login fields always set `aria-describedby="email-err"` / `"pw-err"`, even when no error element exists                                                                                                                                                  | `app/pages/admin/login.vue:97, 112`                         | Low                                            |
| FE-05 | Any `/api/auth/me` failure looks like "logged out" (no error state), so an outage sends staff to the login page                                                                                                                                         | `app/composables/useSession.ts:9`                           | Low                                            |

**NOT VERIFIED:** colour contrast (no axe-core or contrast tool run), screen-reader testing, full keyboard traversal of dialogs, Firefox and Safari (only Chromium tested). Web NFC is Chrome-on-Android only, as documented.

---

## 9. SEO and web standards

Poster pages are intentionally `noindex, nofollow` (header and meta, confirmed), so classic SEO is out of scope. Practical gaps:

- **No Open Graph or meta description on poster pages.** Promo links will be shared on WhatsApp, and they currently show no preview image or title. Add `og:title`, `og:description`, `og:image` (noindex does not block previews). The page `<title>` is the company name only, not the poster title. **P2**
- `/robots.txt` and `/sitemap.xml` return 404. Add a `robots.txt` that disallows `/admin` and `/api`; skip the sitemap (pages are noindex).
- `/admin/**` has no `X-Robots-Tag: noindex`. Add it to `routeRules`.
- HTTPS and HSTS are set by the app; TLS itself depends on the proxy (NOT VERIFIED).

---

## 10. DevOps and production readiness

| ID    | Finding                                                                                                                                                                          | Severity          |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| DO-01 | **Not a git repository.** No version history, no review trail, no rollback, no remote backup of the source                                                                       | High              |
| DO-02 | No CI pipeline. Lint, typecheck, test and build all pass locally but nothing enforces them                                                                                       | Medium            |
| DO-03 | No Dockerfile or deployment config (process manager, reverse proxy, TLS, body limits, compression)                                                                               | Medium            |
| DO-04 | No health-check endpoint (`/api/health` → 404, confirmed), no structured logging, metrics or alerting                                                                            | Medium            |
| DO-05 | All state (sessions, rate limits, data, uploads) is in one process's memory. A restart loses everything, and you cannot run two instances                                        | High (production) |
| DO-06 | No secret management needed yet (no secrets exist). Plan env-based config for DB URL, session secret and storage keys, and keep `.env` out of the repo (already in `.gitignore`) | Info              |
| DO-07 | Large binaries in the project root (5.7 MB PDF, `.docx`, `.xlsx`, logos). Move them to `docs/` or outside the repo                                                               | Low               |
| DO-08 | **Build reproducibility:** `nuxt build` succeeded from a clean copy (51 s) with the lockfile. Pin Node (CQ-12) and the `latest` ranges (CQ-08) to keep it so                     | Info              |

---

## 11. Action plan

### P0 — Critical, now

| #    | Task                                                                                                              | Reason         | Files          | Complexity | Depends on | Validation                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------- | -------------- | -------------- | ---------- | ---------- | ----------------------------------------------------- |
| P0-1 | Make sure no build is publicly reachable. If a client demo is hosted, put it behind basic auth or an IP allowlist | SEC-01, SEC-03 | hosting config | Low        | —          | Anonymous request from outside returns 401            |
| P0-2 | Put the project under git with a private remote                                                                   | DO-01          | repo root      | Low        | —          | `git log` shows the initial commit; the remote has it |

### P1 — High, before any production deployment

| #    | Task                                                                                                                                                              | Reason                 | Files                                                                     | Complexity | Depends on | Validation                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------------------------------- |
| P1-1 | Fix the lockout state machine: keep the lock separate from `status`; inactive stays inactive                                                                      | SEC-02                 | `server/api/auth/login.post.ts`, `shared/types.ts`, `users/[id].patch.ts` | Low        | —          | New unit/API test; repeat the runtime probe (inactive user + 16 min → still 401) |
| P1-2 | Validate analytics `from`/`to` (ISO date, `from ≤ to`, max 366 days)                                                                                              | SEC-03, CQ-04          | `server/api/analytics.get.ts`, `server/utils/validation.ts`               | Low        | —          | `?to=z` → 422 in < 50 ms; server stays responsive                                |
| P1-3 | Trusted-proxy IP handling plus proxy-level rate limit; replace the hard lock with backoff or CAPTCHA; same response for unknown emails                            | SEC-04, SEC-05, SEC-10 | `server/utils/rateLimit.ts`, `login.post.ts`, proxy config                | Medium     | P1-8       | Rotating XFF → 429; unknown and real email give identical responses              |
| P1-4 | Real authentication: Argon2id hashes, stored temp passwords with forced change, no demo login in production, password-reset flow                                  | SEC-01, FE-02          | `server/api/auth/*`, `server/api/users/*`, `login.vue`, `pengguna.vue`    | High       | P1-6       | Auth tests; demo buttons absent from production bundle                           |
| P1-5 | Uploads: unguessable IDs, private access for unpublished files, body limit at the proxy plus a `Content-Length` pre-check, object or disk storage                 | SEC-06, SEC-07, PF-04  | `server/api/uploads/*`, proxy config                                      | Medium     | P1-6       | Anonymous GET of a draft file → 404; 40 MB → 413 without buffering               |
| P1-6 | Database with migrations, FKs, unique constraints and indexes (section 7); backups plus a tested restore                                                          | DB, DO-05              | `server/utils/db.ts` → DB layer, all handlers                             | High       | —          | Migrations run from empty; restore drill documented                              |
| P1-7 | Real clock and Asia/Jakarta time zone in place of `TODAY`                                                                                                         | CQ-01                  | `shared/utils/format.ts`, all callers, tests                              | Medium     | —          | Tests with an injected clock; scheduling crosses midnight WIB correctly          |
| P1-8 | Deployment baseline: Dockerfile (non-root), reverse proxy (TLS, gzip/brotli, body limit), `/api/health`, structured logs, CI running lint, typecheck, test, build | DO-02..05, PF-01       | new files                                                                 | Medium     | P0-2       | CI green on a PR; health check used by the orchestrator                          |
| P1-9 | API test suite: auth matrix, login state machine, uploads, analytics, CSRF                                                                                        | Testing                | `tests/`                                                                  | Medium     | P1-1, P1-2 | The tests fail on the old code and pass on the fix                               |

### P2 — Medium, next cycle

| #    | Task                                                                 | Reason       | Files                                                 | Complexity | Validation                             |
| ---- | -------------------------------------------------------------------- | ------------ | ----------------------------------------------------- | ---------- | -------------------------------------- |
| P2-1 | Public API allow-list of fields                                      | SEC-08       | `server/api/public/k/[code].get.ts`                   | Low        | Response keys test                     |
| P2-2 | `Origin: null` and malformed origins → 403                           | SEC-09       | `server/middleware/security.ts`                       | Low        | Test                                   |
| P2-3 | Throttle, dedupe and filter bots for taps and clicks                 | SEC-11       | public route, `/go` route                             | Medium     | Repeated taps counted once per window  |
| P2-4 | Trim prefetch and JS for `/k/**`; enable compression                 | PF-01, PF-02 | `nuxt.config.ts`, proxy                               | Medium     | Lighthouse mobile before and after     |
| P2-5 | OG tags and per-poster `<title>`; `robots.txt`; noindex for `/admin` | SEO          | `app/pages/k/[code].vue`, `public/`, `nuxt.config.ts` | Low        | WhatsApp link preview shows the poster |
| P2-6 | Enforce retention settings with a scheduled job                      | CQ-06        | new job                                               | Medium     | Old rows removed per setting           |
| P2-7 | Site URL from config instead of forwarded headers                    | SEC-14       | `app/pages/k/[code].vue`, middleware                  | Low        | QR uses the configured host            |
| P2-8 | Coverage provider and a coverage report in CI                        | Testing      | `vitest.config.ts`, `package.json`                    | Low        | Report generated                       |

### P3 — Low, technical debt

| #    | Task                                                                                                                               | Reason                      | Complexity |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------- |
| P3-1 | CSP nonces instead of `'unsafe-inline'` for scripts                                                                                | SEC-12                      | Medium     |
| P3-2 | Fix the login redirect handling (only accept internal paths; never report success as failure)                                      | FE-01, CQ-02                | Low        |
| P3-3 | Persistent dialog with a copy button for temporary passwords                                                                       | FE-02                       | Low        |
| P3-4 | Heading order, conditional `aria-describedby`, error state for `/api/auth/me` failure                                              | FE-03, FE-04, FE-05         | Low        |
| P3-5 | Trim before validating email; page-name uniqueness on rename; announcement audit label                                             | CQ-03, CQ-05, CQ-11         | Low        |
| P3-6 | Remove `cn`; pin `vue` / `vue-router`; add `engines` / `.nvmrc`; `npm audit fix`; upgrade puppeteer-core                           | CQ-07, CQ-08, CQ-12, SEC-15 | Low        |
| P3-7 | Small helpers for repeated lookups; remove the hardcoded demo card link; remove `X-Powered-By`; move binaries out of the repo root | CQ-09, CQ-10, SEC-13, DO-07 | Low        |
| P3-8 | Make negative tests assert the failing field                                                                                       | Testing                     | Low        |

---

## 12. Final assessment

Current status after the fixes in sections 13–15 (the audit-time status is in brackets).

| Category                   | Status              | Reason                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Security (prototype scope) | **PASS** (was FAIL) | No CRITICAL, HIGH or MEDIUM finding left open in the code; all re-verified on a production build. Open, all LOW or deployment-dependent: SEC-04 residual (15-minute lock of a known account), SEC-13 unknown-code 404, SEC-15 dev-tool dependency updates, scrypt → Argon2id. This does **not** cover production: credentials, sessions and rate limits live in process memory |
| Test quality               | **FAIL**            | 86/86 unit tests pass (was 37), including regression tests for every fix; still no API-level or E2E tests, coverage not measured                                                                                                                                                                                                                                               |
| Code quality               | **PASS**            | Lint, typecheck and format clean; clear structure; only Low issues apart from the fixed clock (CQ-01)                                                                                                                                                                                                                                                                          |
| Performance                | **NOT VERIFIED**    | No Core Web Vitals measurement possible here; measured bundle and compression gaps (PF-01, PF-02)                                                                                                                                                                                                                                                                              |
| Database                   | **FAIL**            | No database                                                                                                                                                                                                                                                                                                                                                                    |
| Accessibility / frontend   | **NOT VERIFIED**    | Automated checks done here passed; contrast, screen reader and other browsers not tested                                                                                                                                                                                                                                                                                       |
| DevOps                     | **FAIL**            | No VCS, CI, container, health check or backups                                                                                                                                                                                                                                                                                                                                 |
| **Production readiness**   | **FAIL**            | Prototype by design; see the blockers below                                                                                                                                                                                                                                                                                                                                    |

**Outstanding blockers:** a database with backups and a shared store for credentials, sessions and rate limits (section 7, DO-05); file storage on disk or object storage instead of memory (PF-04); real date and time zone (CQ-01); API and E2E tests (section 4); version control and a deployment pipeline with proxy limits and TLS (DO-01..05).

_Audit made no changes. Afterwards, on approval, the security findings were fixed on 11 Nov 2026: see sections 13–15._

---

## 13. Fix log — security batch (11 Nov 2026)

Verified on a fresh production build with scripted requests and the browser. Tests: 57/57 pass (`tests/security.test.ts` added); lint, typecheck and format clean.

| Finding                               | Status                      | Change                                                                                                                                                                                          | Verified result                                                                                           |
| ------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| SEC-04 rate-limit bypass              | **Fixed (prototype level)** | `server/utils/clientIp.ts`: socket address by default; `NUXT_TRUST_PROXY=true` uses the right-most `X-Forwarded-For` entry. A login lock no longer ends the user's open sessions (`session.ts`) | 22 logins with a new forged XFF each → 429 from the 21st. Locked user's open session → 200                |
| SEC-05 enumeration                    | **Fixed**                   | `createLoginGuard()` in `server/utils/lockout.ts`: unknown and deactivated emails get a stand-in lock after 5 failures                                                                          | unknown, real and deactivated emails all answer `401×4, 423, 423`; deactivated stays `inactive`           |
| SEC-06 public sequential uploads      | **Fixed**                   | Random 128-bit IDs (`f` + 32 hex); `GET /api/uploads/:id` serves visitors only files of live posters and the logo; `Cache-Control: private`                                                     | Draft file: anonymous 404, signed-in 200; after publishing: anonymous 200                                 |
| SEC-07 no body limit                  | **Fixed**                   | `server/utils/requestChecks.ts` + middleware: 413 over 1 MB (uploads 5 MB + 256 KB) from `Content-Length`; 411 for chunked bodies                                                               | 40 MB upload → 413 in 26 ms; 2 MB JSON → 413; chunked → 411; normal upload 200                            |
| SEC-08 internal fields public         | **Fixed**                   | `PUBLIC_POSTER_FIELDS` allow-list (`shared/types.ts`) used by `/api/public/k/:code`                                                                                                             | Keys now `id,kind,end,imageUrl,description,buttons,title,category,price,priceUnit,listTitle,points,terms` |
| SEC-09 `Origin: null` → 500           | **Fixed**                   | `originHost()` returns null for non-URLs                                                                                                                                                        | 403; same-origin write still 200                                                                          |
| SEC-10 unbounded maps                 | **Partly fixed**            | Rate-limit windows and login counters pruned above 10,000 entries; expired sessions pruned at each login                                                                                        | Code + unit tests; a shared store (Redis) is still needed for more than one process                       |
| FE-01 login shows error after success | **Fixed**                   | `app/utils/returnPath.ts`: only `/admin…` return paths; navigation is outside the error handler                                                                                                 | `?ke=//example.com` → lands on `/admin`, no error shown                                                   |

**Still open:** SEC-01 (dummy auth), SEC-11 (tap/click inflation), SEC-12 (CSP nonces), SEC-13, SEC-14, and everything outside security. Residual risk for SEC-04: one client can still lock a known account for 15 minutes (5 tries), but no longer signs its user out. Backoff or CAPTCHA belongs to the real-auth work (P1-4). In production, also enforce the body limit at the proxy.

## 14. Fix log — remaining security (11 Nov 2026)

Verified on a fresh production build (temp copy, `node .output/server/index.mjs` on 127.0.0.1:3999) with a scripted HTTP check (38/38 pass) and in the browser (login, forced password change, create user, reset password, public `/k/K7Q2M9XA`; console clean on every page). Tests: 82/82 pass (`tests/security-remaining.test.ts` added, 25 tests); lint, typecheck and format clean.

| Finding                         | Status                      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verified result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEC-01 demo-only authentication | **Fixed (prototype level)** | `server/utils/passwords.ts`: scrypt + random 16-byte salt, `timingSafeEqual`, stand-in hash for unknown emails; hashes in `db.credentials`, never on `User`. Seeds hashed from `demo123` at startup. Create user / reset store the temp password's hash and set `mustChangePassword`. `POST /api/auth/password` (strict schema, ≥ 10 characters). `server/utils/access.ts`: 403 everywhere else until changed; `/admin/change-password` page, auth guard redirect, user-menu link. `publicUser()` allow-list on login, `/me`, `/users`. Demo buttons behind `NUXT_PUBLIC_DEMO_LOGIN` (default `true`) | `demo123` → 200; `xdemox`, `demo`, `demo-abc`, `DEMO123` → 401. Login, `/me`, `/users` keys `id,name,email,role,status,lastLogin,(lockedUntil),mustChangePassword`, no hash or salt. New user with temp → 200 `mustChangePassword:true`; `/api/posters` → 403 "Ganti kata sandi sementara Anda terlebih dahulu."; short new → 422 `newPassword`; wrong current → 422 `currentPassword`; change → 200, then `/api/posters` 200, temp → 401, new → 200. Reset: old → 401, temp → 200 + forced change. `NUXT_PUBLIC_DEMO_LOGIN=false` → no demo box |
| SEC-11 tap/click inflation      | **Fixed**                   | `server/utils/tapCounter.ts` (+ `visits.ts`): once per (visitor IP, card, poster/button) per 30 s; `Sec-Purpose`/`Purpose: prefetch` ignored; bot user agents → `bots`; map pruned above 10,000. The server-rendered page passes its visitor's address to its own API call (`x-nfc-visitor`), which is read only on internal requests (no socket address), so it cannot be forged from outside                                                                                                                                                                                                    | 5 page loads + 3 API calls from one IP → +1 tap; a second IP → +1; 4 requests with forged `x-nfc-visitor` values → +1; prefetch → +0; WhatsApp and facebookexternalhit UAs → taps +0, bots +2; 4 WhatsApp clicks → +1, prefetch click → +0                                                                                                                                                                                                                                                                                                       |
| SEC-12 CSP `unsafe-inline`      | **Fixed**                   | `server/utils/csp.ts` + `server/plugins/csp.ts` (`render:html`): HTML responses allow their own inline scripts by sha256 hash; everything else gets `script-src 'self'`. No nonce support or new dependency needed                                                                                                                                                                                                                                                                                                                                                                                | `/k/K7Q2M9XA` and `/admin/login`: `script-src 'self' 'sha256-…' 'sha256-…'` (2 inline scripts, 2 hashes); APIs `script-src 'self'`. Public page hydrates; admin login, Beranda, Pengguna, ganti-sandi work; no CSP errors in the console                                                                                                                                                                                                                                                                                                         |
| SEC-13 information disclosure   | **Partly fixed**            | `X-Powered-By` removed (`beforeResponse` hook in `server/plugins/csp.ts`). Unknown vs inactive card codes: **not changed** (see trade-off)                                                                                                                                                                                                                                                                                                                                                                                                                                                        | No `X-Powered-By` on `/k/…`, `/admin/login`, `/api/auth/me`, `/api/public/k/…`. `/k/ZZZZ9999` → 404, `/k/H3LPQSTX` → 200 (unchanged)                                                                                                                                                                                                                                                                                                                                                                                                             |
| SEC-14 host-header trust        | **Fixed**                   | `runtimeConfig.public.siteUrl` (`NUXT_PUBLIC_SITE_URL`); `app/utils/posterLink.ts` builds the QR link from it, request origin only in dev, no QR otherwise. The same-origin write check uses the site URL's host, and `X-Forwarded-Host` only with `NUXT_TRUST_PROXY=true`                                                                                                                                                                                                                                                                                                                        | Without the setting: forged `X-Forwarded-Host: evil.test` not in the HTML, no QR; forged host + `Origin: https://evil.test` → 403. With `NUXT_PUBLIC_SITE_URL=https://poster.rs-bethesda.test`: QR shown; write with that Origin → 200, with the server's own host → 403                                                                                                                                                                                                                                                                         |

**Trade-off (SEC-13):** the public page shows "Halaman tidak tersedia" with HTTP 404 for unknown codes because the API tells it `kind: 'notfound'`. Making the API answer unknown codes like inactive ones would remove that page and its 404, which the README documents. Following the brief, the user-facing behaviour was kept and the API left as it is. Real-world risk stays low (32⁸ codes).

**Also checked:** FE-02 was already in place: the temporary password shows in a dialog with a copy button that stays until it is confirmed and closed (no 15-second toast). Seen in the browser for both create and reset.

**Still open:** a database and shared store (everything above is per process and resets on restart); Argon2id/bcrypt instead of scrypt once a dependency is acceptable, email-based self-service reset, TOTP for Super Admins; the 15-minute hard lock (SEC-04 residual); SEC-13's unknown-code 404 (above); SEC-15 dependency updates; everything outside security.

---

## 15. Review of section 14 and follow-up fixes (11 Nov 2026)

Section 14 was re-checked independently on a fresh production build: SEC-01, 11, 12, 13 and 14 hold as described (CSP hashes cover every inline script on `/k`, `/admin/login` and the 404 page; no CSP or console errors; forged visitor headers add no taps). Four smaller issues were found and fixed:

| Issue                                                                                                                   | Change                                                                                                                                                                                                                                                                        | Verified result                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Each login attempt blocked the whole server (`scryptSync`, ~38 ms measured)                                             | `server/utils/passwords.ts`: request-time hashing and checking use async `scrypt` (thread pool); `hashPasswordSync` / `credentials.seed()` only for start-up seeding. Callers await it; a new user is added before hashing so a duplicate email can't slip in during the wait | Public API answered in 11 ms while 10 password checks ran; login `demo123` → 200, wrong → 401; new user's temp password → 200. Test: the event loop keeps ticking during checks |
| "Perpanjang" (`POST /api/posters/:id/extend`, added outside the security work) accepted any later date, e.g. 9999-12-31 | `extendEndProblem()` in `server/utils/validation.ts`: after the current end, at most 366 days past it                                                                                                                                                                         | +7 days → 200; +1 year and a month → 422 "Maksimal 1 tahun setelah …"; 9999-12-31 → 422                                                                                         |
| Stray generated folders `app/.nuxt/` and `app/node_modules/.cache/` (from a Nuxt command run inside `app/`)             | Deleted (plain folders, 39 generated files)                                                                                                                                                                                                                                   | Gone; the project's own `.nuxt/` and `node_modules/` untouched; typecheck didn't recreate them                                                                                  |
| Sections 1 and 12 still showed the audit-time state                                                                     | Status note added to section 1; section 12 shows current status                                                                                                                                                                                                               | —                                                                                                                                                                               |

Checks: 86/86 tests, lint, typecheck and format clean.
