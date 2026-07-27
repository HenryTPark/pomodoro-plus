from unittest import mock

from celery.exceptions import SoftTimeLimitExceeded
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from openai import APIConnectionError, APITimeoutError, RateLimitError

from insights.models import InsightRequest
from django.utils import timezone

from insights.openai_client import InsightGenerationResult, InsightResponseError
from insights.schemas import Confidence, InsightResult
from insights.tasks import generate_insight

User = get_user_model()

VALID_PAYLOAD = {
    "summary": "You finish most focus sessions and pause rarely.",
    "patterns": [
        {
            "title": "Strong completion on Classic",
            "evidence": "Classic completion_rate is 0.85 over 20 sessions.",
            "confidence": "high",
        }
    ],
    "template_recommendations": [
        {
            "template_label": "Classic",
            "reason": "Highest completion rate in the range.",
            "suggested_experiment": "Use Classic for deep work blocks this week.",
        }
    ],
    "warnings": ["Tag sample sizes vary widely."],
    "next_steps": ["Track one tag per day to reduce noise."],
}


def _generation_result() -> InsightGenerationResult:
    return InsightGenerationResult(
        insight=InsightResult.model_validate(VALID_PAYLOAD),
        model_name="gpt-4o-mini",
        input_tokens=120,
        output_tokens=80,
    )


def _create_request(user, **kwargs) -> InsightRequest:
    defaults = {
        "user": user,
        "status": InsightRequest.Status.QUEUED,
        "range_key": InsightRequest.RangeKey.THIRTY_D,
        "timezone": "UTC",
        "stats_hash": "abc123",
        "stats_payload": {"range_key": "30d", "completion_rate": 0.8},
    }
    defaults.update(kwargs)
    return InsightRequest.objects.create(**defaults)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class GenerateInsightTaskTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice@example.com",
            email="alice@example.com",
        )

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_completes_request_and_records_tokens(self, mock_fetch):
        row = _create_request(self.user)
        mock_fetch.return_value = _generation_result()

        generate_insight.delay(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.COMPLETED)
        self.assertEqual(row.result, VALID_PAYLOAD)
        self.assertEqual(row.model_name, "gpt-4o-mini")
        self.assertEqual(row.input_tokens, 120)
        self.assertEqual(row.output_tokens, 80)
        self.assertIsNotNone(row.started_at)
        self.assertIsNotNone(row.completed_at)
        self.assertIsNotNone(row.celery_task_id)
        mock_fetch.assert_called_once_with(row.stats_payload)

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_skips_completed_request(self, mock_fetch):
        row = _create_request(
            self.user,
            status=InsightRequest.Status.COMPLETED,
            result=VALID_PAYLOAD,
        )

        generate_insight.delay(row.pk)

        mock_fetch.assert_not_called()

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_skips_failed_request(self, mock_fetch):
        row = _create_request(
            self.user,
            status=InsightRequest.Status.FAILED,
            error_code="openai_invalid_response",
        )

        generate_insight.delay(row.pk)

        mock_fetch.assert_not_called()

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_skips_missing_request(self, mock_fetch):
        generate_insight.delay(999_999)

        mock_fetch.assert_not_called()

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_marks_invalid_response_as_failed(self, mock_fetch):
        row = _create_request(self.user)
        mock_fetch.side_effect = InsightResponseError("Model output failed validation")

        generate_insight.delay(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.FAILED)
        self.assertEqual(row.error_code, "openai_invalid_response")
        self.assertIn("validation", row.error_detail)
        self.assertIsNotNone(row.completed_at)

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_marks_unexpected_error_as_failed(self, mock_fetch):
        row = _create_request(self.user)
        mock_fetch.side_effect = RuntimeError("boom")

        generate_insight.delay(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.FAILED)
        self.assertEqual(row.error_code, "internal_error")
        self.assertEqual(row.error_detail, "boom")

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_processing_retry_does_not_reset_started_at(self, mock_fetch):
        started_at = timezone.now()
        row = _create_request(
            self.user,
            status=InsightRequest.Status.PROCESSING,
            started_at=started_at,
        )
        mock_fetch.return_value = _generation_result()

        generate_insight.delay(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.COMPLETED)
        self.assertEqual(row.started_at, started_at)

    @mock.patch("insights.tasks.generate_insight.retry")
    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_retries_transient_openai_errors(self, mock_fetch, mock_retry):
        row = _create_request(self.user)
        rate_limit_error = RateLimitError(
            "rate limit",
            response=mock.Mock(status_code=429),
            body=None,
        )
        mock_fetch.side_effect = rate_limit_error
        mock_retry.side_effect = rate_limit_error

        task = generate_insight
        task.request.retries = 0

        with self.assertRaises(RateLimitError):
            task(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.PROCESSING)
        mock_retry.assert_called_once()

    @mock.patch("insights.tasks.generate_insight.retry")
    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_retries_timeout_errors(self, mock_fetch, mock_retry):
        row = _create_request(self.user)
        timeout_error = APITimeoutError(request=mock.Mock())
        mock_fetch.side_effect = timeout_error
        mock_retry.side_effect = timeout_error

        task = generate_insight
        task.request.retries = 0

        with self.assertRaises(APITimeoutError):
            task(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.PROCESSING)
        mock_retry.assert_called_once()

    @mock.patch("insights.tasks.generate_insight.retry")
    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_marks_failed_after_retries_exhausted(self, mock_fetch, mock_retry):
        row = _create_request(self.user)
        timeout_error = APITimeoutError(request=mock.Mock())
        mock_fetch.side_effect = timeout_error
        mock_retry.side_effect = timeout_error

        task = generate_insight
        task.request.retries = task.max_retries

        with self.assertRaises(APITimeoutError):
            task(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.FAILED)
        self.assertEqual(row.error_code, "openai_timeout")

    @mock.patch("insights.tasks.generate_insight.retry")
    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_marks_failed_after_rate_limit_retries_exhausted(self, mock_fetch, mock_retry):
        row = _create_request(self.user)
        rate_limit_error = RateLimitError(
            "rate limit",
            response=mock.Mock(status_code=429),
            body=None,
        )
        mock_fetch.side_effect = rate_limit_error
        mock_retry.side_effect = rate_limit_error

        task = generate_insight
        task.request.retries = task.max_retries

        with self.assertRaises(RateLimitError):
            task(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.FAILED)
        self.assertEqual(row.error_code, "openai_rate_limited")

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_marks_soft_time_limit_as_failed(self, mock_fetch):
        row = _create_request(self.user)
        mock_fetch.side_effect = SoftTimeLimitExceeded()

        with self.assertRaises(SoftTimeLimitExceeded):
            generate_insight(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.FAILED)
        self.assertEqual(row.error_code, "task_timeout")

    @mock.patch("insights.tasks.fetch_insight_from_openai")
    def test_connection_error_code(self, mock_fetch):
        row = _create_request(self.user)
        connection_error = APIConnectionError(request=mock.Mock())
        mock_fetch.side_effect = connection_error

        task = generate_insight
        task.request.retries = task.max_retries

        with self.assertRaises(APIConnectionError):
            task(row.pk)

        row.refresh_from_db()
        self.assertEqual(row.status, InsightRequest.Status.FAILED)
        self.assertEqual(row.error_code, "openai_connection")
