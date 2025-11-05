"""
Custom authentication for external API integration
"""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings


class APIKeyAuthentication(BaseAuthentication):
    """
    Custom authentication class for API key-based authentication
    Used for external application integration (like B&R Driver App)
    """
    
    def authenticate(self, request):
        api_key = request.META.get('HTTP_X_API_KEY')
        
        if not api_key:
            return None
        
        # Check if the API key is valid
        valid_keys = getattr(settings, 'API_KEYS', {})
        
        for app_name, valid_key in valid_keys.items():
            if api_key == valid_key:
                # Return a tuple of (user, auth) where user can be None for API key auth
                # We'll create a custom user object to represent the external app
                return (APIKeyUser(app_name), api_key)
        
        raise AuthenticationFailed('Invalid API key')


class APIKeyUser:
    """
    Custom user object for API key authentication
    Represents an external application rather than a real user
    """
    
    def __init__(self, app_name):
        self.app_name = app_name
        self.is_authenticated = True
        self.is_anonymous = False
    
    @property
    def is_active(self):
        return True
    
    def __str__(self):
        return f"API User: {self.app_name}"
