from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase
from django.urls import reverse
from allauth.account.signals import user_signed_up
from rest_framework import status
from rest_framework.test import APIClient

from core.defaults import BUILTIN_TEMPLATES
from core.models import Template, UserProfile
from core.services import seed_user_defaults

User = get_user_model()


class SeedUserDefaultsTests(TestCase):
    def test_creates_profile_and_builtin_templates(self):
        user = User.objects.create_user(username="alice@example.com", email="alice@example.com")

        profile = seed_user_defaults(user)

        self.assertIsNotNone(profile.pk)
        self.assertEqual(UserProfile.objects.filter(user=user).count(), 1)
        self.assertEqual(Template.objects.filter(user=user).count(), len(BUILTIN_TEMPLATES))
        self.assertTrue(Template.objects.filter(user=user, label="Classic", is_builtin=True).exists())
        self.assertEqual(profile.active_template_label, "Classic")

    def test_is_idempotent(self):
        user = User.objects.create_user(username="bob@example.com", email="bob@example.com")

        seed_user_defaults(user)
        seed_user_defaults(user)

        self.assertEqual(UserProfile.objects.filter(user=user).count(), 1)
        self.assertEqual(Template.objects.filter(user=user).count(), len(BUILTIN_TEMPLATES))

    def test_user_signed_up_signal_seeds_defaults(self):
        user = User.objects.create_user(username="eve@example.com", email="eve@example.com")
        request = RequestFactory().post("/api/auth/google/")

        user_signed_up.send(sender=User, request=request, user=user)

        self.assertTrue(UserProfile.objects.filter(user=user).exists())
        self.assertEqual(Template.objects.filter(user=user).count(), len(BUILTIN_TEMPLATES))


class AuthUrlTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_google_login_requires_authorization_code(self):
        response = self.client.post(reverse("google_login"), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_endpoint_requires_authentication(self):
        response = self.client.get(reverse("user"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_authenticated_user_endpoint_returns_profile_fields(self):
        user = User.objects.create_user(username="carol@example.com", email="carol@example.com")
        self.client.force_authenticate(user=user)

        response = self.client.get(reverse("user"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "carol@example.com")
        self.assertEqual(response.data["pk"], user.pk)

    def test_logout_clears_session(self):
        user = User.objects.create_user(username="dave@example.com", email="dave@example.com")
        self.client.force_login(user)

        response = self.client.post(reverse("logout"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("_auth_user_id", self.client.session)
