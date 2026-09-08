"""Auth endpoints (FR-AAA-001)."""
import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt_handler import (create_access_token, create_refresh_token, decode_token)
from app.auth.password import verify_password
from app.auth.rate_limit import login_limiter
from app.database import get_db
from app.models import RefreshToken, User
from app.schemas import LoginRequest, LoginResponse, RefreshRequest, RefreshResponse, UserOut
from app.utils.audit import write_audit

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

MAX_FAILED = 5
LOCK_MINUTES = 30


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}:{body.username}"
    if not login_limiter.allow(key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail={
            "code": "RATE_LIMITED",
            "message": "Too many login attempts. Account temporarily locked for 30 minutes."})

    user = (await db.execute(select(User).where(User.username == body.username))).scalar_one_or_none()
    if user and user.locked_until:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail={
                "code": "ACCOUNT_LOCKED", "message": "Account locked. Try again later."})

    if user is None or not verify_password(body.password, user.password_hash):
        if user is not None:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)
            await db.commit()
        await write_audit(db, user_id=str(user.id) if user else None, action="LOGIN_FAILED",
                         resource_type="user", resource_id=body.username,
                         ip_address=ip, user_agent=request.headers.get("user-agent"))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "code": "INVALID_CREDENTIALS", "message": "Invalid username or password"})

    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)

    access, expires_in = create_access_token(str(user.id), user.role, user.scope_type, user.scope_value)
    refresh, jti, exp = create_refresh_token(str(user.id))
    db.add(RefreshToken(id=uuid.uuid4(), jti=jti, user_id=user.id, expires_at=exp))
    await db.commit()

    await write_audit(db, user_id=str(user.id), action="LOGIN_SUCCESS",
                      resource_type="user", resource_id=user.username,
                      ip_address=ip, user_agent=request.headers.get("user-agent"))

    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        secure=True,
        samesite="lax",
    )

    return LoginResponse(
        access_token=access, refresh_token=refresh, expires_in=expires_in,
        user=UserOut(id=str(user.id), username=user.username, full_name=user.full_name,
                     role=user.role, scope_type=user.scope_type, scope_value=user.scope_value),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(request: Request, response: Response, body: dict | None = None, db: AsyncSession = Depends(get_db)):
    refresh_tok = request.cookies.get("refresh_token")
    if not refresh_tok and body and "refresh_token" in body:
        refresh_tok = body["refresh_token"]
    if not refresh_tok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "code": "AUTH_REQUIRED", "message": "Refresh token missing"})

    try:
        payload = decode_token(refresh_tok, expected_type="refresh")
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "code": "AUTH_REQUIRED", "message": "Invalid refresh token"})

    stored = (await db.execute(select(RefreshToken).where(RefreshToken.jti == payload["jti"]))).scalar_one_or_none()
    if stored is None or stored.revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "code": "AUTH_REQUIRED", "message": "Refresh token revoked"})
    try:
        uid = uuid.UUID(str(payload["sub"]))
    except (ValueError, TypeError):
        uid = payload["sub"]
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={
            "code": "AUTH_REQUIRED", "message": "User not found"})

    # token rotation: revoke old, issue new
    stored.revoked = True
    access, expires_in = create_access_token(str(user.id), user.role, user.scope_type, user.scope_value)
    refresh_new, jti, exp = create_refresh_token(str(user.id))
    db.add(RefreshToken(id=uuid.uuid4(), jti=jti, user_id=user.id, expires_at=exp))
    await db.commit()

    response.set_cookie(
        key="refresh_token",
        value=refresh_new,
        httponly=True,
        secure=True,
        samesite="lax",
    )

    return RefreshResponse(access_token=access, expires_in=expires_in)


@router.post("/logout")
async def logout(request: Request, response: Response, body: dict | None = None, db: AsyncSession = Depends(get_db)):
    refresh_tok = request.cookies.get("refresh_token")
    if not refresh_tok and body and isinstance(body, dict) and "refresh_token" in body:
        refresh_tok = body["refresh_token"]
    if not refresh_tok:
        refresh_tok = request.headers.get("Authorization", "").replace("Bearer ", "")
    try:
        payload = decode_token(refresh_tok, expected_type="refresh")
        stored = (await db.execute(select(RefreshToken).where(RefreshToken.jti == payload["jti"]))).scalar_one_or_none()
        if stored:
            stored.revoked = True
            await db.commit()
    except Exception:
        pass
    
    response.delete_cookie("refresh_token")
    return {"status": "ok"}


from app.auth.rbac import get_current_user


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return UserOut(id=str(user.id), username=user.username, full_name=user.full_name,
                   role=user.role, scope_type=user.scope_type, scope_value=user.scope_value)
