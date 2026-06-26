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

## Production deployment

The API runs on [Render](https://render.com); Postgres is on [Neon](https://neon.tech). Service definition: `render.yaml` at the repo root.

**Render** deploys on git push to the connected branch. `backend/build.sh` installs dependencies and runs migrations; Gunicorn serves `config.wsgi:application` (see `render.yaml` for commands and health check path).

**Neon** — `DATABASE_URL` is the pooled connection string from the Neon dashboard (`?sslmode=require`).

Required environment variables on Render:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon pooled connection string |
| `DJANGO_SECRET_KEY` | Django secret key |
| `DJANGO_DEBUG` | `false` in production |
| `DJANGO_ALLOWED_HOSTS` | Render hostname (e.g. `pomodoro-plus-api.onrender.com`) |
| `CORS_ALLOWED_ORIGINS` | Vercel frontend origin |
| `CSRF_TRUSTED_ORIGINS` | Same as CORS origins |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_OAUTH_CALLBACK_URL` | Frontend callback URL |

After deploy, confirm `GET /api/health/` returns `{"status":"ok"}`.

**Vercel** — `NEXT_PUBLIC_API_URL` must match the Render service URL. Redeploy the frontend after changing it (build-time variable).
