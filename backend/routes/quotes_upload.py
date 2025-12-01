"""
Quote Upload from Simplified Excel Template

Endpoint: POST /api/quotes/upload-excel
Accepts simplified Excel template, parses it, and runs calculation engine.

Created: 2025-11-28
"""

import io
import logging
from datetime import date, timedelta
from typing import Optional, List
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from auth import get_current_user, User
from excel_parser.simplified_parser import (
    SimplifiedExcelParser,
    SimplifiedQuoteInput,
    ProductInput,
    parse_simplified_template,
)
from calculation_models import (
    QuoteCalculationInput,
    ProductInfo,
    FinancialParams,
    LogisticsParams,
    TaxesAndDuties,
    PaymentTerms,
    CustomsAndClearance,
    CompanySettings,
    SystemConfig,
    Currency as CalcCurrency,
    SupplierCountry,
    SellerCompany,
    OfferSaleType,
    Incoterms,
    DMFeeType,
)
from calculation_engine import calculate_multiproduct_quote
from services.exchange_rate_service import get_exchange_rate_service
from services.export_validation_service import generate_validation_export
from fastapi.responses import StreamingResponse


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quotes", tags=["quotes-upload"])


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class CalculationResultSummary(BaseModel):
    """Full calculation results with all intermediate values"""
    # Quote-level totals
    total_purchase_price: str  # S13
    total_cogs: str  # AB13
    total_revenue: str  # AK13 (without VAT)
    total_revenue_with_vat: str  # AL13
    total_profit: str  # AF13
    total_financing_cost: str  # BJ11
    total_credit_interest: str  # BL5
    margin_percent: str  # profit / COGS

    # Quote-level financing (BH/BI/BJ/BL series)
    evaluated_revenue: Optional[str] = None  # BH2
    client_advance: Optional[str] = None  # BH3
    supplier_payment: Optional[str] = None  # BH6
    supplier_financing_cost: Optional[str] = None  # BJ7
    operational_financing_cost: Optional[str] = None  # BJ10

    # All products with FULL intermediate values (30+ fields each)
    products: List[dict]  # Full ProductCalculationResult as dicts

    # Exchange rates used
    exchange_rates_used: dict


class UploadResponse(BaseModel):
    """Response from upload endpoint"""
    success: bool
    message: str
    quote_input: Optional[dict] = None
    calculation_results: Optional[CalculationResultSummary] = None
    errors: Optional[list] = None


class ParseOnlyResponse(BaseModel):
    """Response when only parsing (no calculation)"""
    success: bool
    parsed_data: dict
    errors: Optional[list] = None


# ============================================================================
# CURRENCY AND ENUM MAPPINGS
# ============================================================================

# Map simplified parser Currency to calculation_models Currency
CURRENCY_MAP = {
    "USD": CalcCurrency.USD,
    "EUR": CalcCurrency.EUR,
    "RUB": CalcCurrency.RUB,
    "TRY": CalcCurrency.TRY,
    "CNY": CalcCurrency.CNY,
}

# Map supplier country strings to SupplierCountry enum
SUPPLIER_COUNTRY_MAP = {
    "Турция": SupplierCountry.TURKEY,
    "Турция (транзитная зона)": SupplierCountry.TURKEY_TRANSIT,
    "Россия": SupplierCountry.RUSSIA,
    "Китай": SupplierCountry.CHINA,
    "Литва": SupplierCountry.LITHUANIA,
    "Латвия": SupplierCountry.LATVIA,
    "Болгария": SupplierCountry.BULGARIA,
    "Польша": SupplierCountry.POLAND,
    "ЕС (закупка между странами ЕС)": SupplierCountry.EU_CROSS_BORDER,
    "ОАЭ": SupplierCountry.UAE,
    "Прочие": SupplierCountry.OTHER,
}

# Map seller company strings to SellerCompany enum
SELLER_COMPANY_MAP = {
    "МАСТЕР БЭРИНГ ООО": SellerCompany.MASTER_BEARING_RU,
    "ЦМТО1 ООО": SellerCompany.CMTO1_RU,
    "РАД РЕСУРС ООО": SellerCompany.RAD_RESURS_RU,
    "TEXCEL OTOMOTİV TİCARET LİMİTED ŞİRKETİ": SellerCompany.TEXCEL_TR,
    "GESTUS DIŞ TİCARET LİMİTED ŞİRKETİ": SellerCompany.GESTUS_TR,
    "UPDOOR Limited": SellerCompany.UPDOOR_CN,
}

# Map sale type strings to OfferSaleType enum
SALE_TYPE_MAP = {
    "поставка": OfferSaleType.SUPPLY,
    "транзит": OfferSaleType.TRANSIT,
    "финтранзит": OfferSaleType.FIN_TRANSIT,
    "экспорт": OfferSaleType.EXPORT,
}

# Map incoterms strings to Incoterms enum
INCOTERMS_MAP = {
    "DDP": Incoterms.DDP,
    "DAP": Incoterms.DAP,
    "CIF": Incoterms.CIF,
    "FOB": Incoterms.FOB,
    "EXW": Incoterms.EXW,
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_exchange_rates(quote_currency: str, product_currencies: List[str]) -> dict:
    """
    Get exchange rates from CBR for all currencies used in the quote.

    Returns dict mapping currency pair to rate, e.g.:
    {"EUR/RUB": 95.5, "USD/RUB": 88.3, ...}
    """
    service = get_exchange_rate_service()
    rates = {}

    # Get unique currencies needed
    all_currencies = set(product_currencies)
    all_currencies.add(quote_currency)

    # Get rates to RUB (CBR base currency)
    for currency in all_currencies:
        if currency == "RUB":
            rates[f"{currency}/RUB"] = Decimal("1.0")
        else:
            rate = await service.get_rate(currency, "RUB")
            if rate:
                rates[f"{currency}/RUB"] = rate
            else:
                logger.warning(f"Could not get rate for {currency}/RUB")
                rates[f"{currency}/RUB"] = Decimal("1.0")  # Fallback

    return rates


def calculate_exchange_rate(
    from_currency: str,
    to_currency: str,
    rates: dict,
    for_division: bool = False
) -> Decimal:
    """
    Calculate exchange rate between two currencies using RUB as base.

    Args:
        from_currency: Source currency (e.g., "TRY")
        to_currency: Target currency (e.g., "EUR")
        rates: Dict of currency/RUB rates from CBR
        for_division: If True, returns rate for division (to/from).
                      If False, returns rate for multiplication (from/to).

    The calculation engine uses DIVISION: R16 = P16 / exchange_rate
    So for engine's exchange_rate_base_price_to_quote, use for_division=True.

    For converting costs (multiply), use for_division=False (default).
    """
    if from_currency == to_currency:
        return Decimal("1.0")

    from_rub = rates.get(f"{from_currency}/RUB", Decimal("1.0"))
    to_rub = rates.get(f"{to_currency}/RUB", Decimal("1.0"))

    if for_division:
        # For division: rate = to_rub / from_rub
        # Example: TRY→EUR, returns 4.92 (how many TRY per 1 EUR)
        # Engine does: 83333 TRY / 4.92 = 16941 EUR
        if from_rub == 0:
            return Decimal("1.0")
        result = to_rub / from_rub
    else:
        # For multiplication: rate = from_rub / to_rub
        # Example: EUR→RUB, returns 90.78 (how many RUB per 1 EUR)
        # Usage: 1500 EUR * 90.78 = 136170 RUB
        if to_rub == 0:
            return Decimal("1.0")
        result = from_rub / to_rub

    # Round to 4 decimal places for consistency with calculation engine
    return result.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


async def map_to_calculation_inputs(
    parsed: SimplifiedQuoteInput,
    rates: dict
) -> List[QuoteCalculationInput]:
    """
    Map SimplifiedQuoteInput to list of QuoteCalculationInput (one per product).
    """
    inputs = []
    quote_currency = CURRENCY_MAP.get(parsed.quote_currency.value, CalcCurrency.EUR)

    for product in parsed.products:
        # Calculate exchange rate for this product (for_division=True for engine's R16 = P16 / rate)
        product_currency = product.currency.value
        exchange_rate = calculate_exchange_rate(
            product_currency,
            parsed.quote_currency.value,
            rates,
            for_division=True  # Engine divides by this rate
        )

        # Map supplier country
        supplier_country = SUPPLIER_COUNTRY_MAP.get(
            product.supplier_country,
            SupplierCountry.TURKEY
        )

        # Build QuoteCalculationInput
        calc_input = QuoteCalculationInput(
            product=ProductInfo(
                base_price_VAT=product.base_price_vat,
                quantity=product.quantity,
                weight_in_kg=product.weight_kg or Decimal("0"),
                currency_of_base_price=CURRENCY_MAP.get(product_currency, CalcCurrency.EUR),
                customs_code=str(product.customs_code or "8708913509").zfill(10),
            ),
            financial=FinancialParams(
                currency_of_quote=quote_currency,
                exchange_rate_base_price_to_quote=exchange_rate,
                supplier_discount=product.supplier_discount * Decimal("100"),  # Convert 0.10 -> 10%
                markup=product.markup * Decimal("100"),  # Convert 0.15 -> 15%
                rate_forex_risk=Decimal("3"),  # Default
                dm_fee_type=DMFeeType.PERCENTAGE if parsed.dm_fee_type == "% от суммы" else DMFeeType.FIXED,
                dm_fee_value=parsed.dm_fee_value,
            ),
            logistics=LogisticsParams(
                supplier_country=supplier_country,
                offer_incoterms=INCOTERMS_MAP.get(parsed.incoterms, Incoterms.DDP),
                delivery_time=parsed.delivery_time,
                # Calculate delivery_date for VAT determination (22% for 2026+)
                delivery_date=date.today() + timedelta(days=parsed.delivery_time),
                # Convert logistics costs to quote currency
                logistics_supplier_hub=parsed.logistics_supplier_hub.value * calculate_exchange_rate(
                    parsed.logistics_supplier_hub.currency.value,
                    parsed.quote_currency.value,
                    rates
                ),
                logistics_hub_customs=parsed.logistics_hub_customs.value * calculate_exchange_rate(
                    parsed.logistics_hub_customs.currency.value,
                    parsed.quote_currency.value,
                    rates
                ),
                logistics_customs_client=parsed.logistics_customs_client.value * calculate_exchange_rate(
                    parsed.logistics_customs_client.currency.value,
                    parsed.quote_currency.value,
                    rates
                ),
            ),
            taxes=TaxesAndDuties(
                import_tariff=product.import_tariff * Decimal("100"),  # Convert 0.05 -> 5%
                excise_tax=Decimal("0"),
                util_fee=Decimal("0"),
            ),
            payment=PaymentTerms(
                # All percentages: convert from decimal (0.30) to percentage (30)
                advance_from_client=next(
                    (m.percentage * Decimal("100") for m in parsed.payment_milestones if m.name == "advance_from_client"),
                    Decimal("100")
                ),
                advance_to_supplier=parsed.advance_to_supplier * Decimal("100"),  # Convert 0.50 -> 50%
                time_to_advance=next(
                    (m.days or 0 for m in parsed.payment_milestones if m.name == "advance_from_client"),
                    0
                ),
                advance_on_loading=next(
                    (m.percentage * Decimal("100") for m in parsed.payment_milestones if m.name == "advance_on_loading"),
                    Decimal("0")
                ),
                time_to_advance_loading=next(
                    (m.days or 0 for m in parsed.payment_milestones if m.name == "advance_on_loading"),
                    0
                ),
                advance_on_going_to_country_destination=next(
                    (m.percentage * Decimal("100") for m in parsed.payment_milestones if m.name == "advance_on_shipping"),
                    Decimal("0")
                ),
                time_to_advance_going_to_country_destination=next(
                    (m.days or 0 for m in parsed.payment_milestones if m.name == "advance_on_shipping"),
                    0
                ),
                advance_on_customs_clearance=next(
                    (m.percentage * Decimal("100") for m in parsed.payment_milestones if m.name == "advance_on_customs"),
                    Decimal("0")
                ),
                time_to_advance_on_customs_clearance=next(
                    (m.days or 0 for m in parsed.payment_milestones if m.name == "advance_on_customs"),
                    0
                ),
                time_to_advance_on_receiving=next(
                    (m.days or 0 for m in parsed.payment_milestones if m.name == "on_receiving"),
                    0
                ),
            ),
            customs=CustomsAndClearance(
                brokerage_hub=parsed.brokerage_hub.value * calculate_exchange_rate(
                    parsed.brokerage_hub.currency.value,
                    parsed.quote_currency.value,
                    rates
                ),
                brokerage_customs=parsed.brokerage_customs.value * calculate_exchange_rate(
                    parsed.brokerage_customs.currency.value,
                    parsed.quote_currency.value,
                    rates
                ),
                warehousing_at_customs=parsed.warehousing.value * calculate_exchange_rate(
                    parsed.warehousing.currency.value,
                    parsed.quote_currency.value,
                    rates
                ),
                customs_documentation=parsed.documentation.value * calculate_exchange_rate(
                    parsed.documentation.currency.value,
                    parsed.quote_currency.value,
                    rates
                ),
                brokerage_extra=parsed.other_costs.value * calculate_exchange_rate(
                    parsed.other_costs.currency.value,
                    parsed.quote_currency.value,
                    rates
                ),
            ),
            company=CompanySettings(
                seller_company=SELLER_COMPANY_MAP.get(parsed.seller_company, SellerCompany.MASTER_BEARING_RU),
                offer_sale_type=SALE_TYPE_MAP.get(parsed.sale_type, OfferSaleType.SUPPLY),
            ),
            system=SystemConfig(),  # Use defaults
        )

        inputs.append(calc_input)

    return inputs


def format_decimal(value: Decimal, precision: int = 2) -> str:
    """Format decimal for display"""
    return f"{value:.{precision}f}"


def serialize_product_result(result, product_input) -> dict:
    """Serialize ProductCalculationResult to dict with all fields as strings"""
    # Get all fields from the result model
    data = result.model_dump()

    # Convert all Decimal values to formatted strings
    for key, value in data.items():
        if isinstance(value, Decimal):
            data[key] = format_decimal(value, 4)  # 4 decimal places for precision
        elif value is None:
            data[key] = None

    # Add input fields for reference
    data["_input_name"] = product_input.name
    data["_input_sku"] = product_input.sku
    data["_input_brand"] = product_input.brand
    data["_input_quantity"] = product_input.quantity
    data["_input_currency"] = product_input.currency.value
    data["_input_base_price_vat"] = format_decimal(product_input.base_price_vat)
    data["_input_markup"] = format_decimal(product_input.markup)

    return data


def build_calculation_summary(
    parsed: SimplifiedQuoteInput,
    results: List,  # List[ProductCalculationResult]
    rates: dict
) -> CalculationResultSummary:
    """Build summary from calculation results with ALL intermediate values"""

    # Serialize all products with full intermediate values
    products = []
    for product_input, product_result in zip(parsed.products, results):
        products.append(serialize_product_result(product_result, product_input))

    # Calculate totals by summing across all products
    total_purchase = sum(r.purchase_price_total_quote_currency for r in results)
    total_cogs = sum(r.cogs_per_product for r in results)
    total_profit = sum(r.profit for r in results)
    total_revenue_no_vat = sum(r.sales_price_total_no_vat for r in results)
    total_revenue_with_vat = sum(r.sales_price_total_with_vat for r in results)
    total_financing_cost = sum(r.financing_cost_initial + r.financing_cost_credit for r in results)
    total_credit_interest = Decimal("0")  # Will be populated from quote-level if available

    # Margin = Profit / COGS (as percentage)
    margin_percent = (total_profit / total_cogs * Decimal("100")) if total_cogs > 0 else Decimal("0")

    # Get quote-level financing from first product (if available)
    first_result = results[0] if results else None
    evaluated_revenue = first_result.quote_level_evaluated_revenue if first_result and first_result.quote_level_evaluated_revenue else None
    client_advance = first_result.quote_level_client_advance if first_result and first_result.quote_level_client_advance else None
    supplier_payment = first_result.quote_level_supplier_payment if first_result and first_result.quote_level_supplier_payment else None
    supplier_financing_cost = first_result.quote_level_supplier_financing_cost if first_result and first_result.quote_level_supplier_financing_cost else None
    operational_financing_cost = first_result.quote_level_operational_financing_cost if first_result and first_result.quote_level_operational_financing_cost else None

    if first_result and first_result.quote_level_credit_sales_interest:
        total_credit_interest = first_result.quote_level_credit_sales_interest

    return CalculationResultSummary(
        total_purchase_price=format_decimal(total_purchase),
        total_cogs=format_decimal(total_cogs),
        total_revenue=format_decimal(total_revenue_no_vat),
        total_revenue_with_vat=format_decimal(total_revenue_with_vat),
        total_profit=format_decimal(total_profit),
        total_financing_cost=format_decimal(total_financing_cost),
        total_credit_interest=format_decimal(total_credit_interest),
        margin_percent=format_decimal(margin_percent),
        evaluated_revenue=format_decimal(evaluated_revenue) if evaluated_revenue else None,
        client_advance=format_decimal(client_advance) if client_advance else None,
        supplier_payment=format_decimal(supplier_payment) if supplier_payment else None,
        supplier_financing_cost=format_decimal(supplier_financing_cost) if supplier_financing_cost else None,
        operational_financing_cost=format_decimal(operational_financing_cost) if operational_financing_cost else None,
        products=products,
        exchange_rates_used={k: format_decimal(v, 4) for k, v in rates.items()},
    )


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/upload-excel", response_model=UploadResponse)
async def upload_excel_quote(
    file: UploadFile = File(...),
    calculate: bool = True,
    user: User = Depends(get_current_user),
):
    """
    Upload simplified Excel template and optionally run calculation.

    Args:
        file: Excel file (.xlsx)
        calculate: If True, run calculation engine after parsing

    Returns:
        UploadResponse with parsed data and calculation results
    """
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an Excel file (.xlsx)"
        )

    try:
        # Read file content
        content = await file.read()
        file_stream = io.BytesIO(content)

        # Parse Excel
        parser = SimplifiedExcelParser(file_stream)
        parsed_data = parser.parse()

        if not calculate:
            return UploadResponse(
                success=True,
                message="File parsed successfully",
                quote_input=parsed_data.dict(),
                calculation_results=None,
            )

        # Get exchange rates
        product_currencies = [p.currency.value for p in parsed_data.products]
        rates = await get_exchange_rates(parsed_data.quote_currency.value, product_currencies)

        # Map to calculation inputs
        calc_inputs = await map_to_calculation_inputs(parsed_data, rates)

        # Run calculation
        calc_result = calculate_multiproduct_quote(calc_inputs)

        # Build summary
        summary = build_calculation_summary(parsed_data, calc_result, rates)

        return UploadResponse(
            success=True,
            message="File parsed and calculated successfully",
            quote_input=parsed_data.dict(),
            calculation_results=summary,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.exception("Error processing Excel upload")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )


@router.post("/parse-excel", response_model=ParseOnlyResponse)
async def parse_excel_only(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """
    Parse Excel template without running calculation.
    Useful for validation and preview.

    Args:
        file: Excel file (.xlsx)

    Returns:
        ParseOnlyResponse with parsed data
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an Excel file (.xlsx)"
        )

    try:
        content = await file.read()
        file_stream = io.BytesIO(content)

        parser = SimplifiedExcelParser(file_stream)
        parsed_data = parser.parse()

        return ParseOnlyResponse(
            success=True,
            parsed_data=parsed_data.dict(),
        )

    except ValueError as e:
        return ParseOnlyResponse(
            success=False,
            parsed_data={},
            errors=[str(e)],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )


@router.post("/upload-excel-validation")
async def upload_excel_with_validation_export(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """
    Upload Excel, run calculation, and return validation Excel file.

    The validation Excel contains:
    - API_Inputs tab: All uploaded input values
    - расчет tab: Modified to reference API_Inputs (formulas recalculate)
    - API_Results tab: API calculation outputs
    - Comparison tab: Detailed comparison with >0.01% differences highlighted

    Returns:
        Excel file (.xlsm) as downloadable attachment
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an Excel file (.xlsx)"
        )

    try:
        # Read file content
        content = await file.read()
        file_stream = io.BytesIO(content)

        # Parse Excel
        parser = SimplifiedExcelParser(file_stream)
        parsed_data = parser.parse()

        # Get exchange rates
        product_currencies = [p.currency.value for p in parsed_data.products]
        rates = await get_exchange_rates(parsed_data.quote_currency.value, product_currencies)

        # Map to calculation inputs
        calc_inputs = await map_to_calculation_inputs(parsed_data, rates)

        # Run calculation
        calc_results = calculate_multiproduct_quote(calc_inputs)

        # Build quote-level inputs dict
        quote_inputs = {
            "seller_company": parsed_data.seller_company,
            "offer_sale_type": parsed_data.sale_type,
            "incoterms": parsed_data.incoterms,
            "quote_currency": parsed_data.quote_currency.value,
            "delivery_time": parsed_data.delivery_time,
            "advance_to_supplier": float(parsed_data.advance_to_supplier),
            # Payment milestones
            "advance_from_client": float(parsed_data.payment_milestones[0].percentage) if parsed_data.payment_milestones else 0,
            "time_to_advance": parsed_data.payment_milestones[0].days if parsed_data.payment_milestones else 0,
            # Days to payment after receipt (F7 in расчет) - from on_receiving milestone
            "time_to_payment": next(
                (m.days or 0 for m in parsed_data.payment_milestones if m.name == "on_receiving"),
                0
            ),
            # Logistics costs
            "logistics_supplier_hub": float(parsed_data.logistics_supplier_hub.value),
            "logistics_hub_customs": float(parsed_data.logistics_hub_customs.value),
            "logistics_customs_client": float(parsed_data.logistics_customs_client.value),
            # Brokerage costs
            "brokerage_hub": float(parsed_data.brokerage_hub.value),
            "brokerage_customs": float(parsed_data.brokerage_customs.value),
            "warehousing": float(parsed_data.warehousing.value),
            "documentation": float(parsed_data.documentation.value),
            "other_costs": float(parsed_data.other_costs.value),
            # DM Fee
            "dm_fee_type": parsed_data.dm_fee_type,
            "dm_fee_value": float(parsed_data.dm_fee_value),
            # Admin settings (defaults)
            "rate_forex_risk": 0.03,  # 3%
        }

        # Build product inputs list
        product_inputs = []
        for p in parsed_data.products:
            product_inputs.append({
                "brand": p.brand or "",
                "sku": p.sku or "",
                "name": p.name,
                "quantity": p.quantity,
                "weight_in_kg": float(p.weight_kg) if p.weight_kg else 0,
                "currency_of_base_price": p.currency.value,
                "base_price_vat": float(p.base_price_vat),
                "supplier_country": p.supplier_country if p.supplier_country else "Турция",
                "supplier_discount": float(p.supplier_discount) if p.supplier_discount else 0,
                "exchange_rate": float(calculate_exchange_rate(p.currency.value, parsed_data.quote_currency.value, rates, for_division=True)),
                "customs_code": p.customs_code or "",
                "import_tariff": float(p.import_tariff) if p.import_tariff else 0,
                "markup": float(p.markup),
            })

        # Build API results dict (quote-level)
        total_purchase = sum(r.purchase_price_total_quote_currency for r in calc_results)
        total_cogs = sum(r.cogs_per_product for r in calc_results)
        total_profit = sum(r.profit for r in calc_results)
        total_revenue_no_vat = sum(r.sales_price_total_no_vat for r in calc_results)
        total_revenue_with_vat = sum(r.sales_price_total_with_vat for r in calc_results)
        # Logistics totals
        total_logistics_first = sum(r.logistics_first_leg for r in calc_results)
        total_logistics_last = sum(r.logistics_last_leg for r in calc_results)
        total_logistics = sum(r.logistics_total for r in calc_results)

        first_result = calc_results[0] if calc_results else None

        api_results = {
            # Quote totals
            "total_purchase_price": float(total_purchase),
            "total_logistics_first": float(total_logistics_first),
            "total_logistics_last": float(total_logistics_last),
            "total_logistics": float(total_logistics),
            "total_cogs": float(total_cogs),
            "total_revenue": float(total_revenue_no_vat),
            "total_revenue_with_vat": float(total_revenue_with_vat),
            "total_profit": float(total_profit),
            # Financing
            "evaluated_revenue": float(first_result.quote_level_evaluated_revenue) if first_result and first_result.quote_level_evaluated_revenue else 0,
            "client_advance": float(first_result.quote_level_client_advance) if first_result and first_result.quote_level_client_advance else 0,
            "total_before_forwarding": float(first_result.quote_level_total_before_forwarding) if first_result and hasattr(first_result, 'quote_level_total_before_forwarding') and first_result.quote_level_total_before_forwarding else 0,
            "supplier_payment": float(first_result.quote_level_supplier_payment) if first_result and first_result.quote_level_supplier_payment else 0,
            "supplier_financing_cost": float(first_result.quote_level_supplier_financing_cost) if first_result and first_result.quote_level_supplier_financing_cost else 0,
            "operational_financing_cost": float(first_result.quote_level_operational_financing_cost) if first_result and first_result.quote_level_operational_financing_cost else 0,
            "total_financing_cost": float(first_result.quote_level_total_financing_cost) if first_result and first_result.quote_level_total_financing_cost else 0,
            "credit_sales_amount": float(first_result.quote_level_credit_sales_amount) if first_result and hasattr(first_result, 'quote_level_credit_sales_amount') and first_result.quote_level_credit_sales_amount else 0,
            "credit_sales_fv": float(first_result.quote_level_credit_sales_fv) if first_result and hasattr(first_result, 'quote_level_credit_sales_fv') and first_result.quote_level_credit_sales_fv else 0,
            "credit_sales_interest": float(first_result.quote_level_credit_sales_interest) if first_result and first_result.quote_level_credit_sales_interest else 0,
        }

        # Build product results list
        product_results = []
        for r in calc_results:
            product_results.append({
                "purchase_price_no_vat": float(r.purchase_price_no_vat),
                "purchase_price_after_discount": float(r.purchase_price_after_discount),
                "purchase_price_per_unit_quote_currency": float(r.purchase_price_per_unit_quote_currency),
                "purchase_price_total_quote_currency": float(r.purchase_price_total_quote_currency),
                "logistics_first_leg": float(r.logistics_first_leg),
                "logistics_last_leg": float(r.logistics_last_leg),
                "logistics_total": float(r.logistics_total),
                "customs_fee": float(r.customs_fee),
                "excise_tax_amount": float(r.excise_tax_amount),
                "cogs_per_unit": float(r.cogs_per_unit),
                "cogs_per_product": float(r.cogs_per_product),
                "sale_price_per_unit_excl_financial": float(r.sale_price_per_unit_excl_financial),
                "sale_price_total_excl_financial": float(r.sale_price_total_excl_financial),
                "profit": float(r.profit),
                "dm_fee": float(r.dm_fee),
                "forex_reserve": float(r.forex_reserve),
                "financial_agent_fee": float(r.financial_agent_fee),
                "sales_price_per_unit_no_vat": float(r.sales_price_per_unit_no_vat),
                "sales_price_total_no_vat": float(r.sales_price_total_no_vat),
                "sales_price_total_with_vat": float(r.sales_price_total_with_vat),
                "sales_price_per_unit_with_vat": float(r.sales_price_per_unit_with_vat),
                "vat_from_sales": float(r.vat_from_sales),
                "vat_on_import": float(r.vat_on_import),
                "vat_net_payable": float(r.vat_net_payable),
                "transit_commission": float(r.transit_commission),
                "internal_sale_price_per_unit": float(r.internal_sale_price_per_unit),
                "internal_sale_price_total": float(r.internal_sale_price_total),
                "financing_cost_initial": float(r.financing_cost_initial),
                "financing_cost_credit": float(r.financing_cost_credit),
            })

        # Generate validation Excel
        excel_bytes = generate_validation_export(
            quote_inputs=quote_inputs,
            product_inputs=product_inputs,
            api_results=api_results,
            product_results=product_results,
        )

        # Return as downloadable file
        filename = f"validation_{file.filename.replace('.xlsx', '').replace('.xls', '')}.xlsm"

        return StreamingResponse(
            io.BytesIO(excel_bytes),
            media_type="application/vnd.ms-excel.sheet.macroEnabled.12",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.exception("Error generating validation export")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )
