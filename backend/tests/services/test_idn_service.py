"""Tests for IDN Service - Quote and Product Identification Numbers"""
import asyncio
import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from datetime import datetime
import json

from services.idn_service import (
    IDNService,
    IDNValidationError,
    IDNGenerationError,
    validate_supplier_code,
    validate_inn,
    generate_idn_sku,
    get_idn_service,
)


class TestValidateSupplierCode:
    """Test supplier code validation function"""

    def test_valid_codes(self):
        """Valid 3-letter uppercase codes"""
        assert validate_supplier_code("MBR") is True
        assert validate_supplier_code("CMT") is True
        assert validate_supplier_code("RAR") is True
        assert validate_supplier_code("GES") is True
        assert validate_supplier_code("TEX") is True
        assert validate_supplier_code("ABC") is True
        assert validate_supplier_code("XYZ") is True

    def test_invalid_too_short(self):
        """Code must be exactly 3 characters"""
        assert validate_supplier_code("") is False
        assert validate_supplier_code("A") is False
        assert validate_supplier_code("AB") is False

    def test_invalid_too_long(self):
        """Code must be exactly 3 characters"""
        assert validate_supplier_code("ABCD") is False
        assert validate_supplier_code("MASTER") is False

    def test_invalid_lowercase(self):
        """Code must be uppercase"""
        assert validate_supplier_code("mbr") is False
        assert validate_supplier_code("Mbr") is False
        assert validate_supplier_code("mBR") is False

    def test_invalid_with_numbers(self):
        """Code must not contain numbers"""
        assert validate_supplier_code("MB1") is False
        assert validate_supplier_code("123") is False
        assert validate_supplier_code("A2B") is False

    def test_invalid_with_special_chars(self):
        """Code must not contain special characters"""
        assert validate_supplier_code("MB-") is False
        assert validate_supplier_code("M_R") is False
        assert validate_supplier_code("M R") is False

    def test_invalid_none(self):
        """None should return False"""
        assert validate_supplier_code(None) is False

    def test_invalid_empty_string(self):
        """Empty string should return False"""
        assert validate_supplier_code("") is False


class TestValidateINN:
    """Test INN (Tax ID) validation function"""

    def test_valid_10_digit_inn(self):
        """10-digit INN for organizations"""
        assert validate_inn("1234567890") is True
        assert validate_inn("7701234567") is True
        assert validate_inn("0000000000") is True

    def test_valid_12_digit_inn(self):
        """12-digit INN for individuals"""
        assert validate_inn("123456789012") is True
        assert validate_inn("770123456789") is True
        assert validate_inn("000000000000") is True

    def test_invalid_too_short(self):
        """INN must be 10 or 12 digits"""
        assert validate_inn("") is False
        assert validate_inn("123") is False
        assert validate_inn("123456789") is False  # 9 digits
        assert validate_inn("12345678901") is False  # 11 digits

    def test_invalid_too_long(self):
        """INN must be 10 or 12 digits"""
        assert validate_inn("1234567890123") is False  # 13 digits
        assert validate_inn("12345678901234567890") is False

    def test_invalid_with_letters(self):
        """INN must only contain digits"""
        assert validate_inn("123456789A") is False
        assert validate_inn("ABCDEFGHIJ") is False
        assert validate_inn("12345A7890") is False

    def test_invalid_with_special_chars(self):
        """INN must not contain special characters"""
        assert validate_inn("123-456-789") is False
        assert validate_inn("123 456 7890") is False
        assert validate_inn("123.456.7890") is False

    def test_invalid_none(self):
        """None should return False"""
        assert validate_inn(None) is False

    def test_invalid_empty_string(self):
        """Empty string should return False"""
        assert validate_inn("") is False


class TestGenerateIdnSku:
    """Test IDN-SKU generation function"""

    def test_valid_sku_generation(self):
        """Generate valid IDN-SKU"""
        quote_idn = "CMT-1234567890-2025-1"

        assert generate_idn_sku(quote_idn, 1) == "CMT-1234567890-2025-1-1"
        assert generate_idn_sku(quote_idn, 2) == "CMT-1234567890-2025-1-2"
        assert generate_idn_sku(quote_idn, 10) == "CMT-1234567890-2025-1-10"
        assert generate_idn_sku(quote_idn, 100) == "CMT-1234567890-2025-1-100"

    def test_different_quote_idns(self):
        """Generate SKU for different quote IDNs"""
        assert generate_idn_sku("MBR-7701234567-2024-1", 1) == "MBR-7701234567-2024-1-1"
        assert generate_idn_sku("TEX-123456789012-2025-100", 5) == "TEX-123456789012-2025-100-5"

    def test_invalid_position_zero(self):
        """Position must be >= 1"""
        with pytest.raises(IDNValidationError) as exc_info:
            generate_idn_sku("CMT-1234567890-2025-1", 0)
        assert "Position must be >= 1" in str(exc_info.value)

    def test_invalid_position_negative(self):
        """Position must be >= 1"""
        with pytest.raises(IDNValidationError) as exc_info:
            generate_idn_sku("CMT-1234567890-2025-1", -1)
        assert "Position must be >= 1" in str(exc_info.value)

    def test_invalid_empty_quote_idn(self):
        """Quote IDN cannot be empty"""
        with pytest.raises(IDNValidationError) as exc_info:
            generate_idn_sku("", 1)
        assert "Quote IDN cannot be empty" in str(exc_info.value)

    def test_invalid_none_quote_idn(self):
        """Quote IDN cannot be None"""
        with pytest.raises(IDNValidationError) as exc_info:
            generate_idn_sku(None, 1)
        assert "Quote IDN cannot be empty" in str(exc_info.value)


class TestIDNService:
    """Test IDNService class"""

    @pytest.fixture
    def service(self):
        return IDNService()

    @pytest.fixture
    def org_id(self):
        return uuid4()

    @pytest.fixture
    def customer_id(self):
        return uuid4()

    # === generate_item_idn_sku tests ===

    def test_generate_item_idn_sku(self, service):
        """Generate single item IDN-SKU"""
        quote_idn = "CMT-1234567890-2025-1"
        result = service.generate_item_idn_sku(quote_idn, 1)
        assert result == "CMT-1234567890-2025-1-1"

    # === generate_item_idn_skus tests ===

    def test_generate_item_idn_skus_multiple(self, service):
        """Generate multiple item IDN-SKUs"""
        quote_idn = "CMT-1234567890-2025-1"

        async def run_test():
            return await service.generate_item_idn_skus(quote_idn, 5)

        results = asyncio.run(run_test())

        assert len(results) == 5
        assert results[0] == "CMT-1234567890-2025-1-1"
        assert results[1] == "CMT-1234567890-2025-1-2"
        assert results[2] == "CMT-1234567890-2025-1-3"
        assert results[3] == "CMT-1234567890-2025-1-4"
        assert results[4] == "CMT-1234567890-2025-1-5"

    def test_generate_item_idn_skus_empty(self, service):
        """Generate zero item IDN-SKUs"""
        quote_idn = "CMT-1234567890-2025-1"

        async def run_test():
            return await service.generate_item_idn_skus(quote_idn, 0)

        results = asyncio.run(run_test())
        assert len(results) == 0
        assert results == []

    # === generate_quote_idn tests with mocked database ===

    def test_generate_quote_idn_success(self, service, org_id):
        """Generate quote IDN with mocked database"""
        mock_conn = AsyncMock()

        # Mock fetchrow to return org with supplier_code and empty counters
        mock_conn.fetchrow.return_value = {
            'supplier_code': 'CMT',
            'idn_counters': {}
        }
        mock_conn.execute = AsyncMock()

        async def run_test():
            with patch('services.idn_service.datetime') as mock_datetime:
                mock_datetime.now.return_value = datetime(2025, 12, 14)

                result = await service.generate_quote_idn(
                    organization_id=org_id,
                    customer_inn="1234567890",
                    conn=mock_conn
                )
                return result

        result = asyncio.run(run_test())
        assert result == "CMT-1234567890-2025-1"

    def test_generate_quote_idn_increments_counter(self, service, org_id):
        """Counter should increment on each call"""
        mock_conn = AsyncMock()

        # First call: counter at 4524
        mock_conn.fetchrow.return_value = {
            'supplier_code': 'CMT',
            'idn_counters': {"2025": 4524}
        }
        mock_conn.execute = AsyncMock()

        async def run_test():
            with patch('services.idn_service.datetime') as mock_datetime:
                mock_datetime.now.return_value = datetime(2025, 12, 14)

                result = await service.generate_quote_idn(
                    organization_id=org_id,
                    customer_inn="1234567890",
                    conn=mock_conn
                )
                return result

        result = asyncio.run(run_test())
        assert result == "CMT-1234567890-2025-4525"

    def test_generate_quote_idn_invalid_inn_format(self, service, org_id):
        """Should raise error for invalid INN format"""
        mock_conn = AsyncMock()

        async def run_test():
            await service.generate_quote_idn(
                organization_id=org_id,
                customer_inn="123",  # Too short
                conn=mock_conn
            )

        with pytest.raises(IDNValidationError) as exc_info:
            asyncio.run(run_test())

        assert "Invalid INN format" in str(exc_info.value)

    def test_generate_quote_idn_missing_supplier_code(self, service, org_id):
        """Should raise error if org has no supplier_code"""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            'supplier_code': None,  # Not set
            'idn_counters': {}
        }

        async def run_test():
            await service.generate_quote_idn(
                organization_id=org_id,
                customer_inn="1234567890",
                conn=mock_conn
            )

        with pytest.raises(IDNGenerationError) as exc_info:
            asyncio.run(run_test())

        assert "supplier_code" in str(exc_info.value).lower()

    def test_generate_quote_idn_org_not_found(self, service, org_id):
        """Should raise error if organization not found"""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = None  # Org not found

        async def run_test():
            await service.generate_quote_idn(
                organization_id=org_id,
                customer_inn="1234567890",
                conn=mock_conn
            )

        with pytest.raises(IDNGenerationError) as exc_info:
            asyncio.run(run_test())

        assert "not found" in str(exc_info.value)

    def test_generate_quote_idn_different_years(self, service, org_id):
        """Counters should be separate per year"""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            'supplier_code': 'CMT',
            'idn_counters': {"2024": 3200, "2025": 100}  # Multi-year counters
        }
        mock_conn.execute = AsyncMock()

        async def run_test():
            with patch('services.idn_service.datetime') as mock_datetime:
                # Test 2025
                mock_datetime.now.return_value = datetime(2025, 1, 15)

                result = await service.generate_quote_idn(
                    organization_id=org_id,
                    customer_inn="1234567890",
                    conn=mock_conn
                )
                return result

        result = asyncio.run(run_test())
        # Should use 2025 counter (100 + 1 = 101)
        assert result == "CMT-1234567890-2025-101"

    def test_generate_quote_idn_12_digit_inn(self, service, org_id):
        """Should work with 12-digit INN (individual)"""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            'supplier_code': 'MBR',
            'idn_counters': {"2025": 0}
        }
        mock_conn.execute = AsyncMock()

        async def run_test():
            with patch('services.idn_service.datetime') as mock_datetime:
                mock_datetime.now.return_value = datetime(2025, 12, 14)

                result = await service.generate_quote_idn(
                    organization_id=org_id,
                    customer_inn="123456789012",  # 12-digit INN
                    conn=mock_conn
                )
                return result

        result = asyncio.run(run_test())
        assert result == "MBR-123456789012-2025-1"

    # === get_customer_inn tests ===

    def test_get_customer_inn_success(self, service, customer_id, org_id):
        """Get customer INN successfully"""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {'inn': '1234567890'}

        async def run_test():
            result = await service.get_customer_inn(
                customer_id=customer_id,
                organization_id=org_id,
                conn=mock_conn
            )
            return result

        result = asyncio.run(run_test())
        assert result == "1234567890"

    def test_get_customer_inn_not_found(self, service, customer_id, org_id):
        """Should raise error if customer not found"""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = None

        async def run_test():
            await service.get_customer_inn(
                customer_id=customer_id,
                organization_id=org_id,
                conn=mock_conn
            )

        with pytest.raises(IDNValidationError) as exc_info:
            asyncio.run(run_test())

        assert "not found" in str(exc_info.value)

    def test_get_customer_inn_missing(self, service, customer_id, org_id):
        """Should raise error if customer has no INN"""
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {'inn': None}

        async def run_test():
            await service.get_customer_inn(
                customer_id=customer_id,
                organization_id=org_id,
                conn=mock_conn
            )

        with pytest.raises(IDNValidationError) as exc_info:
            asyncio.run(run_test())

        assert "INN" in str(exc_info.value)

    # === set_organization_supplier_code tests ===

    def test_set_supplier_code_success(self, service, org_id):
        """Set supplier code successfully"""
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock()

        async def run_test():
            result = await service.set_organization_supplier_code(
                organization_id=org_id,
                supplier_code="CMT",
                conn=mock_conn
            )
            return result

        result = asyncio.run(run_test())
        assert result is True

    def test_set_supplier_code_invalid_format(self, service, org_id):
        """Should raise error for invalid supplier code"""
        mock_conn = AsyncMock()

        async def run_test():
            await service.set_organization_supplier_code(
                organization_id=org_id,
                supplier_code="123",  # Invalid
                conn=mock_conn
            )

        with pytest.raises(IDNValidationError) as exc_info:
            asyncio.run(run_test())

        assert "Invalid supplier_code format" in str(exc_info.value)


class TestGetIdnServiceSingleton:
    """Test singleton pattern for IDNService"""

    def test_get_idn_service_returns_instance(self):
        """get_idn_service should return IDNService instance"""
        service = get_idn_service()
        assert isinstance(service, IDNService)

    def test_get_idn_service_returns_same_instance(self):
        """get_idn_service should return same instance (singleton)"""
        service1 = get_idn_service()
        service2 = get_idn_service()
        assert service1 is service2
