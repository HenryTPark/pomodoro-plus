from datetime import datetime, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import SessionEvent, Template, UserProfile

User = get_user_model()

GOOGLE_USER_INFO = {
    "sub": "google-smoke-123",
    "email": "smoke@example.com",
    "given_name": "Smoke",
    "family_name": "Tester",
    "email_verified": True,
}


@override_settings(
    GOOGLE_OAUTH_CLIENT_ID="test-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET="test-client-secret",
)
class LoginSyncSmokeTests(TestCase):
    """End-to-end: Google code exchange -> session cookie -> bulk sync -> read back."""

    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)

    @patch(
        "allauth.socialaccount.providers.google.views.GoogleOAuth2Adapter._fetch_user_info",
        return_value=GOOGLE_USER_INFO,
    )
    @patch(
        "allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token",
        return_value={"access_token": "smoke-test-token"},
    )
    def test_google_login_then_sync_local_snapshot(self, _mock_token, _mock_user_info):
        health = self.client.get(reverse("health"))
        self.assertEqual(health.status_code, status.HTTP_200_OK)
        csrf_token = self.client.cookies["csrftoken"].value

        login_response = self.client.post(
            reverse("google_login"),
            {"code": "smoke-auth-code"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK, login_response.data)
        self.assertEqual(login_response.data["email"], "smoke@example.com")

        user = User.objects.get(email="smoke@example.com")
        self.assertTrue(UserProfile.objects.filter(user=user).exists())
        self.assertEqual(Template.objects.filter(user=user).count(), 5)

        profile_probe = self.client.get(reverse("profile"))
        self.assertEqual(
            profile_probe.status_code,
            status.HTTP_200_OK,
            profile_probe.data,
        )

        csrf_token = self.client.cookies["csrftoken"].value
        sync_response = self.client.post(
            reverse("sync"),
            {
                "profile": {
                    "focus_minutes": 30,
                    "theme": "light",
                    "sound_enabled": False,
                },
                "templates": {
                    "Side Project": {
                        "focus": 20,
                        "short_break": 5,
                        "long_break": 15,
                        "cycle": 4,
                    }
                },
                "sessions": [
                    {
                        "event_type": "completed",
                        "mode": "focus",
                        "template_label": "Classic",
                        "session_count": 1,
                        "duration_seconds": 1500,
                        "client_id": "smoke-session-1",
                        "occurred_at": "2026-06-22T10:00:00Z",
                    }
                ],
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(sync_response.status_code, status.HTTP_200_OK)

        profile_response = self.client.get(reverse("profile"))
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data["focus_minutes"], 30)
        self.assertEqual(profile_response.data["theme"], "light")
        self.assertFalse(profile_response.data["sound_enabled"])

        templates_response = self.client.get(reverse("template-list"))
        labels = {item["label"] for item in templates_response.data}
        self.assertIn("Side Project", labels)

        sessions_response = self.client.get(reverse("session-list"))
        self.assertEqual(len(sessions_response.data), 1)
        self.assertEqual(sessions_response.data[0]["client_id"], "smoke-session-1")

        self.assertEqual(
            SessionEvent.objects.filter(user=user, client_id="smoke-session-1").count(),
            1,
        )
        self.assertTrue(
            Template.objects.filter(user=user, label="Side Project").exists()
        )

        user_response = self.client.get(reverse("user"))
        self.assertEqual(user_response.status_code, status.HTTP_200_OK)
        self.assertEqual(user_response.data["email"], "smoke@example.com")

        logout_response = self.client.post(
            reverse("logout"),
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

        denied = self.client.get(reverse("profile"))
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
