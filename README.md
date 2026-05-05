# BKKGO Shortlink System

A self-hosted, full-stack URL shortener (s.id-style) with user accounts, an admin dashboard, QR codes, and analytics.

- **Backend:** Node.js + Express + SQLite (`better-sqlite3`) + JWT + bcrypt + nanoid + qrcode
- **Frontend:** React + Vite + TailwindCSS + Recharts + React Router
- **Storage:** SQLite by default (zero-config). Drop in PostgreSQL by replacing `backend/db.js`.

> The default database is SQLite for simplicity. Schema and indexes mirror the spec so you can migrate to Postgres without code changes elsewhere.

## Project Structure

```
bkkgo/
├─ backend/
│  ├─ middleware/auth.js
│  ├─ routes/{auth,links,analytics,admin}.js
│  ├─ db.js
│  └─ server.js
├─ frontend/
│  ├─ src/
│  │  ├─ components/Navbar.jsx
│  │  ├─ pages/{Home,Login,Register,Dashboard,LinkStats,Settings,Admin}.jsx
│  │  ├─ api.js, auth.jsx, App.jsx, main.jsx, index.css
│  ├─ tailwind.config.js, vite.config.js, index.html
└─ package.json
```

## Quick Start

```bash
# 1. Install dependencies
npm run install:all

# 2. Configure backend env (optional — defaults work)
cp backend/.env.example backend/.env

# 3. Run backend (port 4000) — seeds admins on first boot
npm run dev:backend

# 4. In another terminal, run frontend (port 5173, proxies /api → 4000)
npm run dev:frontend
```

Open http://localhost:5173

### Production single-process

```bash
npm run build:frontend   # builds frontend → frontend/dist
npm start                # backend serves API + redirects + static frontend
```

## Default Accounts (seeded on first start)

| Role        | Email                       | Password      |
| ----------- | --------------------------- | ------------- |
| Admin       | `bkkcemerlang@gmail.com`    | `#BKK_2026`   |
| Super Admin | `mpratamamail@gmail.com`    | `Anonymous263`|

> Change these via env (`ADMIN_EMAIL/PASSWORD`, `SUPERADMIN_EMAIL/PASSWORD`) before deployment.

## API

Authentication: `Authorization: Bearer <jwt>` or `X-API-Key: <key>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/forgot-password` | Stub |
| GET  | `/api/auth/me` | Current user |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/regenerate-api-key` | New API key |
| POST | `/api/links` | Create shortlink |
| POST | `/api/links/public` | Anonymous shorten (rate-limited) |
| GET  | `/api/links` | List my links |
| GET  | `/api/links/:id` | Get one |
| PUT  | `/api/links/:id` | Update |
| DELETE | `/api/links/:id` | Delete |
| GET  | `/api/links/:id/qrcode?format=png\|svg` | QR code |
| GET  | `/api/links/:id/stats` | Per-link analytics |
| GET  | `/api/links/:id/export.csv` | CSV export |
| GET  | `/api/users/:id/stats` | User totals |
| GET  | `/api/admin/stats` | Global stats (admin) |
| GET/PUT/DELETE | `/api/admin/users[/:id]` | Manage users |
| PUT/DELETE | `/api/admin/links/:id[/block]` | Manage links |
| POST | `/api/admin/impersonate/:id` | Get JWT for user (superadmin) |
| GET  | `/:shortcode` | Public redirect (logs click) |

## Performance & Optimization

- `better-sqlite3` synchronous driver — fastest for read-heavy redirect workloads.
- Indexes on `links.short_code`, `links.user_id`, `clicks.link_id`.
- WAL journaling enabled for concurrent reads.
- `nanoid` 7-char alphanumeric codes (`62^7 ≈ 3.5T` keyspace).
- Rate-limiting on `/api/auth` and public shorten endpoint.
- Frontend served as a static SPA build (CDN-friendly).

## Deployment Notes

- Set `JWT_SECRET`, `BASE_URL`, DB path/URL via env.
- Put behind Cloudflare/Caddy/Nginx for SSL.
- For Postgres: replace `backend/db.js` with `pg` and adjust SQL placeholders (`?` → `$1`).
- For high traffic, optionally add Redis for hot-path shortcode lookups.

## License

MIT