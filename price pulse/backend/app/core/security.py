from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def _parse_expires_in(value: str) -> timedelta:
    text = value.strip().lower()
    if text.endswith("d"):
        return timedelta(days=int(text[:-1]))
    if text.endswith("h"):
        return timedelta(hours=int(text[:-1]))
    if text.endswith("m"):
        return timedelta(minutes=int(text[:-1]))
    return timedelta(days=7)


def create_access_token(user_id: str, email: str) -> str:
    expires_delta = _parse_expires_in(settings.jwt_expires_in)
    expire_at = datetime.now(timezone.utc) + expires_delta
    payload = {
        "userId": user_id,
        "email": email,
        "exp": expire_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
