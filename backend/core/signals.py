from allauth.account.signals import user_signed_up
from django.dispatch import receiver

from core.services import seed_user_defaults


@receiver(user_signed_up)
def seed_defaults_on_signup(request, user, **kwargs):
    seed_user_defaults(user)
