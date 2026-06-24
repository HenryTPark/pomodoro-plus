from django.contrib import admin

from core.models import SessionEvent, Template, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "active_template_label", "theme", "sound_enabled")
    search_fields = ("user__email", "user__username")


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ("label", "user", "focus", "short_break", "long_break", "cycle", "is_builtin")
    list_filter = ("is_builtin",)
    search_fields = ("label", "user__email", "user__username")


@admin.register(SessionEvent)
class SessionEventAdmin(admin.ModelAdmin):
    list_display = (
        "event_type",
        "mode",
        "template_label",
        "user",
        "session_count",
        "occurred_at",
    )
    list_filter = ("event_type", "mode")
    search_fields = ("client_id", "template_label", "user__email", "user__username")
