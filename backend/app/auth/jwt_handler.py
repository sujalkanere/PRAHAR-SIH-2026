"""JWT handling — RS256 signed tokens (FR-AAA-001, NFR-SEC-003)."""
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.config import get_settings

settings = get_settings()

ALGORITHM = "RS256"


def _ensure_keys() -> tuple[str, str]:
    priv_path = Path(settings.jwt_private_key_path)
    pub_path = Path(settings.jwt_public_key_path)
    if not priv_path.exists() or not pub_path.exists():
        priv_path.parent.mkdir(parents=True, exist_ok=True)
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        priv_pem = key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        pub_pem = key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        priv_path.write_bytes(priv_pem)
        pub_path.write_bytes(pub_pem)
    return priv_path.read_text(), pub_path.read_text()


_PRIVATE_KEY, _PUBLIC_KEY = _ensure_keys()


def create_access_token(user_id: str, role: str, scope_type: str | None, scope_value: str | None) -> tuple[str, int]:
    """Returns (token, expires_in_seconds)."""
    now = datetime.now(timezone.utc)
    expires_in = settings.access_token_expiry_minutes * 60
    payload = {
        "sub": str(user_id),
        "role": role,
        "scope_type": scope_type,
        "scope_value": scope_value,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, _PRIVATE_KEY, algorithm=ALGORITHM)
    return token, expires_in


def create_refresh_token(user_id: str) -> tuple[str, str, datetime]:
    """Returns (token, jti, expiry)."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=settings.refresh_token_expiry_days)
    jti = str(uuid.uuid4())
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": jti,
        "iat": now,
        "exp": expires,
    }
    token = jwt.encode(payload, _PRIVATE_KEY, algorithm=ALGORITHM)
    return token, jti, expires


def decode_token(token: str, expected_type: str | None = None) -> dict:
    """Raises jwt.PyJWTError on invalid/expired tokens."""
    payload = jwt.decode(token, _PUBLIC_KEY, algorithms=[ALGORITHM])
    if expected_type and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected token type {expected_type}")
    return payload
