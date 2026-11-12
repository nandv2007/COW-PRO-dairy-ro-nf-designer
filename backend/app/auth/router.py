"""Authentication & User Account API Routes (Section 4)."""

import secrets
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field, model_validator
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db.database import get_db
from ..db.models import Profile
from .security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    organization: Optional[str] = Field(default=None, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Password and confirm password do not match.")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    remember_me: bool = False


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirm password do not match.")
        return self


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    organization: Optional[str] = Field(default=None, max_length=255)
    preferred_units: Optional[Dict[str, str]] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirm password do not match.")
        return self


def _serialize_user(user: Profile) -> Dict[str, Any]:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "organization": user.organization,
        "preferred_units": user.preferred_units,
        "email_verified": user.email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new engineer account and generate an email verification token."""
    normalized_email = payload.email.strip().lower()
    existing = db.query(Profile).filter(Profile.email == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    verification_token = secrets.token_urlsafe(24)
    user = Profile(
        full_name=payload.full_name.strip(),
        email=normalized_email,
        organization=payload.organization.strip() if payload.organization else None,
        password_hash=hash_password(payload.password),
        email_verified=False,
        verification_token=verification_token,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    settings = get_settings()
    response: Dict[str, Any] = {
        "message": "Account created. Please verify your email address before signing in.",
        "user": _serialize_user(user),
    }
    if settings.expose_dev_tokens or settings.environment != "production":
        response["verification_token"] = verification_token
    return response


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Verify a user's email address using the issued verification token."""
    user = db.query(Profile).filter(Profile.verification_token == payload.token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired email verification token.",
        )
    user.email_verified = True
    user.verification_token = None
    db.commit()
    return {"message": "Email verified successfully. You may now sign in.", "email": user.email}


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate an engineer and set an HTTP-only session cookie + Bearer token."""
    normalized_email = payload.email.strip().lower()
    user = db.query(Profile).filter(Profile.email == normalized_email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email address or password.",
        )
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address not verified. Please complete email verification first.",
        )

    token = create_access_token(user.id, user.email, remember_me=payload.remember_me)
    settings = get_settings()
    max_age = (
        settings.remember_token_expire_minutes * 60
        if payload.remember_me
        else settings.access_token_expire_minutes * 60
    )
    response.set_cookie(
        key="cowpro_token",
        value=token,
        httponly=True,
        samesite="none" if settings.environment == "production" else "lax",
        secure=settings.environment == "production",
        max_age=max_age,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "remember_me": payload.remember_me,
        "user": _serialize_user(user),
    }


@router.post("/logout")
def logout(response: Response):
    """Clear the active authentication cookie."""
    response.delete_cookie("cowpro_token")
    return {"message": "Signed out successfully."}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Initiate a password reset by creating a secure one-time reset token."""
    normalized_email = payload.email.strip().lower()
    user = db.query(Profile).filter(Profile.email == normalized_email).first()
    settings = get_settings()

    if not user:
        return {"message": "If an account exists for that email, reset instructions have been issued."}

    reset_token = secrets.token_urlsafe(24)
    user.reset_token = reset_token
    db.commit()

    resp: Dict[str, Any] = {
        "message": "If an account exists for that email, reset instructions have been issued."
    }
    if settings.expose_dev_tokens or settings.environment != "production":
        resp["reset_token"] = reset_token
    return resp


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Complete a password reset using a valid reset token."""
    user = db.query(Profile).filter(Profile.reset_token == payload.token).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )
    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    db.commit()
    return {"message": "Password updated successfully. You may now sign in."}


@router.get("/me")
def get_me(current_user: Profile = Depends(get_current_user)):
    """Return the authenticated user's profile and unit preferences."""
    return {"user": _serialize_user(current_user)}


@router.patch("/me")
def update_me(
    payload: UpdateProfileRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update profile fields and preferred engineering units."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.organization is not None:
        current_user.organization = payload.organization.strip() or None
    if payload.preferred_units is not None:
        merged = dict(current_user.preferred_units or {})
        merged.update(payload.preferred_units)
        current_user.preferred_units = merged
    db.commit()
    db.refresh(current_user)
    return {"user": _serialize_user(current_user)}


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the password for the authenticated user."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully."}
