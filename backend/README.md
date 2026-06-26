# Pomodoro Plus — Backend

Django + Django REST Framework API backing the Pomodoro Plus app. Provides
Google OAuth authentication (via `django-allauth` + `dj-rest-auth`) and
local-first sync for templates, settings/preferences, and session history.

## Stack

- Django 5 / Django REST Framework
- PostgreSQL (via `docker-compose.yml` for local development)
- Cookie-based session auth; CORS allowlist for the Next.js frontend

## Local setup

```bash
cd backend

# 1. Python environment
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Environment variables
cp .env.example .env   # then edit as needed

# 3. Start Postgres (local container uses trust auth — no password)
docker compose up -d db

# 4. Migrate and run
python manage.py migrate
python manage.py runserver
```

The API is then available at `http://localhost:8000/`. A health check lives at
`GET /api/health/`.

## Configuration

All configuration is environment-driven. Copy `.env.example` to `.env` and fill
in the values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DJANGO_SECRET_KEY` | prod | Django secret key |
| `DJANGO_DEBUG` | no | `true` in development |
| `DATABASE_URL` | no | Postgres URL (defaults match `docker-compose.yml`) |
| `CORS_ALLOWED_ORIGINS` | no | Frontend origin(s), comma-separated |
| `CSRF_TRUSTED_ORIGINS` | no | Same as CORS origins for cookie auth |
| `GOOGLE_OAUTH_CLIENT_ID` | yes | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | yes | Google OAuth client secret |
| `GOOGLE_OAUTH_CALLBACK_URL` | no | Frontend callback (default `http://localhost:3000/auth/callback/google`) |

In development a `backend/.env` file is loaded automatically by `config/settings.py`.

## API surface

All routes are under `/api/`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health/` | no | Health check (sets CSRF cookie) |
| `POST` | `/api/auth/google/` | no | Exchange Google auth code for session |
| `POST` | `/api/auth/logout/` | yes | End session |
| `GET` | `/api/auth/user/` | yes | Current user |
| `GET/PUT` | `/api/profile/` | yes | Timer settings + preferences |
| `GET/POST/PUT/PATCH/DELETE` | `/api/templates/` | yes | Template CRUD |
| `GET/POST` | `/api/sessions/` | yes | Session history |
| `POST` | `/api/sync/` | yes | Bulk merge local snapshot |

## Tests

```bash
source .venv/bin/activate
python manage.py test
```

The test runner uses an in-memory SQLite database, so Postgres does not need to
be running for tests.

Test modules:

- `core.tests.test_models` — model defaults and uniqueness constraints
- `core.tests.test_auth` — sign-up seeding and auth endpoints
- `core.tests.test_api` — profile/templates/sessions/sync API and permissions
- `core.tests.test_smoke` — Google login (mocked) → sync → read-back flow

## Production deployment (Render + Neon)

Recommended stack for a live demo (~**$7/month** total):

| Service | Plan | Cost | Notes |
|---------|------|------|-------|
| [Render](https://render.com) web service | **Starter** | ~$7/mo | Always on — no cold starts |
| [Neon](https://neon.tech) Postgres | Free | $0 | 0.5 GB storage; DB may scale to zero after idle |

**Alternative:** Render **Free** ($0) works for hobby use but spins down after ~15 min idle; the first request after sleep can take 30–60s. The blueprint defaults to Starter; change `plan: starter` → `plan: free` in `render.yaml` if you prefer.

### 1. Neon — Postgres

1. Sign up at [neon.tech](https://neon.tech) and create a project.
2. Copy the **pooled** connection string (`DATABASE_URL`, includes `?sslmode=require`).

### 2. Render — Django API

1. Push this repo to GitHub (Render deploys from git).
2. In [Render](https://dashboard.render.com) → **New** → **Blueprint** and point at the repo (uses `render.yaml`),  
   **or** **New** → **Web Service** with:
   - **Root directory:** `backend`
   - **Build command:** `./build.sh`
   - **Start command:** `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
   - **Health check path:** `/api/health/`
3. Set environment variables (replace placeholders):

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Neon pooled connection string |
| `DJANGO_SECRET_KEY` | Long random string (Render can auto-generate) |
| `DJANGO_DEBUG` | `false` |
| `DJANGO_ALLOWED_HOSTS` | `pomodoro-plus-api.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | `https://your-app.vercel.app` |
| `GOOGLE_OAUTH_CLIENT_ID` | Same as Vercel |
| `GOOGLE_OAUTH_CLIENT_SECRET` | From Google Cloud |
| `GOOGLE_OAUTH_CALLBACK_URL` | `https://your-app.vercel.app/auth/callback/google` |

4. After deploy, verify `GET https://<your-service>.onrender.com/api/health/` returns `{"status":"ok"}`.

### 3. Vercel — point frontend at the API

Add or update in Vercel → **Settings** → **Environment Variables**:

```
NEXT_PUBLIC_API_URL=https://<your-service>.onrender.com
```

Redeploy the frontend so the new value is baked into the build.
