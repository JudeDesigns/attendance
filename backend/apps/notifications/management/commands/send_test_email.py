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
            # Use Django settings directly instead of EmailConfiguration
            from django.conf import settings

            self.stdout.write("DEBUG: Using Django settings directly")
            self.stdout.write(f"DEBUG: Host: {settings.EMAIL_HOST}")
            self.stdout.write(f"DEBUG: User: {settings.EMAIL_HOST_USER}")
            self.stdout.write(f"DEBUG: Password length: {len(settings.EMAIL_HOST_PASSWORD)}")

            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE

            msg = MIMEMultipart()
            msg['From'] = settings.DEFAULT_FROM_EMAIL
            msg['To'] = options['recipient']
            msg['Subject'] = 'Attendance Email Test'

            body = 'This is a test email from Attendance to verify your configuration.'
            msg.attach(MIMEText(body, 'plain'))

            self.stdout.write("DEBUG: About to connect to SMTP...")
            server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT)
            self.stdout.write("DEBUG: SMTP connection established")

            server.starttls(context=context)
            self.stdout.write("DEBUG: STARTTLS completed")

            server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
            self.stdout.write("DEBUG: Login successful")

            server.send_message(msg)
            server.quit()

            self.stdout.write(self.style.SUCCESS('Email sent successfully!'))
            return "SUCCESS"

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed: {str(e)}'))
            return f"ERROR: {str(e)}"
