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
        
        # Debug logging
        # print(f"Auth Check: Header X-API-KEY: {api_key}")
        
        if not api_key:
            return None
        
        # Check if the API key is valid
        valid_keys = getattr(settings, 'API_KEYS', {})
        
        for app_name, valid_key in valid_keys.items():
            if api_key == valid_key:
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
    
    @property
    def username(self):
        return self.app_name
    
    def __str__(self):
        return f"API User: {self.app_name}"
