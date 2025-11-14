"""
Webhook Endpoints
Handles incoming webhooks from external services (Sentry, etc.)
"""
from fastapi import APIRouter, Request, Header
from typing import Optional
import hashlib
import hmac
from services.telegram_notifier import send_alert

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/sentry")
async def sentry_webhook(
    request: Request,
    sentry_hook_resource: Optional[str] = Header(None)
):
    """
    Sentry webhook handler
    Receives error events from Sentry and forwards to Telegram

    Configure in Sentry:
    1. Project Settings → Webhooks
    2. Add webhook: https://kvota-production.up.railway.app/api/webhooks/sentry
    3. Enable: error.created
    """
    try:
        payload = await request.json()

        # Extract error details from Sentry payload
        event_type = payload.get("action", "unknown")
        data = payload.get("data", {})
        issue = data.get("issue", {})
        event = data.get("event", {})

        # Only process error.created events
        if event_type != "created":
            return {"status": "ignored", "reason": "not error.created event"}

        # Extract error info
        error_title = issue.get("title", "Unknown error")
        error_type = issue.get("type", "error")
        culprit = issue.get("culprit", "Unknown location")
        platform = issue.get("platform", "unknown")
        project_name = issue.get("project", {}).get("name", "unknown")

        # Get error message and stack trace (if available)
        exception = event.get("exception", {}).get("values", [{}])[0]
        error_message = exception.get("value", "No message")
        stacktrace = exception.get("stacktrace", {})
        frames = stacktrace.get("frames", [])

        # Get last frame (where error occurred)
        last_frame = frames[-1] if frames else {}
        filename = last_frame.get("filename", "Unknown file")
        lineno = last_frame.get("lineno", "?")
        function = last_frame.get("function", "?")

        # Get user context (if available)
        user = event.get("user", {})
        user_email = user.get("email", "Unknown")

        # Get URL where error occurred
        request_data = event.get("request", {})
        url = request_data.get("url", "Unknown URL")

        # Build Telegram message
        severity = "ERROR" if error_type == "error" else "WARNING"

        message = f"Project: {project_name}\n"
        message += f"Error: {error_message}\n\n"
        message += f"Location: {filename}:{lineno}\n"
        message += f"Function: {function}\n"
        message += f"URL: {url}\n"

        # Send to Telegram
        send_alert(
            title=f"Frontend Error: {error_title[:50]}",
            message=message,
            severity=severity,
            user_email=user_email if user_email != "Unknown" else None
        )

        return {"status": "success", "telegram_sent": True}

    except Exception as e:
        # Don't fail webhook if Telegram fails
        print(f"Sentry webhook error: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/health")
async def webhook_health():
    """Health check for webhook endpoint"""
    return {"status": "ok", "webhook": "ready"}
