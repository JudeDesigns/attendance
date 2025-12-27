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
    ALWAYS return Los Angeles timezone - no user-specific timezones.
    Everything in the system uses Los Angeles time.
    """
    # FORCE LOS ANGELES TIME EVERYWHERE
    return pytz.timezone('America/Los_Angeles')


def convert_to_user_timezone(dt: datetime, user) -> datetime:
    """
    Convert a datetime to Los Angeles timezone - NO USER-SPECIFIC TIMEZONES.
    """
    if not dt:
        return dt

    # FORCE LOS ANGELES TIME
    la_tz = pytz.timezone('America/Los_Angeles')

    # If datetime is naive, assume it's already in LA time
    if timezone.is_naive(dt):
        return la_tz.localize(dt)

    # If it's timezone-aware, convert to LA time
    return dt.astimezone(la_tz)


def convert_from_user_timezone(dt: datetime, user, target_tz: Optional[Union[str, pytz.timezone]] = None) -> datetime:
    """
    Convert a datetime from Los Angeles timezone to target timezone.
    BUT WE DON'T WANT CONVERSIONS - everything stays in LA time.
    """
    if not dt:
        return dt

    # FORCE LOS ANGELES TIME - no conversions
    la_tz = pytz.timezone('America/Los_Angeles')

    # If datetime is naive, assume it's in LA time and keep it there
    if timezone.is_naive(dt):
        return la_tz.localize(dt)

    # If it's timezone-aware, convert to LA time and keep it there
    return dt.astimezone(la_tz)


def get_current_time_in_user_timezone(user) -> datetime:
    """
    Get current time in user's timezone.
    """
    return convert_to_user_timezone(timezone.now(), user)


def convert_naive_to_user_timezone(naive_dt, user):
    """
    Convert a naive datetime to Los Angeles timezone.
    NO UTC CONVERSION - everything stays in Los Angeles time.
    When frontend sends '11:00', it means 11:00 Los Angeles time.
    """
    from django.utils import timezone as django_timezone

    # FORCE LOS ANGELES TIME - no conversions
    la_tz = pytz.timezone('America/Los_Angeles')

    # If datetime is already timezone-aware, convert to LA time
    if django_timezone.is_aware(naive_dt):
        return naive_dt.astimezone(la_tz)

    # Localize the naive datetime to Los Angeles time and keep it there
    return la_tz.localize(naive_dt)


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
    Parse date and time strings from user input as naive Los Angeles time.
    NO TIMEZONE CONVERSION - everything is naive Los Angeles time.

    Args:
        date_str: Date string in format 'YYYY-MM-DD'
        time_str: Time string in format 'HH:MM' or 'HH:MM:SS'
        user: User object (ignored - always use LA time)

    Returns:
        naive datetime object (Los Angeles time)
    """
    import logging
    logger = logging.getLogger(__name__)

    # Combine date and time
    datetime_str = f"{date_str} {time_str}"
    logger.error(f"🕐 PARSING: {datetime_str} -> will be naive LA time")

    # Parse the datetime as NAIVE (no timezone info)
    try:
        if len(time_str.split(':')) == 2:  # HH:MM format
            dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M')
        else:  # HH:MM:SS format
            dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
    except ValueError as e:
        raise ValueError(f"Invalid date/time format: {e}")

    # Return naive datetime - Django will treat this as Los Angeles time
    logger.error(f"🕐 RESULT: {dt} (naive - will be stored as LA time)")
    return dt


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
