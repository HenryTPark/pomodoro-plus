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
