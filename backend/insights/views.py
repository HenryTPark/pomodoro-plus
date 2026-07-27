from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from insights.analytics import build_stats
from insights.models import InsightRequest
from insights.serializers import InsightCreateSerializer, InsightRequestSerializer
from insights.services import (
    MIN_COMPLETED_FOCUS_SESSIONS,
    compute_stats_hash,
    count_completed_focus_sessions,
    count_daily_requests,
    create_insight_request,
    daily_quota_limit,
    find_completed_by_stats_hash,
    find_in_flight_request,
    get_user_timezone,
    reap_stale_request,
)


class InsightRequestCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = InsightCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        range_key = serializer.validated_data["range_key"]
        tz = get_user_timezone(request.user)

        if count_completed_focus_sessions(request.user, range_key) < MIN_COMPLETED_FOCUS_SESSIONS:
            return Response(
                {
                    "error_code": "keep_tracking",
                    "detail": (
                        f"Complete at least {MIN_COMPLETED_FOCUS_SESSIONS} focus sessions "
                        "in this range before generating insights."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        if count_daily_requests(request.user, tz) >= daily_quota_limit():
            return Response(
                {
                    "error_code": "daily_quota_exceeded",
                    "detail": f"Daily insight limit ({daily_quota_limit()}) reached.",
                },
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        in_flight = find_in_flight_request(request.user)
        if in_flight is not None:
            return Response(
                InsightRequestSerializer(in_flight).data,
                status=status.HTTP_202_ACCEPTED,
            )

        stats = build_stats(request.user, range_key, tz)
        stats_hash = compute_stats_hash(stats)
        cached = find_completed_by_stats_hash(request.user, stats_hash)
        if cached is not None:
            return Response(
                InsightRequestSerializer(cached).data,
                status=status.HTTP_202_ACCEPTED,
            )

        row = create_insight_request(request.user, range_key, tz)
        return Response(
            InsightRequestSerializer(row).data,
            status=status.HTTP_202_ACCEPTED,
        )


class InsightRequestDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        try:
            row = InsightRequest.objects.get(pk=pk, user=request.user)
        except InsightRequest.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        row = reap_stale_request(row)
        return Response(InsightRequestSerializer(row).data)


class InsightLatestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        range_key = request.query_params.get("range", InsightRequest.RangeKey.THIRTY_D)
        valid_ranges = {choice for choice, _ in InsightRequest.RangeKey.choices}
        if range_key not in valid_ranges:
            return Response(
                {"range": [f"Must be one of: {', '.join(sorted(valid_ranges))}."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        row = (
            InsightRequest.objects.filter(
                user=request.user,
                status=InsightRequest.Status.COMPLETED,
                range_key=range_key,
            )
            .order_by("-created_at")
            .first()
        )
        if row is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(InsightRequestSerializer(row).data)
