# Pomodoro Plus

A local-first Pomodoro timer with Google sign-in and cloud sync. The monorepo
contains a **Next.js** frontend at the repo root and a **Django** API in
`backend/`.

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (for local PostgreSQL)
- A [Google OAuth client](https://console.cloud.google.com/) with redirect URI
  `http://localhost:3000/auth/callback/google`

## Quick start

### 1. Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit backend/.env — set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET

docker compose up -d db
python manage.py migrate
python manage.py runserver
```

API: `http://localhost:8000/` — health check at `GET /api/health/`.

See [backend/README.md](backend/README.md) for API details and testing.

### 2. Frontend

From the repo root:

```bash
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_GOOGLE_CLIENT_ID (same value as backend client id)

npm install
npm run dev
```

App: `http://localhost:3000/`

### 3. Google OAuth

Use the **same** OAuth client for both apps:

| Variable | File | Purpose |
|----------|------|---------|
| `GOOGLE_OAUTH_CLIENT_ID` | `backend/.env` | Django allauth provider |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `backend/.env` | Token exchange |
| `GOOGLE_OAUTH_CALLBACK_URL` | `backend/.env` | Must match Google Cloud redirect URI |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `.env.local` | Frontend sign-in button |
| `NEXT_PUBLIC_API_URL` | `.env.local` | Django API base URL (default `http://localhost:8000`) |

## How sync works

The app works offline via `localStorage`. When you sign in with Google:

1. Local templates, settings, preferences, and session history are pushed to
   `POST /api/sync/` (idempotent on `client_id` for sessions).
2. The backend becomes the source of truth while still mirroring to
   `localStorage`.
3. Further changes write through to the API while authenticated.

The active timer state stays client-only and is not synced.

## Development commands

| Command | Where | Description |
|---------|-------|-------------|
| `npm run dev` | repo root | Start Next.js dev server |
| `python manage.py runserver` | `backend/` | Start Django API |
| `python manage.py test` | `backend/` | Run backend test suite |
| `docker compose up -d db` | `backend/` | Start PostgreSQL |

## Project layout

```
pomodoro-plus/
├── src/                 # Next.js app (pages, components, stores, sync)
├── backend/             # Django API (models, auth, REST endpoints)
├── .env.example         # Frontend env template → copy to .env.local
└── backend/.env.example # Backend env template → copy to .env
```
