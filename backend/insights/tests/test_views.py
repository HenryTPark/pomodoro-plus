from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import SessionEvent
from core.services import seed_user_defaults
from insights.analytics import build_stats
from insights.models import InsightRequest
from insights.services import STALE_ERROR_CODE, compute_stats_hash
from insights.tests.test_tasks import VALID_PAYLOAD

User = get_user_model()


def _stats_payload(user, range_key: str = "30d", tz: str = "UTC") -> dict:
    return build_stats(user, range_key, tz)


class InsightApiTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice@example.com",
            email="alice@example.com",
        )
        seed_user_defaults(self.user)
        self.other = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
        )
        seed_user_defaults(self.other)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self._client_seq = 0

    def _cid(self) -> str:
        self._client_seq += 1
        return f"c-{self._client_seq}"

    def _focus_completed(self, user=None, **kwargs) -> SessionEvent:
        defaults = {
            "user": user or self.user,
            "event_type": SessionEvent.EventType.COMPLETED,
            "mode": SessionEvent.Mode.FOCUS,
            "template_label": "Classic",
            "session_count": 1,
            "duration_seconds": 1500,
            "planned_seconds": 1500,
            "client_id": self._cid(),
            "occurred_at": timezone.now(),
        }
        defaults.update(kwargs)
        return SessionEvent.objects.create(**defaults)

    def _seed_min_sessions(self, count: int = 10, user=None):
        for _ in range(count):
            self._focus_completed(user=user)


@override_settings(AI_INSIGHTS_DAILY_LIMIT=5)
class InsightCreateViewTests(InsightApiTestCase):
    def test_requires_authentication(self):
        client = APIClient()
        response = client.post(reverse("insight-create"), {"range": "30d"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_rejects_invalid_range(self):
        response = self.client.post(reverse("insight-create"), {"range": "90d"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_insufficient_data(self):
        self._focus_completed()
        response = self.client.post(reverse("insight-create"), {"range": "30d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error_code"], "keep_tracking")

    def test_floor_ignores_sessions_outside_range(self):
        for _ in range(10):
            self._focus_completed(occurred_at=timezone.now() - timedelta(days=14))

        response = self.client.post(reverse("insight-create"), {"range": "7d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error_code"], "keep_tracking")

    @override_settings(AI_INSIGHTS_DAILY_LIMIT=2)
    def test_rejects_daily_quota_exceeded(self):
        self._seed_min_sessions()
        InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.FAILED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="hash-1",
            stats_payload={},
        )
        InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.FAILED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="hash-2",
            stats_payload={},
        )

        response = self.client.post(reverse("insight-create"), {"range": "30d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(response.data["error_code"], "daily_quota_exceeded")

    @override_settings(AI_INSIGHTS_DAILY_LIMIT=1)
    @mock.patch("insights.services.generate_insight.delay")
    def test_quota_ignores_other_users_and_prior_days(self, mock_delay):
        self._seed_min_sessions()
        mock_delay.return_value = mock.Mock(id="task-quota")

        InsightRequest.objects.create(
            user=self.other,
            status=InsightRequest.Status.FAILED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="other-user",
            stats_payload={},
        )
        prior = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.FAILED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="yesterday",
            stats_payload={},
        )
        InsightRequest.objects.filter(pk=prior.pk).update(
            created_at=timezone.now() - timedelta(days=1)
        )

        response = self.client.post(reverse("insight-create"), {"range": "30d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], InsightRequest.Status.QUEUED)
        mock_delay.assert_called_once()

    def test_returns_in_flight_request_without_creating_another(self):
        self._seed_min_sessions()
        in_flight = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.QUEUED,
            range_key=InsightRequest.RangeKey.SEVEN_D,
            timezone="UTC",
            stats_hash="in-flight",
            stats_payload={},
        )

        with mock.patch("insights.services.generate_insight.delay") as mock_delay:
            response = self.client.post(reverse("insight-create"), {"range": "30d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["id"], in_flight.id)
        mock_delay.assert_not_called()
        self.assertEqual(InsightRequest.objects.filter(user=self.user).count(), 1)

    def test_returns_processing_in_flight_request_without_creating_another(self):
        self._seed_min_sessions()
        in_flight = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.PROCESSING,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="processing",
            stats_payload={},
        )

        with mock.patch("insights.services.generate_insight.delay") as mock_delay:
            response = self.client.post(reverse("insight-create"), {"range": "30d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["id"], in_flight.id)
        mock_delay.assert_not_called()

    def test_returns_cached_completed_request_by_stats_hash(self):
        self._seed_min_sessions()
        stats = _stats_payload(self.user, "30d", "UTC")
        stats_hash = compute_stats_hash(stats)
        cached = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.COMPLETED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash=stats_hash,
            stats_payload=stats,
            result=VALID_PAYLOAD,
        )

        with mock.patch("insights.services.generate_insight.delay") as mock_delay:
            response = self.client.post(reverse("insight-create"), {"range": "30d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["id"], cached.id)
        self.assertEqual(response.data["status"], InsightRequest.Status.COMPLETED)
        mock_delay.assert_not_called()

    @mock.patch("insights.services.generate_insight.delay")
    def test_creates_new_request_when_stats_hash_differs(self, mock_delay):
        self._seed_min_sessions()
        mock_delay.return_value = mock.Mock(id="task-new")
        InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.COMPLETED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="different-hash",
            stats_payload={"range_key": "30d"},
            result=VALID_PAYLOAD,
        )

        response = self.client.post(reverse("insight-create"), {"range": "30d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], InsightRequest.Status.QUEUED)
        row = InsightRequest.objects.get(pk=response.data["id"])
        self.assertNotEqual(row.stats_hash, "different-hash")
        mock_delay.assert_called_once()

    @mock.patch("insights.services.generate_insight.delay")
    def test_creates_request_and_enqueues_task(self, mock_delay):
        self._seed_min_sessions()
        mock_delay.return_value = mock.Mock(id="task-123")

        response = self.client.post(reverse("insight-create"), {"range": "30d"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], InsightRequest.Status.QUEUED)
        row = InsightRequest.objects.get(pk=response.data["id"])
        self.assertEqual(row.celery_task_id, "task-123")
        mock_delay.assert_called_once_with(row.pk)


class InsightDetailViewTests(InsightApiTestCase):
    def test_requires_authentication(self):
        row = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.QUEUED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="abc",
            stats_payload={},
        )
        client = APIClient()
        response = client.get(reverse("insight-detail", args=[row.pk]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_returns_own_request(self):
        row = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.COMPLETED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="abc",
            stats_payload={},
            result=VALID_PAYLOAD,
        )
        response = self.client.get(reverse("insight-detail", args=[row.pk]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], row.id)
        self.assertEqual(response.data["result"]["summary"], VALID_PAYLOAD["summary"])

    def test_hides_other_users_request(self):
        row = InsightRequest.objects.create(
            user=self.other,
            status=InsightRequest.Status.COMPLETED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="abc",
            stats_payload={},
        )
        response = self.client.get(reverse("insight-detail", args=[row.pk]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_reaps_stale_queued_request(self):
        row = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.QUEUED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="abc",
            stats_payload={},
        )
        stale_time = timezone.now() - timedelta(minutes=6)
        InsightRequest.objects.filter(pk=row.pk).update(created_at=stale_time)

        response = self.client.get(reverse("insight-detail", args=[row.pk]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], InsightRequest.Status.FAILED)
        self.assertEqual(response.data["error_code"], STALE_ERROR_CODE)
        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.FAILED)

    def test_reaps_stale_processing_request(self):
        row = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.PROCESSING,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="abc",
            stats_payload={},
        )
        stale_time = timezone.now() - timedelta(minutes=6)
        InsightRequest.objects.filter(pk=row.pk).update(created_at=stale_time)

        response = self.client.get(reverse("insight-detail", args=[row.pk]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], InsightRequest.Status.FAILED)
        self.assertEqual(response.data["error_code"], STALE_ERROR_CODE)
        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.FAILED)
        self.assertIsNotNone(row.completed_at)

    def test_does_not_reap_recent_in_flight_request(self):
        row = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.PROCESSING,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="abc",
            stats_payload={},
        )
        response = self.client.get(reverse("insight-detail", args=[row.pk]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], InsightRequest.Status.PROCESSING)

    def test_does_not_reap_completed_request(self):
        row = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.COMPLETED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="abc",
            stats_payload={},
            result=VALID_PAYLOAD,
        )
        InsightRequest.objects.filter(pk=row.pk).update(
            created_at=timezone.now() - timedelta(minutes=30)
        )

        response = self.client.get(reverse("insight-detail", args=[row.pk]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], InsightRequest.Status.COMPLETED)


class InsightLatestViewTests(InsightApiTestCase):
    def test_requires_authentication(self):
        client = APIClient()
        response = client.get(reverse("insight-latest"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_returns_most_recent_completed_for_range(self):
        older = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.COMPLETED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="older",
            stats_payload={},
            result={**VALID_PAYLOAD, "summary": "Older insight"},
        )
        newer = InsightRequest.objects.create(
            user=self.user,
            status=InsightRequest.Status.COMPLETED,
            range_key=InsightRequest.RangeKey.THIRTY_D,
            timezone="UTC",
            stats_hash="newer",
            stats_payload={},
            result={**VALID_PAYLOAD, "summary": "Newer insight"},
        )
        InsightRequest.objects.filter(pk=older.pk).update(
            created_at=timezone.now() - timedelta(hours=2)
        )

        response = self.client.get(reverse("insight-latest"), {"range": "30d"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], newer.id)
        self.assertEqual(response.data["result"]["summary"], "Newer insight")

    def test_returns_404_when_no_completed_insight(self):
        response = self.client.get(reverse("insight-latest"), {"range": "7d"})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_rejects_invalid_range(self):
        response = self.client.get(reverse("insight-latest"), {"range": "90d"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
