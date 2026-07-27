from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from core.defaults import BUILTIN_TEMPLATES, DEFAULT_ACTIVE_TEMPLATE_LABEL, DEFAULT_PROFILE
from core.models import SessionEvent, Template, UserProfile

User = get_user_model()

PROFILE_FIELDS = (
    "focus_minutes",
    "break_minutes",
    "long_break_minutes",
    "cycle",
    "active_template_label",
    "active_tag",
    "theme",
    "sound_enabled",
    "timezone",
)


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


def _template_values(template: Template | dict) -> dict[str, int]:
    if isinstance(template, Template):
        return {
            "focus": template.focus,
            "short_break": template.short_break,
            "long_break": template.long_break,
            "cycle": template.cycle,
        }
    return {
        "focus": template["focus"],
        "short_break": template["short_break"],
        "long_break": template["long_break"],
        "cycle": template["cycle"],
    }


def _templates_equal(left: Template | dict, right: Template | dict) -> bool:
    return _template_values(left) == _template_values(right)


def _unique_template_label(user: User, base_label: str) -> str:
    candidate = f"{base_label} (local)"
    suffix = 2
    while Template.objects.filter(user=user, label=candidate).exists():
        candidate = f"{base_label} (local {suffix})"
        suffix += 1
    return candidate


@transaction.atomic
def merge_local_snapshot(user: User, data: dict) -> dict:
    """Merge a local-first snapshot into the user's backend data."""
    profile, _ = UserProfile.objects.get_or_create(user=user)

    profile_data = data.get("profile") or {}
    for field in PROFILE_FIELDS:
        if field in profile_data:
            setattr(profile, field, profile_data[field])
    profile.save()

    templates_data = data.get("templates") or {}
    for label, local_template in templates_data.items():
        remote = Template.objects.filter(user=user, label=label).first()
        if remote is None:
            Template.objects.create(
                user=user,
                label=label,
                focus=local_template["focus"],
                short_break=local_template["short_break"],
                long_break=local_template["long_break"],
                cycle=local_template["cycle"],
                is_builtin=label in BUILTIN_TEMPLATES,
            )
        elif not _templates_equal(remote, local_template):
            Template.objects.create(
                user=user,
                label=_unique_template_label(user, label),
                focus=local_template["focus"],
                short_break=local_template["short_break"],
                long_break=local_template["long_break"],
                cycle=local_template["cycle"],
                is_builtin=False,
            )

    sessions_data = data.get("sessions") or []
    for session in sessions_data:
        client_id = session["client_id"]
        if SessionEvent.objects.filter(user=user, client_id=client_id).exists():
            continue

        occurred_at = session["occurred_at"]
        if timezone.is_naive(occurred_at):
            occurred_at = timezone.make_aware(occurred_at, timezone.get_current_timezone())

        started_at = session.get("started_at")
        if started_at is not None and timezone.is_naive(started_at):
            started_at = timezone.make_aware(started_at, timezone.get_current_timezone())

        SessionEvent.objects.create(
            user=user,
            event_type=session["event_type"],
            mode=session["mode"],
            template_label=session["template_label"],
            tag=session.get("tag"),
            session_count=session["session_count"],
            duration_seconds=session.get("duration_seconds"),
            minutes_added=session.get("minutes_added"),
            extension_count=session.get("extension_count", 0),
            minutes_extended=session.get("minutes_extended", 0),
            planned_seconds=session.get("planned_seconds"),
            pause_count=session.get("pause_count", 0),
            paused_seconds=session.get("paused_seconds", 0),
            started_at=started_at,
            template_snapshot=session.get("template_snapshot"),
            client_id=client_id,
            occurred_at=occurred_at,
        )

    return {
        "profile": profile,
        "templates": Template.objects.filter(user=user),
        "sessions": SessionEvent.objects.filter(user=user),
    }
