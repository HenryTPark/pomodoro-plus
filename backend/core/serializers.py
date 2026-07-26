from dj_rest_auth.serializers import UserDetailsSerializer
from rest_framework import serializers

from core.models import SessionEvent, Template, UserProfile


class UserSerializer(UserDetailsSerializer):
    """Session-auth user payload returned by login and /api/auth/user/."""

    class Meta(UserDetailsSerializer.Meta):
        fields = ("pk", "email", "first_name", "last_name")
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            "focus_minutes",
            "break_minutes",
            "long_break_minutes",
            "cycle",
            "active_template_label",
            "theme",
            "sound_enabled",
        )


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = (
            "id",
            "label",
            "focus",
            "short_break",
            "long_break",
            "cycle",
            "is_builtin",
        )
        read_only_fields = ("id", "is_builtin")

    def validate_label(self, value: str) -> str:
        if self.instance and self.instance.is_builtin and self.instance.label != value:
            raise serializers.ValidationError("Built-in template labels cannot be renamed.")
        return value


class SessionEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionEvent
        fields = (
            "id",
            "event_type",
            "mode",
            "template_label",
            "session_count",
            "duration_seconds",
            "minutes_added",
            "extension_count",
            "minutes_extended",
            "planned_seconds",
            "pause_count",
            "paused_seconds",
            "started_at",
            "template_snapshot",
            "client_id",
            "occurred_at",
        )
        read_only_fields = ("id",)

    def validate(self, attrs: dict) -> dict:
        event_type = attrs.get("event_type", getattr(self.instance, "event_type", None))
        duration_seconds = attrs.get(
            "duration_seconds",
            getattr(self.instance, "duration_seconds", None),
        )
        minutes_added = attrs.get(
            "minutes_added",
            getattr(self.instance, "minutes_added", None),
        )

        if event_type == SessionEvent.EventType.EXTENDED:
            if minutes_added is None:
                raise serializers.ValidationError(
                    {"minutes_added": "Required for extended sessions."}
                )
        elif duration_seconds is None:
            raise serializers.ValidationError(
                {"duration_seconds": f"Required for {event_type} sessions."}
            )

        return attrs


class SyncTemplateInputSerializer(serializers.Serializer):
    focus = serializers.IntegerField(min_value=1)
    short_break = serializers.IntegerField(min_value=1)
    long_break = serializers.IntegerField(min_value=1)
    cycle = serializers.IntegerField(min_value=1)


class SyncProfileInputSerializer(serializers.Serializer):
    focus_minutes = serializers.IntegerField(min_value=1, required=False)
    break_minutes = serializers.IntegerField(min_value=1, required=False)
    long_break_minutes = serializers.IntegerField(min_value=1, required=False)
    cycle = serializers.IntegerField(min_value=1, required=False)
    active_template_label = serializers.CharField(max_length=100, required=False)
    theme = serializers.ChoiceField(choices=UserProfile.Theme.choices, required=False)
    sound_enabled = serializers.BooleanField(required=False)


class SyncSessionInputSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=SessionEvent.EventType.choices)
    mode = serializers.ChoiceField(choices=SessionEvent.Mode.choices)
    template_label = serializers.CharField(max_length=100)
    session_count = serializers.IntegerField(min_value=0)
    duration_seconds = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    minutes_added = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    extension_count = serializers.IntegerField(min_value=0, required=False, default=0)
    minutes_extended = serializers.IntegerField(min_value=0, required=False, default=0)
    planned_seconds = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    pause_count = serializers.IntegerField(min_value=0, required=False, default=0)
    paused_seconds = serializers.IntegerField(min_value=0, required=False, default=0)
    started_at = serializers.DateTimeField(required=False, allow_null=True)
    template_snapshot = serializers.JSONField(required=False, allow_null=True)
    client_id = serializers.CharField(max_length=100)
    occurred_at = serializers.DateTimeField()


class SyncInputSerializer(serializers.Serializer):
    profile = SyncProfileInputSerializer(required=False)
    templates = serializers.DictField(
        child=SyncTemplateInputSerializer(),
        required=False,
    )
    sessions = SyncSessionInputSerializer(many=True, required=False)


class SyncOutputSerializer(serializers.Serializer):
    profile = UserProfileSerializer()
    templates = TemplateSerializer(many=True)
    sessions = SessionEventSerializer(many=True)
