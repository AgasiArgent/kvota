"""
USD vs Quote Currency Calculation Engine Comparison Tests

Purpose: Validate that the USD-based calculation engine produces mathematically
equivalent results to the quote-currency engine.

Strategy:
1. Run same inputs through both engines
2. Old engine: Gets exchange rate to quote currency → results in quote currency
3. New engine: Gets exchange rate to USD → results in USD
4. Convert old results to USD: old_result / usd_to_quote_rate
5. Compare: Should be equal within tolerance (0.01)
"""
import pytest
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict

# Import both engines
import calculation_engine as engine_quote
import calculation_engine_usd as engine_usd
from calculation_models import SupplierCountry


def round_decimal(value: Decimal, places: int = 4) -> Decimal:
    """Round decimal to specified places"""
    if places == 4:
        return value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    elif places == 2:
        return value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    return value


@pytest.mark.calculation
@pytest.mark.unit
class TestPhase1Comparison:
    """Compare Phase 1 (Purchase Price) between engines"""

    def test_eur_product_rub_quote(self):
        """
        Product: 100 EUR
        Quote currency: RUB

        Exchange rates (via RUB as CBR base):
        - EUR/RUB = 100 (1 EUR = 100 RUB)
        - USD/RUB = 90 (1 USD = 90 RUB)
        - EUR/USD = 100/90 = 1.111 (1 EUR = 1.111 USD)
        """
        # Test inputs
        base_price_VAT = Decimal("120")  # 120 EUR with 20% VAT
        quantity = 10
        supplier_discount = Decimal("0")  # No discount
        vat_seller_country = Decimal("0.20")  # 20% VAT
        supplier_country = SupplierCountry.TURKEY

        # Exchange rates
        eur_to_rub = Decimal("100")  # 1 EUR = 100 RUB
        usd_to_rub = Decimal("90")   # 1 USD = 90 RUB
        eur_to_usd = eur_to_rub / usd_to_rub  # 1.111...

        # Calculate exchange rate for engines
        # Old engine: base → quote currency (EUR → RUB)
        # Formula uses division: R16 = P16 / exchange_rate
        # So exchange_rate = 1/eur_to_rub = 0.01 (how many EUR per RUB)
        exchange_rate_to_quote = Decimal("1") / eur_to_rub

        # New engine: base → USD (EUR → USD)
        # Same formula: R16 = P16 / exchange_rate
        # exchange_rate = 1/eur_to_usd = 0.9 (how many EUR per USD)
        exchange_rate_to_usd = Decimal("1") / eur_to_usd

        # Run old engine (quote currency = RUB)
        result_quote = engine_quote.phase1_purchase_price(
            base_price_VAT=base_price_VAT,
            quantity=quantity,
            supplier_discount=supplier_discount,
            exchange_rate=exchange_rate_to_quote,
            vat_seller_country=vat_seller_country,
            supplier_country=supplier_country
        )

        # Run new engine (USD)
        result_usd = engine_usd.phase1_purchase_price(
            base_price_VAT=base_price_VAT,
            quantity=quantity,
            supplier_discount=supplier_discount,
            exchange_rate=exchange_rate_to_usd,
            vat_seller_country=vat_seller_country,
            supplier_country=supplier_country
        )

        # Convert old results (RUB) to USD for comparison
        usd_to_quote_rate = usd_to_rub  # 90 RUB per USD
        result_quote_in_usd = {
            "N16": result_quote["N16"],  # Still in base currency (EUR)
            "P16": result_quote["P16"],  # Still in base currency (EUR)
            "R16": round_decimal(result_quote["R16"] / usd_to_quote_rate),
            "S16": round_decimal(result_quote["S16"] / usd_to_quote_rate),
        }

        # Compare
        tolerance = Decimal("0.01")

        # N16, P16 should be identical (base currency, no conversion)
        assert result_quote["N16"] == result_usd["N16"], f"N16 mismatch"
        assert result_quote["P16"] == result_usd["P16"], f"P16 mismatch"

        # R16, S16 should be equivalent when converted
        diff_R16 = abs(result_quote_in_usd["R16"] - result_usd["R16"])
        diff_S16 = abs(result_quote_in_usd["S16"] - result_usd["S16"])

        assert diff_R16 <= tolerance, f"R16 diff {diff_R16} > tolerance {tolerance}"
        assert diff_S16 <= tolerance, f"S16 diff {diff_S16} > tolerance {tolerance}"

    def test_usd_product_usd_quote(self):
        """
        Product: 100 USD
        Quote currency: USD

        Both engines should produce identical results (no conversion needed)
        """
        base_price_VAT = Decimal("120")  # 120 USD with 20% VAT
        quantity = 5
        supplier_discount = Decimal("10")  # 10% discount
        vat_seller_country = Decimal("0.20")
        supplier_country = SupplierCountry.TURKEY

        # Exchange rate = 1 (USD to USD)
        exchange_rate = Decimal("1")

        result_quote = engine_quote.phase1_purchase_price(
            base_price_VAT=base_price_VAT,
            quantity=quantity,
            supplier_discount=supplier_discount,
            exchange_rate=exchange_rate,
            vat_seller_country=vat_seller_country,
            supplier_country=supplier_country
        )

        result_usd = engine_usd.phase1_purchase_price(
            base_price_VAT=base_price_VAT,
            quantity=quantity,
            supplier_discount=supplier_discount,
            exchange_rate=exchange_rate,
            vat_seller_country=vat_seller_country,
            supplier_country=supplier_country
        )

        # Results should be IDENTICAL (same currency, same rate)
        assert result_quote["N16"] == result_usd["N16"]
        assert result_quote["P16"] == result_usd["P16"]
        assert result_quote["R16"] == result_usd["R16"]
        assert result_quote["S16"] == result_usd["S16"]

    def test_china_product_no_vat(self):
        """
        China products have no VAT in base price (special case)
        """
        base_price_VAT = Decimal("100")  # Already VAT-free for China
        quantity = 10
        supplier_discount = Decimal("0")
        vat_seller_country = Decimal("0.13")  # China VAT (not applied)
        supplier_country = SupplierCountry.CHINA

        cny_to_usd = Decimal("0.14")  # 1 CNY = 0.14 USD
        exchange_rate_to_usd = Decimal("1") / cny_to_usd

        result_usd = engine_usd.phase1_purchase_price(
            base_price_VAT=base_price_VAT,
            quantity=quantity,
            supplier_discount=supplier_discount,
            exchange_rate=exchange_rate_to_usd,
            vat_seller_country=vat_seller_country,
            supplier_country=supplier_country
        )

        # N16 should equal base price (no VAT removal for China)
        assert result_usd["N16"] == base_price_VAT

        # R16 should be in USD
        expected_R16 = round_decimal(base_price_VAT / exchange_rate_to_usd)
        assert result_usd["R16"] == expected_R16


@pytest.mark.calculation
@pytest.mark.unit
class TestPhase2Comparison:
    """Compare Phase 2 (Distribution Base) between engines"""

    def test_distribution_base_identical(self):
        """
        Distribution base calculation is currency-agnostic
        (it's a ratio of S16 values)
        """
        # Two products with different purchase totals
        products_S16 = [Decimal("1000"), Decimal("500")]

        S13_quote, BD16_quote = engine_quote.phase2_distribution_base(products_S16)
        S13_usd, BD16_usd = engine_usd.phase2_distribution_base(products_S16)

        # Should be identical (ratios don't depend on currency)
        assert S13_quote == S13_usd
        assert BD16_quote == BD16_usd

        # Verify ratios
        assert BD16_quote[0] == round_decimal(Decimal("1000") / Decimal("1500"), 6)
        assert BD16_quote[1] == round_decimal(Decimal("500") / Decimal("1500"), 6)


@pytest.mark.calculation
@pytest.mark.integration
class TestFullEngineComparison:
    """Full engine comparison tests"""

    @pytest.mark.skip(reason="Requires full orchestrator setup - implement after Phase 3")
    def test_single_product_full_calculation(self):
        """
        Run full 13-phase calculation through both engines
        and compare all outputs
        """
        pass

    @pytest.mark.skip(reason="Requires full orchestrator setup - implement after Phase 3")
    def test_multi_product_full_calculation(self):
        """
        Multi-product quote through both engines
        """
        pass


@pytest.mark.calculation
@pytest.mark.unit
class TestExchangeRateDirections:
    """Verify exchange rate direction understanding"""

    def test_exchange_rate_formula_understanding(self):
        """
        Document how the exchange_rate parameter works in Phase 1

        Formula: R16 = P16 / exchange_rate

        If P16 = 100 EUR and we want USD:
        - EUR/USD = 1.08 (1 EUR = 1.08 USD)
        - exchange_rate = 1/1.08 = 0.926 (how many EUR per USD)
        - R16 = 100 / 0.926 = 108 USD ✓
        """
        P16 = Decimal("100")  # 100 EUR (after VAT removal and discount)
        eur_to_usd = Decimal("1.08")  # 1 EUR = 1.08 USD

        # The exchange_rate is the INVERSE of the direct rate
        exchange_rate = Decimal("1") / eur_to_usd

        R16 = round_decimal(P16 / exchange_rate)

        # Should be approximately 108 USD
        expected = round_decimal(P16 * eur_to_usd)
        assert abs(R16 - expected) < Decimal("0.01")

    def test_rub_to_usd_conversion(self):
        """
        RUB to USD conversion example

        USD/RUB = 90 (1 USD = 90 RUB)
        To convert 9000 RUB to USD:
        - exchange_rate = 1/90 = 0.0111
        - R16 = 9000 / 0.0111 = 810,810? NO!

        Wait, the formula is wrong for this direction.
        Let me reconsider...

        Actually if base currency is RUB:
        - P16 = 9000 RUB
        - We want USD
        - RUB/USD = 90 (90 RUB = 1 USD)
        - exchange_rate = 90 (how many RUB per USD)
        - R16 = 9000 / 90 = 100 USD ✓
        """
        P16 = Decimal("9000")  # 9000 RUB
        rub_per_usd = Decimal("90")  # 90 RUB = 1 USD

        R16 = round_decimal(P16 / rub_per_usd)

        assert R16 == Decimal("100")  # 100 USD
