# Pomodoro Plus

A local-first Pomodoro timer with Google sign-in and cloud sync. The monorepo
contains a **Next.js** frontend at the repo root and a **Django** API in
`backend/`.

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (for local PostgreSQL and Redis)
- A [Google OAuth client](https://console.cloud.google.com/) with redirect URI
  `http://localhost:3000/auth/callback/google`
- An [OpenAI API key](https://platform.openai.com/api-keys) if you want AI Insights
  (optional for timer + sync only)

## Quick start

### 1. Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Edit backend/.env — set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET
# For AI Insights, also set OPENAI_API_KEY (see below)

docker compose up -d db redis
python manage.py migrate
python manage.py runserver
```

API: `http://localhost:8000/` — health check at `GET /api/health/`.

In a **second** terminal (same venv, `backend/`), start the Celery worker for
AI Insights:

```bash
cd backend
source .venv/bin/activate
celery -A config worker --loglevel=info --concurrency=2
```

See [backend/README.md](backend/README.md) for API details, AI Insights operator
setup (OpenAI billing, Render Redis + worker), and testing.

### 2. Frontend

From the repo root:

```bash
cp .env.example .env.local
# Edit .env.local — set NEXT_PUBLIC_GOOGLE_CLIENT_ID (same value as backend client id)
# AI Insights env vars (OPENAI_*, REDIS_URL, …) belong in backend/.env only

npm install
npm run dev
```

App: `http://localhost:3000/` — open **Insights** in the nav after signing in
(needs enough completed focus sessions; see backend docs).

### 3. Google OAuth

Use the **same** OAuth client for both apps:

| Variable | File | Purpose |
|----------|------|---------|
| `GOOGLE_OAUTH_CLIENT_ID` | `backend/.env` | Django allauth provider |
| `GOOGLE_OAUTH_CLIENT_SECRET` | `backend/.env` | Token exchange |
| `GOOGLE_OAUTH_CALLBACK_URL` | `backend/.env` | Must match Google Cloud redirect URI |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `.env.local` | Frontend sign-in button |
| `NEXT_PUBLIC_API_URL` | `.env.local` | Django API base URL (default `http://localhost:8000`) |

### 4. AI Insights (optional)

Insights run asynchronously: Django enqueues a Celery task; the worker calls
OpenAI and writes the result to Postgres. You need Redis, a worker process, and
an OpenAI key.

| Variable | File | Purpose |
|----------|------|---------|
| `OPENAI_API_KEY` | `backend/.env` | OpenAI secret key (never put this on Vercel) |
| `OPENAI_MODEL` | `backend/.env` | Default `gpt-4o-mini` |
| `REDIS_URL` | `backend/.env` | Celery broker (default matches local Redis) |
| `AI_INSIGHTS_DAILY_LIMIT` | `backend/.env` | Per-user daily cap (default `5`) |

Full step-by-step (OpenAI billing, local Redis/Celery, Render Key Value + worker,
verification): **[AI Insights operator setup](backend/README.md#ai-insights-operator-setup)**.

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
| `celery -A config worker --loglevel=info --concurrency=2` | `backend/` | Celery worker (AI Insights) |
| `python manage.py test` | `backend/` | Run backend test suite |
| `docker compose up -d db redis` | `backend/` | Start PostgreSQL + Redis |

## Project layout

```
pomodoro-plus/
├── src/                 # Next.js app (pages, components, stores, sync)
├── backend/             # Django API + insights app + Celery
├── render.yaml          # Render web API, Celery worker, Redis Key Value
├── .env.example         # Frontend env template → copy to .env.local
└── backend/.env.example # Backend env template → copy to .env
```
