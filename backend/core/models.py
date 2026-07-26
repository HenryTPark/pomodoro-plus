from django.conf import settings
from django.db import models

from core.defaults import (
    DEFAULT_ACTIVE_TEMPLATE_LABEL,
    DEFAULT_PROFILE,
)


class UserProfile(models.Model):
    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        SYSTEM = "system", "System"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    focus_minutes = models.PositiveSmallIntegerField(default=DEFAULT_PROFILE["focus"])
    break_minutes = models.PositiveSmallIntegerField(default=DEFAULT_PROFILE["short_break"])
    long_break_minutes = models.PositiveSmallIntegerField(default=DEFAULT_PROFILE["long_break"])
    cycle = models.PositiveSmallIntegerField(default=DEFAULT_PROFILE["cycle"])
    active_template_label = models.CharField(
        max_length=100,
        default=DEFAULT_ACTIVE_TEMPLATE_LABEL,
    )
    active_tag = models.CharField(max_length=50, null=True, blank=True)
    theme = models.CharField(max_length=10, choices=Theme.choices, default=Theme.DARK)
    sound_enabled = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"Profile for {self.user}"


class Template(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="templates",
    )
    label = models.CharField(max_length=100)
    focus = models.PositiveSmallIntegerField()
    short_break = models.PositiveSmallIntegerField()
    long_break = models.PositiveSmallIntegerField()
    cycle = models.PositiveSmallIntegerField()
    is_builtin = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "label"], name="unique_template_label_per_user"),
        ]
        ordering = ["label"]

    def __str__(self) -> str:
        return f"{self.label} ({self.user})"


class SessionEvent(models.Model):
    class EventType(models.TextChoices):
        COMPLETED = "completed", "Completed"
        SKIPPED = "skipped", "Skipped"
        EXTENDED = "extended", "Extended"
        STOPPED = "stopped", "Stopped"

    class Mode(models.TextChoices):
        FOCUS = "focus", "Focus"
        BREAK = "break", "Break"
        LONG_BREAK = "longBreak", "Long Break"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="session_events",
    )
    event_type = models.CharField(max_length=10, choices=EventType.choices)
    mode = models.CharField(max_length=10, choices=Mode.choices)
    template_label = models.CharField(max_length=100)
    tag = models.CharField(max_length=50, null=True, blank=True)
    session_count = models.PositiveSmallIntegerField()
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    minutes_added = models.PositiveSmallIntegerField(null=True, blank=True)
    extension_count = models.PositiveSmallIntegerField(default=0)
    minutes_extended = models.PositiveSmallIntegerField(default=0)
    planned_seconds = models.PositiveIntegerField(null=True, blank=True)
    pause_count = models.PositiveSmallIntegerField(default=0)
    paused_seconds = models.PositiveIntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    template_snapshot = models.JSONField(null=True, blank=True)
    client_id = models.CharField(max_length=100)
    occurred_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "client_id"],
                name="unique_session_client_id_per_user",
            ),
        ]
        ordering = ["-occurred_at"]

    def __str__(self) -> str:
        return f"{self.event_type} {self.mode} ({self.user})"
