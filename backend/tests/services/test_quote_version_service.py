"""
Tests for Quote Version Service

Tests the quote versioning functionality for multi-currency support.
"""
import pytest
from decimal import Decimal
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4

from services.quote_version_service import QuoteVersionService
from domain_models.quote_version import QuoteVersion, QuoteVersionCreate


class TestQuoteVersionService:
    """Test QuoteVersionService"""

    @pytest.fixture
    def service(self):
        return QuoteVersionService()

    @pytest.fixture
    def org_id(self):
        return uuid4()

    @pytest.fixture
    def quote_id(self):
        return uuid4()

    @pytest.fixture
    def user_id(self):
        return uuid4()

    @pytest.fixture
    def sample_quote_variables(self):
        """Sample quote variables for testing"""
        return {
            "currency_of_quote": "USD",
            "seller_company": "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ",
            "quote_date": "2025-11-25",
            "delivery_time": 45,
            "logistics_supplier_hub": {"value": 1500.0, "currency": "EUR"},
            "logistics_hub_customs": {"value": 800.0, "currency": "EUR"},
            "logistics_customs_client": {"value": 25000.0, "currency": "RUB"},
        }

    @pytest.fixture
    def sample_products(self):
        """Sample products for testing"""
        return [
            {
                "sku": "SKF-6205",
                "brand": "SKF",
                "name": "Bearing 6205",
                "base_price_vat": {"value": 5.00, "currency": "EUR"},
                "quantity": 100,
                "weight_in_kg": 0.5,
            },
            {
                "sku": "FAG-6206",
                "brand": "FAG",
                "name": "Bearing 6206",
                "base_price_vat": {"value": 6.50, "currency": "EUR"},
                "quantity": 50,
                "weight_in_kg": 0.6,
            },
        ]

    @pytest.fixture
    def sample_exchange_rates(self):
        """Sample exchange rates for testing"""
        return {
            "USD": Decimal("1.0"),
            "EUR": Decimal("1.08"),
            "RUB": Decimal("0.0105"),
            "TRY": Decimal("0.0303"),
            "CNY": Decimal("0.1389"),
        }

    def test_quote_version_create_model(self):
        """Test QuoteVersionCreate model validates correctly"""
        version = QuoteVersionCreate(
            quote_id=uuid4(),
            quote_variables={"currency_of_quote": "USD"},
            products_snapshot=[{"sku": "TEST"}],
            exchange_rates_used={"USD": "1.0", "EUR": "1.08"},
            rates_source="cbr",
            calculation_results={"total": 1000},
            total_usd=Decimal("1000.00"),
            total_quote_currency=Decimal("1000.00"),
            created_by=uuid4(),
        )
        assert version.quote_id is not None
        assert version.rates_source == "cbr"

    def test_quote_version_model(self):
        """Test QuoteVersion model with all fields"""
        version = QuoteVersion(
            id=uuid4(),
            quote_id=uuid4(),
            version_number=1,
            status="draft",
            quote_variables={"currency_of_quote": "USD"},
            products_snapshot=[{"sku": "TEST"}],
            exchange_rates_used={"USD": "1.0", "EUR": "1.08"},
            rates_source="cbr",
            calculation_results={"total": 1000},
            total_usd=Decimal("1000.00"),
            total_quote_currency=Decimal("1000.00"),
            created_by=uuid4(),
            created_at=datetime.now(timezone.utc),
        )
        assert version.version_number == 1
        assert version.status == "draft"

    def test_quote_version_status_validation(self):
        """Test that invalid status is rejected"""
        with pytest.raises(ValueError):
            QuoteVersion(
                id=uuid4(),
                quote_id=uuid4(),
                version_number=1,
                status="invalid_status",  # Should fail
                quote_variables={},
                products_snapshot=[],
                exchange_rates_used={},
                rates_source="cbr",
                calculation_results={},
                total_usd=Decimal("0"),
                total_quote_currency=Decimal("0"),
                created_by=uuid4(),
                created_at=datetime.now(timezone.utc),
            )

    @pytest.mark.asyncio
    async def test_create_version_increments_version_number(
        self, service, quote_id, user_id, sample_quote_variables, sample_products
    ):
        """Creating a version should auto-increment version_number"""
        with patch.object(service, '_get_latest_version_number', new_callable=AsyncMock, return_value=0):
            with patch.object(service, '_save_version', new_callable=AsyncMock) as mock_save:
                with patch.object(service, '_update_quote_current_version', new_callable=AsyncMock):
                    with patch.object(service, '_get_exchange_rates_for_org', new_callable=AsyncMock, return_value={"USD": "1.0"}):
                        with patch.object(service, '_determine_rates_source', new_callable=AsyncMock, return_value="cbr"):
                            mock_save.return_value = QuoteVersion(
                                id=uuid4(),
                                quote_id=quote_id,
                                version_number=1,
                                status="draft",
                                quote_variables=sample_quote_variables,
                                products_snapshot=sample_products,
                                exchange_rates_used={"USD": "1.0"},
                                rates_source="cbr",
                                calculation_results={},
                                total_usd=Decimal("1000.00"),
                                total_quote_currency=Decimal("1000.00"),
                                created_by=user_id,
                                created_at=datetime.now(timezone.utc),
                            )

                            result = await service.create_version(
                                quote_id=quote_id,
                                org_id=uuid4(),
                                quote_variables=sample_quote_variables,
                                products=sample_products,
                                calculation_results={"total": 1000},
                                total_usd=Decimal("1000.00"),
                                total_quote_currency=Decimal("1000.00"),
                                user_id=user_id,
                            )

                            assert result.version_number == 1

    @pytest.mark.asyncio
    async def test_get_version_history(self, service, quote_id):
        """Test fetching version history for a quote"""
        mock_versions = [
            {
                "id": str(uuid4()),
                "quote_id": str(quote_id),
                "version_number": 1,
                "status": "draft",
                "quote_variables": {},
                "products_snapshot": [],
                "exchange_rates_used": {},
                "rates_source": "cbr",
                "calculation_results": {},
                "total_usd": 1000.00,
                "total_quote_currency": 1000.00,
                "created_by": str(uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            {
                "id": str(uuid4()),
                "quote_id": str(quote_id),
                "version_number": 2,
                "status": "sent",
                "quote_variables": {},
                "products_snapshot": [],
                "exchange_rates_used": {},
                "rates_source": "manual",
                "calculation_results": {},
                "total_usd": 1100.00,
                "total_quote_currency": 1100.00,
                "created_by": str(uuid4()),
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        ]

        with patch.object(service, '_fetch_versions', return_value=mock_versions):
            versions = await service.get_version_history(quote_id)
            assert len(versions) == 2
            assert versions[0]["version_number"] == 1
            assert versions[1]["version_number"] == 2

    @pytest.mark.asyncio
    async def test_get_specific_version(self, service, quote_id):
        """Test fetching a specific version"""
        version_id = uuid4()
        mock_version = {
            "id": str(version_id),
            "quote_id": str(quote_id),
            "version_number": 1,
            "status": "draft",
            "quote_variables": {"currency_of_quote": "USD"},
            "products_snapshot": [{"sku": "TEST"}],
            "exchange_rates_used": {"USD": "1.0"},
            "rates_source": "cbr",
            "calculation_results": {"total": 1000},
            "total_usd": 1000.00,
            "total_quote_currency": 1000.00,
            "created_by": str(uuid4()),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        with patch.object(service, '_fetch_version_by_id', return_value=mock_version):
            version = await service.get_version(version_id)
            assert version["version_number"] == 1
            assert version["status"] == "draft"

    @pytest.mark.asyncio
    async def test_recalculate_creates_new_version(
        self, service, quote_id, user_id, sample_quote_variables, sample_products
    ):
        """Recalculating a quote should create a new version"""
        existing_version = {
            "id": str(uuid4()),
            "quote_id": str(quote_id),
            "version_number": 1,
            "quote_variables": sample_quote_variables,
            "products_snapshot": sample_products,
        }

        with patch.object(service, '_fetch_current_version', return_value=existing_version):
            with patch.object(service, 'create_version', new_callable=AsyncMock) as mock_create:
                mock_create.return_value = QuoteVersion(
                    id=uuid4(),
                    quote_id=quote_id,
                    version_number=2,
                    status="draft",
                    quote_variables=sample_quote_variables,
                    products_snapshot=sample_products,
                    exchange_rates_used={"USD": "1.0"},
                    rates_source="cbr",
                    calculation_results={},
                    total_usd=Decimal("1100.00"),
                    total_quote_currency=Decimal("1100.00"),
                    created_by=user_id,
                    created_at=datetime.now(timezone.utc),
                    parent_version_id=uuid4(),
                    change_reason="Recalculated with fresh rates",
                )

                result = await service.recalculate_with_fresh_rates(
                    quote_id=quote_id,
                    org_id=uuid4(),
                    user_id=user_id,
                )

                assert result.version_number == 2
                assert result.change_reason == "Recalculated with fresh rates"
