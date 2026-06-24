from datetime import datetime, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase

from core.defaults import BUILTIN_TEMPLATES, DEFAULT_ACTIVE_TEMPLATE_LABEL, DEFAULT_PROFILE
from core.models import SessionEvent, Template, UserProfile
from core.services import seed_user_defaults

User = get_user_model()


class UserProfileModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice@example.com",
            email="alice@example.com",
        )

    def test_default_field_values(self):
        profile = UserProfile.objects.create(user=self.user)

        self.assertEqual(profile.focus_minutes, DEFAULT_PROFILE["focus"])
        self.assertEqual(profile.break_minutes, DEFAULT_PROFILE["short_break"])
        self.assertEqual(profile.long_break_minutes, DEFAULT_PROFILE["long_break"])
        self.assertEqual(profile.cycle, DEFAULT_PROFILE["cycle"])
        self.assertEqual(profile.active_template_label, DEFAULT_ACTIVE_TEMPLATE_LABEL)
        self.assertEqual(profile.theme, UserProfile.Theme.DARK)
        self.assertTrue(profile.sound_enabled)

    def test_one_profile_per_user(self):
        UserProfile.objects.create(user=self.user)

        with self.assertRaises(IntegrityError):
            UserProfile.objects.create(user=self.user)


class TemplateModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice@example.com",
            email="alice@example.com",
        )
        self.other = User.objects.create_user(
            username="other@example.com",
            email="other@example.com",
        )

    def test_unique_label_per_user(self):
        Template.objects.create(
            user=self.user,
            label="Custom",
            focus=25,
            short_break=5,
            long_break=15,
            cycle=4,
        )

        with self.assertRaises(IntegrityError):
            Template.objects.create(
                user=self.user,
                label="Custom",
                focus=30,
                short_break=6,
                long_break=20,
                cycle=3,
            )

    def test_same_label_allowed_for_different_users(self):
        for user in (self.user, self.other):
            Template.objects.create(
                user=user,
                label="Shared Label",
                focus=25,
                short_break=5,
                long_break=15,
                cycle=4,
            )

        self.assertEqual(Template.objects.filter(label="Shared Label").count(), 2)

    def test_seed_user_defaults_creates_all_builtins(self):
        seed_user_defaults(self.user)

        labels = set(
            Template.objects.filter(user=self.user).values_list("label", flat=True)
        )
        self.assertEqual(labels, set(BUILTIN_TEMPLATES.keys()))
        self.assertTrue(
            Template.objects.filter(user=self.user, label="Classic", is_builtin=True).exists()
        )


class SessionEventModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="alice@example.com",
            email="alice@example.com",
        )

    def _create_event(self, client_id: str) -> SessionEvent:
        return SessionEvent.objects.create(
            user=self.user,
            event_type=SessionEvent.EventType.COMPLETED,
            mode=SessionEvent.Mode.FOCUS,
            template_label="Classic",
            session_count=1,
            duration_seconds=1500,
            client_id=client_id,
            occurred_at=datetime(2026, 6, 22, 10, 0, tzinfo=dt_timezone.utc),
        )

    def test_unique_client_id_per_user(self):
        self._create_event("client-1")

        with self.assertRaises(IntegrityError):
            self._create_event("client-1")

    def test_same_client_id_allowed_for_different_users(self):
        other = User.objects.create_user(username="other@example.com", email="other@example.com")

        self._create_event("shared-client")
        SessionEvent.objects.create(
            user=other,
            event_type=SessionEvent.EventType.COMPLETED,
            mode=SessionEvent.Mode.FOCUS,
            template_label="Classic",
            session_count=1,
            duration_seconds=1500,
            client_id="shared-client",
            occurred_at=datetime(2026, 6, 22, 10, 0, tzinfo=dt_timezone.utc),
        )

        self.assertEqual(SessionEvent.objects.filter(client_id="shared-client").count(), 2)
