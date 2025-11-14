"""
Monitoring Test Endpoints
ONLY FOR TESTING - Remove after verification
"""
from fastapi import APIRouter, HTTPException
from services.telegram_notifier import send_alert

router = APIRouter(prefix="/api/test", tags=["monitoring-test"])


@router.get("/error-500")
async def test_500_error():
    """Trigger 500 error to test Sentry + Telegram"""
    # This will be caught by global exception handler
    raise Exception("Test error for monitoring - this is intentional!")


@router.get("/telegram-alert")
async def test_telegram():
    """Send test alert to Telegram"""
    success = send_alert(
        title="Test Alert",
        message="This is a manual test of Telegram notifications",
        severity="INFO",
        endpoint="/api/test/telegram-alert"
    )
    return {"telegram_sent": success}


@router.get("/sentry-error")
async def test_sentry():
    """Test Sentry error tracking"""
    try:
        # Intentional error
        result = 1 / 0
    except ZeroDivisionError as e:
        # This will be captured by Sentry
        raise HTTPException(
            status_code=500,
            detail=f"Division by zero test: {str(e)}"
        )
