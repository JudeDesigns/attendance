import socket
import ssl
import smtplib
import sys
import pprint

def get_cert_info(host, port):
    print(f"\n--- Checking Certificate for {host}:{port} ---")
    try:
        context = ssl.create_default_context()
        # Disable hostname check just to get the cert even if it fails
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        
        with socket.create_connection((host, port), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=host) as ssock:
                cert = ssock.getpeercert(binary_form=True)
                # Re-wrap to get decoded cert
                decoded_cert = ssl.DER_cert_to_PEM_cert(cert)
                
                # Get more details with verification enabled but caught
                try:
                    context_verify = ssl.create_default_context()
                    with socket.create_connection((host, port), timeout=10) as sock2:
                        with context_verify.wrap_socket(sock2, server_hostname=host) as ssock2:
                            print("Success: Standard SSL verification passed!")
                except ssl.SSLCertVerificationError as e:
                    print(f"SSL Verification Error (Expected if mismatch): {e}")
                except Exception as e:
                    print(f"Other SSL Error: {e}")

                # Use OpenSSL-like output for the cert
                print("\nCertificate presented by the server:")
                # We can't easily parse full details without 'cryptography' or 'pyOpenSSL'
                # but we can see the binary data or use smtplib's starttls behavior
                return True
    except Exception as e:
        print(f"Could not connect to {port}: {e}")
        return False

def test_smtp_starttls(host, port=587):
    print(f"\n--- Testing SMTP STARTTLS on {host}:{port} ---")
    try:
        print(f"Resolving {host}...")
        ip = socket.gethostbyname(host)
        print(f"IP address: {ip}")

        server = smtplib.SMTP(host, port, timeout=10)
        server.set_debuglevel(1)
        print("Connecting...")
        server.ehlo()
        
        if server.has_ext('STARTTLS'):
            print("Server supports STARTTLS. Attempting...")
            try:
                context = ssl.create_default_context()
                server.starttls(context=context)
                print("STARTTLS Success!")
            except ssl.SSLCertVerificationError as e:
                print(f"\n!!! SSL VERIFICATION FAILED: {e}")
                print("This confirms the mismatch is happening during the STARTTLS handshake.")
            except Exception as e:
                print(f"STARTTLS failed with: {e}")
        else:
            print("Server does NOT support STARTTLS on this port.")
        
        server.quit()
    except Exception as e:
        print(f"SMTP connection error: {e}")

def main():
    target_host = "smtp.gmail.com"
    
    print("WorkSync SMTP Diagnostic Tool")
    print("=============================")
    
    # 1. DNS check
    test_smtp_starttls(target_host, 587)
    
    # 2. Check Port 465 (Implicit SSL)
    print("\n--- Testing SMTP SSL on port 465 ---")
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(target_host, 465, context=context, timeout=10) as server:
            server.set_debuglevel(1)
            server.ehlo()
            print("SMTP SSL on 465 Success!")
    except Exception as e:
        print(f"SMTP SSL on 465 failed: {e}")

if __name__ == "__main__":
    main()
