"""
Custom middleware for enhanced security and monitoring
"""
import logging
import time
import json
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from ipaddress import ip_address, ip_network

logger = logging.getLogger('worksync.security')


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Add additional security headers to all responses
    """
    
    def process_response(self, request, response):
        # Content Security Policy
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; "
            "font-src 'self'; "
            "connect-src 'self' ws: wss:; "
            "media-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self';"
        )
        
        # Additional security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = (
            'geolocation=(self), '
            'camera=(self), '
            'microphone=(), '
            'payment=(), '
            'usb=()'
        )
        
        # Remove server information
        if 'Server' in response:
            del response['Server']
        
        return response


class RateLimitMiddleware(MiddlewareMixin):
    """
    Custom rate limiting middleware for API endpoints
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        super().__init__(get_response)
    
    def process_request(self, request):
        return None
        # Skip rate limiting for certain paths
        skip_paths = ['/admin/', '/static/', '/media/']
        if any(request.path.startswith(path) for path in skip_paths):
            return None
        
        # Get client IP
        client_ip = self.get_client_ip(request)
        
        # Different rate limits for different endpoints
        rate_limits = {
            '/api/v1/auth/login/': {'requests': 5, 'window': 300},  # 5 requests per 5 minutes
            '/api/v1/attendance/clock-in/': {'requests': 10, 'window': 60},  # 10 requests per minute
            '/api/v1/attendance/clock-out/': {'requests': 10, 'window': 60},  # 10 requests per minute
            'default': {'requests': 100, 'window': 60},  # 100 requests per minute for other endpoints
        }
        
        # Get rate limit for current path
        rate_limit = rate_limits.get(request.path, rate_limits['default'])
        
        # Check rate limit
        cache_key = f"rate_limit:{client_ip}:{request.path}"
        current_requests = cache.get(cache_key, 0)
        
        if current_requests >= rate_limit['requests']:
            logger.warning(
                f"Rate limit exceeded for IP {client_ip} on path {request.path}. "
                f"Requests: {current_requests}/{rate_limit['requests']}"
            )
            return JsonResponse({
                'error': 'Rate limit exceeded',
                'message': 'Too many requests. Please try again later.',
                'retry_after': rate_limit['window']
            }, status=429)
        
        # Increment counter
        cache.set(cache_key, current_requests + 1, rate_limit['window'])
        
        return None
    
    def get_client_ip(self, request):
        """Get the real client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Log all requests for security monitoring
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        super().__init__(get_response)
    
    def process_request(self, request):
        request.start_time = time.time()
        
        # Log suspicious requests
        self.check_suspicious_request(request)
        
        return None
    
    def process_response(self, request, response):
        # Calculate request duration
        duration = time.time() - getattr(request, 'start_time', time.time())
        
        # Log API requests
        if request.path.startswith('/api/'):
            user = getattr(request, 'user', AnonymousUser())
            user_info = f"User: {user.username}" if user.is_authenticated else "Anonymous"
            
            logger.info(
                f"API Request - {request.method} {request.path} - "
                f"Status: {response.status_code} - "
                f"Duration: {duration:.3f}s - "
                f"IP: {self.get_client_ip(request)} - "
                f"{user_info}"
            )
            
            # Log failed authentication attempts
            if response.status_code == 401:
                logger.warning(
                    f"Authentication failed - {request.method} {request.path} - "
                    f"IP: {self.get_client_ip(request)} - "
                    f"User-Agent: {request.META.get('HTTP_USER_AGENT', 'Unknown')}"
                )
        
        return response
    
    def check_suspicious_request(self, request):
        """Check for suspicious request patterns"""
        suspicious_patterns = [
            'admin', 'wp-admin', 'phpmyadmin', '.env', 'config',
            'backup', 'sql', 'database', 'passwd', 'shadow'
        ]
        
        # Check URL for suspicious patterns
        path_lower = request.path.lower()
        for pattern in suspicious_patterns:
            if pattern in path_lower:
                logger.warning(
                    f"Suspicious request detected - Path: {request.path} - "
                    f"IP: {self.get_client_ip(request)} - "
                    f"User-Agent: {request.META.get('HTTP_USER_AGENT', 'Unknown')}"
                )
                break
        
        # Check for SQL injection attempts in query parameters
        query_string = request.META.get('QUERY_STRING', '')
        sql_patterns = ['union', 'select', 'drop', 'insert', 'update', 'delete', '--', ';']
        for pattern in sql_patterns:
            if pattern in query_string.lower():
                logger.warning(
                    f"Potential SQL injection attempt - Query: {query_string} - "
                    f"IP: {self.get_client_ip(request)} - "
                    f"User-Agent: {request.META.get('HTTP_USER_AGENT', 'Unknown')}"
                )
                break
    
    def get_client_ip(self, request):
        """Get the real client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class IPWhitelistMiddleware(MiddlewareMixin):
    """
    IP whitelist middleware for admin access
    """
    
    def process_request(self, request):
        # Only apply to admin paths
        if not request.path.startswith('/admin/'):
            return None
        
        # Get allowed IP ranges from settings
        allowed_ips = getattr(settings, 'ADMIN_ALLOWED_IPS', [])
        if not allowed_ips:
            return None  # No restrictions if not configured
        
        client_ip = self.get_client_ip(request)
        
        # Check if IP is in allowed ranges
        try:
            client_ip_obj = ip_address(client_ip)
            for allowed_ip in allowed_ips:
                if '/' in allowed_ip:  # CIDR notation
                    if client_ip_obj in ip_network(allowed_ip, strict=False):
                        return None
                else:  # Single IP
                    if str(client_ip_obj) == allowed_ip:
                        return None
            
            # IP not allowed
            logger.warning(
                f"Admin access denied for IP {client_ip} - "
                f"Path: {request.path} - "
                f"User-Agent: {request.META.get('HTTP_USER_AGENT', 'Unknown')}"
            )
            
            return JsonResponse({
                'error': 'Access denied',
                'message': 'Your IP address is not authorized to access this resource.'
            }, status=403)
            
        except ValueError:
            logger.error(f"Invalid IP address format: {client_ip}")
            return JsonResponse({
                'error': 'Access denied',
                'message': 'Invalid request.'
            }, status=403)
    
    def get_client_ip(self, request):
        """Get the real client IP address"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip
