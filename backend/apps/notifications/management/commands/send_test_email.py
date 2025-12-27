from django.core.management.base import BaseCommand
import ssl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from apps.notifications.models import EmailConfiguration

class Command(BaseCommand):
    help = 'Send test email using direct SMTP'

    def add_arguments(self, parser):
        parser.add_argument('recipient', type=str, help='Recipient email address')

    def handle(self, *args, **options):
        try:
            config = EmailConfiguration.objects.filter(is_active=True).first()
            
            # Debug: Print what credentials we're actually using
            self.stdout.write(f"DEBUG: Config ID: {config.id}")
            self.stdout.write(f"DEBUG: Host: {config.email_host}")
            self.stdout.write(f"DEBUG: User: {config.email_host_user}")
            self.stdout.write(f"DEBUG: Password length: {len(config.email_host_password)}")
            self.stdout.write(f"DEBUG: Password first 5 chars: {config.email_host_password[:5]}")
            
            # Also check Django settings for comparison
            from django.conf import settings
            self.stdout.write(f"DEBUG: Django settings user: {settings.EMAIL_HOST_USER}")
            self.stdout.write(f"DEBUG: Django settings password length: {len(settings.EMAIL_HOST_PASSWORD)}")
            self.stdout.write(f"DEBUG: Passwords match: {config.email_host_password == settings.EMAIL_HOST_PASSWORD}")
            
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            msg = MIMEMultipart()
            msg['From'] = config.default_from_email
            msg['To'] = options['recipient']
            msg['Subject'] = 'Attendance Email Test'
            
            body = 'This is a test email from Attendance to verify your configuration.'
            msg.attach(MIMEText(body, 'plain'))
            
            self.stdout.write("DEBUG: About to connect to SMTP...")
            server = smtplib.SMTP(config.email_host, config.email_port)
            self.stdout.write("DEBUG: SMTP connection established")
            
            server.starttls(context=context)
            self.stdout.write("DEBUG: STARTTLS completed")
            
            server.login(config.email_host_user, config.email_host_password)
            self.stdout.write("DEBUG: Login successful")
            
            server.send_message(msg)
            server.quit()
            
            self.stdout.write(self.style.SUCCESS('Email sent successfully!'))
            return "SUCCESS"
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed: {str(e)}'))
            return f"ERROR: {str(e)}"
