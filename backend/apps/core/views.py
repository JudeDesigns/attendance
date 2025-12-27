"""
Core views for WorkSync application
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .timezone_utils import TIMEZONE_CHOICES, is_valid_timezone, get_user_timezone
import pytz


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def timezone_list(request):
    """
    Get list of available timezones.
    """
    return Response({
        'timezones': TIMEZONE_CHOICES,
        'current_user_timezone': str(get_user_timezone(request.user))
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_user_timezone(request):
    """
    Update the current user's timezone.
    """
    timezone_str = request.data.get('timezone')
    
    if not timezone_str:
        return Response(
            {'error': 'Timezone is required'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if not is_valid_timezone(timezone_str):
        return Response(
            {'error': 'Invalid timezone'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        employee = request.user.employee_profile
        employee.timezone = timezone_str
        employee.save()
        
        return Response({
            'message': 'Timezone updated successfully',
            'timezone': timezone_str
        })
    except AttributeError:
        return Response(
            {'error': 'Employee profile not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_time_info(request):
    """
    Get current time information for the user.
    """
    from django.utils import timezone as django_timezone
    from .timezone_utils import convert_to_user_timezone, format_datetime_for_user
    
    now_utc = django_timezone.now()
    user_tz = get_user_timezone(request.user)
    now_user = convert_to_user_timezone(now_utc, request.user)
    
    return Response({
        'utc_time': now_utc.isoformat(),
        'user_time': now_user.isoformat(),
        'user_timezone': str(user_tz),
        'formatted_time': format_datetime_for_user(now_utc, request.user),
        'timezone_offset': now_user.strftime('%z')
    })
