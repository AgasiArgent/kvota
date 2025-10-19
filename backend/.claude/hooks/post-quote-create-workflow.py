#!/usr/bin/env python3
"""
Post-Quote-Create Workflow Hook for Russian B2B Quotation System
Handles approval workflow automation, notifications, and business logic
"""
import os
import sys
import json
import asyncio
import asyncpg
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from uuid import UUID
from pathlib import Path


class QuoteWorkflowManager:
    """Manages quote approval workflows and notifications"""

    def __init__(self):
        self.quote_data = self._parse_quote_data()
        self.db_url = os.getenv("DATABASE_URL")

    def _parse_quote_data(self) -> Optional[Dict[str, Any]]:
        """Parse quote data from command line arguments or stdin"""
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
        }
        print(f"{colors.get(status, colors['info'])} {message}\033[0m")

    async def get_db_connection(self):
        """Get database connection"""
        if not self.db_url:
            raise Exception("DATABASE_URL not configured")
        return await asyncpg.connect(self.db_url)

    async def get_quote_details(self, quote_id: UUID) -> Optional[Dict[str, Any]]:
        """Get quote details from database"""
        try:
            conn = await self.get_db_connection()

            query = """
                SELECT
                    q.*,
                    u.email as creator_email,
                    u.raw_user_meta_data->>'full_name' as creator_name
                FROM quotes q
                LEFT JOIN auth.users u ON q.user_id = u.id
                WHERE q.id = $1
            """

            row = await conn.fetchrow(query, quote_id)
            await conn.close()

            if row:
                return dict(row)
            return None

        except Exception as e:
            self.print_status(f"Error fetching quote details: {str(e)}", "error")
            return None

    async def determine_required_approvers(self, quote_data: Dict[str, Any]) -> List[UUID]:
        """Determine who needs to approve the quote based on business rules"""
        try:
            conn = await self.get_db_connection()

            total_amount = float(quote_data.get('total_amount', 0))
            currency = quote_data.get('currency', 'RUB')

            # Convert to RUB for approval thresholds
            if currency == 'USD':
                total_amount_rub = total_amount * 90  # Approximate exchange rate
            elif currency == 'EUR':
                total_amount_rub = total_amount * 100
            elif currency == 'CNY':
                total_amount_rub = total_amount * 12
            else:
                total_amount_rub = total_amount

            # Russian business approval thresholds
            approvers = []

            if total_amount_rub > 5000000:  # > 5M RUB - Director approval required
                director_query = """
                    SELECT id FROM auth.users
                    WHERE raw_user_meta_data->>'role' = 'director'
                    AND banned_until IS NULL
                    ORDER BY created_at
                    LIMIT 1
                """
                director = await conn.fetchrow(director_query)
                if director:
                    approvers.append(director['id'])

            if total_amount_rub > 1000000:  # > 1M RUB - Finance Manager approval
                finance_query = """
                    SELECT id FROM auth.users
                    WHERE raw_user_meta_data->>'role' = 'finance_manager'
                    AND banned_until IS NULL
                    ORDER BY created_at
                    LIMIT 1
                """
                finance_manager = await conn.fetchrow(finance_query)
                if finance_manager:
                    approvers.append(finance_manager['id'])

            if total_amount_rub > 500000:  # > 500K RUB - Department Manager approval
                dept_query = """
                    SELECT id FROM auth.users
                    WHERE raw_user_meta_data->>'role' = 'department_manager'
                    AND banned_until IS NULL
                    ORDER BY created_at
                    LIMIT 1
                """
                dept_manager = await conn.fetchrow(dept_query)
                if dept_manager:
                    approvers.append(dept_manager['id'])

            await conn.close()
            return approvers

        except Exception as e:
            self.print_status(f"Error determining approvers: {str(e)}", "error")
            return []

    async def create_approval_workflow(self, quote_id: UUID, approvers: List[UUID]) -> bool:
        """Create approval workflow entries"""
        if not approvers:
            return True

        try:
            conn = await self.get_db_connection()

            # Create approval records
            for i, approver_id in enumerate(approvers):
                insert_query = """
                    INSERT INTO quote_approvals (
                        quote_id, approver_id, approval_order, approval_status,
                        assigned_at
                    ) VALUES ($1, $2, $3, 'pending', TIMEZONE('utc', NOW()))
                """
                await conn.execute(insert_query, quote_id, approver_id, i + 1)

            # Update quote status to pending_approval
            update_query = """
                UPDATE quotes
                SET
                    status = 'pending_approval',
                    submitted_for_approval_at = TIMEZONE('utc', NOW()),
                    updated_at = TIMEZONE('utc', NOW())
                WHERE id = $1
            """
            await conn.execute(update_query, quote_id)

            await conn.close()
            self.print_status(f"Created approval workflow with {len(approvers)} approvers", "success")
            return True

        except Exception as e:
            self.print_status(f"Error creating approval workflow: {str(e)}", "error")
            return False

    async def send_approval_notifications(self, quote_id: UUID, approvers: List[UUID]) -> bool:
        """Send notifications to approvers"""
        try:
            conn = await self.get_db_connection()

            quote_details = await self.get_quote_details(quote_id)
            if not quote_details:
                return False

            # Get approver details
            approver_query = """
                SELECT id, email, raw_user_meta_data->>'full_name' as full_name
                FROM auth.users
                WHERE id = ANY($1)
            """
            approver_rows = await conn.fetch(approver_query, approvers)

            # Create notification entries
            for approver in approver_rows:
                notification_data = {
                    "type": "quote_approval_request",
                    "quote_id": str(quote_id),
                    "quote_title": quote_details.get('title'),
                    "quote_amount": str(quote_details.get('total_amount')),
                    "currency": quote_details.get('currency'),
                    "customer_name": quote_details.get('customer_name'),
                    "approver_email": approver['email'],
                    "approver_name": approver['full_name'],
                    "created_at": datetime.now().isoformat()
                }

                # Save notification to file (could be integrated with email service)
                notifications_dir = Path("logs/notifications")
                notifications_dir.mkdir(parents=True, exist_ok=True)

                notification_file = notifications_dir / f"approval_request_{quote_id}_{approver['id']}.json"
                with open(notification_file, 'w', encoding='utf-8') as f:
                    json.dump(notification_data, f, indent=2, ensure_ascii=False)

                self.print_status(f"Notification queued for {approver['email']}", "info")

            await conn.close()
            return True

        except Exception as e:
            self.print_status(f"Error sending notifications: {str(e)}", "error")
            return False

    async def check_compliance_requirements(self, quote_data: Dict[str, Any]) -> List[str]:
        """Check Russian business compliance requirements"""
        issues = []

        # Check customer tax information
        customer_name = quote_data.get('customer_name', '')
        customer_id = quote_data.get('customer_id')

        if customer_id:
            try:
                conn = await self.get_db_connection()

                customer_query = """
                    SELECT inn, kpp, ogrn, company_type
                    FROM customers
                    WHERE id = $1
                """
                customer = await conn.fetchrow(customer_query, customer_id)

                if customer:
                    if not customer['inn']:
                        issues.append("Customer INN (tax number) is required for Russian business")

                    if customer['company_type'] == 'organization' and not customer['kpp']:
                        issues.append("Customer KPP is required for organizations")

                    if not customer['ogrn']:
                        issues.append("Customer OGRN is required for business registration")

                await conn.close()

            except Exception as e:
                issues.append(f"Could not verify customer tax information: {str(e)}")

        # Check VAT compliance
        vat_rate = quote_data.get('vat_rate', 0)
        if vat_rate not in [0, 10, 20]:
            issues.append(f"Unusual VAT rate {vat_rate}% - standard Russian rates are 0%, 10%, or 20%")

        # Check currency compliance
        currency = quote_data.get('currency', 'RUB')
        if currency not in ['RUB', 'CNY', 'USD', 'EUR']:
            issues.append(f"Currency {currency} may require special compliance procedures")

        return issues

    async def log_workflow_event(self, quote_id: UUID, event_type: str, details: Dict[str, Any]):
        """Log workflow events for audit trail"""
        try:
            logs_dir = Path("logs/workflow")
            logs_dir.mkdir(parents=True, exist_ok=True)

            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "quote_id": str(quote_id),
                "event_type": event_type,
                "details": details
            }

            log_file = logs_dir / f"workflow_{datetime.now().strftime('%Y%m%d')}.jsonl"
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\\n')

        except Exception as e:
            self.print_status(f"Error logging workflow event: {str(e)}", "warning")

    async def process_quote_workflow(self) -> bool:
        """Main workflow processing function"""
        if not self.quote_data:
            self.print_status("No quote data provided", "warning")
            return True

        quote_id_str = self.quote_data.get('quote_id') or self.quote_data.get('id')
        if not quote_id_str:
            self.print_status("No quote ID provided", "warning")
            return True

        try:
            quote_id = UUID(quote_id_str)
        except ValueError:
            self.print_status(f"Invalid quote ID format: {quote_id_str}", "error")
            return False

        action = self.quote_data.get('action', 'create')
        self.print_status(f"Processing quote workflow: {action} for quote {quote_id}", "info")

        # Get current quote details
        quote_details = await self.get_quote_details(quote_id)
        if not quote_details:
            self.print_status(f"Quote {quote_id} not found", "error")
            return False

        # Log workflow event
        await self.log_workflow_event(quote_id, action, {
            "quote_title": quote_details.get('title'),
            "status": quote_details.get('status'),
            "total_amount": str(quote_details.get('total_amount', 0)),
            "currency": quote_details.get('currency')
        })

        # Check compliance
        compliance_issues = await self.check_compliance_requirements(quote_details)
        if compliance_issues:
            self.print_status("Compliance issues found:", "warning")
            for issue in compliance_issues:
                self.print_status(f"  • {issue}", "warning")

        # Handle different actions
        if action in ['create', 'submit_for_approval']:
            if quote_details.get('requires_approval', True):
                # Determine required approvers
                approvers = await self.determine_required_approvers(quote_details)

                if approvers:
                    # Create approval workflow
                    success = await self.create_approval_workflow(quote_id, approvers)
                    if success:
                        # Send notifications
                        await self.send_approval_notifications(quote_id, approvers)
                        self.print_status("Approval workflow initiated successfully", "success")
                    else:
                        return False
                else:
                    self.print_status("No approvers required, marking as approved", "info")
                    # Auto-approve if no approvers needed
                    try:
                        conn = await self.get_db_connection()
                        await conn.execute(
                            "UPDATE quotes SET status = 'approved', updated_at = TIMEZONE('utc', NOW()) WHERE id = $1",
                            quote_id
                        )
                        await conn.close()
                    except Exception as e:
                        self.print_status(f"Error auto-approving quote: {str(e)}", "error")
                        return False

        elif action == 'approved':
            self.print_status("Quote approved, workflow completed", "success")

        elif action == 'rejected':
            self.print_status("Quote rejected, workflow terminated", "info")

        return True


async def main():
    """Main function"""
    workflow_manager = QuoteWorkflowManager()

    try:
        success = await workflow_manager.process_quote_workflow()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Quote workflow processing failed: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())