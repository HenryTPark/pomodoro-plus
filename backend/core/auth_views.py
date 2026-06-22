from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from django.conf import settings
from dj_rest_auth.registration.views import SocialLoginView
from rest_framework import status
from rest_framework.response import Response

from core.serializers import UserSerializer


class GoogleLogin(SocialLoginView):
    """Exchange a Google authorization code for a Django session cookie."""

    adapter_class = GoogleOAuth2Adapter
    client_class = OAuth2Client
    callback_url = settings.GOOGLE_OAUTH_CALLBACK_URL

    def get_response(self):
        serializer = UserSerializer(self.user, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_200_OK)
