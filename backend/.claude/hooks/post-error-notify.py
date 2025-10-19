#!/usr/bin/env python3
"""
Post-Error-Notify Hook for Russian B2B Quotation System
Handles critical error notifications and monitoring alerts
"""
import os
import sys
import json
import smtplib
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from pathlib import Path
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart


class ErrorNotificationManager:
    """Manages critical error notifications and alerts"""

    def __init__(self):
        self.error_data = self._parse_error_data()
        self.notifications_dir = Path("logs/notifications")
        self.notifications_dir.mkdir(parents=True, exist_ok=True)
        self.error_threshold = 5  # Number of errors before escalation
        self.time_window = 300  # 5 minutes in seconds

    def _parse_error_data(self) -> Optional[Dict[str, Any]]:
        """Parse error data from command line arguments or stdin"""
        try:
            if len(sys.argv) > 1:
                # Data passed as JSON argument
                return json.loads(sys.argv[1])
            else:
                # Data passed via stdin
                return json.load(sys.stdin)
        except (json.JSONDecodeError, IndexError):
            return None

    def print_status(self, message: str, status: str = "info"):
        """Print colored status messages"""
        colors = {
            "success": "\033[0;32m✅",
            "error": "\033[0;31m❌",
            "warning": "\033[1;33m⚠️ ",
            "info": "\033[0;34mℹ️ ",
            "alert": "\033[0;35m🚨",
        }
        print(f"{colors.get(status, colors['info'])} {message}\033[0m")

    def categorize_error(self, error_data: Dict[str, Any]) -> str:
        """Categorize error by severity and type"""
        status_code = error_data.get('status_code', 500)
        error_message = error_data.get('error_message', '').lower()
        endpoint = error_data.get('endpoint', '')

        # Critical errors (immediate attention required)
        if status_code >= 500:
            if 'database' in error_message or 'connection' in error_message:
                return "critical_database"
            elif 'authentication' in error_message or 'auth' in error_message:
                return "critical_auth"
            elif 'payment' in error_message or 'billing' in error_message:
                return "critical_payment"
            else:
                return "critical_server"

        # Business logic errors
        elif '/quotes' in endpoint:
            if 'approval' in error_message:
                return "business_approval"
            elif 'validation' in error_message:
                return "business_validation"
            else:
                return "business_quote"

        # Authentication/authorization errors
        elif status_code in [401, 403]:
            return "security_access"

        # Client errors
        elif 400 <= status_code < 500:
            return "client_error"

        return "unknown"

    def check_error_frequency(self, error_category: str) -> Dict[str, Any]:
        """Check if error frequency exceeds thresholds"""
        now = datetime.now()
        cutoff_time = now - timedelta(seconds=self.time_window)

        # Read recent error logs
        error_log_file = self.notifications_dir / f"error_tracking_{now.strftime('%Y%m%d')}.jsonl"
        recent_errors = []

        if error_log_file.exists():
            with open(error_log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    try:
                        error = json.loads(line)
                        error_time = datetime.fromisoformat(error['timestamp'])
                        if error_time >= cutoff_time and error.get('category') == error_category:
                            recent_errors.append(error)
                    except (json.JSONDecodeError, ValueError, KeyError):
                        continue

        return {
            "count": len(recent_errors),
            "exceeds_threshold": len(recent_errors) >= self.error_threshold,
            "recent_errors": recent_errors[-5:],  # Last 5 errors
            "time_window_minutes": self.time_window // 60
        }

    def log_error_event(self, error_data: Dict[str, Any], category: str) -> bool:
        """Log error event for tracking and analysis"""
        try:
            timestamp = datetime.now()

            error_entry = {
                "timestamp": timestamp.isoformat(),
                "category": category,
                "status_code": error_data.get('status_code'),
                "endpoint": error_data.get('endpoint'),
                "error_message": error_data.get('error_message'),
                "user_id": error_data.get('user_id'),
                "request_id": error_data.get('request_id'),
                "ip_address": error_data.get('ip_address'),
                "user_agent": error_data.get('user_agent'),
                "stack_trace": error_data.get('stack_trace'),
                "environment": os.getenv('ENVIRONMENT', 'unknown'),
                "russian_business_context": {
                    "moscow_time": timestamp.strftime("%Y-%m-%d %H:%M:%S MSK"),
                    "business_hours": 8 <= timestamp.hour <= 20,
                    "business_day": timestamp.weekday() < 5
                }
            }

            # Log to daily error tracking file
            error_log_file = self.notifications_dir / f"error_tracking_{timestamp.strftime('%Y%m%d')}.jsonl"
            with open(error_log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(error_entry, ensure_ascii=False) + '\\n')

            return True

        except Exception as e:
            self.print_status(f"Error logging error event: {str(e)}", "error")
            return False

    def generate_error_notification(self, error_data: Dict[str, Any], category: str, frequency_info: Dict[str, Any]) -> Dict[str, Any]:
        """Generate error notification content"""
        timestamp = datetime.now()

        # Determine notification urgency
        urgency = "high" if category.startswith("critical_") or frequency_info["exceeds_threshold"] else "medium"
        if category == "client_error":
            urgency = "low"

        # Generate subject
        if frequency_info["exceeds_threshold"]:
            subject = f"🚨 URGENT: {frequency_info['count']} {category} errors in {frequency_info['time_window_minutes']} minutes"
        else:
            subject = f"⚠️  Error Alert: {category} - {error_data.get('endpoint', 'Unknown endpoint')}"

        # Generate message body
        body_parts = [
            f"Error Category: {category}",
            f"Timestamp: {timestamp.strftime('%Y-%m-%d %H:%M:%S MSK')}",
            f"Environment: {os.getenv('ENVIRONMENT', 'unknown')}",
            "",
            "Error Details:",
            f"- Status Code: {error_data.get('status_code', 'N/A')}",
            f"- Endpoint: {error_data.get('endpoint', 'N/A')}",
            f"- Error Message: {error_data.get('error_message', 'N/A')}",
            f"- User ID: {error_data.get('user_id', 'N/A')}",
            f"- Request ID: {error_data.get('request_id', 'N/A')}",
            f"- IP Address: {error_data.get('ip_address', 'N/A')}",
            ""
        ]

        if frequency_info["exceeds_threshold"]:
            body_parts.extend([
                f"⚠️  FREQUENCY ALERT: {frequency_info['count']} similar errors in {frequency_info['time_window_minutes']} minutes",
                "",
                "Recent Similar Errors:",
            ])

            for i, recent_error in enumerate(frequency_info["recent_errors"], 1):
                body_parts.append(f"{i}. {recent_error.get('timestamp', 'N/A')} - {recent_error.get('error_message', 'N/A')[:100]}")

            body_parts.append("")

        # Add business context
        if timestamp.hour < 8 or timestamp.hour > 20:
            body_parts.append("⏰ Note: Error occurred outside business hours (08:00-20:00 MSK)")

        if timestamp.weekday() >= 5:
            body_parts.append("📅 Note: Error occurred on weekend")

        # Add Russian business specific context
        if '/quotes' in error_data.get('endpoint', ''):
            body_parts.extend([
                "",
                "🇷🇺 Russian Business Impact:",
                "- This error affects quotation processing",
                "- May impact customer deliveries and approvals",
                "- Check VAT calculations and INN/KPP validations"
            ])

        if 'database' in error_data.get('error_message', '').lower():
            body_parts.extend([
                "",
                "💾 Database Impact:",
                "- Customer data may be affected",
                "- Quote approvals may be delayed",
                "- Check backup systems and replication"
            ])

        # Add stack trace if available
        stack_trace = error_data.get('stack_trace')
        if stack_trace and urgency == "high":
            body_parts.extend([
                "",
                "Stack Trace:",
                stack_trace[:1000] + "..." if len(stack_trace) > 1000 else stack_trace
            ])

        return {
            "urgency": urgency,
            "subject": subject,
            "body": "\\n".join(body_parts),
            "category": category,
            "timestamp": timestamp.isoformat()
        }

    def send_email_notification(self, notification: Dict[str, Any]) -> bool:
        """Send email notification"""
        try:
            # Email configuration from environment
            smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
            smtp_port = int(os.getenv('SMTP_PORT', '587'))
            smtp_username = os.getenv('SMTP_USERNAME')
            smtp_password = os.getenv('SMTP_PASSWORD')
            from_email = os.getenv('FROM_EMAIL', smtp_username)
            to_emails = os.getenv('ERROR_NOTIFICATION_EMAILS', '').split(',')

            if not all([smtp_username, smtp_password, to_emails[0]]):
                self.print_status("Email configuration incomplete - skipping email notification", "warning")
                return False

            # Create email message
            msg = MimeMultipart()
            msg['From'] = from_email
            msg['To'] = ', '.join(to_emails)
            msg['Subject'] = notification['subject']

            # Add body
            msg.attach(MimeText(notification['body'], 'plain', 'utf-8'))

            # Send email
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.starttls()
                server.login(smtp_username, smtp_password)
                server.send_message(msg)

            self.print_status(f"Email notification sent to {len(to_emails)} recipients", "success")
            return True

        except Exception as e:
            self.print_status(f"Failed to send email notification: {str(e)}", "error")
            return False

    def send_slack_notification(self, notification: Dict[str, Any]) -> bool:
        """Send Slack notification"""
        try:
            slack_webhook_url = os.getenv('SLACK_WEBHOOK_URL')
            if not slack_webhook_url:
                return False

            # Determine color based on urgency
            color_map = {
                "high": "#ff0000",   # Red
                "medium": "#ff9900", # Orange
                "low": "#ffff00"     # Yellow
            }

            slack_payload = {
                "text": notification['subject'],
                "attachments": [
                    {
                        "color": color_map.get(notification['urgency'], "#ff9900"),
                        "fields": [
                            {
                                "title": "Category",
                                "value": notification['category'],
                                "short": True
                            },
                            {
                                "title": "Urgency",
                                "value": notification['urgency'].upper(),
                                "short": True
                            },
                            {
                                "title": "Environment",
                                "value": os.getenv('ENVIRONMENT', 'unknown'),
                                "short": True
                            },
                            {
                                "title": "Time",
                                "value": datetime.now().strftime('%Y-%m-%d %H:%M:%S MSK'),
                                "short": True
                            }
                        ],
                        "text": notification['body'][:1000] + "..." if len(notification['body']) > 1000 else notification['body']
                    }
                ]
            }

            response = requests.post(slack_webhook_url, json=slack_payload, timeout=10)
            if response.status_code == 200:
                self.print_status("Slack notification sent successfully", "success")
                return True
            else:
                self.print_status(f"Slack notification failed: {response.status_code}", "error")
                return False

        except Exception as e:
            self.print_status(f"Failed to send Slack notification: {str(e)}", "error")
            return False

    def save_notification_record(self, notification: Dict[str, Any]) -> bool:
        """Save notification record for audit trail"""
        try:
            timestamp = datetime.now()
            notification_file = self.notifications_dir / f"error_notifications_{timestamp.strftime('%Y%m%d')}.jsonl"

            notification_record = {
                "timestamp": timestamp.isoformat(),
                "notification": notification,
                "sent_via": {
                    "email": bool(os.getenv('SMTP_USERNAME')),
                    "slack": bool(os.getenv('SLACK_WEBHOOK_URL'))
                }
            }

            with open(notification_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(notification_record, ensure_ascii=False) + '\\n')

            return True

        except Exception as e:
            self.print_status(f"Error saving notification record: {str(e)}", "error")
            return False

    def process_error_notification(self) -> bool:
        """Main error notification processing function"""
        if not self.error_data:
            self.print_status("No error data provided", "warning")
            return True

        self.print_status("🚨 Processing critical error notification...", "alert")

        # Categorize the error
        error_category = self.categorize_error(self.error_data)
        self.print_status(f"Error categorized as: {error_category}", "info")

        # Log the error event
        self.log_error_event(self.error_data, error_category)

        # Check error frequency
        frequency_info = self.check_error_frequency(error_category)

        # Generate notification
        notification = self.generate_error_notification(self.error_data, error_category, frequency_info)

        # Determine if notification should be sent
        should_notify = (
            error_category.startswith("critical_") or
            frequency_info["exceeds_threshold"] or
            notification["urgency"] == "high"
        )

        if should_notify:
            self.print_status(f"Sending {notification['urgency']} urgency notification", "alert")

            # Send notifications via configured channels
            email_sent = self.send_email_notification(notification)
            slack_sent = self.send_slack_notification(notification)

            if not (email_sent or slack_sent):
                self.print_status("No notification channels configured or available", "warning")

            # Save notification record
            self.save_notification_record(notification)

            if frequency_info["exceeds_threshold"]:
                self.print_status(f"⚠️  ESCALATION: {frequency_info['count']} errors in {frequency_info['time_window_minutes']} minutes", "alert")

        else:
            self.print_status(f"Error logged but notification threshold not met for {error_category}", "info")

        return True


def main():
    """Main function"""
    notification_manager = ErrorNotificationManager()

    try:
        success = notification_manager.process_error_notification()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Error notification processing failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()