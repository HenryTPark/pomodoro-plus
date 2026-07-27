"""Celery application for async work (AI insights, etc.).

Imported from ``config.__init__`` so Django and ``celery -A config`` share the
same app instance. Broker / result backend come from ``CELERY_*`` settings,
which read ``REDIS_URL``.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
