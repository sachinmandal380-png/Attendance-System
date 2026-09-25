# PROJECT_STATUS.md — Standalone QR Attendance Management System

## Project path
`attendance-system/` (root), containing `backend/` and `frontend/`.
Standalone — no relation to Rising World LMS or any other project.

## Current phase
**Real verification attempted and executed end-to-end.** Every step in
the runbook below was actually invoked (not just described). Two hard,
confirmed environment blockers stopped the live run; everything else
that could be checked without them was checked and passed.

## VERIFICATION RESULTS (as of this session)

### Hard blockers (confirmed by actually running the commands)
1. **No package registry access.** `npm install` inside `backend/` fails
   immediately: `npm error code E403 ... 403 Forbidden - GET
   https://registry.npmjs.org/@types%2fbcrypt`. No dependencies
   (express, pg, drizzle-orm, zod, bcrypt, jsonwebtoken, etc.) can be
   installed.
2. **No PostgreSQL available and none installable.** No `psql`/`postgres`
   binary and no service present. `apt-get install postgresql` fails:
   every Ubuntu mirror (`archive.ubuntu.com`, `security.ubuntu.com`)
   returns `403 Forbidden` / "repository ... no longer signed" — apt
   itself is network-blocked in this sandbox, same as npm.

Both are sandbox network-egress restrictions, not code problems. Direct
consequence: `npm run db:migrate`, `npm run create-admin`, `npm run dev`,
and `npm test` were all actually run and all failed the same way —
`MODULE_NOT_FOUND` for `express`/`pg`/etc. (dev/migrate/create-admin) and
`fetch failed` for every one of the 18 automated tests (nothing was
listening on port 4000, since the server never started). Real output was
captured for each, not assumed.

### What WAS actually executed and passed
| Check | Method | Result |
|---|---|---|
| Node.js / npm present | `node --version` / `npm --version` | Node v22.22.2, npm 10.9.7 — OK |
| Backend type-check | `tsc --noEmit` (real TypeScript compiler) | **0 code errors** (only expected "module not found" noise from uninstalled deps) |
| Frontend JS syntax | `node --check` on extracted `<script>` | **Valid, no syntax errors** |
| No Course/Batch/Subject | `grep -riE "course\|batch\|subject"` across backend+frontend | **Clean — zero matches** |
| No Rising World coupling | `grep -ri "rising"` across backend+frontend | **Clean — zero matches** |
| Security features present in code | grep for helmet/cors/rate-limit/bcrypt/jwt/zod usage | **All present**: helmet (app.ts), cors allow-list (app.ts), express-rate-limit (rateLimit.ts, applied to login + public attendance routes), bcrypt (auth + createAdmin), jsonwebtoken (utils/jwt.ts), zod `.parse()` on every controller that takes input |
| Frontend `API_BASE_URL` wiring | inspected `attendance.html` | Set to `http://localhost:4000`, matching backend's default `PORT=4000` — correctly wired |
| Timezone/display logic (`timezone.ts`) | verbatim logic copied into a dependency-free harness (no code changes, only TS type annotations stripped) and run with plain `node` | **7/7 passed**, including IST day-rollover across a UTC boundary and the 12-hour-clock midnight/noon edge cases |
| CSV export escaping (`reportController.ts`'s `toCsv`) | same verbatim-copy method | **4/4 passed**, including embedded-quote doubling and embedded-comma containment |

These two logic harnesses are **not** the real modules running (they
can't run without `dotenv`/`zod` installed) — they are the exact same
algorithm, copied verbatim with only TypeScript type annotations
removed, executed to catch real logic bugs in isolation. They are not a
substitute for the real test suite.

### What could NOT be executed (and why)
Everything requiring a live server, a live database, or a real browser —
blocked by the two hard blockers above, with no workaround available in
this sandbox:
- `npm run db:migrate` / `npm run create-admin` / `npm run dev` / `npm start`
- The real automated suite (`npm test`, 18 cases) — ran, 0/18 passed,
  all failures are `fetch failed` (no server was up)
- Public student attendance flow, public teacher attendance flow
- Admin login + dashboard, Students/Teachers CRUD, attendance filters,
  correction, deletion
- Reports UI, CSV export download, permanent QR rendering
- Audit-log-survives-deletion, duplicate IN/OUT rejection, inactive-user
  rejection — the *code* implementing them was reviewed and is present
  and structurally sound (unique index + app-level check for
  duplicates; no FK from `audit_logs` to `attendance` so deletes can't
  cascade; `status !== 'ACTIVE'` checks before verify/mark), but none of
  this was exercised against a real Postgres instance in this session
- A headless-browser check was also attempted (`playwright` is
  installed globally) but no Chromium binary is cached and downloading
  one requires network access, which is blocked — so no browser-level
  check of `attendance.html` was possible either

## Database status
Schema, migration SQL, and duplicate-prevention constraints are
unchanged from the build phase (see `backend/src/db/schema.ts` and
`backend/drizzle/0000_init.sql`) — reviewed again this session, no
changes needed. Never applied to a real database (no PostgreSQL
available here).

## Backend status
No code changes were made this session — nothing genuinely broken was
found. `tsc --noEmit` is clean. Once dependencies can actually be
installed, `npm run dev` should start normally (the only failures seen
were `MODULE_NOT_FOUND`, i.e., missing packages, not bad code).

## Frontend status
No code changes. JS syntax valid, config wiring correct. Visual/
interactive behavior still unverified in an actual browser (blocked, see
above).

## Remaining blockers (exact list)
1. This sandbox cannot reach `registry.npmjs.org` (npm) or any Ubuntu
   apt mirror — `npm install` and `apt-get install postgresql` both
   return `403 Forbidden`. No dependencies can be installed here.
2. No PostgreSQL server exists in this sandbox and none can be
   installed (same network restriction).
3. No Chromium/browser binary is cached for Playwright, and one cannot
   be downloaded here — no headless-browser check of `attendance.html`
   was possible.
4. Consequently, the full automated test suite (18 cases), the manual
   click-through flows (student/teacher/admin), and any live-database
   behavior (constraint enforcement, actual audit-log survival, real
   duplicate-IN/OUT rejection under Postgres) remain **unexecuted** —
   not because of a code defect found, but because this environment has
   no path to a running server or database.

## Exact resume command (unchanged — this is the next real step)
```bash
cd attendance-system/backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, CORS_ORIGIN, PUBLIC_ATTENDANCE_URL
npm run db:migrate
npm run create-admin -- admin admin@example.com "A-Strong-Password-123"
npm run db:seed        # optional demo data
npm run dev
# in another terminal, once the server is up:
BASE_URL=http://localhost:4000 ADMIN_USER=admin ADMIN_PASS="A-Strong-Password-123" npm test
```
That resume command has now actually been attempted, line by line, in
this sandbox, and the exact failures are documented above — a clean
machine with internet access and PostgreSQL should get past all of them.
