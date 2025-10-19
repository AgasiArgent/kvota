#!/usr/bin/env python3
"""
Pre-Quote-Send Validation Hook for Russian B2B Quotation System
Validates Russian tax compliance, business rules, and data integrity before sending quotes
"""
import os
import sys
import json
import asyncio
import asyncpg
import re
from decimal import Decimal
from datetime import datetime, date
from typing import Dict, List, Any, Optional, Tuple
from uuid import UUID
from pathlib import Path

# Import our Russian business validator
sys.path.append(str(Path(__file__).parent.parent))
from hooks.validators.russian_business import RussianBusinessValidator


class QuoteSendValidator:
    """Validates quotes before sending to customers"""

    def __init__(self):
        self.quote_data = self._parse_quote_data()
        self.db_url = os.getenv("DATABASE_URL")
        self.errors: List[str] = []
        self.warnings: List[str] = []

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

    async def get_complete_quote_data(self, quote_id: UUID) -> Optional[Dict[str, Any]]:
        """Get complete quote data including customer and items"""
        try:
            conn = await self.get_db_connection()

            # Get quote with customer data
            quote_query = """
                SELECT
                    q.*,
                    c.inn as customer_inn,
                    c.kpp as customer_kpp,
                    c.ogrn as customer_ogrn,
                    c.company_type as customer_company_type,
                    c.postal_code as customer_postal_code,
                    c.address as customer_address_full,
                    c.phone as customer_phone
                FROM quotes q
                LEFT JOIN customers c ON q.customer_id = c.id
                WHERE q.id = $1
            """
            quote_row = await conn.fetchrow(quote_query, quote_id)

            if not quote_row:
                return None

            quote_data = dict(quote_row)

            # Get quote items
            items_query = """
                SELECT * FROM quote_items
                WHERE quote_id = $1
                ORDER BY sort_order, created_at
            """
            items_rows = await conn.fetch(items_query, quote_id)
            quote_data['items'] = [dict(item) for item in items_rows]

            # Get approval status
            approvals_query = """
                SELECT
                    qa.*,
                    u.email as approver_email,
                    u.raw_user_meta_data->>'full_name' as approver_name
                FROM quote_approvals qa
                LEFT JOIN auth.users u ON qa.approver_id = u.id
                WHERE qa.quote_id = $1
                ORDER BY qa.approval_order
            """
            approvals_rows = await conn.fetch(approvals_query, quote_id)
            quote_data['approvals'] = [dict(approval) for approval in approvals_rows]

            await conn.close()
            return quote_data

        except Exception as e:
            self.print_status(f"Error fetching quote data: {str(e)}", "error")
            return None

    def validate_customer_tax_information(self, quote_data: Dict[str, Any]) -> bool:
        """Validate customer Russian tax information"""
        valid = True

        customer_inn = quote_data.get('customer_inn')
        customer_kpp = quote_data.get('customer_kpp')
        customer_ogrn = quote_data.get('customer_ogrn')
        customer_type = quote_data.get('customer_company_type', 'organization')

        # Validate INN
        if customer_inn:
            is_valid, error = RussianBusinessValidator.validate_inn(customer_inn)
            if not is_valid:
                self.errors.append(f"Customer INN validation failed: {error}")
                valid = False
            else:
                self.print_status(f"Customer INN {customer_inn} validated", "success")
        else:
            self.errors.append("Customer INN is required for Russian business transactions")
            valid = False

        # Validate KPP (required for organizations)
        if customer_type == 'organization':
            if customer_kpp:
                is_valid, error = RussianBusinessValidator.validate_kpp(customer_kpp)
                if not is_valid:
                    self.errors.append(f"Customer KPP validation failed: {error}")
                    valid = False
                else:
                    self.print_status(f"Customer KPP {customer_kpp} validated", "success")
            else:
                self.errors.append("Customer KPP is required for organizations")
                valid = False

        # Validate OGRN
        if customer_ogrn:
            is_valid, error = RussianBusinessValidator.validate_ogrn(customer_ogrn)
            if not is_valid:
                self.errors.append(f"Customer OGRN validation failed: {error}")
                valid = False
            else:
                self.print_status(f"Customer OGRN {customer_ogrn} validated", "success")
        else:
            self.warnings.append("Customer OGRN is missing (recommended for business verification)")

        # Validate postal code
        customer_postal = quote_data.get('customer_postal_code')
        if customer_postal:
            is_valid, error = RussianBusinessValidator.validate_russian_postal_code(customer_postal)
            if not is_valid:
                self.warnings.append(f"Customer postal code validation failed: {error}")
            else:
                self.print_status(f"Customer postal code {customer_postal} validated", "success")

        return valid

    def validate_quote_financial_data(self, quote_data: Dict[str, Any]) -> bool:
        """Validate quote financial calculations and compliance"""
        valid = True

        # Check VAT compliance
        vat_rate = quote_data.get('vat_rate', 0)
        if vat_rate not in [0, 10, 20]:
            self.warnings.append(f"Unusual VAT rate {vat_rate}% - standard Russian rates are 0%, 10%, 20%")

        # Validate totals calculation
        subtotal = Decimal(str(quote_data.get('subtotal', 0)))
        vat_amount = Decimal(str(quote_data.get('vat_amount', 0)))
        total_amount = Decimal(str(quote_data.get('total_amount', 0)))

        # Basic calculation check
        expected_vat = subtotal * Decimal(str(vat_rate)) / 100
        if abs(vat_amount - expected_vat) > Decimal('0.01'):
            self.warnings.append(f"VAT calculation discrepancy: expected {expected_vat}, got {vat_amount}")

        # Check for reasonable amounts
        if total_amount <= 0:
            self.errors.append("Quote total amount must be greater than zero")
            valid = False

        if total_amount > Decimal('100000000'):  # 100M RUB
            self.warnings.append(f"Very large quote amount: {total_amount} - verify accuracy")

        # Currency validation
        currency = quote_data.get('currency', 'RUB')
        supported_currencies = ['RUB', 'CNY', 'USD', 'EUR']
        if currency not in supported_currencies:
            self.errors.append(f"Unsupported currency: {currency}")
            valid = False

        return valid

    def validate_quote_items(self, quote_data: Dict[str, Any]) -> bool:
        """Validate quote items for completeness and compliance"""
        valid = True

        items = quote_data.get('items', [])
        if not items:
            self.errors.append("Quote must contain at least one item")
            return False

        for i, item in enumerate(items):
            item_num = i + 1

            # Check required fields
            required_fields = ['description', 'quantity', 'unit_price']
            for field in required_fields:
                if not item.get(field):
                    self.errors.append(f"Item {item_num}: {field} is required")
                    valid = False

            # Validate quantities and prices
            try:
                quantity = Decimal(str(item.get('quantity', 0)))
                unit_price = Decimal(str(item.get('unit_price', 0)))

                if quantity <= 0:
                    self.errors.append(f"Item {item_num}: quantity must be greater than zero")
                    valid = False

                if unit_price <= 0:
                    self.errors.append(f"Item {item_num}: unit price must be greater than zero")
                    valid = False

            except (ValueError, TypeError):
                self.errors.append(f"Item {item_num}: invalid quantity or price format")
                valid = False

            # Check for country of origin (important for import duties)
            if not item.get('country_of_origin'):
                self.warnings.append(f"Item {item_num}: country of origin not specified (may affect import duties)")

            # Check product description quality
            description = item.get('description', '')
            if len(description) < 10:
                self.warnings.append(f"Item {item_num}: description may be too brief for customs")

        return valid

    def validate_approval_status(self, quote_data: Dict[str, Any]) -> bool:
        """Validate that quote has proper approvals"""
        valid = True

        status = quote_data.get('status')
        if status not in ['approved', 'ready_to_send']:
            self.errors.append(f"Quote status '{status}' is not approved for sending")
            return False

        requires_approval = quote_data.get('requires_approval', True)
        if requires_approval:
            approvals = quote_data.get('approvals', [])

            if not approvals:
                self.errors.append("Quote requires approval but no approvals found")
                return False

            # Check that all required approvals are granted
            pending_approvals = [a for a in approvals if a.get('approval_status') == 'pending']
            if pending_approvals:
                self.errors.append(f"{len(pending_approvals)} approvals still pending")
                valid = False

            rejected_approvals = [a for a in approvals if a.get('approval_status') == 'rejected']
            if rejected_approvals:
                self.errors.append(f"{len(rejected_approvals)} approvals were rejected")
                valid = False

        return valid

    def validate_quote_dates(self, quote_data: Dict[str, Any]) -> bool:
        """Validate quote dates and validity"""
        valid = True

        # Check validity date
        valid_until = quote_data.get('valid_until')
        if valid_until:
            try:
                if isinstance(valid_until, str):
                    valid_date = datetime.strptime(valid_until, '%Y-%m-%d').date()
                else:
                    valid_date = valid_until

                if valid_date <= date.today():
                    self.errors.append(f"Quote validity has expired: {valid_date}")
                    valid = False
                elif valid_date <= date.today() + timedelta(days=3):
                    self.warnings.append(f"Quote expires soon: {valid_date}")

            except (ValueError, TypeError):
                self.warnings.append("Invalid quote validity date format")

        # Check delivery date
        delivery_date = quote_data.get('delivery_date')
        if delivery_date:
            try:
                if isinstance(delivery_date, str):
                    delivery = datetime.strptime(delivery_date, '%Y-%m-%d').date()
                else:
                    delivery = delivery_date

                if delivery <= date.today():
                    self.warnings.append(f"Delivery date is in the past: {delivery}")

            except (ValueError, TypeError):
                self.warnings.append("Invalid delivery date format")

        return valid

    def validate_contact_information(self, quote_data: Dict[str, Any]) -> bool:
        """Validate customer contact information"""
        valid = True

        # Check email format
        customer_email = quote_data.get('customer_email')
        if customer_email:
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, customer_email):
                self.errors.append(f"Invalid customer email format: {customer_email}")
                valid = False
        else:
            self.warnings.append("Customer email not provided (required for sending quote)")

        # Check phone format (Russian)
        customer_phone = quote_data.get('customer_phone')
        if customer_phone:
            # Russian phone pattern: +7 (XXX) XXX-XX-XX or variations
            phone_clean = re.sub(r'[^0-9+]', '', customer_phone)
            if not (phone_clean.startswith('+7') or phone_clean.startswith('7') or phone_clean.startswith('8')):
                self.warnings.append(f"Phone number may not be Russian format: {customer_phone}")

        # Check address completeness
        customer_address = quote_data.get('customer_address') or quote_data.get('customer_address_full')
        if not customer_address or len(customer_address.strip()) < 20:
            self.warnings.append("Customer address may be incomplete for delivery")

        return valid

    def generate_validation_report(self, quote_id: UUID) -> Dict[str, Any]:
        """Generate detailed validation report"""
        return {
            "quote_id": str(quote_id),
            "validation_timestamp": datetime.now().isoformat(),
            "errors_count": len(self.errors),
            "warnings_count": len(self.warnings),
            "errors": self.errors,
            "warnings": self.warnings,
            "validation_passed": len(self.errors) == 0
        }

    async def validate_quote_for_sending(self) -> bool:
        """Main validation function"""
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

        self.print_status(f"🔍 Validating quote {quote_id} before sending...", "info")

        # Get complete quote data
        quote_data = await self.get_complete_quote_data(quote_id)
        if not quote_data:
            self.print_status(f"Quote {quote_id} not found", "error")
            return False

        # Run all validations
        validations = [
            ("Customer Tax Information", self.validate_customer_tax_information),
            ("Financial Data", self.validate_quote_financial_data),
            ("Quote Items", self.validate_quote_items),
            ("Approval Status", self.validate_approval_status),
            ("Quote Dates", self.validate_quote_dates),
            ("Contact Information", self.validate_contact_information)
        ]

        all_valid = True
        for validation_name, validation_func in validations:
            self.print_status(f"Validating {validation_name}...", "info")
            try:
                result = validation_func(quote_data)
                if result:
                    self.print_status(f"{validation_name} validation passed", "success")
                else:
                    self.print_status(f"{validation_name} validation failed", "error")
                    all_valid = False
            except Exception as e:
                self.print_status(f"Error in {validation_name} validation: {str(e)}", "error")
                all_valid = False

        # Generate and save validation report
        report = self.generate_validation_report(quote_id)
        reports_dir = Path("logs/validation")
        reports_dir.mkdir(parents=True, exist_ok=True)

        report_file = reports_dir / f"pre_send_validation_{quote_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        # Print summary
        print()
        if self.warnings:
            self.print_status("Validation Warnings:", "warning")
            for warning in self.warnings:
                print(f"  ⚠️  {warning}")

        if self.errors:
            print()
            self.print_status("Validation Errors:", "error")
            for error in self.errors:
                print(f"  ❌ {error}")
            print()
            self.print_status("❌ Quote validation FAILED - cannot send to customer", "error")
            return False
        else:
            print()
            self.print_status("✅ Quote validation PASSED - ready to send!", "success")
            if self.warnings:
                self.print_status(f"Note: {len(self.warnings)} warnings were found but are non-blocking", "info")
            return True


async def main():
    """Main function"""
    validator = QuoteSendValidator()

    try:
        success = await validator.validate_quote_for_sending()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"❌ Quote validation failed with error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())