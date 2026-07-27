from django.urls import include, path
from dj_rest_auth.views import LogoutView, UserDetailsView
from rest_framework.routers import DefaultRouter

from core.auth_views import GoogleLogin
from core.views import ProfileView, SessionEventViewSet, SyncView, TemplateViewSet

router = DefaultRouter()
router.register("templates", TemplateViewSet, basename="template")
router.register("sessions", SessionEventViewSet, basename="session")

auth_urlpatterns = [
    path("google/", GoogleLogin.as_view(), name="google_login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("user/", UserDetailsView.as_view(), name="user"),
]

api_urlpatterns = [
    path("profile/", ProfileView.as_view(), name="profile"),
    path("sync/", SyncView.as_view(), name="sync"),
    path("", include("insights.urls")),
    path("", include(router.urls)),
]
