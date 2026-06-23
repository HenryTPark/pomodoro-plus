"""Root URL configuration for the Pomodoro Plus backend.

App- and auth-specific routes are added in later phases. For now this exposes
the admin site and a lightweight health-check endpoint so the scaffold is
verifiable end to end.
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

from core.urls import api_urlpatterns, auth_urlpatterns


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include(auth_urlpatterns)),
    path("api/", include(api_urlpatterns)),
    path("api/health/", healthcheck, name="health"),
]
