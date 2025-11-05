"""
Custom validators for enhanced security
"""
import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class CustomPasswordValidator:
    """
    Custom password validator with enhanced security requirements
    """
    
    def validate(self, password, user=None):
        """
        Validate password against custom security requirements
        """
        errors = []
        
        # Check for at least one uppercase letter
        if not re.search(r'[A-Z]', password):
            errors.append(_('Password must contain at least one uppercase letter.'))
        
        # Check for at least one lowercase letter
        if not re.search(r'[a-z]', password):
            errors.append(_('Password must contain at least one lowercase letter.'))
        
        # Check for at least one digit
        if not re.search(r'\d', password):
            errors.append(_('Password must contain at least one digit.'))
        
        # Check for at least one special character
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append(_('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>).'))
        
        # Check for common patterns
        common_patterns = [
            r'123',
            r'abc',
            r'password',
            r'admin',
            r'user',
            r'qwerty',
        ]
        
        for pattern in common_patterns:
            if re.search(pattern, password.lower()):
                errors.append(_('Password contains common patterns that are not allowed.'))
                break
        
        # Check for repeated characters (more than 2 consecutive)
        if re.search(r'(.)\1{2,}', password):
            errors.append(_('Password cannot contain more than 2 consecutive identical characters.'))
        
        if errors:
            raise ValidationError(errors)
    
    def get_help_text(self):
        return _(
            'Your password must contain at least one uppercase letter, '
            'one lowercase letter, one digit, and one special character. '
            'It cannot contain common patterns or more than 2 consecutive identical characters.'
        )
