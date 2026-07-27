"""Celery tasks for AI productivity insights."""

from __future__ import annotations

import logging

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.db import transaction
from django.utils import timezone
from openai import APIConnectionError, APITimeoutError, RateLimitError

from insights.models import InsightRequest
from insights.openai_client import InsightResponseError
from insights.openai_client import generate_insight as fetch_insight_from_openai

logger = logging.getLogger(__name__)

RETRIABLE_OPENAI_ERRORS = (RateLimitError, APITimeoutError, APIConnectionError)

CLAIMABLE_STATUSES = (
    InsightRequest.Status.QUEUED,
    InsightRequest.Status.PROCESSING,
)

TERMINAL_STATUSES = (
    InsightRequest.Status.COMPLETED,
    InsightRequest.Status.FAILED,
)


def _error_code_for(exc: Exception) -> str:
    if isinstance(exc, RateLimitError):
        return "openai_rate_limited"
    if isinstance(exc, APITimeoutError):
        return "openai_timeout"
    if isinstance(exc, APIConnectionError):
        return "openai_connection"
    return "internal_error"


def _try_claim(request_id: int, task_id: str | None) -> InsightRequest | None:
    """Move a queued row to processing, or return an in-flight row for retry."""
    with transaction.atomic():
        try:
            row = InsightRequest.objects.select_for_update().get(pk=request_id)
        except InsightRequest.DoesNotExist:
            logger.warning("InsightRequest %s not found; skipping task", request_id)
            return None

        if row.status in TERMINAL_STATUSES:
            return None

        update_fields = ["celery_task_id"]
        if row.status == InsightRequest.Status.QUEUED:
            row.status = InsightRequest.Status.PROCESSING
            row.started_at = timezone.now()
            update_fields.extend(["status", "started_at"])

        if task_id:
            row.celery_task_id = task_id
            row.save(update_fields=update_fields)
        elif update_fields != ["celery_task_id"]:
            row.save(update_fields=update_fields)

        return row


def _mark_completed(row: InsightRequest, generation) -> None:
    row.status = InsightRequest.Status.COMPLETED
    row.result = generation.insight.model_dump()
    row.model_name = generation.model_name
    row.input_tokens = generation.input_tokens
    row.output_tokens = generation.output_tokens
    row.completed_at = timezone.now()
    row.save(
        update_fields=[
            "status",
            "result",
            "model_name",
            "input_tokens",
            "output_tokens",
            "completed_at",
        ]
    )


def _mark_failed(row: InsightRequest, error_code: str, error_detail: str) -> None:
    row.status = InsightRequest.Status.FAILED
    row.error_code = error_code
    row.error_detail = error_detail
    row.completed_at = timezone.now()
    row.save(
        update_fields=[
            "status",
            "error_code",
            "error_detail",
            "completed_at",
        ]
    )


def _fail_by_id(request_id: int, error_code: str, error_detail: str) -> None:
    try:
        row = InsightRequest.objects.get(pk=request_id)
    except InsightRequest.DoesNotExist:
        return

    if row.status in TERMINAL_STATUSES:
        return

    _mark_failed(row, error_code, error_detail)


@shared_task(
    bind=True,
    max_retries=3,
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
    soft_time_limit=100,
    time_limit=120,
    autoretry_for=RETRIABLE_OPENAI_ERRORS,
)
def generate_insight(self, request_id: int) -> None:
    """Generate an AI insight for a queued InsightRequest row."""
    row = _try_claim(request_id, self.request.id)
    if row is None:
        return

    try:
        generation = fetch_insight_from_openai(row.stats_payload)
    except RETRIABLE_OPENAI_ERRORS as exc:
        if self.request.retries >= self.max_retries:
            _fail_by_id(request_id, _error_code_for(exc), str(exc))
        raise
    except InsightResponseError as exc:
        _mark_failed(row, "openai_invalid_response", str(exc))
        return
    except SoftTimeLimitExceeded:
        _mark_failed(row, "task_timeout", "Task exceeded soft time limit")
        raise
    except Exception as exc:
        logger.exception("Unexpected error generating insight for request %s", request_id)
        _mark_failed(row, "internal_error", str(exc))
        return
    else:
        _mark_completed(row, generation)
