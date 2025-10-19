#!/usr/bin/env python3
"""
Post-User-Auth-Log Hook for Russian B2B Quotation System
Logs authentication events for security audit trails and anomaly detection
"""
import os
import sys
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
from uuid import UUID


class AuthenticationLogger:
    """Logs and analyzes authentication events"""

    def __init__(self):
        self.auth_data = self._parse_auth_data()
        self.logs_dir = Path("logs/security")
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    def _parse_auth_data(self) -> Optional[Dict[str, Any]]:
        """Parse authentication data from command line arguments or stdin"""
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
            "security": "\033[0;35m🛡️ ",
        }
        print(f"{colors.get(status, colors['info'])} {message}\033[0m")

    def get_client_info_hash(self, user_agent: str, ip_address: str) -> str:
        """Create a hash of client information for privacy while maintaining trackability"""
        client_string = f"{user_agent}:{ip_address}"
        return hashlib.sha256(client_string.encode()).hexdigest()[:16]

    def classify_event_risk(self, auth_event: Dict[str, Any]) -> str:
        """Classify authentication event risk level"""
        risk_score = 0
        risk_factors = []

        # Check for failed login
        if not auth_event.get('success', True):
            risk_score += 3
            risk_factors.append("failed_login")

        # Check for unusual hours (outside 8 AM - 8 PM Moscow time)
        hour = datetime.now().hour
        if hour < 8 or hour > 20:
            risk_score += 1
            risk_factors.append("unusual_hours")

        # Check for weekend access
        weekday = datetime.now().weekday()
        if weekday >= 5:  # Saturday = 5, Sunday = 6
            risk_score += 1
            risk_factors.append("weekend_access")

        # Check for admin/privileged access
        user_role = auth_event.get('user_role', '')
        if user_role in ['admin', 'director']:
            risk_score += 1
            risk_factors.append("privileged_access")

        # Check for multiple rapid attempts
        if auth_event.get('rapid_attempts', False):
            risk_score += 4
            risk_factors.append("rapid_attempts")

        # Determine risk level
        if risk_score >= 6:
            return "high"
        elif risk_score >= 3:
            return "medium"
        elif risk_score >= 1:
            return "low"
        else:
            return "normal"

    def detect_anomalies(self, auth_event: Dict[str, Any]) -> List[str]:
        """Detect potential security anomalies"""
        anomalies = []

        # Check for suspicious patterns
        user_agent = auth_event.get('user_agent', '')
        ip_address = auth_event.get('ip_address', '')

        # Bot/automated access patterns
        bot_indicators = ['bot', 'crawler', 'spider', 'scraper', 'automated']
        if any(indicator in user_agent.lower() for indicator in bot_indicators):
            anomalies.append("potential_bot_access")

        # Unusual user agent
        if len(user_agent) < 10 or 'Mozilla' not in user_agent:
            anomalies.append("unusual_user_agent")

        # Private/internal IP trying to access from "external"
        if auth_event.get('expected_internal', False) and not ip_address.startswith(('192.168.', '10.', '172.')):
            anomalies.append("internal_user_external_ip")

        # Check for SQL injection attempts in email
        email = auth_event.get('email', '')
        sql_indicators = ["'", '"', 'union', 'select', 'drop', 'insert', 'update', 'delete']
        if any(indicator in email.lower() for indicator in sql_indicators):
            anomalies.append("potential_sql_injection")

        # Check for brute force patterns
        if auth_event.get('failed_attempts_count', 0) > 5:
            anomalies.append("potential_brute_force")

        return anomalies

    def log_authentication_event(self, auth_event: Dict[str, Any]) -> bool:
        """Log authentication event with security analysis"""
        try:
            timestamp = datetime.now()

            # Enhance event data with security analysis
            enhanced_event = {
                "timestamp": timestamp.isoformat(),
                "date": timestamp.strftime("%Y-%m-%d"),
                "time": timestamp.strftime("%H:%M:%S"),
                "event_type": "authentication",
                "success": auth_event.get('success', True),
                "user_id": auth_event.get('user_id'),
                "email": auth_event.get('email'),
                "user_role": auth_event.get('user_role'),
                "method": auth_event.get('method', 'jwt'),
                "ip_address": auth_event.get('ip_address'),
                "user_agent": auth_event.get('user_agent'),
                "client_hash": self.get_client_info_hash(
                    auth_event.get('user_agent', ''),
                    auth_event.get('ip_address', '')
                ),
                "session_id": auth_event.get('session_id'),
                "risk_level": self.classify_event_risk(auth_event),
                "anomalies": self.detect_anomalies(auth_event),
                "russian_business_context": {
                    "moscow_time": timestamp.strftime("%Y-%m-%d %H:%M:%S MSK"),
                    "business_hours": 8 <= timestamp.hour <= 20,
                    "business_day": timestamp.weekday() < 5
                }
            }

            # Add failure-specific information
            if not auth_event.get('success', True):
                enhanced_event.update({
                    "failure_reason": auth_event.get('failure_reason', 'unknown'),
                    "attempts_count": auth_event.get('attempts_count', 1)
                })

            # Log to daily security log file
            security_log_file = self.logs_dir / f"auth_security_{timestamp.strftime('%Y%m%d')}.jsonl"
            with open(security_log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(enhanced_event, ensure_ascii=False) + '\\n')

            # Log high-risk events to separate file
            if enhanced_event['risk_level'] in ['high', 'medium'] or enhanced_event['anomalies']:
                risk_log_file = self.logs_dir / f"auth_high_risk_{timestamp.strftime('%Y%m%d')}.jsonl"
                with open(risk_log_file, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(enhanced_event, ensure_ascii=False) + '\\n')

            # Create summary for monitoring
            summary = {
                "timestamp": timestamp.isoformat(),
                "user": enhanced_event.get('email', 'unknown'),
                "success": enhanced_event['success'],
                "risk": enhanced_event['risk_level'],
                "anomalies_count": len(enhanced_event['anomalies'])
            }

            # Log summary to monitoring file
            monitoring_file = self.logs_dir / "auth_monitoring_summary.jsonl"
            with open(monitoring_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(summary, ensure_ascii=False) + '\\n')

            # Print status based on risk level
            if enhanced_event['risk_level'] == 'high':
                self.print_status(f"HIGH RISK authentication event logged for {enhanced_event.get('email', 'unknown')}", "security")
            elif enhanced_event['anomalies']:
                self.print_status(f"Authentication anomalies detected: {', '.join(enhanced_event['anomalies'])}", "warning")
            elif enhanced_event['success']:
                self.print_status(f"Authentication logged for {enhanced_event.get('email', 'unknown')}", "success")
            else:
                self.print_status(f"Failed authentication attempt logged for {enhanced_event.get('email', 'unknown')}", "error")

            return True

        except Exception as e:
            self.print_status(f"Error logging authentication event: {str(e)}", "error")
            return False

    def generate_daily_summary(self) -> bool:
        """Generate daily authentication summary"""
        try:
            today = datetime.now().strftime("%Y%m%d")
            security_log_file = self.logs_dir / f"auth_security_{today}.jsonl"

            if not security_log_file.exists():
                return True

            # Read today's events
            events = []
            with open(security_log_file, 'r', encoding='utf-8') as f:
                for line in f:
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue

            if not events:
                return True

            # Calculate statistics
            total_events = len(events)
            successful_logins = len([e for e in events if e.get('success', True)])
            failed_logins = total_events - successful_logins
            unique_users = len(set(e.get('email') for e in events if e.get('email')))
            high_risk_events = len([e for e in events if e.get('risk_level') == 'high'])
            medium_risk_events = len([e for e in events if e.get('risk_level') == 'medium'])

            # Count anomalies
            all_anomalies = []
            for event in events:
                all_anomalies.extend(event.get('anomalies', []))
            anomaly_counts = {}
            for anomaly in all_anomalies:
                anomaly_counts[anomaly] = anomaly_counts.get(anomaly, 0) + 1

            # Generate summary
            summary = {
                "date": today,
                "generated_at": datetime.now().isoformat(),
                "statistics": {
                    "total_authentication_events": total_events,
                    "successful_logins": successful_logins,
                    "failed_logins": failed_logins,
                    "success_rate": round((successful_logins / total_events) * 100, 2) if total_events > 0 else 0,
                    "unique_users": unique_users,
                    "high_risk_events": high_risk_events,
                    "medium_risk_events": medium_risk_events
                },
                "anomalies": anomaly_counts,
                "security_recommendations": []
            }

            # Add security recommendations
            if failed_logins > successful_logins:
                summary["security_recommendations"].append("High failure rate detected - investigate potential attacks")

            if high_risk_events > 0:
                summary["security_recommendations"].append(f"{high_risk_events} high-risk events require investigation")

            if "potential_brute_force" in anomaly_counts:
                summary["security_recommendations"].append("Brute force attempts detected - consider IP blocking")

            if "potential_bot_access" in anomaly_counts:
                summary["security_recommendations"].append("Bot access detected - verify legitimate automation")

            # Save summary
            summary_file = self.logs_dir / f"daily_summary_{today}.json"
            with open(summary_file, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2, ensure_ascii=False)

            # Log summary to monitoring
            self.print_status(f"Daily summary generated: {successful_logins}/{total_events} successful logins", "info")
            if high_risk_events > 0:
                self.print_status(f"⚠️  {high_risk_events} high-risk events detected today", "warning")

            return True

        except Exception as e:
            self.print_status(f"Error generating daily summary: {str(e)}", "error")
            return False

    def process_authentication_log(self) -> bool:
        """Main processing function"""
        if not self.auth_data:
            self.print_status("No authentication data provided", "warning")
            return True

        self.print_status("🛡️  Processing authentication event for security audit...", "info")

        # Log the authentication event
        success = self.log_authentication_event(self.auth_data)

        # Generate daily summary (if it's the first event of the day)
        if success:
            self.generate_daily_summary()

        return success


def main():
    """Main function"""
    logger = AuthenticationLogger()

    try:
        success = logger.process_authentication_log()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Authentication logging failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()