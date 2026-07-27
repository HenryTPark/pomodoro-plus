from datetime import datetime, timedelta, timezone as dt_timezone
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import SessionEvent
from insights.analytics import build_stats

User = get_user_model()

UTC = dt_timezone.utc


class BuildStatsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice@example.com",
            email="alice@example.com",
        )
        self.other = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
        )
        self._client_seq = 0

    def _cid(self) -> str:
        self._client_seq += 1
        return f"c-{self._client_seq}"

    def _event(self, user=None, **kwargs) -> SessionEvent:
        defaults = {
            "user": user or self.user,
            "event_type": SessionEvent.EventType.COMPLETED,
            "mode": SessionEvent.Mode.FOCUS,
            "template_label": "Classic",
            "session_count": 1,
            "duration_seconds": 1500,
            "planned_seconds": 1500,
            "client_id": self._cid(),
            "occurred_at": datetime(2026, 6, 22, 17, 0, tzinfo=UTC),
        }
        defaults.update(kwargs)
        return SessionEvent.objects.create(**defaults)

    def test_empty_stats(self):
        stats = build_stats(self.user, "all", "UTC")

        self.assertEqual(stats["completion_rate"], None)
        self.assertEqual(stats["session_counts"]["total"], 0)
        self.assertEqual(stats["by_template"], [])
        self.assertEqual(stats["by_tag"], [])
        self.assertEqual(stats["streaks"], {"current": 0, "longest": 0})
        self.assertEqual(stats["planned_vs_actual"]["sessions_with_both"], 0)
        self.assertIsNone(stats["pause_behavior"]["mean_pause_count"])
        self.assertIsNone(stats["extension_behavior"]["share_extended"])

    def test_completion_rate_overall(self):
        self._event(event_type=SessionEvent.EventType.COMPLETED)
        self._event(event_type=SessionEvent.EventType.COMPLETED)
        self._event(event_type=SessionEvent.EventType.SKIPPED, duration_seconds=300)
        self._event(event_type=SessionEvent.EventType.STOPPED, duration_seconds=100)

        stats = build_stats(self.user, "all", "UTC")

        self.assertEqual(stats["session_counts"]["total"], 4)
        self.assertEqual(stats["session_counts"]["completed"], 2)
        self.assertEqual(stats["session_counts"]["skipped"], 1)
        self.assertEqual(stats["session_counts"]["stopped"], 1)
        self.assertEqual(stats["completion_rate"], 0.5)

    def test_completion_rate_by_template(self):
        self._event(template_label="Classic", event_type=SessionEvent.EventType.COMPLETED)
        self._event(template_label="Classic", event_type=SessionEvent.EventType.SKIPPED)
        self._event(template_label="Deep Work", event_type=SessionEvent.EventType.COMPLETED)
        self._event(template_label="Deep Work", event_type=SessionEvent.EventType.COMPLETED)
        self._event(template_label="Deep Work", event_type=SessionEvent.EventType.STOPPED)

        by_template = {
            row["template_label"]: row
            for row in build_stats(self.user, "all", "UTC")["by_template"]
        }

        self.assertEqual(by_template["Classic"]["total"], 2)
        self.assertEqual(by_template["Classic"]["completed"], 1)
        self.assertEqual(by_template["Classic"]["completion_rate"], 0.5)
        self.assertEqual(by_template["Deep Work"]["total"], 3)
        self.assertEqual(by_template["Deep Work"]["completed"], 2)
        self.assertAlmostEqual(by_template["Deep Work"]["completion_rate"], 2 / 3, places=4)

    def test_completion_rate_and_volume_by_tag(self):
        self._event(tag="writing", event_type=SessionEvent.EventType.COMPLETED)
        self._event(tag="writing", event_type=SessionEvent.EventType.SKIPPED)
        self._event(tag="writing", event_type=SessionEvent.EventType.COMPLETED)
        self._event(tag="coding", event_type=SessionEvent.EventType.COMPLETED)
        self._event(tag=None, event_type=SessionEvent.EventType.STOPPED)

        by_tag = {row["tag"]: row for row in build_stats(self.user, "all", "UTC")["by_tag"]}

        self.assertEqual(by_tag["writing"]["volume"], 3)
        self.assertEqual(by_tag["writing"]["completed"], 2)
        self.assertAlmostEqual(by_tag["writing"]["completion_rate"], 2 / 3, places=4)
        self.assertEqual(by_tag["coding"]["volume"], 1)
        self.assertEqual(by_tag["coding"]["completion_rate"], 1.0)
        self.assertEqual(by_tag[None]["volume"], 1)
        self.assertEqual(by_tag[None]["completion_rate"], 0.0)

    def test_planned_vs_actual_drift(self):
        self._event(duration_seconds=1800, planned_seconds=1500)
        self._event(duration_seconds=1200, planned_seconds=1500)
        # Missing planned — excluded from drift average.
        self._event(duration_seconds=900, planned_seconds=None)

        drift = build_stats(self.user, "all", "UTC")["planned_vs_actual"]

        self.assertEqual(drift["sessions_with_both"], 2)
        self.assertEqual(drift["mean_planned_seconds"], 1500.0)
        self.assertEqual(drift["mean_actual_seconds"], 1500.0)
        self.assertEqual(drift["mean_drift_seconds"], 0.0)

    def test_abandonment_by_hour_timezone_aware(self):
        # 17:00 UTC = 10:00 America/Los_Angeles (PDT, UTC-7).
        self._event(
            occurred_at=datetime(2026, 6, 22, 17, 0, tzinfo=UTC),
            event_type=SessionEvent.EventType.COMPLETED,
        )
        self._event(
            occurred_at=datetime(2026, 6, 22, 17, 30, tzinfo=UTC),
            event_type=SessionEvent.EventType.STOPPED,
        )
        # 05:00 UTC = 22:00 previous local evening.
        self._event(
            occurred_at=datetime(2026, 6, 23, 5, 0, tzinfo=UTC),
            event_type=SessionEvent.EventType.SKIPPED,
        )

        by_hour = {
            row["hour"]: row
            for row in build_stats(self.user, "all", "America/Los_Angeles")[
                "abandonment_by_hour"
            ]
        }

        self.assertEqual(by_hour[10]["total"], 2)
        self.assertEqual(by_hour[10]["abandoned"], 1)
        self.assertEqual(by_hour[10]["abandonment_rate"], 0.5)
        self.assertEqual(by_hour[22]["total"], 1)
        self.assertEqual(by_hour[22]["abandoned"], 1)
        self.assertEqual(by_hour[22]["abandonment_rate"], 1.0)

        # Same UTC hours under UTC bucketing land differently.
        utc_hours = {
            row["hour"]
            for row in build_stats(self.user, "all", "UTC")["abandonment_by_hour"]
        }
        self.assertEqual(utc_hours, {5, 17})

    def test_abandonment_by_weekday(self):
        # Monday 2026-06-22.
        self._event(
            occurred_at=datetime(2026, 6, 22, 12, 0, tzinfo=UTC),
            event_type=SessionEvent.EventType.COMPLETED,
        )
        self._event(
            occurred_at=datetime(2026, 6, 22, 13, 0, tzinfo=UTC),
            event_type=SessionEvent.EventType.STOPPED,
        )
        # Tuesday.
        self._event(
            occurred_at=datetime(2026, 6, 23, 12, 0, tzinfo=UTC),
            event_type=SessionEvent.EventType.SKIPPED,
        )

        by_weekday = {
            row["weekday"]: row
            for row in build_stats(self.user, "all", "UTC")["abandonment_by_weekday"]
        }

        # ExtractIsoWeekDay: Monday=1, Tuesday=2.
        self.assertEqual(by_weekday[1]["total"], 2)
        self.assertEqual(by_weekday[1]["abandoned"], 1)
        self.assertEqual(by_weekday[2]["total"], 1)
        self.assertEqual(by_weekday[2]["abandoned"], 1)

    def test_pause_and_extension_behavior(self):
        self._event(
            pause_count=2,
            paused_seconds=60,
            duration_seconds=1500,
            extension_count=1,
            minutes_extended=5,
        )
        self._event(
            pause_count=0,
            paused_seconds=0,
            duration_seconds=1500,
            extension_count=0,
            minutes_extended=0,
        )

        stats = build_stats(self.user, "all", "UTC")

        self.assertEqual(stats["pause_behavior"]["mean_pause_count"], 1.0)
        # 60 / 3000
        self.assertEqual(stats["pause_behavior"]["paused_seconds_share"], 0.02)
        self.assertEqual(stats["extension_behavior"]["share_extended"], 0.5)
        self.assertEqual(stats["extension_behavior"]["mean_minutes_extended"], 2.5)

    def test_range_filter_excludes_old_sessions(self):
        now = datetime(2026, 6, 22, 12, 0, tzinfo=UTC)
        self._event(occurred_at=now - timedelta(days=2))
        self._event(occurred_at=now - timedelta(days=10))
        self._event(occurred_at=now - timedelta(days=40))

        with mock.patch("insights.analytics.timezone.now", return_value=now):
            stats_7d = build_stats(self.user, "7d", "UTC")
            stats_30d = build_stats(self.user, "30d", "UTC")
            stats_all = build_stats(self.user, "all", "UTC")

        self.assertEqual(stats_7d["session_counts"]["total"], 1)
        self.assertEqual(stats_30d["session_counts"]["total"], 2)
        self.assertEqual(stats_all["session_counts"]["total"], 3)

    def test_other_users_sessions_excluded(self):
        self._event(user=self.user)
        self._event(user=self.other)

        stats = build_stats(self.user, "all", "UTC")
        self.assertEqual(stats["session_counts"]["total"], 1)

    def test_current_and_longest_streak(self):
        # Freeze "now" to evening of 2026-06-22 UTC.
        now = datetime(2026, 6, 22, 20, 0, tzinfo=UTC)

        # Longest run: Jun 18–20 (3 days). Gap on 21. Activity on 22 (today).
        for day in (18, 19, 20, 22):
            self._event(
                occurred_at=datetime(2026, 6, day, 15, 0, tzinfo=UTC),
                event_type=SessionEvent.EventType.COMPLETED,
                mode=SessionEvent.Mode.FOCUS,
            )
        # Non-focus / non-completed must not count toward streak.
        self._event(
            occurred_at=datetime(2026, 6, 21, 15, 0, tzinfo=UTC),
            event_type=SessionEvent.EventType.SKIPPED,
        )
        self._event(
            occurred_at=datetime(2026, 6, 21, 16, 0, tzinfo=UTC),
            mode=SessionEvent.Mode.BREAK,
            event_type=SessionEvent.EventType.COMPLETED,
        )

        with mock.patch("insights.analytics.timezone.now", return_value=now):
            streaks = build_stats(self.user, "all", "UTC")["streaks"]

        self.assertEqual(streaks["longest"], 3)
        self.assertEqual(streaks["current"], 1)

    def test_current_streak_allows_yesterday_start(self):
        now = datetime(2026, 6, 22, 20, 0, tzinfo=UTC)
        self._event(occurred_at=datetime(2026, 6, 20, 12, 0, tzinfo=UTC))
        self._event(occurred_at=datetime(2026, 6, 21, 12, 0, tzinfo=UTC))

        with mock.patch("insights.analytics.timezone.now", return_value=now):
            streaks = build_stats(self.user, "all", "UTC")["streaks"]

        self.assertEqual(streaks["current"], 2)
        self.assertEqual(streaks["longest"], 2)

    def test_streak_day_boundary_respects_timezone(self):
        # 2026-06-22 05:00 UTC = 2026-06-21 22:00 in LA — counts as Jun 21 local.
        now = datetime(2026, 6, 22, 10, 0, tzinfo=UTC)  # Jun 22 03:00 LA
        self._event(occurred_at=datetime(2026, 6, 22, 5, 0, tzinfo=UTC))
        self._event(occurred_at=datetime(2026, 6, 22, 16, 0, tzinfo=UTC))  # Jun 22 09:00 LA

        with mock.patch("insights.analytics.timezone.now", return_value=now):
            la_streaks = build_stats(self.user, "all", "America/Los_Angeles")["streaks"]
            utc_streaks = build_stats(self.user, "all", "UTC")["streaks"]

        # LA: activity on Jun 21 and Jun 22 → current 2, longest 2.
        self.assertEqual(la_streaks["current"], 2)
        self.assertEqual(la_streaks["longest"], 2)
        # UTC: both events land on Jun 22 → current 1, longest 1.
        self.assertEqual(utc_streaks["current"], 1)
        self.assertEqual(utc_streaks["longest"], 1)

    def test_unknown_range_key_raises(self):
        with self.assertRaises(ValueError):
            build_stats(self.user, "today", "UTC")
