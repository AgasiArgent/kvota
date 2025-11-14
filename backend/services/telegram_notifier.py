"""
Telegram Notification Service
Sends alerts to Telegram when critical errors occur
"""
import os
import requests
from typing import Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
ENABLED = bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)

# Emoji mapping for severity levels
EMOJI_MAP = {
    "ERROR": "🔴",
    "WARNING": "⚠️",
    "INFO": "ℹ️",
    "SUCCESS": "✅",
    "CRITICAL": "🚨"
}


def send_alert(
    title: str,
    message: str,
    severity: str = "ERROR",
    user_email: Optional[str] = None,
    endpoint: Optional[str] = None
) -> bool:
    """
    Send alert notification to Telegram

    Args:
        title: Alert title (e.g., "Quote Calculation Failed")
        message: Error details and context
        severity: ERROR | WARNING | INFO | SUCCESS | CRITICAL
        user_email: Email of affected user (optional)
        endpoint: API endpoint where error occurred (optional)

    Returns:
        bool: True if sent successfully, False otherwise

    Example:
        send_alert(
            title="Database Connection Failed",
            message="Connection pool exhausted",
            severity="CRITICAL",
            endpoint="/api/quotes-calc/calculate"
        )
    """
    if not ENABLED:
        logger.debug("Telegram notifications disabled (no TOKEN or CHAT_ID)")
        return False

    try:
        # Build message with formatting
        emoji = EMOJI_MAP.get(severity, "📢")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        text = f"{emoji} *KVOTA {severity}*\n\n"
        text += f"*{title}*\n\n"
        text += f"{message}\n\n"

        if endpoint:
            text += f"📍 Endpoint: `{endpoint}`\n"

        if user_email:
            text += f"👤 User: {user_email}\n"

        text += f"🕐 Time: {timestamp}"

        # Send to Telegram Bot API
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

        response = requests.post(
            url,
            json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "Markdown"
            },
            timeout=5  # 5 second timeout
        )

        if response.ok:
            logger.info(f"Telegram alert sent: {title}")
            return True
        else:
            logger.error(f"Telegram API error: {response.status_code} - {response.text}")
            return False

    except Exception as e:
        # NEVER crash app if Telegram fails
        logger.error(f"Failed to send Telegram alert: {str(e)}")
        return False


def send_startup_notification():
    """Send notification when backend starts"""
    send_alert(
        title="Backend Started",
        message="KVOTA backend is now running",
        severity="SUCCESS"
    )


def send_daily_summary(stats: dict):
    """
    Send daily statistics summary

    Args:
        stats: Dictionary with daily statistics
            - quotes_created: int
            - total_revenue: float
            - active_users: int
            - errors: int
    """
    message = "📊 *Daily Statistics*\n\n"
    message += f"📝 Quotes created: {stats.get('quotes_created', 0)}\n"
    message += f"💰 Total revenue: ${stats.get('total_revenue', 0):,.2f}\n"
    message += f"👥 Active users: {stats.get('active_users', 0)}\n"
    message += f"❌ Errors: {stats.get('errors', 0)}\n"

    send_alert(
        title="Daily Summary",
        message=message,
        severity="INFO"
    )
