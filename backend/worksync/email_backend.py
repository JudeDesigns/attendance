"""
Custom email backend for AlmaLinux FIPS compatibility
"""
import ssl
import smtplib
from django.core.mail.backends.smtp import EmailBackend


class FIPSCompatibleEmailBackend(EmailBackend):
    """
    Custom SMTP email backend that bypasses FIPS SSL restrictions
    """

    def __init__(self, host=None, port=None, username=None, password=None,
                 use_tls=None, fail_silently=False, use_ssl=None, timeout=None,
                 ssl_keyfile=None, ssl_certfile=None, **kwargs):
        super().__init__(host, port, username, password, use_tls, fail_silently,
                         use_ssl, timeout, ssl_keyfile, ssl_certfile, **kwargs)

    def open(self):
        """
        Override to use custom SSL context
        """
        if self.connection:
            return False

        connection_params = {}
        if self.timeout is not None:
            connection_params['timeout'] = self.timeout
        if self.use_ssl:
            connection_params['context'] = self._create_custom_ssl_context()

        try:
            self.connection = smtplib.SMTP(self.host, self.port, **connection_params)

            if not self.use_ssl and self.use_tls:
                context = self._create_custom_ssl_context()
                self.connection.starttls(context=context)

            if self.username and self.password:
                self.connection.login(self.username, self.password)
            return True
        except OSError:
            if not self.fail_silently:
                raise

    def _create_custom_ssl_context(self):
        """
        Create a custom SSL context that bypasses FIPS restrictions
        """
        context = ssl.create_default_context()
        
        # Disable hostname checking and certificate verification
        # This is necessary for AlmaLinux FIPS environments
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        # Set cipher suite to bypass FIPS restrictions
        # @SECLEVEL=0 allows weaker ciphers that work with Gmail
        try:
            context.set_ciphers('ALL:@SECLEVEL=0')
        except ssl.SSLError:
            # Fallback if SECLEVEL is not supported
            context.set_ciphers('HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA')
        
        return context
