from django.contrib import admin

from insights.models import InsightRequest


@admin.register(InsightRequest)
class InsightRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "status",
        "range_key",
        "timezone",
        "model_name",
        "input_tokens",
        "output_tokens",
        "created_at",
        "completed_at",
    )
    list_filter = ("status", "range_key")
    search_fields = ("user__email", "user__username", "stats_hash", "celery_task_id")
    readonly_fields = (
        "created_at",
        "started_at",
        "completed_at",
        "stats_hash",
        "stats_payload",
        "result",
    )
