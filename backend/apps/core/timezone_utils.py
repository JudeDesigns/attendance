"""
Timezone utilities for WorkSync application
"""
import pytz
from django.utils import timezone
from django.conf import settings
from datetime import datetime
from typing import Optional, Union


# Common timezone choices for the application
TIMEZONE_CHOICES = [
    # US Timezones
    ('US/Pacific', 'Pacific Time (US/Pacific)'),
    ('US/Mountain', 'Mountain Time (US/Mountain)'),
    ('US/Central', 'Central Time (US/Central)'),
    ('US/Eastern', 'Eastern Time (US/Eastern)'),
    ('US/Alaska', 'Alaska Time (US/Alaska)'),
    ('US/Hawaii', 'Hawaii Time (US/Hawaii)'),
    
    # Major World Timezones
    ('UTC', 'UTC'),
    ('Europe/London', 'London (Europe/London)'),
    ('Europe/Paris', 'Paris (Europe/Paris)'),
    ('Europe/Berlin', 'Berlin (Europe/Berlin)'),
    ('Europe/Rome', 'Rome (Europe/Rome)'),
    ('Europe/Madrid', 'Madrid (Europe/Madrid)'),
    ('Asia/Tokyo', 'Tokyo (Asia/Tokyo)'),
    ('Asia/Shanghai', 'Shanghai (Asia/Shanghai)'),
    ('Asia/Kolkata', 'Mumbai/Delhi (Asia/Kolkata)'),
    ('Australia/Sydney', 'Sydney (Australia/Sydney)'),
    ('America/Toronto', 'Toronto (America/Toronto)'),
    ('America/Vancouver', 'Vancouver (America/Vancouver)'),
    ('America/Mexico_City', 'Mexico City (America/Mexico_City)'),
    ('America/Sao_Paulo', 'São Paulo (America/Sao_Paulo)'),
    ('Africa/Cairo', 'Cairo (Africa/Cairo)'),
    ('Africa/Johannesburg', 'Johannesburg (Africa/Johannesburg)'),
]


def get_user_timezone(user) -> pytz.timezone:
    """
    Get the timezone for a user based on their employee profile.
    Falls back to system default if not set.
    """
    try:
        if hasattr(user, 'employee_profile') and user.employee_profile.timezone:
            return pytz.timezone(user.employee_profile.timezone)
    except (AttributeError, pytz.UnknownTimeZoneError):
        pass
    
    # Fallback to system default
    return pytz.timezone(settings.TIME_ZONE)


def convert_to_user_timezone(dt: datetime, user) -> datetime:
    """
    Convert a datetime to the user's timezone.
    """
    if not dt:
        return dt
    
    user_tz = get_user_timezone(user)
    
    # If datetime is naive, assume it's in UTC
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, pytz.UTC)
    
    return dt.astimezone(user_tz)


def convert_from_user_timezone(dt: datetime, user, target_tz: Optional[Union[str, pytz.timezone]] = None) -> datetime:
    """
    Convert a datetime from user's timezone to target timezone (default: UTC).
    """
    if not dt:
        return dt
    
    user_tz = get_user_timezone(user)
    target_tz = target_tz or pytz.UTC
    
    if isinstance(target_tz, str):
        target_tz = pytz.timezone(target_tz)
    
    # If datetime is naive, assume it's in user's timezone
    if timezone.is_naive(dt):
        dt = user_tz.localize(dt)
    
    return dt.astimezone(target_tz)


def get_current_time_in_user_timezone(user) -> datetime:
    """
    Get current time in user's timezone.
    """
    return convert_to_user_timezone(timezone.now(), user)


def convert_naive_to_user_timezone(naive_dt, user):
    """
    Convert a naive datetime to timezone-aware datetime in UTC.
    Assumes the naive datetime is in the user's local timezone.
    This is used when frontend sends times like '09:00' and we want them
    to be interpreted as 9AM in the user's timezone, not 9AM UTC.
    """
    from django.utils import timezone as django_timezone

    user_tz = get_user_timezone(user)

    # If datetime is already timezone-aware, just return it
    if django_timezone.is_aware(naive_dt):
        return naive_dt

    # Localize the naive datetime to user's timezone, then convert to UTC for storage
    localized_dt = user_tz.localize(naive_dt)
    return localized_dt.astimezone(django_timezone.utc)


def format_datetime_for_user(dt: datetime, user, format_string: str = '%Y-%m-%d %H:%M:%S %Z') -> str:
    """
    Format a datetime for display to the user in their timezone.
    """
    if not dt:
        return ''
    
    user_dt = convert_to_user_timezone(dt, user)
    return user_dt.strftime(format_string)


def parse_user_datetime(date_str: str, time_str: str, user) -> datetime:
    """
    Parse date and time strings from user input and convert to UTC.
    Assumes the input is in the user's timezone.
    
    Args:
        date_str: Date string in format 'YYYY-MM-DD'
        time_str: Time string in format 'HH:MM' or 'HH:MM:SS'
        user: User object
    
    Returns:
        datetime object in UTC
    """
    user_tz = get_user_timezone(user)
    
    # Combine date and time
    datetime_str = f"{date_str} {time_str}"
    
    # Parse the datetime
    try:
        if len(time_str.split(':')) == 2:  # HH:MM format
            dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M')
        else:  # HH:MM:SS format
            dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
    except ValueError as e:
        raise ValueError(f"Invalid date/time format: {e}")
    
    # Localize to user's timezone
    dt = user_tz.localize(dt)
    
    # Convert to UTC
    return dt.astimezone(pytz.UTC)


def is_valid_timezone(tz_string: str) -> bool:
    """
    Check if a timezone string is valid.
    """
    try:
        pytz.timezone(tz_string)
        return True
    except pytz.UnknownTimeZoneError:
        return False


def get_timezone_display_name(tz_string: str) -> str:
    """
    Get a human-readable display name for a timezone.
    """
    for tz_code, display_name in TIMEZONE_CHOICES:
        if tz_code == tz_string:
            return display_name
    
    # Fallback to the timezone string itself
    return tz_string
