# Pomodoro Plus — Backend

Django + Django REST Framework API backing the Pomodoro Plus app. Provides
Google OAuth authentication (via `django-allauth` + `dj-rest-auth`),
local-first sync for templates, settings/preferences, and session history, and
async AI productivity insights (Celery + OpenAI).

## Stack

- Django 5 / Django REST Framework
- PostgreSQL (via `docker-compose.yml` for local development)
- Redis + Celery (AI Insights queue; Redis via `docker-compose.yml`)
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

# 3. Start Postgres + Redis (local Postgres uses trust auth — no password)
docker compose up -d db redis

# 4. Migrate and run the API
python manage.py migrate
python manage.py runserver
```

The API is then available at `http://localhost:8000/`. A health check lives at
`GET /api/health/`.

For AI Insights, also start a Celery worker (second terminal, same venv):

```bash
cd backend
source .venv/bin/activate
celery -A config worker --loglevel=info --concurrency=2
```

Full OpenAI / Redis / Render steps: [AI Insights operator setup](#ai-insights-operator-setup).

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
| `REDIS_URL` | for Insights | Celery broker + Django cache (default `redis://127.0.0.1:6379/0`) |
| `OPENAI_API_KEY` | for Insights | OpenAI secret key |
| `OPENAI_MODEL` | no | Model id (default `gpt-4o-mini`) |
| `AI_INSIGHTS_DAILY_LIMIT` | no | Per-user generations per calendar day (default `5`) |

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
| `POST` | `/api/insights/` | yes | Enqueue insight (`202`; body `{ "range": "7d"\|"30d"\|"all" }`) |
| `GET` | `/api/insights/{id}/` | yes | Poll insight status / result (also reaps stale jobs) |
| `GET` | `/api/insights/latest/?range=` | yes | Most recent completed insight for a range |

## Tests

```bash
source .venv/bin/activate
python manage.py test
```

The test runner uses an in-memory SQLite database, so Postgres does not need to
be running for tests. OpenAI and Celery are mocked; no test makes a network call.

Test modules:

- `core.tests.test_models` — model defaults and uniqueness constraints
- `core.tests.test_auth` — sign-up seeding and auth endpoints
- `core.tests.test_api` — profile/templates/sessions/sync API and permissions
- `core.tests.test_smoke` — Google login (mocked) → sync → read-back flow
- `insights.tests.*` — analytics, OpenAI client, Celery task, API views

## AI Insights operator setup

Insights need three pieces beyond the normal API: an **OpenAI key**, a **Redis
broker**, and a **Celery worker**. Postgres remains the source of truth for
request rows; Redis only holds the queue.

### 1. OpenAI API key and billing

1. Sign in at [platform.openai.com](https://platform.openai.com/).
2. Open **Settings → Billing** (or **Billing** in the left nav) and add a payment
   method / prepaid credits. There is no permanent free tier that covers a useful
   insight model; a small prepaid balance (often about $5 minimum) is enough for
   solo/demo usage with the daily quota and stats-hash dedupe.
3. Open **API keys** → **Create new secret key**. Copy the key once (it starts
   with `sk-`).
4. Locally, put it in `backend/.env`:

   ```bash
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   AI_INSIGHTS_DAILY_LIMIT=5
   ```

5. On Render, set the same vars on **both** `pomodoro-plus-api` (web) and
   `pomodoro-plus-worker` (see [§5](#5-render-celery-worker) and
   [env tables](#environment-variables-on-render--vercel)). Never put
   `OPENAI_API_KEY` in Vercel or any `NEXT_PUBLIC_*` variable — the browser never
   calls OpenAI.

### 2. Local Redis

From `backend/`:

```bash
docker compose up -d redis
# or with Postgres: docker compose up -d db redis
docker compose ps   # redis should be healthy
```

Confirm connectivity (optional):

```bash
docker compose exec redis redis-cli ping   # → PONG
```

`REDIS_URL` in `.env.example` already matches the compose service:

```bash
REDIS_URL=redis://127.0.0.1:6379/0
```

Free-tier Redis on Render is in-memory only and can lose queue state on restart;
locally the same idea applies if you wipe the container. Durable state lives in
Postgres (`InsightRequest` rows). Stale `queued`/`processing` rows older than
five minutes are marked `failed` when polled.

### 3. Local Celery worker

With Redis running and `OPENAI_API_KEY` set, start the worker alongside Django
and Next.js:

```bash
cd backend
source .venv/bin/activate
celery -A config worker --loglevel=info --concurrency=2
```

You should see the worker boot and register `insights.tasks.generate_insight`.
Leave this terminal open while generating insights.

Typical local process set:

| Process | Command | Where |
|---------|---------|-------|
| Postgres + Redis | `docker compose up -d db redis` | `backend/` |
| Django | `python manage.py runserver` | `backend/` |
| Celery | `celery -A config worker --loglevel=info --concurrency=2` | `backend/` |
| Next.js | `npm run dev` | repo root |

### 4. Render Key Value (Redis broker)

Blueprint: `render.yaml` at the repo root defines `pomodoro-plus-redis`
(`type: keyvalue`, free plan) and wires `REDIS_URL` into the web and worker
services via `fromService`.

**If you use Blueprint / Infrastructure-as-code**

1. In the [Render Dashboard](https://dashboard.render.com/), open your workspace.
2. **New → Blueprint** (or open the existing Blueprint linked to this repo).
3. Connect the GitHub repo if needed, select the branch that contains the updated
   `render.yaml`, and **Apply**.
4. Confirm a Key Value instance named `pomodoro-plus-redis` appears (free plan is
   fine for v1).
5. Open **pomodoro-plus-api** → **Environment** and confirm `REDIS_URL` is
   present and sourced from the Key Value connection string (not hand-typed).
6. Open **pomodoro-plus-worker** → **Environment** and confirm the same
   `REDIS_URL` wiring.

**If you create services manually**

1. **New → Key Value** → name `pomodoro-plus-redis` → Free plan → create.
   Prefer **no eviction** / policy suitable for a broker if the UI offers it
   (`maxmemoryPolicy: noeviction` in the blueprint).
2. Copy the **Internal Redis URL** / connection string from the Key Value
   dashboard.
3. On **pomodoro-plus-api** and **pomodoro-plus-worker**, add env var
   `REDIS_URL` = that connection string (or link the Key Value as a service
   dependency so Render injects it).

Upgrade Key Value off free only if lost queues become a real operational pain;
Postgres + the poll reaper already protect against orphaned UI requests.

### 5. Render Celery worker

The blueprint defines worker `pomodoro-plus-worker`:

- **Root directory:** `backend`
- **Build:** `./build.sh` (same as the API)
- **Start:** `celery -A config worker --loglevel=info --concurrency=2`
- **Plan:** Starter (always-on; required for a real queue consumer)

**Apply / start**

1. After Blueprint apply (or create a **Background Worker** manually with the
   commands above), open **pomodoro-plus-worker** in the dashboard.
2. Set secrets that Blueprint marks `sync: false` (same values as the API where
   applicable):

   | Variable | Notes |
   |----------|--------|
   | `DATABASE_URL` | Same Neon pooled URL as the web service |
   | `OPENAI_API_KEY` | Same key as the web service |
   | `REDIS_URL` | From Key Value (auto if Blueprint `fromService`) |
   | `OPENAI_MODEL` | Optional; blueprint default `gpt-4o-mini` |
   | `AI_INSIGHTS_DAILY_LIMIT` | Optional; blueprint default `5` |

   `DJANGO_SECRET_KEY` is copied from the web service in the blueprint. The
   worker needs DB + Redis + OpenAI; it does **not** need Google OAuth or CORS
   vars.
3. Deploy / restart the worker. In **Logs**, confirm Celery starts without broker
   connection errors and is ready for tasks.
4. Ensure **pomodoro-plus-api** also has `REDIS_URL`, `OPENAI_API_KEY`,
   `OPENAI_MODEL`, and `AI_INSIGHTS_DAILY_LIMIT` so enqueue + quota checks work
   on the web tier.

### Environment variables on Render + Vercel

**Render — `pomodoro-plus-api` (web)**

| Variable | How it is set | Purpose |
|----------|---------------|---------|
| `DATABASE_URL` | Manual (`sync: false`) | Neon Postgres |
| `DJANGO_SECRET_KEY` | Generated / secret | Django signing |
| `DJANGO_DEBUG` | `"false"` | Production |
| `DJANGO_ALLOWED_HOSTS` | Manual | API hostname |
| `CORS_ALLOWED_ORIGINS` | Manual | Vercel origin |
| `CSRF_TRUSTED_ORIGINS` | Manual | Same as CORS |
| `GOOGLE_OAUTH_*` | Manual | Auth |
| `REDIS_URL` | From `pomodoro-plus-redis` | Celery broker |
| `OPENAI_API_KEY` | Manual secret | Used if web ever touches client; keep in sync |
| `OPENAI_MODEL` | Default `gpt-4o-mini` | Model id |
| `AI_INSIGHTS_DAILY_LIMIT` | Default `5` | Bill-protecting quota |

**Render — `pomodoro-plus-worker`**

| Variable | How it is set | Purpose |
|----------|---------------|---------|
| `DATABASE_URL` | Manual | Same Neon DB as API |
| `DJANGO_SECRET_KEY` | From web service | Shared signing |
| `REDIS_URL` | From Key Value | Broker |
| `OPENAI_API_KEY` | Manual secret | Worker calls OpenAI |
| `OPENAI_MODEL` | Default `gpt-4o-mini` | Model id |
| `AI_INSIGHTS_DAILY_LIMIT` | Default `5` | Must match web for consistency |

**Vercel (Next.js frontend)**

Only public frontend vars. Do **not** add OpenAI or Redis here.

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | Render API origin (e.g. `https://pomodoro-plus-api.onrender.com`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Same Google client id as the API |
| `NEXT_PUBLIC_GOOGLE_OAUTH_CALLBACK_URL` | Production callback URL (must match Google Cloud + backend) |

After changing `NEXT_PUBLIC_*` values, **redeploy** the Vercel project (they are
build-time).

### 6. Verify end-to-end

**Local**

1. `curl -s http://localhost:8000/api/health/` → `{"status":"ok"}` (or similar).
2. Confirm Redis and Celery are running (worker logs idle / ready).
3. Sign in on `http://localhost:3000`, complete at least **10 focus sessions**
   (completed focus events) so the min-data floor is met, then open **Insights**.
4. Choose a range and click **Generate**. The UI should poll until status is
   `completed` (or `failed` with a mapped error).
5. Or with a session cookie / CSRF from the browser:

   ```bash
   # After auth in the browser, from DevTools → Network you can replay:
   # POST /api/insights/  body: {"range":"30d"}  → 202 with id + status queued|processing|completed
   # GET  /api/insights/<id>/  until status is completed or failed
   ```

6. Worker logs should show the task start and finish; the row’s `result` JSON
   should appear in the Insights UI.

**Production (Render)**

1. `GET https://<your-api-host>/api/health/` → ok.
2. Render → **pomodoro-plus-worker** → Logs: Celery connected to Redis.
3. Render → **pomodoro-plus-redis**: instance exists; web + worker both show
   `REDIS_URL`.
4. Signed-in production app → Insights → Generate; confirm transition to
   `completed` within a minute or two (OpenAI latency + worker).
5. If a job stays `queued` forever, the worker is down or `REDIS_URL` differs
   between web and worker. If it flips to `failed` after ~5 minutes on poll, the
   reaper fired (broker message likely lost) — fix Redis/worker and generate
   again.

## Production deployment

The API runs on [Render](https://render.com); Postgres is on [Neon](https://neon.tech).
Service definition: `render.yaml` at the repo root (web API, Celery worker, Key
Value Redis).

**Render** deploys on git push to the connected branch. `backend/build.sh`
installs dependencies and runs migrations; Gunicorn serves
`config.wsgi:application` (see `render.yaml` for commands and health check path).
The worker uses the same build and runs Celery as above.

**Neon** — `DATABASE_URL` is the pooled connection string from the Neon dashboard
(`?sslmode=require`). Set it on **both** the web and worker services.

After deploy, confirm `GET /api/health/` returns `{"status":"ok"}`, then follow
[§6 Verify](#6-verify-end-to-end).

**Vercel** — `NEXT_PUBLIC_API_URL` must match the Render service URL. Redeploy the
frontend after changing it (build-time variable). AI secrets stay on Render only.
