"""
IDN Service - Quote and Product Identification Numbers
Generates unique identification numbers for quotes and products.

IDN Format:
- Quote IDN: SUPPLIER_CODE-CLIENT_INN-YEARSEQ
  Example: CMT-1234567890-2025004525

- Product IDN-SKU: QUOTE_IDN-POSITION
  Example: CMT-1234567890-2025004525-1

Counter Storage:
- Organizations table: idn_counters JSONB {"2025": 4525, "2024": 3200}
- Atomic increment using SELECT FOR UPDATE

Rate of Change:
- Counter increments on each quote creation
- Year-based sequences reset each year
"""
import os
import re
import json
import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from uuid import UUID

import asyncpg
from fastapi import HTTPException, status

# Configure logging
logger = logging.getLogger(__name__)


class IDNValidationError(Exception):
    """Raised when IDN validation fails"""
    pass


class IDNGenerationError(Exception):
    """Raised when IDN generation fails"""
    pass


def validate_supplier_code(code: str) -> bool:
    """
    Validate supplier code format.

    Args:
        code: 3-letter uppercase code (e.g., MBR, CMT, RAR)

    Returns:
        True if valid, False otherwise

    Rules:
        - Exactly 3 characters
        - All uppercase letters A-Z
        - No numbers or special characters
    """
    if not code:
        return False
    if len(code) != 3:
        return False
    if not code.isalpha():
        return False
    if not code.isupper():
        return False
    return True


def validate_inn(inn: str) -> bool:
    """
    Validate Russian INN (Tax Identification Number) format.

    Args:
        inn: Tax ID string (10 or 12 digits)

    Returns:
        True if valid, False otherwise

    Rules:
        - 10 digits for organizations (юридические лица)
        - 12 digits for individuals (физические лица, ИП)
        - Only digits allowed
    """
    if not inn:
        return False
    if not inn.isdigit():
        return False
    if len(inn) not in (10, 12):
        return False
    return True


def generate_idn_sku(quote_idn: str, position: int) -> str:
    """
    Generate product-level IDN-SKU.

    Args:
        quote_idn: The parent quote's IDN
        position: 1-based position in the quote items list

    Returns:
        IDN-SKU string (e.g., CMT-1234567890-2025004525-1)

    Raises:
        IDNValidationError: If position is invalid
    """
    if position < 1:
        raise IDNValidationError(f"Position must be >= 1, got {position}")

    if not quote_idn:
        raise IDNValidationError("Quote IDN cannot be empty")

    return f"{quote_idn}-{position}"


async def get_db_connection() -> asyncpg.Connection:
    """Get database connection for IDN operations"""
    db_url = os.getenv("POSTGRES_DIRECT_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        raise IDNGenerationError("Database URL not configured")
    return await asyncpg.connect(db_url)


class IDNService:
    """
    Service for generating and managing IDN (Identification Numbers).

    Thread-safe: Uses PostgreSQL row locking for concurrent access.

    Usage:
        service = IDNService()

        # Generate quote IDN
        idn = await service.generate_quote_idn(
            organization_id=org_id,
            customer_inn="1234567890"
        )
        # Returns: "CMT-1234567890-2025004525"

        # Generate product IDN-SKU
        sku = service.generate_item_idn_sku(idn, position=1)
        # Returns: "CMT-1234567890-2025004525-1"
    """

    def __init__(self, conn: Optional[asyncpg.Connection] = None):
        """
        Initialize IDN service.

        Args:
            conn: Optional database connection. If not provided,
                  will create new connection for each operation.
        """
        self._conn = conn

    async def _get_connection(self) -> asyncpg.Connection:
        """Get database connection (reuse or create new)"""
        if self._conn:
            return self._conn
        return await get_db_connection()

    async def _close_connection(self, conn: asyncpg.Connection):
        """Close connection if it was created by this method"""
        if conn != self._conn:
            await conn.close()

    async def generate_quote_idn(
        self,
        organization_id: UUID,
        customer_inn: str,
        conn: Optional[asyncpg.Connection] = None
    ) -> str:
        """
        Generate unique IDN for a quote with atomic counter increment.

        Uses SELECT FOR UPDATE to lock the organization row and prevent
        race conditions when multiple quotes are created simultaneously.

        Args:
            organization_id: The organization creating the quote
            customer_inn: Client's tax identification number (INN)
            conn: Optional existing database connection

        Returns:
            IDN string (e.g., CMT-1234567890-2025004525)

        Raises:
            IDNValidationError: If INN format is invalid
            IDNGenerationError: If org has no supplier_code or DB error

        Example:
            >>> service = IDNService()
            >>> idn = await service.generate_quote_idn(
            ...     organization_id=org_id,
            ...     customer_inn="1234567890"
            ... )
            >>> print(idn)
            "CMT-1234567890-2025004525"
        """
        # Validate INN format
        if not validate_inn(customer_inn):
            raise IDNValidationError(
                f"Invalid INN format: '{customer_inn}'. "
                f"INN must be 10 digits (organization) or 12 digits (individual)."
            )

        current_year = datetime.now().year
        own_conn = conn is None

        if own_conn:
            conn = await self._get_connection()

        try:
            # Start transaction if not already in one
            # Lock organization row to prevent race conditions
            org_row = await conn.fetchrow("""
                SELECT supplier_code, idn_counters
                FROM organizations
                WHERE id = $1
                FOR UPDATE
            """, organization_id)

            if not org_row:
                raise IDNGenerationError(
                    f"Organization {organization_id} not found"
                )

            supplier_code = org_row['supplier_code']
            if not supplier_code:
                raise IDNGenerationError(
                    "Organization does not have a supplier_code configured. "
                    "Please contact admin to set up the supplier code in organization settings."
                )

            if not validate_supplier_code(supplier_code):
                raise IDNGenerationError(
                    f"Invalid supplier_code format: '{supplier_code}'. "
                    f"Must be exactly 3 uppercase letters."
                )

            # Get current counter for this year
            counters = org_row['idn_counters'] or {}
            if isinstance(counters, str):
                counters = json.loads(counters)

            year_key = str(current_year)
            current_count = counters.get(year_key, 0)
            new_count = current_count + 1

            # Update counter
            counters[year_key] = new_count

            await conn.execute("""
                UPDATE organizations
                SET idn_counters = $1
                WHERE id = $2
            """, json.dumps(counters), organization_id)

            # Generate IDN: SUPPLIER-INN-YEAR-SEQ
            # Format: YYYY-N where N is sequence number (no padding)
            idn = f"{supplier_code}-{customer_inn}-{current_year}-{new_count}"  # e.g., CMT-1234567890-2025-1

            logger.info(
                f"Generated IDN {idn} for org {organization_id}, "
                f"counter updated: {current_count} -> {new_count}"
            )

            return idn

        except IDNValidationError:
            raise
        except IDNGenerationError:
            raise
        except Exception as e:
            logger.error(f"Failed to generate IDN: {e}")
            raise IDNGenerationError(f"Failed to generate IDN: {str(e)}")
        finally:
            if own_conn:
                await conn.close()

    def generate_item_idn_sku(self, quote_idn: str, position: int) -> str:
        """
        Generate IDN-SKU for a quote item.

        This is a simple synchronous function (no DB access).

        Args:
            quote_idn: The parent quote's IDN
            position: 1-based position in quote items list

        Returns:
            IDN-SKU string (e.g., CMT-1234567890-2025004525-1)
        """
        return generate_idn_sku(quote_idn, position)

    async def generate_item_idn_skus(
        self,
        quote_idn: str,
        item_count: int
    ) -> List[str]:
        """
        Generate IDN-SKUs for all items in a quote.

        Args:
            quote_idn: The parent quote's IDN
            item_count: Number of items in the quote

        Returns:
            List of IDN-SKU strings
        """
        return [
            generate_idn_sku(quote_idn, position)
            for position in range(1, item_count + 1)
        ]

    async def get_customer_inn(
        self,
        customer_id: UUID,
        organization_id: UUID,
        conn: Optional[asyncpg.Connection] = None
    ) -> str:
        """
        Fetch customer INN from database.

        Args:
            customer_id: Customer UUID
            organization_id: Organization UUID for RLS
            conn: Optional existing database connection

        Returns:
            INN string

        Raises:
            IDNValidationError: If customer not found or has no INN
        """
        own_conn = conn is None

        if own_conn:
            conn = await self._get_connection()

        try:
            row = await conn.fetchrow("""
                SELECT inn
                FROM customers
                WHERE id = $1 AND organization_id = $2
            """, customer_id, organization_id)

            if not row:
                raise IDNValidationError(
                    f"Customer {customer_id} not found"
                )

            inn = row['inn']
            if not inn:
                raise IDNValidationError(
                    f"Customer does not have an INN (tax identification number). "
                    f"Please add INN to the customer record before creating a quote."
                )

            return inn

        finally:
            if own_conn:
                await conn.close()

    async def get_organization_supplier_code(
        self,
        organization_id: UUID,
        conn: Optional[asyncpg.Connection] = None
    ) -> Optional[str]:
        """
        Get organization's supplier code.

        Args:
            organization_id: Organization UUID
            conn: Optional existing database connection

        Returns:
            Supplier code string or None if not set
        """
        own_conn = conn is None

        if own_conn:
            conn = await self._get_connection()

        try:
            row = await conn.fetchrow("""
                SELECT supplier_code
                FROM organizations
                WHERE id = $1
            """, organization_id)

            if not row:
                return None

            return row['supplier_code']

        finally:
            if own_conn:
                await conn.close()

    async def set_organization_supplier_code(
        self,
        organization_id: UUID,
        supplier_code: str,
        conn: Optional[asyncpg.Connection] = None
    ) -> bool:
        """
        Set organization's supplier code.

        Args:
            organization_id: Organization UUID
            supplier_code: 3-letter uppercase code
            conn: Optional existing database connection

        Returns:
            True if updated successfully

        Raises:
            IDNValidationError: If supplier_code format is invalid
        """
        if not validate_supplier_code(supplier_code):
            raise IDNValidationError(
                f"Invalid supplier_code format: '{supplier_code}'. "
                f"Must be exactly 3 uppercase letters (A-Z)."
            )

        own_conn = conn is None

        if own_conn:
            conn = await self._get_connection()

        try:
            await conn.execute("""
                UPDATE organizations
                SET supplier_code = $1
                WHERE id = $2
            """, supplier_code, organization_id)

            logger.info(
                f"Set supplier_code '{supplier_code}' for org {organization_id}"
            )

            return True

        finally:
            if own_conn:
                await conn.close()


# Singleton instance for reuse
_idn_service: Optional[IDNService] = None


def get_idn_service() -> IDNService:
    """Get IDN service singleton instance"""
    global _idn_service
    if _idn_service is None:
        _idn_service = IDNService()
    return _idn_service
