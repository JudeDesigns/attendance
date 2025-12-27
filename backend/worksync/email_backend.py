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
    
    def open(self):
        """
        Ensure an open connection to the email server. Return whether or not a
        new connection was required (True or False).
        """
        if self.connection:
            # Nothing to do if the connection is already open.
            return False

        # If local_hostname is not specified, socket.getfqdn() gets used.
        # For performance, we use the cached FQDN for local_hostname.
        connection_params = {'local_hostname': self.local_hostname}
        if self.timeout is not None:
            connection_params['timeout'] = self.timeout
        if self.use_ssl:
            connection_params['context'] = self._create_custom_ssl_context()
            
        try:
            self.connection = smtplib.SMTP(self.host, self.port, **connection_params)
            
            # TLS/STARTTLS are mutually exclusive, so only attempt TLS over
            # non-secure connections.
            if not self.use_ssl and self.use_tls:
                # Create custom SSL context for STARTTLS
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
