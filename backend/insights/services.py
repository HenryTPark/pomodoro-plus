"""Business logic for insight request API endpoints."""

from __future__ import annotations

import hashlib
import json
from datetime import timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.models import SessionEvent, UserProfile
from insights.analytics import _apply_range, build_stats
from insights.models import InsightRequest
from insights.tasks import generate_insight

MIN_COMPLETED_FOCUS_SESSIONS = 10
STALE_REQUEST_AFTER = timedelta(minutes=5)
STALE_ERROR_CODE = "request_timeout"
IN_FLIGHT_STATUSES = (
    InsightRequest.Status.QUEUED,
    InsightRequest.Status.PROCESSING,
)


def get_user_timezone(user) -> str:
    profile = UserProfile.objects.filter(user=user).first()
    if profile is None:
        return "UTC"
    return profile.timezone


def compute_stats_hash(stats: dict) -> str:
    canonical = json.dumps(stats, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def count_completed_focus_sessions(user, range_key: str) -> int:
    qs = SessionEvent.objects.filter(
        user=user,
        mode=SessionEvent.Mode.FOCUS,
        event_type=SessionEvent.EventType.COMPLETED,
    )
    qs = _apply_range(qs, range_key, timezone.now())
    return qs.count()


def count_daily_requests(user, tz: str) -> int:
    zone = ZoneInfo(tz)
    local_now = timezone.now().astimezone(zone)
    local_midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = local_midnight.astimezone(dt_timezone.utc)
    return InsightRequest.objects.filter(user=user, created_at__gte=start_utc).count()


def find_in_flight_request(user) -> InsightRequest | None:
    return (
        InsightRequest.objects.filter(user=user, status__in=IN_FLIGHT_STATUSES)
        .order_by("-created_at")
        .first()
    )


def find_completed_by_stats_hash(user, stats_hash: str) -> InsightRequest | None:
    return InsightRequest.objects.filter(
        user=user,
        status=InsightRequest.Status.COMPLETED,
        stats_hash=stats_hash,
    ).first()


def reap_stale_request(row: InsightRequest) -> InsightRequest:
    if row.status not in IN_FLIGHT_STATUSES:
        return row
    if timezone.now() - row.created_at < STALE_REQUEST_AFTER:
        return row

    row.status = InsightRequest.Status.FAILED
    row.error_code = STALE_ERROR_CODE
    row.error_detail = "Request timed out waiting for worker."
    row.completed_at = timezone.now()
    row.save(
        update_fields=[
            "status",
            "error_code",
            "error_detail",
            "completed_at",
        ]
    )
    return row


@transaction.atomic
def create_insight_request(user, range_key: str, tz: str) -> InsightRequest:
    stats = build_stats(user, range_key, tz)
    stats_hash = compute_stats_hash(stats)
    row = InsightRequest.objects.create(
        user=user,
        range_key=range_key,
        timezone=tz,
        stats_hash=stats_hash,
        stats_payload=stats,
    )
    task = generate_insight.delay(row.pk)
    row.celery_task_id = task.id
    row.save(update_fields=["celery_task_id"])
    return row


def daily_quota_limit() -> int:
    return settings.AI_INSIGHTS_DAILY_LIMIT
