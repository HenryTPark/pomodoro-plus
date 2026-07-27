"""DRF serializers for insight API endpoints."""

from rest_framework import serializers

from insights.models import InsightRequest


class InsightCreateSerializer(serializers.Serializer):
    range = serializers.ChoiceField(
        choices=InsightRequest.RangeKey.choices,
        source="range_key",
    )


class InsightRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsightRequest
        fields = (
            "id",
            "status",
            "range_key",
            "timezone",
            "result",
            "error_code",
            "error_detail",
            "created_at",
            "started_at",
            "completed_at",
        )
        read_only_fields = fields
