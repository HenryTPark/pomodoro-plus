"""Deterministic session analytics for AI insight prompts.

Pure ORM aggregation — no network calls. Day/hour bucketing uses the caller's
timezone so local patterns (e.g. evening abandonment) are accurate.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Avg, Count, F, FloatField, Q, Sum
from django.db.models.functions import (
    Cast,
    Coalesce,
    ExtractHour,
    ExtractIsoWeekDay,
    TruncDate,
)
from django.utils import timezone

from core.models import SessionEvent

# Rates and shares are rounded so identical inputs hash to the same stats_hash.
_RATE_DIGITS = 4


def build_stats(user, range_key: str, tz: str) -> dict:
    """Aggregate SessionEvent rows into a compact, JSON-serializable stats dict.

    Parameters
    ----------
    user:
        Auth user whose sessions to analyze.
    range_key:
        ``\"7d\"``, ``\"30d\"``, or ``\"all\"``.
    tz:
        IANA timezone name (e.g. ``\"America/Los_Angeles\"``). Used for hour,
        weekday, and streak day boundaries.
    """
    zone = ZoneInfo(tz)
    now = timezone.now()
    qs = SessionEvent.objects.filter(user=user)
    qs = _apply_range(qs, range_key, now)

    focus_qs = qs.filter(mode=SessionEvent.Mode.FOCUS)
    completed_q = Q(event_type=SessionEvent.EventType.COMPLETED)
    abandoned_q = Q(
        event_type__in=[
            SessionEvent.EventType.SKIPPED,
            SessionEvent.EventType.STOPPED,
        ]
    )

    total = qs.count()
    completed = qs.filter(completed_q).count()
    focus_total = focus_qs.count()
    focus_completed = focus_qs.filter(completed_q).count()

    return {
        "range_key": range_key,
        "timezone": tz,
        "session_counts": {
            "total": total,
            "completed": completed,
            "skipped": qs.filter(event_type=SessionEvent.EventType.SKIPPED).count(),
            "stopped": qs.filter(event_type=SessionEvent.EventType.STOPPED).count(),
            "focus_total": focus_total,
            "focus_completed": focus_completed,
        },
        "completion_rate": _rate(completed, total),
        "by_template": _group_completion(qs, "template_label"),
        "by_tag": _group_completion(qs, "tag", include_volume=True),
        "planned_vs_actual": _planned_vs_actual(focus_qs),
        "abandonment_by_hour": _abandonment_by_extract(
            focus_qs,
            ExtractHour("occurred_at", tzinfo=zone),
            "hour",
            abandoned_q,
        ),
        "abandonment_by_weekday": _abandonment_by_extract(
            focus_qs,
            ExtractIsoWeekDay("occurred_at", tzinfo=zone),
            "weekday",
            abandoned_q,
        ),
        "pause_behavior": _pause_behavior(focus_qs),
        "extension_behavior": _extension_behavior(focus_qs),
        # Streaks are an all-time concept (matches HistoryDashboard).
        "streaks": _streaks(user, zone, now),
    }


def _apply_range(qs, range_key: str, now: datetime):
    if range_key == "7d":
        return qs.filter(occurred_at__gte=now - timedelta(days=7))
    if range_key == "30d":
        return qs.filter(occurred_at__gte=now - timedelta(days=30))
    if range_key == "all":
        return qs
    raise ValueError(f"Unknown range_key: {range_key!r}")


def _rate(numerator: int | float, denominator: int | float) -> float | None:
    if denominator == 0:
        return None
    return round(float(numerator) / float(denominator), _RATE_DIGITS)


def _group_completion(qs, field: str, *, include_volume: bool = False) -> list[dict]:
    rows = (
        qs.values(field)
        .annotate(
            total=Count("id"),
            completed=Count("id", filter=Q(event_type=SessionEvent.EventType.COMPLETED)),
        )
        .order_by(field)
    )
    result = []
    for row in rows:
        key = row[field]
        entry = {
            field: key,
            "total": row["total"],
            "completed": row["completed"],
            "completion_rate": _rate(row["completed"], row["total"]),
        }
        if include_volume:
            entry["volume"] = row["total"]
        result.append(entry)
    return result


def _planned_vs_actual(focus_qs) -> dict:
    comparable = focus_qs.filter(
        duration_seconds__isnull=False,
        planned_seconds__isnull=False,
    )
    aggregates = comparable.aggregate(
        count=Count("id"),
        mean_planned=Avg("planned_seconds"),
        mean_actual=Avg("duration_seconds"),
        mean_drift=Avg(
            Cast(F("duration_seconds"), FloatField())
            - Cast(F("planned_seconds"), FloatField())
        ),
    )
    count = aggregates["count"] or 0
    if count == 0:
        return {
            "sessions_with_both": 0,
            "mean_planned_seconds": None,
            "mean_actual_seconds": None,
            "mean_drift_seconds": None,
        }
    return {
        "sessions_with_both": count,
        "mean_planned_seconds": round(aggregates["mean_planned"], _RATE_DIGITS),
        "mean_actual_seconds": round(aggregates["mean_actual"], _RATE_DIGITS),
        "mean_drift_seconds": round(aggregates["mean_drift"], _RATE_DIGITS),
    }


def _abandonment_by_extract(focus_qs, extract_expr, key_name: str, abandoned_q) -> list[dict]:
    rows = (
        focus_qs.annotate(_bucket=extract_expr)
        .values("_bucket")
        .annotate(
            total=Count("id"),
            abandoned=Count("id", filter=abandoned_q),
        )
        .order_by("_bucket")
    )
    result = []
    for row in rows:
        bucket = row["_bucket"]
        if bucket is None:
            continue
        total = row["total"]
        abandoned = row["abandoned"]
        result.append(
            {
                key_name: int(bucket),
                "total": total,
                "abandoned": abandoned,
                "abandonment_rate": _rate(abandoned, total),
            }
        )
    return result


def _pause_behavior(focus_qs) -> dict:
    aggregates = focus_qs.aggregate(
        count=Count("id"),
        mean_pause_count=Avg("pause_count"),
        total_paused=Coalesce(Sum("paused_seconds"), 0),
        total_duration=Coalesce(Sum("duration_seconds"), 0),
    )
    count = aggregates["count"] or 0
    if count == 0:
        return {
            "mean_pause_count": None,
            "paused_seconds_share": None,
        }
    total_duration = aggregates["total_duration"] or 0
    return {
        "mean_pause_count": round(float(aggregates["mean_pause_count"] or 0), _RATE_DIGITS),
        "paused_seconds_share": _rate(aggregates["total_paused"], total_duration)
        if total_duration
        else None,
    }


def _extension_behavior(focus_qs) -> dict:
    aggregates = focus_qs.aggregate(
        count=Count("id"),
        extended_count=Count("id", filter=Q(extension_count__gt=0)),
        mean_minutes_extended=Avg("minutes_extended"),
    )
    count = aggregates["count"] or 0
    if count == 0:
        return {
            "share_extended": None,
            "mean_minutes_extended": None,
        }
    return {
        "share_extended": _rate(aggregates["extended_count"], count),
        "mean_minutes_extended": round(
            float(aggregates["mean_minutes_extended"] or 0), _RATE_DIGITS
        ),
    }


def _streaks(user, zone: ZoneInfo, now: datetime) -> dict[str, int]:
    """Current and longest consecutive days with a completed focus session.

    Day boundaries use ``tz``. Current streak allows "today or yesterday" as
    the starting cursor (same rule as HistoryDashboard).
    """
    day_rows = (
        SessionEvent.objects.filter(
            user=user,
            mode=SessionEvent.Mode.FOCUS,
            event_type=SessionEvent.EventType.COMPLETED,
        )
        .annotate(local_day=TruncDate("occurred_at", tzinfo=zone))
        .values_list("local_day", flat=True)
        .distinct()
    )
    days = sorted({d for d in day_rows if d is not None})
    if not days:
        return {"current": 0, "longest": 0}

    day_set = set(days)
    longest = _longest_streak(days)
    current = _current_streak(day_set, now.astimezone(zone).date())
    return {"current": current, "longest": longest}


def _longest_streak(sorted_days: list[date]) -> int:
    longest = 1
    run = 1
    for prev, curr in zip(sorted_days, sorted_days[1:]):
        if curr - prev == timedelta(days=1):
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    return longest


def _current_streak(day_set: set[date], today: date) -> int:
    cursor = today
    if cursor not in day_set:
        cursor = today - timedelta(days=1)
        if cursor not in day_set:
            return 0

    count = 0
    while cursor in day_set:
        count += 1
        cursor -= timedelta(days=1)
    return count
