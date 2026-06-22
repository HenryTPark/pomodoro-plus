from django.urls import path
from dj_rest_auth.views import LogoutView, UserDetailsView

from core.auth_views import GoogleLogin

urlpatterns = [
    path("google/", GoogleLogin.as_view(), name="google_login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("user/", UserDetailsView.as_view(), name="user"),
]
