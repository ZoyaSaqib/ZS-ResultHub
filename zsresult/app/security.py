
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError

from app.config import settings

ALGORITHM = "HS256"


# Secure password hashing using Python's built-in scrypt
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)

    password_hash = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=2**14,
        r=8,
        p=1,
        dklen=64
    )

    return f"scrypt${salt.hex()}${password_hash.hex()}"


# Verify password
def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:
    try:
        algorithm, salt_hex, hash_hex = hashed_password.split("$")

        if algorithm != "scrypt":
            return False

        salt = bytes.fromhex(salt_hex)
        expected_hash = bytes.fromhex(hash_hex)

        actual_hash = hashlib.scrypt(
            plain_password.encode("utf-8"),
            salt=salt,
            n=2**14,
            r=8,
            p=1,
            dklen=64
        )

        return hmac.compare_digest(
            actual_hash,
            expected_hash
        )

    except (ValueError, TypeError):
        return False


# Create login token
def create_access_token(subject: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_minutes
    )

    payload = {
        "sub": subject,
        "exp": expires
    }

    return jwt.encode(
        payload,
        settings.secret_key,
        algorithm=ALGORITHM
    )


# Decode login token
def decode_access_token(token: str):
    try:
        return jwt.decode(
            token,
            settings.secret_key,
            algorithms=[ALGORITHM]
        )
    except JWTError:
        return None
