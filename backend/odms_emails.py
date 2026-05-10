"""
FLOWTYM PMS — ODMS reminder email sender.

Exposes POST /api/odms/send-reminder which:
  1. Validates the caller's Supabase JWT (Authorization: Bearer <jwt>).
  2. Looks up the reminder by id using the service-role key.
  3. Enforces hotel-scoping (caller.hotel_id == reminder.hotel_id).
  4. Sends the email via Resend.
  5. Marks the reminder as SENT (status, sent_at).

Secrets required (loaded from /app/backend/.env):
  - RESEND_API_KEY
  - SENDER_EMAIL (e.g. "onboarding@resend.dev")
  - SENDER_NAME  (display name)
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

import httpx
import resend
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

logger = logging.getLogger("odms.emails")

router = APIRouter(prefix="/api/odms", tags=["odms"])


# ------------------------- helpers -------------------------

def _require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return val


async def _verify_supabase_jwt(authorization: str | None) -> dict[str, Any]:
    """Validate a Supabase auth JWT via the auth.getUser REST endpoint."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    supabase_url = _require_env("SUPABASE_URL")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": _require_env("SUPABASE_SERVICE_ROLE_KEY"),
            },
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    return resp.json()


async def _fetch_user_hotel_id(auth_user_id: str) -> str | None:
    """Look up public.users.hotel_id for the given auth_id."""
    supabase_url = _require_env("SUPABASE_URL")
    service_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{supabase_url}/rest/v1/users",
            params={"auth_id": f"eq.{auth_user_id}", "select": "hotel_id"},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Accept": "application/json",
            },
        )
    if resp.status_code != 200:
        return None
    rows = resp.json()
    return rows[0]["hotel_id"] if rows else None


async def _fetch_reminder(reminder_id: str) -> dict[str, Any] | None:
    supabase_url = _require_env("SUPABASE_URL")
    service_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{supabase_url}/rest/v1/ota_dispute_reminders",
            params={"id": f"eq.{reminder_id}", "select": "*"},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Accept": "application/json",
            },
        )
    if resp.status_code != 200:
        return None
    rows = resp.json()
    return rows[0] if rows else None


async def _update_reminder_sent(reminder_id: str, provider_message_id: str | None) -> None:
    supabase_url = _require_env("SUPABASE_URL")
    service_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    payload: dict[str, Any] = {"status": "SENT"}
    # Postgres ISO-8601 with tz; relying on default now() on DB side requires a SQL RPC,
    # so we send the timestamp explicitly.
    from datetime import datetime, timezone

    payload["sent_at"] = datetime.now(timezone.utc).isoformat()
    if provider_message_id:
        # store the provider message id inside email_payload.provider_id (jsonb merge)
        # PostgREST does not natively merge jsonb; we just overwrite by fetching then patching.
        pass
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.patch(
            f"{supabase_url}/rest/v1/ota_dispute_reminders",
            params={"id": f"eq.{reminder_id}"},
            headers={
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            json=payload,
        )
    if resp.status_code not in (200, 204):
        logger.warning("Failed to mark reminder %s as SENT: %s %s", reminder_id, resp.status_code, resp.text)


# ------------------------- request models -------------------------

class SendReminderRequest(BaseModel):
    reminder_id: str = Field(..., min_length=1)
    # Optional override of the recipient (otherwise read from email_payload.to[])
    override_to: list[str] | None = None


class SendReminderResponse(BaseModel):
    status: str
    reminder_id: str
    provider_message_id: str | None = None
    recipients: list[str]


# ------------------------- dependency -------------------------

async def auth_dep(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = await _verify_supabase_jwt(authorization)
    hotel_id = await _fetch_user_hotel_id(user.get("id", ""))
    if not hotel_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User has no linked hotel")
    return {"user": user, "hotel_id": hotel_id}


# ------------------------- route -------------------------

@router.post("/send-reminder", response_model=SendReminderResponse)
async def send_reminder(req: SendReminderRequest, ctx: dict[str, Any] = Depends(auth_dep)) -> SendReminderResponse:
    reminder = await _fetch_reminder(req.reminder_id)
    if not reminder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reminder not found")
    if reminder.get("hotel_id") != ctx["hotel_id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-hotel access denied")
    if reminder.get("status") == "SENT":
        # Idempotent — return success without re-sending
        return SendReminderResponse(
            status="already_sent",
            reminder_id=req.reminder_id,
            provider_message_id=None,
            recipients=(req.override_to or []),
        )

    payload = reminder.get("email_payload") or {}
    subject: str = payload.get("subject") or "Relance dispute OTA"
    html_body: str = payload.get("html") or payload.get("body_html") or payload.get("body_text") or ""
    text_body: str | None = payload.get("body_text")
    recipients_raw = req.override_to or payload.get("to") or payload.get("recipients") or []
    if isinstance(recipients_raw, str):
        recipients = [recipients_raw]
    else:
        recipients = list(recipients_raw)
    if not recipients:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No recipients provided")

    sender_email = _require_env("SENDER_EMAIL")
    sender_name = os.environ.get("SENDER_NAME", "FLOWTYM ODMS")
    resend.api_key = _require_env("RESEND_API_KEY")

    params: dict[str, Any] = {
        "from": f"{sender_name} <{sender_email}>",
        "to": recipients,
        "subject": subject,
        "html": html_body if html_body else f"<pre>{(text_body or '').strip()}</pre>",
    }
    if text_body:
        params["text"] = text_body

    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Resend send failed for reminder %s", req.reminder_id)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Resend error: {exc}") from exc

    provider_id = (email or {}).get("id") if isinstance(email, dict) else None
    await _update_reminder_sent(req.reminder_id, provider_id)
    return SendReminderResponse(
        status="sent",
        reminder_id=req.reminder_id,
        provider_message_id=provider_id,
        recipients=recipients,
    )
