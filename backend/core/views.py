from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import SessionEvent, Template, UserProfile
from core.serializers import (
    SessionEventSerializer,
    SyncInputSerializer,
    SyncOutputSerializer,
    TemplateSerializer,
    UserProfileSerializer,
)
from core.services import merge_local_snapshot, seed_user_defaults


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_profile(self, user):
        profile = UserProfile.objects.filter(user=user).first()
        if profile is None:
            profile = seed_user_defaults(user)
        return profile

    def get(self, request):
        profile = self._get_profile(request.user)
        return Response(UserProfileSerializer(profile).data)

    def put(self, request):
        profile = self._get_profile(request.user)
        serializer = UserProfileSerializer(profile, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TemplateSerializer

    def get_queryset(self):
        return Template.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, is_builtin=False)

    def perform_update(self, serializer):
        if serializer.instance.is_builtin:
            serializer.save(
                focus=serializer.validated_data.get("focus", serializer.instance.focus),
                short_break=serializer.validated_data.get(
                    "short_break",
                    serializer.instance.short_break,
                ),
                long_break=serializer.validated_data.get(
                    "long_break",
                    serializer.instance.long_break,
                ),
                cycle=serializer.validated_data.get("cycle", serializer.instance.cycle),
            )
            return
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        template = self.get_object()
        if template.is_builtin:
            return Response(
                {"detail": "Built-in templates cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class SessionEventViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    serializer_class = SessionEventSerializer

    def get_queryset(self):
        queryset = SessionEvent.objects.filter(user=self.request.user)
        event_type = self.request.query_params.get("event_type")
        if event_type:
            queryset = queryset.filter(event_type=event_type)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SyncInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        merged = merge_local_snapshot(request.user, serializer.validated_data)
        return Response(SyncOutputSerializer(merged).data)
