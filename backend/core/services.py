from django.contrib.auth import get_user_model

from core.defaults import BUILTIN_TEMPLATES, DEFAULT_ACTIVE_TEMPLATE_LABEL, DEFAULT_PROFILE
from core.models import Template, UserProfile

User = get_user_model()


def seed_user_defaults(user: User) -> UserProfile:
    """Create the user's profile and built-in templates on first sign-up."""
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={
            "focus_minutes": DEFAULT_PROFILE["focus"],
            "break_minutes": DEFAULT_PROFILE["short_break"],
            "long_break_minutes": DEFAULT_PROFILE["long_break"],
            "cycle": DEFAULT_PROFILE["cycle"],
            "active_template_label": DEFAULT_ACTIVE_TEMPLATE_LABEL,
        },
    )

    for label, values in BUILTIN_TEMPLATES.items():
        Template.objects.get_or_create(
            user=user,
            label=label,
            defaults={
                "focus": values["focus"],
                "short_break": values["short_break"],
                "long_break": values["long_break"],
                "cycle": values["cycle"],
                "is_builtin": True,
            },
        )

    return profile
