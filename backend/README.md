# Attendance Backend

Standalone Node.js + TypeScript + Express + Drizzle ORM + PostgreSQL backend
for the QR attendance system. Has nothing to do with any other project.

## 1. Install

```bash
cd backend
npm install
cp .env.example .env
# edit .env: DATABASE_URL, JWT_SECRET, CORS_ORIGIN, PUBLIC_ATTENDANCE_URL
```

## 2. Create the database

```bash
createdb attendance_db
# or: psql -c "CREATE DATABASE attendance_db;"
```

## 3. Run migrations

```bash
npm run db:migrate
```

This applies all pending SQL files in `drizzle/` in filename order (tracked in a `_migrations` table so they are safe to re-run). The current feature migration is `drizzle/0001_student_attendance_slots.sql`, which adds the nullable student attendance start time and the daily admin override table. If you change `src/db/schema.ts` later, generate a new SQL
file with `npx drizzle-kit generate` and it will be picked up automatically.

## 4. Create the first admin

```bash
npm run create-admin -- admin admin@example.com "A-Strong-Password-123"
```

## 5. (Optional) Seed demo data

```bash
npm run db:seed
```

Adds fictional demo students (STU001, STU002) and teachers (TCH001, TCH002).
Development/testing only - do not run against production.

## 6. Run the server

```bash
npm run dev     # ts-node/tsx with auto-reload
# or, for production:
npm run build
npm start
```

Server listens on `PORT` (default 4000). Health check: `GET /api/health`.

## 7. Serve the frontend

`../frontend/attendance.html` is a single self-contained file. Serve it with
any static file host (nginx, Apache, `npx serve`, GitHub Pages, S3, etc.) or
even open it in `file://` for local testing. At the top of its `<script>`
block, set:

```js
const API_BASE_URL = "http://localhost:4000"; // or your deployed backend URL
```

Public attendance page: `attendance.html`
Admin panel: `attendance.html#admin`

## 8. Run tests

With the server running against a migrated + seeded DB and an admin created:

```bash
BASE_URL=http://localhost:4000 ADMIN_USER=admin ADMIN_PASS="A-Strong-Password-123" npm test
```

## Deployment notes

- No Docker required - any host that runs Node 18+ and has access to a
  PostgreSQL instance works (Railway, Render, a VPS with PM2, etc.).
- Set `NODE_ENV=production`, a strong random `JWT_SECRET`
  (`openssl rand -hex 32`), and `CORS_ORIGIN` to the exact origin that serves
  `attendance.html`.
- Put the backend behind HTTPS (via a reverse proxy or your host's built-in
  TLS) - admin JWTs and passwords must never travel over plain HTTP.
- Print the permanent QR code once (Admin Panel -> QR Code) and place it
  physically in the classroom/institute. It never needs to be regenerated
  unless `PUBLIC_ATTENDANCE_URL` changes.
