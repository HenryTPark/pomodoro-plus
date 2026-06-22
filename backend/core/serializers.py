from dj_rest_auth.serializers import UserDetailsSerializer


class UserSerializer(UserDetailsSerializer):
    """Session-auth user payload returned by login and /api/auth/user/."""

    class Meta(UserDetailsSerializer.Meta):
        fields = ("pk", "email", "first_name", "last_name")
        read_only_fields = fields
