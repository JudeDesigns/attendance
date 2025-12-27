"""
Management command to process the email queue
This runs via cron and sends all queued emails using the shell method that works
"""
from django.core.management.base import BaseCommand
import os
import json
import glob
import ssl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings

class Command(BaseCommand):
    help = 'Process queued emails and send them via SMTP'

    def handle(self, *args, **options):
        queue_dir = '/var/www/attendance/backend/email_queue'
        
        if not os.path.exists(queue_dir):
            self.stdout.write("No email queue directory found")
            return
        
        # Get all queued email files
        email_files = glob.glob(os.path.join(queue_dir, '*.json'))
        
        if not email_files:
            self.stdout.write("No emails in queue")
            return
        
        self.stdout.write(f"Processing {len(email_files)} queued emails...")
        
        # Setup SMTP connection (reuse for all emails)
        try:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT)
            server.starttls(context=context)
            server.login(settings.EMAIL_HOST_USER, settings.EMAIL_HOST_PASSWORD)
            
            sent_count = 0
            failed_count = 0
            
            for email_file in email_files:
                try:
                    # Load email data
                    with open(email_file, 'r') as f:
                        email_data = json.load(f)
                    
                    # Create email message
                    msg = MIMEMultipart()
                    msg['From'] = settings.DEFAULT_FROM_EMAIL
                    msg['To'] = email_data['recipient']
                    msg['Subject'] = email_data['subject']
                    
                    # Add message body
                    msg.attach(MIMEText(email_data['message'], 'plain'))
                    
                    # Send email
                    server.send_message(msg)
                    
                    # Remove the file after successful sending (prevents duplicates)
                    os.remove(email_file)
                    
                    sent_count += 1
                    self.stdout.write(f"✓ Sent {email_data['type']} email to {email_data['recipient']}")
                    
                except Exception as e:
                    failed_count += 1
                    self.stdout.write(f"✗ Failed to send {email_file}: {str(e)}")
                    # Don't remove failed files - they'll be retried next time
            
            server.quit()
            
            self.stdout.write(f"\nEmail processing complete:")
            self.stdout.write(f"  Sent: {sent_count}")
            self.stdout.write(f"  Failed: {failed_count}")
            
        except Exception as e:
            self.stdout.write(f"SMTP connection failed: {str(e)}")
            return
