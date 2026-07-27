from django.conf import settings
from django.db import models
from django.db.models import Q


class InsightRequest(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class RangeKey(models.TextChoices):
        SEVEN_D = "7d", "7 days"
        THIRTY_D = "30d", "30 days"
        ALL = "all", "All time"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="insight_requests",
    )
    status = models.CharField(
        max_length=12,
        choices=Status.choices,
        default=Status.QUEUED,
    )
    range_key = models.CharField(max_length=3, choices=RangeKey.choices)
    timezone = models.CharField(max_length=64)
    stats_hash = models.CharField(max_length=64)
    stats_payload = models.JSONField()
    result = models.JSONField(null=True, blank=True)
    error_code = models.CharField(max_length=64, null=True, blank=True)
    error_detail = models.TextField(null=True, blank=True)
    model_name = models.CharField(max_length=100, null=True, blank=True)
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    celery_task_id = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="insight_req_user_created"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "stats_hash"],
                condition=Q(status="completed"),
                name="unique_completed_insight_per_user_stats_hash",
            ),
        ]

    def __str__(self) -> str:
        return f"InsightRequest {self.pk} ({self.status}, {self.user})"
