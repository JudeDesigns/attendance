from apps.notifications.models import EmailConfiguration
from django.conf import settings
import os

# Credentials provided by user
MAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USER = 'infobrfood@gmail.com'
EMAIL_PASS = 'ykthrhugoqeuetgp'
EMAIL_FROM = 'infobrfood@gmail.com'

# Create or update the configuration
config, created = EmailConfiguration.objects.get_or_create(
    email_host=MAIL_HOST,
    defaults={
        'email_backend': 'django.core.mail.backends.smtp.EmailBackend',
        'email_port': EMAIL_PORT,
        'email_use_tls': True,
        'email_host_user': EMAIL_USER,
        'email_host_password': EMAIL_PASS,
        'default_from_email': EMAIL_FROM,
        'is_active': True
    }
)

if not created:
    config.email_backend = 'django.core.mail.backends.smtp.EmailBackend'
    config.email_port = EMAIL_PORT
    config.email_use_tls = True
    config.email_host_user = EMAIL_USER
    config.email_host_password = EMAIL_PASS
    config.default_from_email = EMAIL_FROM
    config.is_active = True
    config.save()

print(f"Email configuration {'created' if created else 'updated'} successfully.")
