from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.defaults import BUILTIN_TEMPLATES
from core.models import SessionEvent, Template, UserProfile
from core.services import merge_local_snapshot, seed_user_defaults

User = get_user_model()


class ApiTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice@example.com",
            email="alice@example.com",
        )
        seed_user_defaults(self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


class ProfileApiTests(ApiTestCase):
    def test_get_profile(self):
        response = self.client.get(reverse("profile"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["active_template_label"], "Classic")
        self.assertEqual(response.data["theme"], "dark")

    def test_put_profile(self):
        response = self.client.put(
            reverse("profile"),
            {
                "focus_minutes": 30,
                "break_minutes": 6,
                "long_break_minutes": 20,
                "cycle": 3,
                "active_template_label": "Classic",
                "theme": "light",
                "sound_enabled": False,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.focus_minutes, 30)
        self.assertEqual(profile.theme, "light")
        self.assertFalse(profile.sound_enabled)


class TemplateApiTests(ApiTestCase):
    def test_list_templates_includes_builtins(self):
        response = self.client.get(reverse("template-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), len(BUILTIN_TEMPLATES))

    def test_create_custom_template(self):
        response = self.client.post(
            reverse("template-list"),
            {
                "label": "Custom",
                "focus": 20,
                "short_break": 4,
                "long_break": 12,
                "cycle": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        template = Template.objects.get(user=self.user, label="Custom")
        self.assertFalse(template.is_builtin)

    def test_cannot_delete_builtin_template(self):
        template = Template.objects.get(user=self.user, label="Classic")

        response = self.client.delete(reverse("template-detail", args=[template.pk]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Template.objects.filter(pk=template.pk).exists())

    def test_templates_scoped_to_user(self):
        other = User.objects.create_user(username="other@example.com", email="other@example.com")
        seed_user_defaults(other)

        response = self.client.get(reverse("template-list"))

        labels = {item["label"] for item in response.data}
        self.assertIn("Classic", labels)
        self.assertEqual(len(labels), len(BUILTIN_TEMPLATES))


class SessionApiTests(ApiTestCase):
    def test_create_completed_session(self):
        response = self.client.post(
            reverse("session-list"),
            {
                "event_type": "completed",
                "mode": "focus",
                "template_label": "Classic",
                "session_count": 1,
                "duration_seconds": 1500,
                "client_id": "local-1",
                "occurred_at": "2026-06-22T10:00:00Z",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SessionEvent.objects.filter(user=self.user).count(), 1)

    def test_filter_sessions_by_event_type(self):
        SessionEvent.objects.create(
            user=self.user,
            event_type=SessionEvent.EventType.COMPLETED,
            mode=SessionEvent.Mode.FOCUS,
            template_label="Classic",
            session_count=1,
            duration_seconds=1500,
            client_id="completed-1",
            occurred_at=datetime(2026, 6, 22, 10, 0, tzinfo=dt_timezone.utc),
        )
        SessionEvent.objects.create(
            user=self.user,
            event_type=SessionEvent.EventType.SKIPPED,
            mode=SessionEvent.Mode.BREAK,
            template_label="Classic",
            session_count=1,
            duration_seconds=300,
            client_id="skipped-1",
            occurred_at=datetime(2026, 6, 22, 11, 0, tzinfo=dt_timezone.utc),
        )

        response = self.client.get(reverse("session-list"), {"event_type": "completed"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["event_type"], "completed")


class SyncApiTests(ApiTestCase):
    def test_sync_merges_profile_templates_and_sessions(self):
        response = self.client.post(
            reverse("sync"),
            {
                "profile": {
                    "focus_minutes": 30,
                    "theme": "system",
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
                        "client_id": "sync-1",
                        "occurred_at": "2026-06-22T10:00:00Z",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        profile = UserProfile.objects.get(user=self.user)
        self.assertEqual(profile.focus_minutes, 30)
        self.assertEqual(profile.theme, "system")
        self.assertTrue(Template.objects.filter(user=self.user, label="Side Project").exists())
        self.assertEqual(SessionEvent.objects.filter(user=self.user).count(), 1)
        self.assertIn("profile", response.data)
        self.assertIn("templates", response.data)
        self.assertIn("sessions", response.data)

    def test_sync_dedups_sessions_by_client_id(self):
        payload = {
            "sessions": [
                {
                    "event_type": "completed",
                    "mode": "focus",
                    "template_label": "Classic",
                    "session_count": 1,
                    "duration_seconds": 1500,
                    "client_id": "dup-1",
                    "occurred_at": "2026-06-22T10:00:00Z",
                }
            ]
        }

        self.client.post(reverse("sync"), payload, format="json")
        self.client.post(reverse("sync"), payload, format="json")

        self.assertEqual(SessionEvent.objects.filter(user=self.user, client_id="dup-1").count(), 1)

    def test_sync_keeps_remote_template_on_label_conflict(self):
        classic = Template.objects.get(user=self.user, label="Classic")

        merge_local_snapshot(
            self.user,
            {
                "templates": {
                    "Classic": {
                        "focus": 99,
                        "short_break": 99,
                        "long_break": 99,
                        "cycle": 99,
                    }
                }
            },
        )

        classic.refresh_from_db()
        self.assertEqual(classic.focus, 25)
        conflict = Template.objects.get(user=self.user, label="Classic (local)")
        self.assertEqual(conflict.focus, 99)


class PermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_profile_requires_authentication(self):
        response = self.client.get(reverse("profile"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sync_requires_authentication(self):
        response = self.client.post(reverse("sync"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
