"""Security helpers: bcrypt password hashing and JWT token management."""

import datetime as dt
from typing import Optional

import bcrypt
import jwt
from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db.database import get_db
from ..db.models import Profile


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, remember_me: bool = False) -> str:
    """Create a signed JWT token for the authenticated user."""
    settings = get_settings()
    minutes = (
        settings.remember_token_expire_minutes
        if remember_me
        else settings.access_token_expire_minutes
    )
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + dt.timedelta(minutes=minutes),
        "iss": "cowpro-local",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Decode and verify either a local COW PRO JWT or an optional Supabase JWT."""
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        if settings.supabase_jwt_secret:
            try:
                return jwt.decode(
                    token,
                    settings.supabase_jwt_secret,
                    algorithms=["HS256"],
                    audience="authenticated",
                )
            except jwt.PyJWTError as exc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired authentication token.",
                ) from exc
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    cowpro_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> Profile:
    """Resolve the currently authenticated Profile from Bearer token or cookie."""
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif cowpro_token:
        token = cowpro_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token.",
        )

    user = db.query(Profile).filter(Profile.id == user_id).first()
    if user is None:
        # Support auto-provisioning local shadow profile when authenticated via Supabase JWT
        email = payload.get("email")
        if email and payload.get("iss") != "cowpro-local":
            meta = payload.get("user_metadata") or {}
            user = Profile(
                id=user_id,
                email=email,
                full_name=meta.get("full_name") or email.split("@")[0],
                organization=meta.get("organization"),
                password_hash="!supabase-managed",
                email_verified=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found.",
            )
    return user
