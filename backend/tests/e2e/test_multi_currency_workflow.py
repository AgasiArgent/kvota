"""
E2E Tests - Multi-Currency Quote Workflow

Tests the complete workflow for creating quotes with multi-currency inputs:
1. Create quote with logistics in EUR and brokerage in RUB
2. Verify values are stored correctly with currency info
3. Test quote version creation with exchange rate snapshot
4. Test recalculation with fresh rates creates new version
"""

import pytest
from decimal import Decimal
from uuid import uuid4, UUID
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

# Test domain models
from domain_models.monetary import MonetaryValue, MonetaryInput, SUPPORTED_CURRENCIES
from domain_models.quote_version import QuoteVersion, QuoteVersionCreate


class TestMonetaryValueCreation:
    """Test creating monetary values with different currencies"""

    def test_create_eur_monetary_value(self):
        """Test creating a EUR monetary value"""
        mv = MonetaryValue(
            value=Decimal("1500.00"),
            currency="EUR",
            value_usd=Decimal("1620.00"),
            rate_used=Decimal("1.08"),
            rate_source="cbr"
        )
        assert mv.value == Decimal("1500.00")
        assert mv.currency == "EUR"
        assert mv.value_usd == Decimal("1620.00")

    def test_create_rub_monetary_value(self):
        """Test creating a RUB monetary value"""
        mv = MonetaryValue(
            value=Decimal("100000.00"),
            currency="RUB",
            value_usd=Decimal("1050.00"),
            rate_used=Decimal("0.0105"),
            rate_source="cbr"
        )
        assert mv.value == Decimal("100000.00")
        assert mv.currency == "RUB"
        assert mv.value_usd == Decimal("1050.00")

    def test_supported_currencies_list(self):
        """Test that all expected currencies are supported"""
        assert "USD" in SUPPORTED_CURRENCIES
        assert "EUR" in SUPPORTED_CURRENCIES
        assert "RUB" in SUPPORTED_CURRENCIES
        assert "TRY" in SUPPORTED_CURRENCIES
        assert "CNY" in SUPPORTED_CURRENCIES


class TestMultiCurrencyQuoteVariables:
    """Test quote variables with multi-currency logistics and brokerage"""

    @pytest.fixture
    def sample_multi_currency_variables(self):
        """Sample variables with multi-currency logistics and brokerage"""
        return {
            "currency_of_quote": "USD",
            "seller_company": "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ",
            "quote_date": "2025-11-25",
            "delivery_time": 45,
            # Logistics in EUR
            "logistics_supplier_hub": {"value": 1500.00, "currency": "EUR"},
            "logistics_hub_customs": {"value": 800.00, "currency": "EUR"},
            # Logistics to client in RUB (domestic leg)
            "logistics_customs_client": {"value": 25000.00, "currency": "RUB"},
            # Brokerage in EUR (hub) and RUB (customs)
            "brokerage_hub": {"value": 200.00, "currency": "EUR"},
            "brokerage_customs": {"value": 15000.00, "currency": "RUB"},
            "warehousing_at_customs": {"value": 10000.00, "currency": "RUB"},
            "customs_documentation": {"value": 5000.00, "currency": "RUB"},
            "brokerage_extra": {"value": 3000.00, "currency": "RUB"},
        }

    def test_extract_monetary_fields(self, sample_multi_currency_variables):
        """Test extracting monetary fields from variables"""
        monetary_fields = [
            "logistics_supplier_hub",
            "logistics_hub_customs",
            "logistics_customs_client",
            "brokerage_hub",
            "brokerage_customs",
            "warehousing_at_customs",
            "customs_documentation",
            "brokerage_extra",
        ]

        for field_name in monetary_fields:
            field_value = sample_multi_currency_variables.get(field_name)
            assert field_value is not None, f"Missing field: {field_name}"
            assert "value" in field_value, f"Missing 'value' in {field_name}"
            assert "currency" in field_value, f"Missing 'currency' in {field_name}"
            assert field_value["currency"] in SUPPORTED_CURRENCIES, f"Invalid currency in {field_name}"

    def test_logistics_total_in_eur(self, sample_multi_currency_variables):
        """Test that EUR logistics fields sum correctly"""
        eur_logistics = (
            sample_multi_currency_variables["logistics_supplier_hub"]["value"] +
            sample_multi_currency_variables["logistics_hub_customs"]["value"]
        )
        assert eur_logistics == 2300.00  # 1500 + 800

    def test_brokerage_total_in_rub(self, sample_multi_currency_variables):
        """Test that RUB brokerage fields sum correctly"""
        rub_brokerage = (
            sample_multi_currency_variables["brokerage_customs"]["value"] +
            sample_multi_currency_variables["warehousing_at_customs"]["value"] +
            sample_multi_currency_variables["customs_documentation"]["value"] +
            sample_multi_currency_variables["brokerage_extra"]["value"]
        )
        assert rub_brokerage == 33000.00  # 15000 + 10000 + 5000 + 3000


class TestMultiCurrencyConversion:
    """Test multi-currency conversion service"""

    @pytest.fixture
    def mock_exchange_rates(self):
        """Mock exchange rates to USD"""
        return {
            "USD": Decimal("1.0"),
            "EUR": Decimal("1.08"),
            "RUB": Decimal("0.0105"),
            "TRY": Decimal("0.0303"),
            "CNY": Decimal("0.1389"),
        }

    @pytest.mark.asyncio
    async def test_convert_eur_logistics_to_usd(self, mock_exchange_rates):
        """Test converting EUR logistics to USD"""
        from services.multi_currency_service import MultiCurrencyService

        service = MultiCurrencyService()
        org_id = uuid4()

        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=False):
            with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=mock_exchange_rates["EUR"]):
                result = await service.convert_to_usd(
                    value=Decimal("1500.00"),
                    from_currency="EUR",
                    org_id=org_id
                )

                assert result.value == Decimal("1500.00")
                assert result.currency == "EUR"
                assert result.value_usd == Decimal("1620.00")  # 1500 * 1.08
                assert result.rate_source == "cbr"

    @pytest.mark.asyncio
    async def test_convert_rub_brokerage_to_usd(self, mock_exchange_rates):
        """Test converting RUB brokerage to USD"""
        from services.multi_currency_service import MultiCurrencyService

        service = MultiCurrencyService()
        org_id = uuid4()

        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=False):
            with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=mock_exchange_rates["RUB"]):
                result = await service.convert_to_usd(
                    value=Decimal("15000.00"),
                    from_currency="RUB",
                    org_id=org_id
                )

                assert result.value == Decimal("15000.00")
                assert result.currency == "RUB"
                assert result.value_usd == Decimal("157.50")  # 15000 * 0.0105
                assert result.rate_source == "cbr"


class TestQuoteVersionWithMultiCurrency:
    """Test quote version creation with multi-currency data"""

    @pytest.fixture
    def sample_multi_currency_quote_version(self):
        """Sample quote version with multi-currency data"""
        return QuoteVersion(
            id=uuid4(),
            quote_id=uuid4(),
            version_number=1,
            status="draft",
            quote_variables={
                "currency_of_quote": "USD",
                "seller_company": "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ",
                "logistics_supplier_hub": {"value": 1500.00, "currency": "EUR"},
                "logistics_hub_customs": {"value": 800.00, "currency": "EUR"},
                "logistics_customs_client": {"value": 25000.00, "currency": "RUB"},
                "brokerage_customs": {"value": 15000.00, "currency": "RUB"},
            },
            products_snapshot=[
                {
                    "sku": "SKF-6205",
                    "brand": "SKF",
                    "name": "Bearing 6205",
                    "base_price_vat": {"value": 5.00, "currency": "EUR"},
                    "quantity": 100,
                }
            ],
            exchange_rates_used={
                "USD": "1.0",
                "EUR": "1.08",
                "RUB": "0.0105",
                "TRY": "0.0303",
                "CNY": "0.1389",
            },
            rates_source="cbr",
            calculation_results={
                "total": 15000.00,
                "logistics_usd_total": 2737.50,  # (1500+800)*1.08 + 25000*0.0105
            },
            total_usd=Decimal("15000.00"),
            total_quote_currency=Decimal("15000.00"),
            created_by=uuid4(),
            created_at=datetime.now(timezone.utc),
        )

    def test_version_stores_currency_info(self, sample_multi_currency_quote_version):
        """Test that version stores currency info in quote_variables"""
        version = sample_multi_currency_quote_version
        logistics = version.quote_variables["logistics_supplier_hub"]

        assert "value" in logistics
        assert "currency" in logistics
        assert logistics["currency"] == "EUR"

    def test_version_stores_exchange_rates(self, sample_multi_currency_quote_version):
        """Test that version stores exchange rates used"""
        version = sample_multi_currency_quote_version

        assert "EUR" in version.exchange_rates_used
        assert "RUB" in version.exchange_rates_used
        assert version.exchange_rates_used["EUR"] == "1.08"
        assert version.exchange_rates_used["RUB"] == "0.0105"

    def test_version_has_rates_source(self, sample_multi_currency_quote_version):
        """Test that version identifies rates source"""
        version = sample_multi_currency_quote_version
        assert version.rates_source in ["cbr", "manual", "mixed"]


class TestRecalculationWithFreshRates:
    """Test quote recalculation with fresh exchange rates"""

    @pytest.fixture
    def version_with_old_rates(self):
        """Version with old exchange rates"""
        return {
            "id": str(uuid4()),
            "quote_id": str(uuid4()),
            "version_number": 1,
            "quote_variables": {
                "logistics_supplier_hub": {"value": 1500.00, "currency": "EUR"},
                "logistics_hub_customs": {"value": 800.00, "currency": "EUR"},
            },
            "products_snapshot": [{"sku": "TEST", "base_price_vat": 100.00}],
            "exchange_rates_used": {
                "EUR": "1.05",  # Old rate
            },
            "calculation_results": {},
            "total_usd": 2500.00,
            "total_quote_currency": 2500.00,
        }

    @pytest.mark.asyncio
    async def test_recalculation_creates_new_version(self, version_with_old_rates):
        """Test that recalculation creates a new version"""
        from services.quote_version_service import QuoteVersionService

        service = QuoteVersionService()
        quote_id = UUID(version_with_old_rates["quote_id"])
        org_id = uuid4()
        user_id = uuid4()

        # Mock the fetch_current_version to return old version
        with patch.object(service, '_fetch_current_version', return_value=version_with_old_rates):
            with patch.object(service, 'create_version', new_callable=AsyncMock) as mock_create:
                # Set up mock return value
                mock_create.return_value = QuoteVersion(
                    id=uuid4(),
                    quote_id=quote_id,
                    version_number=2,
                    status="draft",
                    quote_variables=version_with_old_rates["quote_variables"],
                    products_snapshot=version_with_old_rates["products_snapshot"],
                    exchange_rates_used={"EUR": "1.08"},  # New rate
                    rates_source="cbr",
                    calculation_results={},
                    total_usd=Decimal("2500.00"),
                    total_quote_currency=Decimal("2500.00"),
                    created_by=user_id,
                    created_at=datetime.now(timezone.utc),
                    change_reason="Recalculated with fresh rates",
                    parent_version_id=UUID(version_with_old_rates["id"]),
                )

                # Call recalculate
                result = await service.recalculate_with_fresh_rates(
                    quote_id=quote_id,
                    org_id=org_id,
                    user_id=user_id,
                )

                # Verify new version was created
                assert result.version_number == 2
                assert result.change_reason == "Recalculated with fresh rates"
                assert result.parent_version_id == UUID(version_with_old_rates["id"])


class TestManualVsCBRRates:
    """Test behavior with manual rates vs CBR rates"""

    @pytest.mark.asyncio
    async def test_manual_rates_take_priority(self):
        """Test that manual rates are used when org enables them"""
        from services.multi_currency_service import MultiCurrencyService

        service = MultiCurrencyService()
        org_id = uuid4()

        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=True):
            with patch.object(service, '_get_manual_rate', new_callable=AsyncMock, return_value=Decimal("1.10")):
                result = await service.convert_to_usd(
                    value=Decimal("1000.00"),
                    from_currency="EUR",
                    org_id=org_id
                )

                assert result.rate_source == "manual"
                assert result.rate_used == Decimal("1.10")
                assert result.value_usd == Decimal("1100.00")

    @pytest.mark.asyncio
    async def test_fallback_to_cbr_when_manual_not_set(self):
        """Test fallback to CBR when manual rate not configured"""
        from services.multi_currency_service import MultiCurrencyService

        service = MultiCurrencyService()
        org_id = uuid4()

        with patch.object(service, '_get_org_uses_manual_rates', new_callable=AsyncMock, return_value=True):
            with patch.object(service, '_get_manual_rate', new_callable=AsyncMock, return_value=None):
                with patch.object(service, '_get_cbr_rate_to_usd', new_callable=AsyncMock, return_value=Decimal("1.08")):
                    result = await service.convert_to_usd(
                        value=Decimal("1000.00"),
                        from_currency="EUR",
                        org_id=org_id
                    )

                    assert result.rate_source == "cbr"
                    assert result.rate_used == Decimal("1.08")
