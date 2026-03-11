from __future__ import annotations

import secrets
import uuid
from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decrypt_field,
    encrypt_field,
    hash_password,
    store_refresh_token,
)
from app.models.sso import SSOProvider, SSOUserMapping
from app.models.user import User


class SSOService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_provider(self, provider_id: uuid.UUID) -> SSOProvider:
        result = await self.db.execute(
            select(SSOProvider).where(SSOProvider.id == provider_id)
        )
        provider = result.scalar_one_or_none()
        if provider is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SSO provider not found")
        return provider

    def generate_auth_url(self, provider: SSOProvider, state: str | None = None) -> str:
        """Build the OAuth2 authorization URL for the given provider."""
        if state is None:
            state = secrets.token_urlsafe(32)

        params = {
            "client_id": provider.client_id,
            "redirect_uri": provider.redirect_uri,
            "response_type": "code",
            "scope": provider.scopes,
            "state": state,
        }

        # Provider-specific extras
        if provider.provider_type.value == "google":
            params["access_type"] = "offline"
            params["prompt"] = "select_account"

        return f"{provider.authorization_url}?{urlencode(params)}"

    async def exchange_code(self, provider: SSOProvider, code: str) -> dict[str, Any]:
        """Exchange authorization code for tokens and fetch user info."""
        client_secret = decrypt_field(provider.client_secret)

        token_payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": provider.redirect_uri,
            "client_id": provider.client_id,
            "client_secret": client_secret,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            # Exchange code for tokens
            token_resp = await client.post(
                provider.token_url,
                data=token_payload,
                headers={"Accept": "application/json"},
            )
            if token_resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to exchange authorization code: {token_resp.text}",
                )

            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No access token in provider response",
                )

            # Fetch user info
            userinfo_resp = await client.get(
                provider.userinfo_url,
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            if userinfo_resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to fetch user info from provider",
                )

            return userinfo_resp.json()

    async def get_or_create_user(
        self,
        provider: SSOProvider,
        userinfo: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Find or create a local user based on SSO user info.
        Returns JWT tokens.
        """
        # Extract external ID and email based on provider type
        external_id = (
            userinfo.get("sub")
            or userinfo.get("id")
            or str(userinfo.get("login", ""))
        )
        external_email = (
            userinfo.get("email")
            or userinfo.get("mail")
            or ""
        )
        full_name = (
            userinfo.get("name")
            or userinfo.get("displayName")
            or userinfo.get("login")
            or external_email.split("@")[0]
        )

        if not external_id or not external_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract user ID or email from provider response",
            )

        # Check if SSO mapping exists
        result = await self.db.execute(
            select(SSOUserMapping).where(
                SSOUserMapping.provider_id == provider.id,
                SSOUserMapping.external_id == str(external_id),
            )
        )
        mapping = result.scalar_one_or_none()

        if mapping:
            # Existing user — fetch them
            user_result = await self.db.execute(
                select(User).where(User.id == mapping.user_id)
            )
            user = user_result.scalar_one_or_none()
            if not user or not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is inactive",
                )
        else:
            # Check if a local user with this email exists
            user_result = await self.db.execute(
                select(User).where(User.email == external_email)
            )
            user = user_result.scalar_one_or_none()

            if not user:
                # Create new user
                user = User(
                    email=external_email,
                    full_name=full_name,
                    hashed_password=hash_password(secrets.token_urlsafe(32)),
                    is_superadmin=False,
                    is_active=True,
                )
                self.db.add(user)
                await self.db.flush()
                await self.db.refresh(user)

            # Create SSO mapping
            sso_mapping = SSOUserMapping(
                user_id=user.id,
                provider_id=provider.id,
                external_id=str(external_id),
                external_email=external_email,
            )
            self.db.add(sso_mapping)
            await self.db.flush()

        # Generate JWT tokens
        access_token = create_access_token(
            subject=str(user.id),
            email=user.email,
            is_superadmin=user.is_superadmin,
        )
        refresh_token = create_refresh_token(subject=str(user.id))
        await store_refresh_token(str(user.id), refresh_token)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "is_superadmin": user.is_superadmin,
            },
        }
