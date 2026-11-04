# Git workflow (always)

For EVERY change, regardless of size, follow this workflow:

> Do NOT trust the session's `Is directory a git repo` environment metadata — it is a point-in-time snapshot and is sometimes wrong or stale. Always confirm git state yourself before deciding whether this workflow applies, e.g. `git rev-parse --is-inside-work-tree`. If that prints `true`, this workflow is mandatory regardless of what the metadata said.

1. Decide new work vs. revision:
   - New work (on `master`, or a fresh feature/fix request): create a new branch.
   - Revision (already on a feature branch whose PR is being iterated on): stay on that branch.
2. New branch: first sync and prune, then cut from the latest `master`:
   ```bash
   git checkout master
   git fetch --prune origin
   git pull --ff-only origin master
   git branch -vv | awk '/: gone]/{print $1}' | xargs -r git branch -d
   git checkout -b <type>/<short-kebab-desc>
   ```
   (The remote has `delete_branch_on_merge` enabled, so merged branches show as `gone` after fetch and are pruned locally here.)

## Cloud Agent environment

These VMs do not run systemd. The environment start script launches Docker, then Postgres and Redis with `docker compose` from `backend/`, the Django API on port 8000, this Next.js app on port 3000, a Celery worker, and the portfolio app (sibling repo) on port 3001.

Use `backend/.venv` (`backend/.venv/bin/python manage.py test`). The timer, `GET /api/health/`, and the test suite do not need Google OAuth or `OPENAI_API_KEY`. Put those in `backend/.env` and `.env.local` when you need sign-in or AI Insights.
