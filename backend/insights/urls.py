from django.urls import path

from insights.views import (
    InsightLatestView,
    InsightRequestCreateView,
    InsightRequestDetailView,
)

urlpatterns = [
    path("insights/", InsightRequestCreateView.as_view(), name="insight-create"),
    path("insights/latest/", InsightLatestView.as_view(), name="insight-latest"),
    path("insights/<int:pk>/", InsightRequestDetailView.as_view(), name="insight-detail"),
]
