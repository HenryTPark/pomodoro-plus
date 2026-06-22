# Pomodoro Plus — Backend

Django + Django REST Framework API backing the Pomodoro Plus app. Provides
Google OAuth authentication (via `django-allauth` + `dj-rest-auth`) and
local-first sync for templates, settings/preferences, and session history.

## Stack

- Django 5 / Django REST Framework
- PostgreSQL (via `docker-compose.yml`)
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

# 3. Start Postgres
docker compose up -d db

# 4. Migrate and run
python manage.py migrate
python manage.py runserver
```

The API is then available at `http://localhost:8000/`. A health check lives at
`GET /api/health/`.

## Configuration

All configuration is environment-driven; see `.env.example` for the supported
variables. In development a `backend/.env` file is loaded automatically.
