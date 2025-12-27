"""
VAPID (Voluntary Application Server Identification) helper for Web Push
This module provides VAPID signing functionality using cryptography directly,
bypassing the broken py-vapid library compatibility issues.
"""
import base64
import json
import time
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
from urllib.parse import urlparse


def base64url_encode(data):
    """Encode data as base64url without padding"""
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')


def base64url_decode(data):
    """Decode base64url data, adding padding if necessary"""
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += '=' * padding
    return base64.urlsafe_b64decode(data)


class VapidHelper:
    """Helper class for VAPID signing"""
    
    def __init__(self, private_key_pem, claims=None):
        """
        Initialize VAPID helper with private key
        
        Args:
            private_key_pem: PEM-encoded private key string
            claims: Optional dict of VAPID claims (e.g., {"sub": "mailto:admin@example.com"})
        """
        self.private_key = serialization.load_pem_private_key(
            private_key_pem.strip().encode('utf-8'),
            password=None,
            backend=default_backend()
        )
        self.public_key = self.private_key.public_key()
        self.claims = claims or {}
    
    def get_public_key_bytes(self):
        """Get public key as uncompressed point bytes"""
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint
        )
    
    def sign_request(self, endpoint, claims=None):
        """
        Sign a push request with VAPID
        
        Args:
            endpoint: Push service endpoint URL
            claims: Optional additional claims to merge with default claims
            
        Returns:
            dict: Headers to add to the push request
        """
        # Merge claims
        all_claims = {**self.claims}
        if claims:
            all_claims.update(claims)
        
        # Extract audience from endpoint
        parsed = urlparse(endpoint)
        audience = f"{parsed.scheme}://{parsed.netloc}"
        
        # Build JWT claims
        jwt_claims = {
            "aud": audience,
            "exp": int(time.time()) + 43200,  # 12 hours
        }
        jwt_claims.update(all_claims)
        
        # Build JWT header
        jwt_header = {
            "typ": "JWT",
            "alg": "ES256"
        }
        
        # Encode header and claims
        header_b64 = base64url_encode(json.dumps(jwt_header).encode('utf-8'))
        claims_b64 = base64url_encode(json.dumps(jwt_claims).encode('utf-8'))
        
        # Create signature
        message = f"{header_b64}.{claims_b64}".encode('utf-8')
        der_signature = self.private_key.sign(
            message,
            ec.ECDSA(hashes.SHA256())
        )
        
        # Convert DER signature to raw R+S format (required for VAPID)
        # DER signature is ASN.1 encoded, we need to extract R and S values
        from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
        r, s = decode_dss_signature(der_signature)
        
        # Convert R and S to 32-byte big-endian format (ES256 uses P-256 curve)
        r_bytes = r.to_bytes(32, byteorder='big')
        s_bytes = s.to_bytes(32, byteorder='big')
        raw_signature = r_bytes + s_bytes
        
        signature_b64 = base64url_encode(raw_signature)
        
        # Build JWT
        jwt = f"{header_b64}.{claims_b64}.{signature_b64}"
        
        # Get public key for Crypto-Key header
        public_key_bytes = self.get_public_key_bytes()
        public_key_b64 = base64url_encode(public_key_bytes)
        
        return {
            "Authorization": f"vapid t={jwt}, k={public_key_b64}",
            "Crypto-Key": f"p256ecdsa={public_key_b64}"
        }
