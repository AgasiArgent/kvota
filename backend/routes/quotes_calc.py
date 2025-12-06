"""
Quote Calculation Routes - Excel/CSV Upload and Calculation Engine Integration
Uses Supabase client (NOT asyncpg) following customers.py pattern
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, date, timedelta
import os
import io
import asyncio
import logging
import re

from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, status, Request
from fastapi.responses import JSONResponse, StreamingResponse
from supabase import Client
import pandas as pd

from auth import get_current_user, User
from dependencies import get_supabase
from pydantic import BaseModel, Field
from decimal import Decimal

# Import calculation engine
from calculation_engine import calculate_single_product_quote, calculate_multiproduct_quote

# Import activity logging
from services.activity_log_service import log_activity_decorator

# Setup logger
logger = logging.getLogger(__name__)
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
    Currency,
    SupplierCountry,
    SellerCompany,
    OfferSaleType,
    Incoterms,
    DMFeeType
)


# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/quotes-calc",
    tags=["quotes-calculation"],
    dependencies=[Depends(get_current_user)]
)




# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_quote_number(supabase_client: Client, organization_id: str) -> str:
    """
    Generate next sequential quote number for organization.
    Format: КП{YY}-{NNNN} (e.g., КП25-0001)

    Uses MAX(quote_number) approach to avoid race conditions.
    Filters by current year to reset numbering each year.

    Args:
        supabase_client: Supabase client instance
        organization_id: Organization UUID

    Returns:
        str: Next quote number (e.g., "КП25-0001")
    """
    current_year = datetime.now().year
    year_short = str(current_year)[-2:]  # Last 2 digits (2025 → 25)
    year_prefix = f"КП{year_short}-"

    # Query for maximum quote_number starting with this year's prefix
    quotes_response = supabase_client.table("quotes")\
        .select("quote_number")\
        .eq("organization_id", str(organization_id))\
        .like("quote_number", f"{year_prefix}%")\
        .order("quote_number", desc=True)\
        .limit(1)\
        .execute()

    if quotes_response.data and len(quotes_response.data) > 0:
        # Extract numeric part from last quote number (e.g., "КП25-0042" → 42)
        last_quote = quotes_response.data[0]["quote_number"]
        match = re.search(r'-(\d+)$', last_quote)
        if match:
            last_number = int(match.group(1))
            next_number = last_number + 1
        else:
            # Fallback if regex fails
            next_number = 1
    else:
        # No quotes for this year yet
        next_number = 1

    # Format: КП25-0001
    quote_number = f"{year_prefix}{str(next_number).zfill(4)}"
    return quote_number


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ProductFromFile(BaseModel):
    """Product parsed from Excel/CSV file"""
    sku: Optional[str] = None  # Артикул
    brand: Optional[str] = None  # Бренд
    product_name: str
    product_code: Optional[str] = None
    base_price_vat: float
    quantity: int
    weight_in_kg: Optional[float] = 0
    customs_code: Optional[str] = None
    supplier_country: Optional[str] = None

    # Product-level override fields (can override quote-level defaults)
    currency_of_base_price: Optional[str] = None
    exchange_rate_base_price_to_quote: Optional[float] = None
    supplier_discount: Optional[float] = None
    markup: Optional[float] = None
    import_tariff: Optional[float] = None
    excise_tax: Optional[float] = None
    util_fee: Optional[float] = None
    custom_fields: Optional[Dict[str, Any]] = None  # Frontend sends this


class FileUploadResponse(BaseModel):
    """Response after file upload"""
    success: bool
    products: List[ProductFromFile]
    total_count: int
    message: str


class VariableTemplateCreate(BaseModel):
    """Create variable template"""
    name: str
    description: Optional[str] = None
    variables: Dict[str, Any]  # All 39 variables as dict
    is_default: bool = False


class VariableTemplate(BaseModel):
    """Variable template response"""
    id: str
    organization_id: str
    name: str
    description: Optional[str] = None
    variables: Dict[str, Any]
    created_by: str
    created_at: str
    is_default: bool


class QuoteCalculationRequest(BaseModel):
    """Request to calculate a quote"""
    customer_id: str
    contact_id: Optional[str] = None  # Customer contact person
    title: str
    description: Optional[str] = None
    quote_date: date  # Quote creation date
    valid_until: date  # Quote validity date
    products: List[ProductFromFile]
    variables: Dict[str, Any]  # All 39 calculation variables
    template_id: Optional[str] = None


class QuoteCalculationResult(BaseModel):
    """Result of quote calculation"""
    quote_id: str
    quote_number: str
    customer_id: str
    title: str
    items: List[Dict[str, Any]]  # List of products with all calculation results
    totals: Dict[str, Any]
    calculated_at: str


# ============================================================================
# HELPER FUNCTIONS - Variable Mapping
# ============================================================================

def safe_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    """Safely convert value to Decimal"""
    if value is None or value == "":
        return default
    try:
        return Decimal(str(value))
    except (ValueError, TypeError, Exception):  # Catch InvalidOperation and others
        return default


def safe_str(value: Any, default: str = "") -> str:
    """Safely convert value to string"""
    if value is None or value == "":
        return default
    return str(value)


def safe_int(value: Any, default: int = 0) -> int:
    """Safely convert value to int"""
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def get_value(field_name: str, product: ProductFromFile, variables: Dict[str, Any], default: Any = None) -> Any:
    """
    Get value using two-tier logic: product override > quote default > fallback default

    Args:
        field_name: Name of the field to retrieve
        product: ProductFromFile object with potential overrides
        variables: Quote-level default variables dict
        default: Fallback default if not found anywhere

    Returns:
        Value from product override, quote default, or fallback (in that order)
    """
    # Check product override first
    product_value = getattr(product, field_name, None)
    if product_value is not None and product_value != "":
        return product_value

    # Check quote-level default
    quote_value = variables.get(field_name)
    if quote_value is not None and quote_value != "":
        return quote_value

    # Return fallback default
    return default


async def get_exchange_rate_async(from_currency: str, to_currency: str) -> Decimal:
    """Get exchange rate from in-memory CBR cache.

    Uses ExchangeRateService which caches CBR rates in memory (refreshed daily at 12:05 MSK).
    No database queries - instant lookup.

    Returns rate to multiply by (e.g., 1 USD = 100 RUB means rate is 100)
    """
    # Same currency shortcut
    if from_currency == to_currency:
        return Decimal("1.0")

    from services.exchange_rate_service import get_exchange_rate_service
    service = get_exchange_rate_service()

    # get_rate handles cross-rates via RUB automatically
    rate = await service.get_rate(from_currency, to_currency)

    if rate is None:
        logger.warning(f"No exchange rate found for {from_currency} -> {to_currency}, using 1.0")
        return Decimal("1.0")

    return rate


def get_exchange_rate(from_currency: str, to_currency: str, supabase: Client) -> Decimal:
    """Synchronous wrapper for get_exchange_rate_async.

    DEPRECATED: Use get_exchange_rate_async directly in async contexts.
    This wrapper exists for backward compatibility with sync code paths.
    """
    # Same currency shortcut (no async needed)
    if from_currency == to_currency:
        return Decimal("1.0")

    # Run async function in event loop
    import asyncio
    try:
        loop = asyncio.get_running_loop()
        # We're in an async context, create a task
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, get_exchange_rate_async(from_currency, to_currency))
            return future.result()
    except RuntimeError:
        # No running loop, we can use asyncio.run directly
        return asyncio.run(get_exchange_rate_async(from_currency, to_currency))


def get_converted_monetary_value(
    supabase: Optional[Client],
    field_name: str,
    variables: Dict[str, Any],
    quote_currency: str,
    default: Decimal = Decimal("0")
) -> Decimal:
    """
    Get monetary field value converted to quote currency.

    Checks monetary_fields for value+currency pair, converts to quote currency.
    Falls back to raw value if no monetary_fields entry exists.

    Args:
        supabase: Supabase client for exchange rate lookups (can be None if no conversion needed)
        field_name: Name of the field (e.g., 'logistics_supplier_hub')
        variables: Quote variables dict containing monetary_fields
        quote_currency: Target currency to convert to (e.g., 'RUB')
        default: Default value if field not found

    Returns:
        Value converted to quote currency as Decimal

    Raises:
        ValueError: If currency conversion needed but supabase is None
    """
    monetary_fields = variables.get('monetary_fields', {})

    # Check if this field has currency info in monetary_fields
    if field_name in monetary_fields:
        monetary_value = monetary_fields[field_name]
        if isinstance(monetary_value, dict) and 'value' in monetary_value and 'currency' in monetary_value:
            value = Decimal(str(monetary_value['value'])) if monetary_value['value'] else Decimal("0")
            source_currency = monetary_value['currency']

            if source_currency != quote_currency:
                if supabase is None:
                    raise ValueError(f"supabase client required for currency conversion of {field_name}")
                rate = get_exchange_rate(source_currency, quote_currency, supabase)
                converted = value * rate
                logger.info(f"Currency conversion: {field_name} {value} {source_currency} -> {converted:.2f} {quote_currency} (rate: {rate})")
                return converted
            return value

    # Fallback to raw value (no currency conversion)
    raw_value = variables.get(field_name)
    return safe_decimal(raw_value, default)


def get_rates_snapshot_to_usd(quote_date: date, supabase: Optional[Client] = None) -> Dict[str, Any]:
    """
    Get snapshot of all exchange rates to USD for audit trail.

    Args:
        quote_date: Date for rate lookup (CBR rates are date-specific)
        supabase: Optional Supabase client (uses in-memory cache if None)

    Returns:
        Dict with currency pair rates and metadata
    """
    return {
        "EUR_USD": float(get_exchange_rate("EUR", "USD", supabase)),
        "RUB_USD": float(get_exchange_rate("RUB", "USD", supabase)),
        "TRY_USD": float(get_exchange_rate("TRY", "USD", supabase)),
        "CNY_USD": float(get_exchange_rate("CNY", "USD", supabase)),
        "quote_date": quote_date.isoformat(),
        "source": "cbr"
    }


def map_variables_to_calculation_input(
    product: ProductFromFile,
    variables: Dict[str, Any],
    admin_settings: Dict[str, Decimal],
    quote_date: date,
    quote_currency: str = "USD",
    supabase: Optional[Client] = None
) -> QuoteCalculationInput:
    """
    Transform flat variables dict + product into nested QuoteCalculationInput.

    Implements two-tier variable system:
    - Product-level values override quote-level defaults
    - Quote-level defaults override hardcoded fallbacks
    - Monetary fields are converted to quote currency using exchange rates

    Args:
        product: Product from Excel/CSV with potential field overrides
        variables: Quote-level default variables (flat dict from frontend)
        admin_settings: Admin settings with rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
        quote_date: Quote creation date (for delivery_date calculation)
        quote_currency: Target currency for calculations (e.g., 'RUB')
        supabase: Supabase client for exchange rate lookups (optional for tests with manual rates)

    Returns:
        QuoteCalculationInput with all nested models populated

    Raises:
        ValueError: If required fields are missing or supabase required but not provided
    """

    # ========== ProductInfo (5 fields) ==========
    product_info = ProductInfo(
        base_price_VAT=safe_decimal(product.base_price_vat),
        quantity=product.quantity,
        weight_in_kg=safe_decimal(product.weight_in_kg, Decimal("0")),
        currency_of_base_price=Currency(get_value('currency_of_base_price', product, variables, 'USD')),
        customs_code=safe_str(get_value('customs_code', product, variables, '0000000000'))
    )

    # ========== FinancialParams (7 fields) ==========
    # USD is the canonical calculation currency (internal accounting)
    # Quote currency (RUB, EUR, etc.) is only for client-facing output

    # Exchange rate for Phase 1: Phase 1 formula is R16 = P16 / Q16 (DIVIDES by rate)
    # Q16 format: "how many units of base currency per 1 USD"
    # e.g., for RUB: Q16 = 78.25 (78.25 RUB = 1 USD), so 1000 RUB / 78.25 = 12.77 USD
    # e.g., for EUR: Q16 = 0.86 (0.86 EUR = 1 USD), so 1000 EUR / 0.86 = 1163 USD

    # Always use CBR exchange rate from in-memory cache
    # Frontend may send exchange_rate_base_price_to_quote but we ignore it
    # This ensures correct currency conversion using daily CBR rates
    base_currency = product_info.currency_of_base_price.value

    # get_exchange_rate returns multiplier format (e.g., EUR->USD = 1.08)
    # Phase 1 needs divisor format: R16 = P16 / Q16
    rate_multiplier = get_exchange_rate(base_currency, "USD", supabase)

    # Invert to get divisor format for Phase 1
    # e.g., if EUR->USD = 1.08, then Q16 = 1/1.08 = 0.926
    # So 100 EUR / 0.926 = 108 USD (correct conversion)
    exchange_rate_for_phase1 = Decimal("1") / rate_multiplier if rate_multiplier > 0 else Decimal("1")
    logger.info(f"Using CBR exchange rate for {base_currency}->USD: {exchange_rate_for_phase1} (1/{rate_multiplier})")

    financial = FinancialParams(
        currency_of_quote=Currency("USD"),  # Always USD for internal calculation
        exchange_rate_base_price_to_quote=exchange_rate_for_phase1,
        supplier_discount=safe_decimal(
            get_value('supplier_discount', product, variables),
            Decimal("0")
        ),
        markup=safe_decimal(
            get_value('markup', product, variables),
            Decimal("15")
        ),
        rate_forex_risk=admin_settings.get('rate_forex_risk', Decimal("3")),
        dm_fee_type=DMFeeType(variables.get('dm_fee_type', 'fixed')),
        dm_fee_value=safe_decimal(variables.get('dm_fee_value'), Decimal("0"))
    )

    # ========== LogisticsParams (7 fields) ==========
    # Calculate delivery_date from quote_date + delivery_time
    delivery_time_days = safe_int(variables.get('delivery_time'), 60)  # Default 60 days
    delivery_date = quote_date + timedelta(days=delivery_time_days)

    # Allow override if delivery_date explicitly provided in variables
    if 'delivery_date' in variables:
        delivery_date_str = variables['delivery_date']
        if isinstance(delivery_date_str, str):
            delivery_date = datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
        elif isinstance(delivery_date_str, date):
            delivery_date = delivery_date_str

    # Validation: delivery_date must be >= quote_date
    if delivery_date < quote_date:
        raise ValueError(
            f"delivery_date ({delivery_date}) cannot be before quote_date ({quote_date}). "
            f"Check delivery_time ({delivery_time_days} days) or explicit delivery_date override."
        )

    # Convert logistics costs to USD (canonical calculation currency)
    logistics = LogisticsParams(
        supplier_country=SupplierCountry(get_value('supplier_country', product, variables, 'Турция')),
        offer_incoterms=Incoterms(variables.get('offer_incoterms', 'DDP')),
        delivery_time=delivery_time_days,
        delivery_date=delivery_date,
        logistics_supplier_hub=get_converted_monetary_value(supabase, 'logistics_supplier_hub', variables, "USD"),
        logistics_hub_customs=get_converted_monetary_value(supabase, 'logistics_hub_customs', variables, "USD"),
        logistics_customs_client=get_converted_monetary_value(supabase, 'logistics_customs_client', variables, "USD")
    )

    # ========== TaxesAndDuties (3 fields) ==========
    taxes = TaxesAndDuties(
        import_tariff=safe_decimal(get_value('import_tariff', product, variables), Decimal("0")),
        excise_tax=safe_decimal(get_value('excise_tax', product, variables), Decimal("0")),
        util_fee=safe_decimal(get_value('util_fee', product, variables), Decimal("0"))
    )

    # ========== PaymentTerms (10 fields) ==========
    # Advance values as decimal (1.0 = 100%)
    payment = PaymentTerms(
        advance_from_client=safe_decimal(variables.get('advance_from_client'), Decimal("1")),
        advance_to_supplier=safe_decimal(variables.get('advance_to_supplier'), Decimal("1")),
        time_to_advance=safe_int(variables.get('time_to_advance'), 0),
        advance_on_loading=safe_decimal(variables.get('advance_on_loading'), Decimal("0")),
        time_to_advance_loading=safe_int(variables.get('time_to_advance_loading'), 0),
        advance_on_going_to_country_destination=safe_decimal(
            variables.get('advance_on_going_to_country_destination'), Decimal("0")
        ),
        time_to_advance_going_to_country_destination=safe_int(
            variables.get('time_to_advance_going_to_country_destination'), 0
        ),
        advance_on_customs_clearance=safe_decimal(variables.get('advance_on_customs_clearance'), Decimal("0")),
        time_to_advance_on_customs_clearance=safe_int(variables.get('time_to_advance_on_customs_clearance'), 0),
        time_to_advance_on_receiving=safe_int(variables.get('time_to_advance_on_receiving'), 0)
    )

    # ========== CustomsAndClearance (5 fields) ==========
    # Convert brokerage costs to USD (canonical calculation currency)
    # Field names: frontend sends brokerage_hub, brokerage_customs, etc.
    customs = CustomsAndClearance(
        brokerage_hub=get_converted_monetary_value(supabase, 'brokerage_hub', variables, "USD"),
        brokerage_customs=get_converted_monetary_value(supabase, 'brokerage_customs', variables, "USD"),
        warehousing_at_customs=get_converted_monetary_value(supabase, 'warehousing_at_customs', variables, "USD"),
        customs_documentation=get_converted_monetary_value(supabase, 'customs_documentation', variables, "USD"),
        brokerage_extra=get_converted_monetary_value(supabase, 'brokerage_extra', variables, "USD")
    )

    # ========== CompanySettings (2 fields) ==========
    company = CompanySettings(
        seller_company=SellerCompany(variables.get('seller_company', 'МАСТЕР БЭРИНГ ООО')),
        offer_sale_type=OfferSaleType(variables.get('offer_sale_type', 'поставка'))
    )

    # ========== SystemConfig (3 fields from admin) ==========
    system = SystemConfig(
        rate_fin_comm=admin_settings.get('rate_fin_comm', Decimal("0.02")),
        rate_loan_interest_annual=admin_settings.get('rate_loan_interest_annual', Decimal("0.25")),
        rate_insurance=safe_decimal(variables.get('rate_insurance'), Decimal("0.00047")),
        customs_logistics_pmt_due=admin_settings.get('customs_logistics_pmt_due', 10)
    )

    # ========== Construct final input ==========
    return QuoteCalculationInput(
        product=product_info,
        financial=financial,
        logistics=logistics,
        taxes=taxes,
        payment=payment,
        customs=customs,
        company=company,
        system=system
    )


async def fetch_admin_settings(organization_id: str, supabase: Client) -> Dict[str, Decimal]:
    """
    Fetch admin calculation settings for organization.

    Args:
        organization_id: Organization UUID

    Returns:
        Dict with rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
        Returns defaults if settings not found in database

    Default values:
        - rate_forex_risk: 0.03 (3%)
        - rate_fin_comm: 0.02 (2%)
        - rate_loan_interest_annual: 0.25 (25%)
    """
    try:
        # Fetch from calculation_settings table
        response = supabase.table("calculation_settings")\
            .select("rate_forex_risk, rate_fin_comm, rate_loan_interest_annual, customs_logistics_pmt_due")\
            .eq("organization_id", organization_id)\
            .execute()

        if response.data and len(response.data) > 0:
            settings = response.data[0]

            return {
                'rate_forex_risk': Decimal(str(settings.get('rate_forex_risk', "0.03"))),
                'rate_fin_comm': Decimal(str(settings.get('rate_fin_comm', "0.02"))),
                'rate_loan_interest_annual': Decimal(str(settings.get('rate_loan_interest_annual', "0.25"))),
                'customs_logistics_pmt_due': int(settings.get('customs_logistics_pmt_due', 10))
            }
        else:
            # Return defaults if no settings found
            return {
                'rate_forex_risk': Decimal("0.03"),
                'rate_fin_comm': Decimal("0.02"),
                'rate_loan_interest_annual': Decimal("0.25"),
                'customs_logistics_pmt_due': 10
            }

    except Exception as e:
        # Log error and return defaults
        print(f"Error fetching admin settings: {e}")
        return {
            'rate_forex_risk': Decimal("0.03"),
            'rate_fin_comm': Decimal("0.02"),
            'rate_loan_interest_annual': Decimal("0.25"),
            'customs_logistics_pmt_due': 10
        }


def validate_calculation_input(
    product: ProductFromFile,
    variables: Dict[str, Any]
) -> List[str]:
    """
    Validate calculation input before processing.
    Returns list of all validation errors (empty list if valid).

    Business rules:
    - If incoterms ≠ EXW, at least one logistics field must be > 0
    - Required fields must be present
    - Markup must be provided and > 0

    Args:
        product: Product from Excel/CSV
        variables: Quote-level variables dict

    Returns:
        List of user-friendly error messages with Russian field names (empty if valid)
    """
    errors = []

    # Get product identifier for error messages
    product_id = product.product_name
    if product.sku:
        product_id = f"{product.sku} ({product.product_name})"

    # Required fields validation
    if not product.base_price_vat or product.base_price_vat <= 0:
        errors.append(
            f"Товар '{product_id}': отсутствует цена закупки (base_price_vat). "
            "Укажите цену в файле или в таблице."
        )

    if not product.quantity or product.quantity <= 0:
        errors.append(
            f"Товар '{product_id}': отсутствует количество (quantity). "
            "Укажите количество в файле или в таблице."
        )

    # Quote-level required fields
    if not variables.get('seller_company'):
        errors.append(
            "Отсутствует 'Компания-продавец' (seller_company). "
            "Укажите значение в карточке 'Настройки компании'."
        )

    if not variables.get('offer_incoterms'):
        errors.append(
            "Отсутствует 'Базис поставки' (offer_incoterms). "
            "Укажите значение в карточке 'Настройки компании'."
        )

    # Currency validation
    currency_base = get_value('currency_of_base_price', product, variables, None)
    if not currency_base:
        errors.append(
            f"Товар '{product_id}': отсутствует 'Валюта цены закупки' (currency_of_base_price). "
            "Укажите значение в карточке 'Переменные для расчетов' или в таблице для конкретного товара."
        )

    if not variables.get('currency_of_quote'):
        errors.append(
            "Отсутствует 'Валюта КП' (currency_of_quote). "
            "Укажите значение в карточке 'Финансовые параметры'."
        )

    # Exchange rate validation (fix variable name: exchange_rate -> exchange_rate_base_price_to_quote)
    exchange_rate = get_value('exchange_rate_base_price_to_quote', product, variables, None)
    if not exchange_rate:
        errors.append(
            f"Товар '{product_id}': отсутствует 'Курс к валюте КП' (exchange_rate_base_price_to_quote). "
            "Укажите значение в карточке 'Переменные для расчетов' или в таблице для конкретного товара."
        )
    elif safe_decimal(exchange_rate) <= 0:
        errors.append(
            f"Товар '{product_id}': 'Курс к валюте КП' должен быть больше нуля (текущее значение: {exchange_rate})."
        )

    # Markup validation - 0 is valid (no markup), but must not be None or negative
    markup = get_value('markup', product, variables, None)
    if markup is None:
        errors.append(
            f"Товар '{product_id}': отсутствует 'Наценка (%)' (markup). "
            "Укажите значение в карточке 'Финансовые параметры' или в таблице для конкретного товара."
        )
    elif safe_decimal(markup) < 0:
        errors.append(
            f"Товар '{product_id}': 'Наценка (%)' не может быть отрицательной (текущее значение: {markup})."
        )

    # Supplier country validation
    supplier_country = get_value('supplier_country', product, variables, None)
    if not supplier_country:
        errors.append(
            f"Товар '{product_id}': отсутствует 'Страна закупки' (supplier_country). "
            "Укажите значение в карточке 'Переменные для расчетов' или в таблице для конкретного товара."
        )

    # Business rule: If incoterms ≠ EXW, at least one logistics field must be > 0
    incoterms = variables.get('offer_incoterms')
    if incoterms and incoterms != 'EXW':
        logistics_supplier_hub = safe_decimal(variables.get('logistics_supplier_hub'), Decimal("0"))
        logistics_hub_customs = safe_decimal(variables.get('logistics_hub_customs'), Decimal("0"))
        logistics_customs_client = safe_decimal(variables.get('logistics_customs_client'), Decimal("0"))

        if logistics_supplier_hub == 0 and logistics_hub_customs == 0 and logistics_customs_client == 0:
            errors.append(
                f"Для базиса поставки '{incoterms}' должна быть указана хотя бы одна логистическая стоимость: "
                "'Логистика Поставщик-Турция', 'Логистика Турция-РФ' или 'Логистика Таможня-Клиент'. "
                "Укажите значения в карточке 'Логистика'."
            )

    return errors


# ============================================================================
# FILE UPLOAD & PARSING
# ============================================================================

@router.post("/upload-products", response_model=FileUploadResponse)
async def upload_products_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    """
    Upload Excel or CSV file with product data

    Expected columns:
    - product_name (required)
    - product_code (optional)
    - base_price_vat (required)
    - quantity (required)
    - weight_in_kg (optional)
    - customs_code (optional)
    - supplier_country (optional)
    """

    # Validate file type
    allowed_extensions = ['.xlsx', '.xls', '.csv']
    file_ext = os.path.splitext(file.filename)[1].lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

    try:
        # Read file content
        contents = await file.read()

        # Parse based on file type
        if file_ext == '.csv':
            df = pd.read_csv(io.BytesIO(contents))
        else:  # Excel
            df = pd.read_excel(io.BytesIO(contents))

        # Validate required columns
        required_columns = ['product_name', 'base_price_vat', 'quantity']
        missing_columns = [col for col in required_columns if col not in df.columns]

        if missing_columns:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )

        # Parse products
        products = []
        for index, row in df.iterrows():
            try:
                # Helper to safely get string value
                def get_str(col: str) -> Optional[str]:
                    val = row.get(col)
                    return str(val) if pd.notna(val) and val != '' else None

                # Helper to safely get float value
                def get_float(col: str, default: float = 0) -> float:
                    val = row.get(col)
                    return float(val) if pd.notna(val) else default

                # Weight can be in 'weight_in_kg' or 'weight_per_unit' columns
                weight = get_float('weight_in_kg') or get_float('weight_per_unit')

                # Duty/tariff can be in 'import_tariff' or 'duty_pct' columns
                import_tariff = get_float('import_tariff') if pd.notna(row.get('import_tariff')) else None
                if import_tariff is None and pd.notna(row.get('duty_pct')):
                    import_tariff = get_float('duty_pct')

                # HS code can be in 'customs_code' or 'hs_code' columns
                customs_code = get_str('customs_code') or get_str('hs_code')

                product = ProductFromFile(
                    sku=get_str('sku'),
                    brand=get_str('brand'),
                    product_name=str(row['product_name']),
                    product_code=get_str('product_code'),
                    base_price_vat=float(row['base_price_vat']),
                    quantity=int(row['quantity']),
                    weight_in_kg=weight,
                    customs_code=customs_code,
                    supplier_country=get_str('supplier_country'),
                    currency_of_base_price=get_str('currency_of_base_price'),
                    supplier_discount=get_float('supplier_discount') if pd.notna(row.get('supplier_discount')) else None,
                    import_tariff=import_tariff,
                )
                products.append(product)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Error parsing row {index + 2}: {str(e)}"
                )

        if not products:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid products found in file"
            )

        return FileUploadResponse(
            success=True,
            products=products,
            total_count=len(products),
            message=f"Successfully parsed {len(products)} products from {file.filename}"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )


# ============================================================================
# VARIABLE TEMPLATES CRUD
# ============================================================================

@router.get("/variable-templates", response_model=List[VariableTemplate])
async def list_variable_templates(
    user: User = Depends(get_current_user)
):
    """List all variable templates for the user's organization"""

    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization"
        )

    try:
        # Query templates using Supabase client
        response = supabase.table("variable_templates")\
            .select("*")\
            .eq("organization_id", str(user.current_organization_id))\
            .order("created_at", desc=True)\
            .execute()

        # Convert to response models
        templates = []
        for item in response.data:
            templates.append(VariableTemplate(
                id=str(item['id']),
                organization_id=str(item['organization_id']),
                name=item['name'],
                description=item.get('description'),
                variables=item['variables'],
                created_by=str(item['created_by']),
                created_at=item['created_at'],
                is_default=item.get('is_default', False)
            ))

        return templates

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching templates: {str(e)}"
        )


@router.post("/variable-templates", response_model=VariableTemplate, status_code=status.HTTP_201_CREATED)
async def create_variable_template(
    template: VariableTemplateCreate,
    user: User = Depends(get_current_user)
):
    """Create a new variable template"""

    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization"
        )

    try:
        # Create template using Supabase client
        response = supabase.table("variable_templates").insert({
            "organization_id": str(user.current_organization_id),
            "name": template.name,
            "description": template.description,
            "variables": template.variables,
            "created_by": str(user.id),
            "is_default": template.is_default
        }).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create template"
            )

        created = response.data[0]

        return VariableTemplate(
            id=str(created['id']),
            organization_id=str(created['organization_id']),
            name=created['name'],
            description=created.get('description'),
            variables=created['variables'],
            created_by=str(created['created_by']),
            created_at=created['created_at'],
            is_default=created.get('is_default', False)
        )

    except Exception as e:
        if "duplicate key value" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Template with name '{template.name}' already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating template: {str(e)}"
        )


@router.get("/variable-templates/{template_id}", response_model=VariableTemplate)
async def get_variable_template(
    template_id: str,
    user: User = Depends(get_current_user)
):
    """Get a specific variable template"""

    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization"
        )

    try:
        response = supabase.table("variable_templates")\
            .select("*")\
            .eq("id", template_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        item = response.data[0]

        return VariableTemplate(
            id=str(item['id']),
            organization_id=str(item['organization_id']),
            name=item['name'],
            description=item.get('description'),
            variables=item['variables'],
            created_by=str(item['created_by']),
            created_at=item['created_at'],
            is_default=item.get('is_default', False)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching template: {str(e)}"
        )


@router.put("/variable-templates/{template_id}", response_model=VariableTemplate)
async def update_variable_template(
    template_id: str,
    template_update: VariableTemplateCreate,
    user: User = Depends(get_current_user)
):
    """Update an existing variable template"""

    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization"
        )

    try:
        # First, verify the template exists and belongs to this organization
        existing = supabase.table("variable_templates")\
            .select("*")\
            .eq("id", template_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found"
            )

        # Update the template
        response = supabase.table("variable_templates")\
            .update({
                "name": template_update.name,
                "description": template_update.description,
                "variables": template_update.variables,
                "is_default": template_update.is_default
            })\
            .eq("id", template_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update template"
            )

        item = response.data[0]

        return VariableTemplate(
            id=str(item['id']),
            organization_id=str(item['organization_id']),
            name=item['name'],
            description=item.get('description'),
            variables=item['variables'],
            created_by=str(item['created_by']),
            created_at=item['created_at'],
            is_default=item.get('is_default', False)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating template: {str(e)}"
        )


@router.delete("/variable-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variable_template(
    template_id: str,
    user: User = Depends(get_current_user)
):
    """Delete a variable template"""

    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization"
        )

    try:
        # Verify template exists and belongs to user's organization
        check = supabase.table("variable_templates")\
            .select("id")\
            .eq("id", template_id)\
            .eq("organization_id", str(user.current_organization_id))\
            .eq("created_by", str(user.id))\
            .execute()

        if not check.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Template not found or you don't have permission to delete it"
            )

        # Delete template
        supabase.table("variable_templates").delete().eq("id", template_id).execute()

        return None

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting template: {str(e)}"
        )


# ============================================================================
# HELPER FUNCTIONS - JSON SERIALIZATION
# ============================================================================

def convert_decimals_to_float(obj):
    """
    Recursively convert all Decimal objects to float for JSON serialization
    """
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {key: convert_decimals_to_float(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimals_to_float(item) for item in obj]
    else:
        return obj


def aggregate_product_results_to_summary(
    results_list: List,
    quote_variables: Dict[str, Any] = None,
    quote_currency: str = "RUB",
    usd_to_quote_rate: Decimal = None,
    exchange_rate_source: str = "cbr",
    exchange_rate_timestamp: datetime = None
) -> Dict[str, float]:
    """
    Aggregate product-level calculation results to quote-level summary.

    Args:
        results_list: List of ProductCalculationResult objects
        quote_variables: Quote-level variables dict (for brokerage calculation)
        quote_currency: Client's quote currency (e.g., 'RUB', 'EUR')
        usd_to_quote_rate: Exchange rate: 1 USD = X quote_currency
        exchange_rate_source: Rate source ('cbr', 'manual', 'mixed')
        exchange_rate_timestamp: When rate was fetched

    Returns:
        Dict with calculated fields ready for quote_calculation_summaries table
        Includes both USD (canonical) and quote currency values
    """
    from decimal import Decimal

    if not results_list:
        return {}

    if quote_variables is None:
        quote_variables = {}

    # Default exchange rate if not provided
    if usd_to_quote_rate is None:
        usd_to_quote_rate = Decimal("1")  # 1:1 if USD or not provided

    # Initialize sums for monetary fields (Phase 1-13)
    summary = {
        # Phase 1: Purchase prices (sum across products)
        "calc_n16_price_without_vat": Decimal("0"),
        "calc_p16_after_supplier_discount": Decimal("0"),
        "calc_r16_per_unit_quote_currency": Decimal("0"),
        "calc_s16_total_purchase_price": Decimal("0"),

        # Phase 3: Logistics (sum across products)
        "calc_t16_first_leg_logistics": Decimal("0"),
        "calc_u16_last_leg_logistics": Decimal("0"),
        "calc_v16_total_logistics": Decimal("0"),

        # Phase 4: Duties and internal pricing (sum across products)
        "calc_ax16_internal_price_unit": Decimal("0"),
        "calc_ay16_internal_price_total": Decimal("0"),
        "calc_y16_customs_duty": Decimal("0"),
        "calc_z16_excise_tax": Decimal("0"),
        "calc_az16_with_vat_restored": Decimal("0"),

        # Phase 9: Financing costs (sum across products)
        "calc_ba16_financing_per_product": Decimal("0"),
        "calc_bb16_credit_interest_per_product": Decimal("0"),

        # Phase 10: COGS (sum across products)
        "calc_aa16_cogs_per_unit": Decimal("0"),
        "calc_ab16_cogs_total": Decimal("0"),

        # Phase 11: Sales pricing (sum across products)
        "calc_ag16_dm_fee": Decimal("0"),
        "calc_ad16_sale_price_unit": Decimal("0"),
        "calc_ae16_sale_price_total": Decimal("0"),
        "calc_aj16_final_price_unit": Decimal("0"),
        "calc_ak16_final_price_total": Decimal("0"),

        # Phase 12: VAT (sum across products)
        "calc_am16_price_with_vat": Decimal("0"),
        "calc_al16_total_with_vat": Decimal("0"),
        "calc_an16_sales_vat": Decimal("0"),
        "calc_ao16_deductible_vat": Decimal("0"),
        "calc_ap16_net_vat_payable": Decimal("0"),

        # Phase 13: Transit commission (sum across products)
        "calc_aq16_transit_commission": Decimal("0"),
    }

    # Sum monetary fields across all products
    for result in results_list:
        summary["calc_n16_price_without_vat"] += result.purchase_price_no_vat
        summary["calc_p16_after_supplier_discount"] += result.purchase_price_after_discount
        summary["calc_r16_per_unit_quote_currency"] += result.purchase_price_per_unit_quote_currency
        summary["calc_s16_total_purchase_price"] += result.purchase_price_total_quote_currency

        summary["calc_t16_first_leg_logistics"] += result.logistics_first_leg
        summary["calc_u16_last_leg_logistics"] += result.logistics_last_leg
        summary["calc_v16_total_logistics"] += result.logistics_total

        summary["calc_ax16_internal_price_unit"] += result.internal_sale_price_per_unit
        summary["calc_ay16_internal_price_total"] += result.internal_sale_price_total
        summary["calc_y16_customs_duty"] += result.customs_fee
        summary["calc_z16_excise_tax"] += result.excise_tax_amount
        summary["calc_az16_with_vat_restored"] += Decimal("0")  # AZ16 not in model, placeholder

        summary["calc_ba16_financing_per_product"] += result.financing_cost_initial
        summary["calc_bb16_credit_interest_per_product"] += result.financing_cost_credit

        summary["calc_aa16_cogs_per_unit"] += result.cogs_per_unit
        summary["calc_ab16_cogs_total"] += result.cogs_per_product

        summary["calc_ag16_dm_fee"] += result.dm_fee
        summary["calc_ad16_sale_price_unit"] += result.sale_price_per_unit_excl_financial
        summary["calc_ae16_sale_price_total"] += result.sale_price_total_excl_financial
        summary["calc_aj16_final_price_unit"] += result.sales_price_per_unit_no_vat
        summary["calc_ak16_final_price_total"] += result.sales_price_total_no_vat

        summary["calc_am16_price_with_vat"] += result.sales_price_per_unit_with_vat
        summary["calc_al16_total_with_vat"] += result.sales_price_total_with_vat
        summary["calc_an16_sales_vat"] += result.vat_from_sales
        summary["calc_ao16_deductible_vat"] += result.vat_on_import
        summary["calc_ap16_net_vat_payable"] += result.vat_net_payable

        summary["calc_aq16_transit_commission"] += result.transit_commission

    # Phase 2: Quote-level distribution base (from first product)
    summary["calc_s13_sum_purchase_prices"] = results_list[0].quote_level_supplier_payment or Decimal("0")

    # Phase 5-8: Quote-level financing values (from first product)
    first = results_list[0]
    summary["calc_bh6_supplier_payment"] = first.quote_level_supplier_payment or Decimal("0")
    summary["calc_bh4_before_forwarding"] = first.quote_level_total_before_forwarding or Decimal("0")
    summary["calc_bh2_revenue_estimated"] = first.quote_level_evaluated_revenue or Decimal("0")
    summary["calc_bh3_client_advance"] = first.quote_level_client_advance or Decimal("0")
    summary["calc_bh7_supplier_financing_need"] = first.quote_level_supplier_financing_need or Decimal("0")
    summary["calc_bj7_supplier_financing_cost"] = first.quote_level_supplier_financing_cost or Decimal("0")
    summary["calc_bh10_operational_financing"] = first.quote_level_operational_financing_need or Decimal("0")
    summary["calc_bj10_operational_cost"] = first.quote_level_operational_financing_cost or Decimal("0")
    summary["calc_bj11_total_financing_cost"] = first.quote_level_total_financing_cost or Decimal("0")
    summary["calc_bl3_credit_sales_amount"] = first.quote_level_credit_sales_amount or Decimal("0")
    summary["calc_bl4_credit_sales_with_interest"] = first.quote_level_credit_sales_fv or Decimal("0")
    summary["calc_bl5_credit_sales_interest"] = first.quote_level_credit_sales_interest or Decimal("0")

    # Phase 11: Calculate profit margin from aggregated totals (not average!)
    total_revenue = summary["calc_ak16_final_price_total"]
    total_cogs = summary["calc_ab16_cogs_total"]
    if total_revenue > 0:
        summary["calc_af16_profit_margin"] = ((total_revenue - total_cogs) / total_revenue)
    else:
        summary["calc_af16_profit_margin"] = Decimal("0")

    # Phase 11: Quote-level forex and agent fees (from first product)
    summary["calc_ah16_forex_risk_reserve"] = first.forex_reserve
    summary["calc_ai16_agent_fee"] = first.financial_agent_fee

    # Calculate brokerage total from quote variables
    brokerage_total = Decimal("0")
    brokerage_total += Decimal(str(quote_variables.get('brokerage_hub', 0)))
    brokerage_total += Decimal(str(quote_variables.get('brokerage_customs', 0)))
    brokerage_total += Decimal(str(quote_variables.get('warehousing_at_customs', 0)))
    brokerage_total += Decimal(str(quote_variables.get('customs_documentation', 0)))
    brokerage_total += Decimal(str(quote_variables.get('brokerage_extra', 0)))

    summary["calc_total_brokerage"] = brokerage_total
    summary["calc_total_logistics_and_brokerage"] = summary["calc_v16_total_logistics"] + brokerage_total

    # =========================================================================
    # QUOTE CURRENCY VALUES (new in migration 037)
    # =========================================================================

    # Exchange rate metadata
    summary["quote_currency"] = quote_currency
    summary["usd_to_quote_rate"] = usd_to_quote_rate
    summary["exchange_rate_source"] = exchange_rate_source
    summary["exchange_rate_timestamp"] = exchange_rate_timestamp.isoformat() if exchange_rate_timestamp else None

    # Key totals in quote currency (USD values * rate)
    summary["calc_s16_total_purchase_price_quote"] = summary["calc_s16_total_purchase_price"] * usd_to_quote_rate
    summary["calc_v16_total_logistics_quote"] = summary["calc_v16_total_logistics"] * usd_to_quote_rate
    summary["calc_ab16_cogs_total_quote"] = summary["calc_ab16_cogs_total"] * usd_to_quote_rate
    summary["calc_ak16_final_price_total_quote"] = summary["calc_ak16_final_price_total"] * usd_to_quote_rate
    summary["calc_al16_total_with_vat_quote"] = summary["calc_al16_total_with_vat"] * usd_to_quote_rate
    summary["calc_total_brokerage_quote"] = brokerage_total * usd_to_quote_rate
    summary["calc_total_logistics_and_brokerage_quote"] = summary["calc_total_logistics_and_brokerage"] * usd_to_quote_rate

    # Convert all Decimals to float for JSON/database
    return convert_decimals_to_float(summary)


# ============================================================================
# QUOTE CALCULATION ENDPOINT
# ============================================================================

@router.post("/calculate", response_model=QuoteCalculationResult, status_code=status.HTTP_201_CREATED)
@log_activity_decorator(entity_type="quote", action="created")
async def calculate_quote(
    request: QuoteCalculationRequest,
    user: User = Depends(get_current_user)
):
    """
    Calculate a quote using the 13-phase calculation engine

    This endpoint:
    1. Creates a quote record
    2. Creates quote_items records for each product
    3. Saves calculation variables
    4. Runs calculation engine for each product
    5. Saves all 13 phases of results
    6. Returns complete quote with calculations
    """

    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization"
        )

    # Retry logic for quote creation (handles race conditions with duplicate quote numbers)
    max_retries = 3
    last_error = None

    for attempt in range(max_retries):
        try:
            # Generate quote number with current year (format: КП25-0001)
            quote_number = generate_quote_number(supabase, str(user.current_organization_id))

            # 1. Create quote record
            quote_data = {
                "organization_id": str(user.current_organization_id),
                "customer_id": request.customer_id,
                "contact_id": request.contact_id,  # Customer contact person
                "quote_number": quote_number,
                "title": request.title,
                "description": request.description,
                "status": "draft",
                "created_by": str(user.id),
                "manager_name": user.full_name,  # Manager info from user
                "manager_email": user.email,
                "quote_date": request.quote_date.isoformat(),  # Convert date to ISO string
                "valid_until": request.valid_until.isoformat(),  # Convert date to ISO string
                "currency": request.variables.get('currency_of_quote', 'USD'),
                "subtotal": 0,  # Will be updated after calculations
                "total_amount": 0  # Will be updated after calculations
            }

            quote_response = supabase.table("quotes").insert(quote_data).execute()

            if not quote_response.data:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create quote"
                )

            quote_id = quote_response.data[0]['id']

            # Success! Break out of retry loop
            break

        except Exception as e:
            # Check if it's a duplicate key error (code 23505)
            error_str = str(e)
            is_duplicate = '23505' in error_str or 'duplicate key value' in error_str or 'already exists' in error_str

            if is_duplicate and attempt < max_retries - 1:
                # Duplicate quote number - retry with new number
                logger.warning(f"Duplicate quote number detected (attempt {attempt + 1}/{max_retries}). Retrying...")
                last_error = e
                continue  # Retry loop
            elif is_duplicate:
                # Exhausted retries
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Failed to generate unique quote number after {max_retries} attempts. Please try again."
                )
            else:
                # Different error - re-raise immediately
                raise

    # 2. Create quote_items records
    try:
        items_data = []
        for idx, product in enumerate(request.products):
            # Extract custom_fields (product-level variable overrides)
            custom_fields = {}

            # Fields that can be overridden per product
            override_fields = [
                'currency_of_base_price',
                'exchange_rate_base_price_to_quote',
                'supplier_discount',
                'markup',
                'customs_code',
                'import_tariff',
                'excise_tax',
                'util_fee'
            ]

            # Check if product has overrides
            for field in override_fields:
                product_value = getattr(product, field, None)
                if product_value is not None:
                    # Store override in custom_fields
                    # Convert Decimal to float for JSON serialization
                    if isinstance(product_value, Decimal):
                        custom_fields[field] = float(product_value)
                    else:
                        custom_fields[field] = product_value

            item_data = {
                "quote_id": quote_id,
                "position": idx,
                "product_name": product.product_name,
                "product_code": product.product_code,
                "base_price_vat": float(product.base_price_vat),
                "quantity": product.quantity,
                "weight_in_kg": float(product.weight_in_kg) if product.weight_in_kg else 0,
                "customs_code": product.customs_code,
                "supplier_country": product.supplier_country or request.variables.get('supplier_country', 'Турция'),
                "custom_fields": custom_fields  # Add custom_fields to item data
            }
            items_data.append(item_data)

        items_response = supabase.table("quote_items").insert(items_data).execute()

        if not items_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create quote items"
            )

        # 3. Save calculation variables
        variables_data = {
            "quote_id": quote_id,
            "template_id": request.template_id,
            "variables": request.variables
        }

        variables_response = supabase.table("quote_calculation_variables")\
            .insert(variables_data)\
            .execute()

        # 4. Fetch admin settings for organization
        admin_settings = await fetch_admin_settings(str(user.current_organization_id), supabase)

        # 5. Validate all products and build calculation inputs
        calc_inputs = []

        # DEBUG: Log dm_fee values
        logger.info(f"🔍 DEBUG: dm_fee_type from request = {request.variables.get('dm_fee_type')}")
        logger.info(f"🔍 DEBUG: dm_fee_value from request = {request.variables.get('dm_fee_value')}")
        logger.info(f"🔍 DEBUG: currency_of_quote from request = {request.variables.get('currency_of_quote')}")
        logger.info(f"🔍 DEBUG: currency_of_base_price from request = {request.variables.get('currency_of_base_price')}")
        logger.info(f"🔍 DEBUG: Full variables keys = {list(request.variables.keys())}")
        # Log first product's currency override
        if request.products:
            p0 = request.products[0]
            logger.info(f"🔍 DEBUG: Product 0 - currency_of_base_price = {p0.currency_of_base_price}")

        for idx, product in enumerate(request.products):
            # Validate input before processing
            validation_errors = validate_calculation_input(product, request.variables)
            if validation_errors:
                # Roll back quote and return all errors
                supabase.table("quotes").delete().eq("id", quote_id).execute()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Validation failed for product '{product.product_name}': " + "; ".join(validation_errors)
                )

            # Map variables to nested calculation input using helper function
            # Get quote currency for multi-currency conversion
            quote_currency = request.variables.get('currency_of_quote', 'USD')
            calc_input = map_variables_to_calculation_input(
                product=product,
                variables=request.variables,
                admin_settings=admin_settings,
                quote_date=request.quote_date,
                quote_currency=quote_currency,
                supabase=supabase
            )

            # DEBUG: Log what was mapped
            logger.info(f"🔍 DEBUG: Product {idx} - dm_fee_type = {calc_input.financial.dm_fee_type}, dm_fee_value = {calc_input.financial.dm_fee_value}")
            logger.info(f"🔍 DEBUG: Product {idx} - currency_of_base_price = {calc_input.product.currency_of_base_price}")
            logger.info(f"🔍 DEBUG: Product {idx} - currency_of_quote = {calc_input.financial.currency_of_quote}")
            logger.info(f"🔍 DEBUG: Product {idx} - exchange_rate_base_price_to_quote = {calc_input.financial.exchange_rate_base_price_to_quote}")
            logger.info(f"🔍 DEBUG: Product {idx} - base_price_VAT = {calc_input.product.base_price_VAT}")

            calc_inputs.append(calc_input)

        # 6. Run calculation engine for ALL products together (with 60-second timeout)
        # This ensures proper distribution of quote-level costs (dm_fee, logistics, etc.)
        try:
            async with asyncio.timeout(60):
                # Wrap sync calculation in async executor
                loop = asyncio.get_event_loop()
                results_list = await loop.run_in_executor(
                    None,
                    calculate_multiproduct_quote,
                    calc_inputs
                )
        except asyncio.TimeoutError:
            # Roll back quote and raise timeout error
            supabase.table("quotes").delete().eq("id", quote_id).execute()
            raise HTTPException(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail=f"Calculation timeout (max 60 seconds). Please simplify inputs."
            )

        # 7. Process results and save to database
        calculation_results = []
        total_subtotal = Decimal("0")
        total_amount = Decimal("0")
        total_profit_usd = Decimal("0")
        total_vat_on_import_usd = Decimal("0")
        total_vat_payable_usd = Decimal("0")

        # Get quote currency conversion rate (USD -> quote currency)
        # Use 'or' to handle None values (dict.get returns None if key exists with None value)
        client_quote_currency = request.variables.get('currency_of_quote') or 'USD'
        usd_to_quote_rate = get_exchange_rate("USD", client_quote_currency, supabase)
        rates_snapshot = get_rates_snapshot_to_usd(request.quote_date, supabase)

        for idx, (result, product, item_record) in enumerate(zip(results_list, request.products, items_response.data)):
            try:
                # Convert result to dict and add quote currency fields
                result_dict = convert_decimals_to_float(result.dict())

                # Add quote currency output (for client display/export)
                result_dict["quote_currency"] = client_quote_currency
                result_dict["usd_to_quote_rate"] = float(usd_to_quote_rate)
                result_dict["sales_price_per_unit_quote"] = float(result.sales_price_per_unit_no_vat * usd_to_quote_rate)
                result_dict["sales_price_per_unit_with_vat_quote"] = float(result.sales_price_per_unit_with_vat * usd_to_quote_rate)
                result_dict["sales_price_total_quote"] = float(result.sales_price_total_no_vat * usd_to_quote_rate)
                result_dict["sales_price_total_with_vat_quote"] = float(result.sales_price_total_with_vat * usd_to_quote_rate)
                result_dict["rates_snapshot"] = rates_snapshot

                # Build quote currency version of key results
                # This creates a separate JSONB for client-facing values
                phase_results_quote = {
                    "quote_currency": client_quote_currency,
                    "usd_to_quote_rate": float(usd_to_quote_rate),
                    # Key values in quote currency
                    "purchase_price_total": float(result.purchase_price_total_quote_currency * usd_to_quote_rate),
                    "logistics_total": float(result.logistics_total * usd_to_quote_rate),
                    "cogs_per_product": float(result.cogs_per_product * usd_to_quote_rate),
                    "sales_price_total_no_vat": float(result.sales_price_total_no_vat * usd_to_quote_rate),
                    "sales_price_total_with_vat": float(result.sales_price_total_with_vat * usd_to_quote_rate),
                    "sales_price_per_unit_no_vat": float(result.sales_price_per_unit_no_vat * usd_to_quote_rate),
                    "sales_price_per_unit_with_vat": float(result.sales_price_per_unit_with_vat * usd_to_quote_rate),
                    "profit": float(result.profit * usd_to_quote_rate),
                    "dm_fee": float(result.dm_fee * usd_to_quote_rate),
                }

                # Save calculation results (USD in phase_results, quote currency in phase_results_quote_currency)
                results_data = {
                    "quote_id": quote_id,
                    "quote_item_id": item_record['id'],
                    "phase_results": result_dict,
                    "phase_results_quote_currency": phase_results_quote  # New in migration 037
                }

                results_response = supabase.table("quote_calculation_results")\
                    .insert(results_data)\
                    .execute()

                # Accumulate totals
                total_subtotal += result.purchase_price_total_quote_currency  # S16 - Purchase price
                total_amount += result.sales_price_total_no_vat  # AK16 - Final sales price total
                total_profit_usd += result.profit  # AF16 - Markup amount
                total_vat_on_import_usd += result.vat_on_import  # AO16 - VAT on import
                total_vat_payable_usd += result.vat_net_payable  # AP16 - Net VAT payable

                # Calculate individual cost components for display
                # Note: These are already included in result.cogs_per_product (AB16)
                import_duties_total = result.customs_fee  # Y16 - Import tariff
                util_fee_value = Decimal(str(request.variables.get('util_fee', 0)))
                excise_and_util = result.excise_tax_amount + util_fee_value  # Z16 + util_fee
                financing_costs_total = result.financing_cost_initial + result.financing_cost_credit  # BA16 + BB16

                # Total cost = COGS (AB16)
                # AB16 already includes: S16 (purchase) + V16 (logistics+brokerage) + Y16 (duties) + Z16 (excise) + BA16+BB16 (financing)
                # DM fee (AG16) is NOT part of COGS - it's added later in final sales price (AK16)
                total_cost_comprehensive = result.cogs_per_product  # AB16 only

                # Add to response - map backend field names to frontend interface
                calculation_results.append({
                    "item_id": item_record['id'],
                    "product_name": product.product_name,
                    "product_code": product.product_code,
                    "quantity": product.quantity,
                    # Map backend fields to frontend interface (ProductCalculationResult in quotes-calc-service.ts)
                    "base_price_vat": float(product.base_price_vat),
                    "base_price_no_vat": float(result.purchase_price_no_vat),
                    "purchase_price_rub": float(result.purchase_price_total_quote_currency),  # S16 - Total purchase in USD
                    "logistics_costs": float(result.logistics_total),  # V16 - Total logistics in USD
                    "cogs": float(result.cogs_per_product),  # AB16 - Cost of goods sold in USD
                    "cogs_with_vat": float(result.cogs_per_product * Decimal("1.2")),  # COGS + 20% VAT estimate (USD)
                    "import_duties": float(import_duties_total),  # Y16 - Import tariff in USD
                    "customs_fees": float(excise_and_util),  # Z16 + util_fee in USD
                    "financing_costs": float(financing_costs_total),  # BA16 + BB16 in USD
                    "dm_fee": float(result.dm_fee),  # AG16 in USD
                    "total_cost": float(total_cost_comprehensive),  # AB16 in USD
                    "sale_price": float(result.sales_price_total_no_vat),  # AK16 in USD
                    "margin": float(result.profit),  # AF16 - Profit in USD (internal accounting)
                    # Quote currency values for client display
                    "sale_price_quote": float(result.sales_price_total_no_vat * usd_to_quote_rate),  # AK16 in quote currency
                    "sale_price_with_vat_quote": float(result.sales_price_total_with_vat * usd_to_quote_rate),  # With VAT in quote currency
                    "quote_currency": client_quote_currency,
                    "usd_to_quote_rate": float(usd_to_quote_rate)
                })

            except Exception as e:
                # If processing fails for one product, roll back the quote
                supabase.table("quotes").delete().eq("id", quote_id).execute()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to save results for product {product.product_name}: {str(e)}"
                )

        # 8. Update quote totals (USD + quote currency)
        # Calculate totals
        total_with_vat_usd = sum(r.sales_price_total_with_vat for r in results_list)  # AL16 sum in USD
        total_amount_quote = total_amount * usd_to_quote_rate
        total_with_vat_quote = total_with_vat_usd * usd_to_quote_rate

        supabase.table("quotes").update({
            "subtotal": float(total_subtotal),
            "total_amount": float(total_amount),
            "total_usd": float(total_amount),  # AK16 sum - without VAT in USD
            "total_with_vat_usd": float(total_with_vat_usd),  # AL16 sum - with VAT in USD
            "total_profit_usd": float(total_profit_usd),
            "total_vat_on_import_usd": float(total_vat_on_import_usd),
            "total_vat_payable_usd": float(total_vat_payable_usd),
            # New dual-currency fields (migration 037)
            "usd_to_quote_rate": float(usd_to_quote_rate),
            "exchange_rate_source": "cbr",  # TODO: support manual rates
            "exchange_rate_timestamp": datetime.now().isoformat(),
            "total_amount_quote": float(total_amount_quote),
            "total_with_vat_quote": float(total_with_vat_quote)
        }).eq("id", quote_id).execute()

        # 8b. Aggregate product results to quote-level summary (with dual currency)
        quote_summary = aggregate_product_results_to_summary(
            results_list,
            request.variables,
            quote_currency=client_quote_currency,
            usd_to_quote_rate=usd_to_quote_rate,
            exchange_rate_source="cbr",
            exchange_rate_timestamp=datetime.now()
        )
        quote_summary["quote_id"] = quote_id

        # Upsert (insert or update) quote calculation summary
        supabase.table("quote_calculation_summaries")\
            .upsert(quote_summary)\
            .execute()

        # 9. Return complete result
        return QuoteCalculationResult(
            quote_id=quote_id,
            quote_number=quote_number,
            customer_id=request.customer_id,
            title=request.title,
            items=calculation_results,
            totals={
                "subtotal": float(total_subtotal),
                "total_amount": float(total_amount),
                "currency": request.variables.get('currency_of_quote', 'USD')
            },
            calculated_at=datetime.now().isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating quote: {str(e)}"
        )


# ============================================================================
# DEBUG EXPORT ENDPOINT - Intermediate Calculation Results in USD
# ============================================================================

@router.get("/debug-export/{quote_id}")
async def export_calculation_debug(
    quote_id: str,
    user: User = Depends(get_current_user)
):
    """
    Export intermediate calculation results with USD conversion.
    Shows key milestones for debugging/verification.
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization"
        )

    try:
        # Get quote and verify organization ownership
        quote_result = supabase.table("quotes").select("*").eq("id", quote_id).execute()
        if not quote_result.data:
            raise HTTPException(status_code=404, detail="Quote not found")

        quote = quote_result.data[0]
        if quote["organization_id"] != str(user.current_organization_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        # Get quote items
        items_result = supabase.table("quote_items").select("*").eq("quote_id", quote_id).execute()
        if not items_result.data:
            raise HTTPException(status_code=404, detail="No items found for quote")

        # Get calculation results from quote_calculation_results table
        calc_results_query = supabase.table("quote_calculation_results")\
            .select("quote_item_id, phase_results")\
            .eq("quote_id", quote_id)\
            .execute()

        # Build lookup dict: quote_item_id -> phase_results
        calc_results_by_item = {}
        for calc_row in calc_results_query.data:
            item_id = calc_row.get("quote_item_id")
            if item_id:
                calc_results_by_item[item_id] = calc_row.get("phase_results", {})

        # Get exchange rate to USD (from CBR rates)
        quote_currency = quote.get("currency", "USD")
        usd_rate = Decimal("1.0")

        if quote_currency != "USD":
            # Try to get rate from exchange_rates table
            rate_result = supabase.table("exchange_rates")\
                .select("rate")\
                .eq("from_currency", quote_currency)\
                .eq("to_currency", "USD")\
                .order("fetched_at", desc=True)\
                .limit(1)\
                .execute()

            if rate_result.data:
                usd_rate = Decimal(str(rate_result.data[0]["rate"]))
            else:
                # Fallback: try reverse rate
                reverse_result = supabase.table("exchange_rates")\
                    .select("rate")\
                    .eq("from_currency", "USD")\
                    .eq("to_currency", quote_currency)\
                    .order("fetched_at", desc=True)\
                    .limit(1)\
                    .execute()
                if reverse_result.data:
                    usd_rate = Decimal("1") / Decimal(str(reverse_result.data[0]["rate"]))

        # Build CSV rows with key milestones
        rows = []

        # Key calculation variables to export (field_name matches phase_results keys)
        # NOTE: K16 and Q16 are INPUT values from quote_items, not phase_results
        key_vars = [
            ("K16", "_base_price_vat", "Base Price (with VAT) - INPUT"),  # From quote_items
            ("N16", "purchase_price_no_vat", "Price without VAT"),  # From phase_results
            ("Q16", "_exchange_rate", "Exchange Rate - INPUT"),  # From quote_items
            ("S16", "purchase_price_total_quote_currency", "Purchase Total"),
            ("T16", "logistics_first_leg", "Logistics: Supplier→Hub"),
            ("U16", "logistics_last_leg", "Logistics: Hub→Client"),
            ("V16", "logistics_total", "Logistics Total"),
            ("Y16", "customs_fee", "Customs Duty"),
            ("Z16", "excise_tax_amount", "Excise Tax"),
            ("AY16", "internal_sale_price_total", "Internal Sale Price"),
            ("BA16", "financing_cost_initial", "Financing: Initial"),
            ("BB16", "financing_cost_credit", "Financing: Credit"),
            ("AB16", "cogs_per_product", "COGS Total"),
            ("AJ16", "sales_price_per_unit_no_vat", "Final Price/Unit (no VAT)"),
            ("AK16", "sales_price_total_with_vat", "Final Price Total (with VAT)"),
            ("AM16", "vat_from_sales", "VAT Amount"),
            ("AQ16", "transit_commission", "Commission"),
            ("--", "profit", "Profit"),
            ("--", "forex_reserve", "Forex Reserve"),
            ("--", "dm_fee", "DM Fee"),
            ("--", "financial_agent_fee", "Financial Agent Fee"),
        ]

        for item in items_result.data:
            item_id = item.get("id")
            # Get calculation results from lookup dict
            calc_results = calc_results_by_item.get(item_id, {})
            product_name = item.get("product_name", item.get("sku", "Unknown"))
            quantity = item.get("quantity", 1)

            for excel_ref, field_name, description in key_vars:
                # Handle special fields from quote_items (prefixed with "_")
                if field_name == "_base_price_vat":
                    # K16 - Base price with VAT from quote_items
                    value = item.get("base_price_vat", 0)
                elif field_name == "_exchange_rate":
                    # Q16 - Exchange rate: Calculate from R16/P16
                    # R16 = purchase_price_per_unit_quote_currency
                    # P16 = purchase_price_after_discount
                    r16 = calc_results.get("purchase_price_per_unit_quote_currency", 0)
                    p16 = calc_results.get("purchase_price_after_discount", 0)
                    if p16 and float(p16) > 0:
                        value = float(r16) / float(p16)
                    else:
                        value = 0
                else:
                    # Get value from phase_results
                    value = calc_results.get(field_name, 0)

                try:
                    value_decimal = Decimal(str(value)) if value else Decimal("0")
                except:
                    value_decimal = Decimal("0")

                value_usd = value_decimal * usd_rate

                rows.append({
                    "Product": product_name,
                    "Qty": quantity,
                    "Variable": excel_ref,
                    "Description": description,
                    f"Value ({quote_currency})": float(value_decimal.quantize(Decimal("0.01"))),
                    "Value (USD)": float(value_usd.quantize(Decimal("0.01"))),
                    "Rate Used": float(usd_rate.quantize(Decimal("0.0001"))),
                })

        # Get pre-calculated quote-level totals from quote_calculation_summaries table
        summary_result = supabase.table("quote_calculation_summaries")\
            .select("*")\
            .eq("quote_id", quote_id)\
            .execute()

        quote_summary = summary_result.data[0] if summary_result.data else {}

        # Quote-level totals from pre-calculated summary
        quote_total_vars = [
            ("calc_s16_total_purchase_price", "S13", "Purchase Total"),
            ("calc_t16_first_leg_logistics", "T13", "Logistics: Supplier→Hub"),
            ("calc_u16_last_leg_logistics", "U13", "Logistics: Hub→Client"),
            ("calc_v16_total_logistics", "V13", "Logistics Total"),
            ("calc_total_brokerage", "--", "Brokerage Total"),
            ("calc_total_logistics_and_brokerage", "--", "Logistics + Brokerage"),
            ("calc_y16_customs_duty", "Y13", "Customs Duty"),
            ("calc_z16_excise_tax", "Z13", "Excise Tax"),
            ("calc_ay16_internal_price_total", "AY13", "Internal Sale Price"),
            ("calc_ab16_cogs_total", "AB13", "COGS Total"),
            ("calc_ae16_sale_price_total", "AE13", "Sale Price (no VAT)"),
            ("calc_ak16_final_price_total", "AK13", "Final Price Total"),
            ("calc_al16_total_with_vat", "AL13", "Total With VAT"),
            ("calc_an16_sales_vat", "AN13", "Sales VAT"),
            ("calc_ap16_net_vat_payable", "AP13", "Net VAT Payable"),
            ("calc_ag16_dm_fee", "AG13", "DM Fee"),
            ("calc_ah16_forex_risk_reserve", "AH13", "Forex Risk Reserve"),
            ("calc_ai16_agent_fee", "AI13", "Agent Fee"),
            ("calc_ba16_financing_per_product", "BA13", "Financing Cost"),
            ("calc_bh6_supplier_payment", "BH6", "Supplier Payment"),
            ("calc_bh3_client_advance", "BH3", "Client Advance"),
            ("calc_bh2_revenue_estimated", "BH2", "Evaluated Revenue"),
            ("calc_bh4_before_forwarding", "BH4", "Total Before Forwarding"),
            ("calc_bh7_supplier_financing_need", "BH7", "Supplier Financing Need"),
            ("calc_bj7_supplier_financing_cost", "BJ7", "Supplier Financing Cost"),
            ("calc_bh10_operational_financing", "BH10", "Operational Financing Need"),
            ("calc_bj10_operational_cost", "BJ10", "Operational Financing Cost"),
            ("calc_bj11_total_financing_cost", "BJ11", "Total Financing Cost"),
            ("calc_bl3_credit_sales_amount", "BL3", "Credit Sales Amount"),
            ("calc_bl4_credit_sales_with_interest", "BL4", "Credit Sales FV"),
            ("calc_bl5_credit_sales_interest", "BL5", "Credit Sales Interest"),
        ]

        for field_name, excel_ref, description in quote_total_vars:
            value = quote_summary.get(field_name, 0)

            try:
                value_decimal = Decimal(str(value)) if value else Decimal("0")
            except:
                value_decimal = Decimal("0")

            value_usd = value_decimal * usd_rate

            rows.append({
                "Product": "QUOTE TOTAL",
                "Qty": "",
                "Variable": excel_ref,
                "Description": description,
                f"Value ({quote_currency})": float(value_decimal.quantize(Decimal("0.01"))),
                "Value (USD)": float(value_usd.quantize(Decimal("0.01"))),
                "Rate Used": float(usd_rate.quantize(Decimal("0.0001"))),
            })

        # Create CSV
        df = pd.DataFrame(rows)

        # Generate CSV string
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)

        # Return as downloadable CSV
        # Use ASCII-safe filename to avoid encoding issues
        quote_number = quote.get('quote_number', quote_id)
        # Remove any non-ASCII characters for the filename
        safe_quote_number = ''.join(c if ord(c) < 128 else '_' for c in str(quote_number))
        filename = f"debug_calc_{safe_quote_number}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting debug data: {str(e)}"
        )


# ============================================================================
# VALIDATION EXPORT ENDPOINT - Complete Excel Cell Reference Mapping
# ============================================================================

@router.get("/validation-export/{quote_id}")
async def export_validation_data(
    quote_id: str,
    user: User = Depends(get_current_user)
):
    """
    Export ALL calculation results mapped to exact Excel cell references.
    One row per product with all intermediate values for validation.

    Excel Cell Reference Mapping:
    - N16: Price without VAT
    - P16: After discount
    - Q16: Exchange rate to quote currency
    - R16: Price per unit in quote currency
    - S16: Total purchase price
    - T16: Logistics supplier→hub
    - U16: Logistics hub→customs (includes insurance)
    - V16: Total logistics
    - W16: Brokerage total
    - Y16: Customs duty
    - Z16: Excise tax
    - AA16: COGS per unit
    - AB16: COGS total
    - AD16: Sale price/unit (excl financial)
    - AE16: Sale price total (excl financial)
    - AF16: Profit
    - AG16: DM fee (LPR commission)
    - AH16: Forex risk reserve
    - AI16: Financial agent fee
    - AJ16: Sale price/unit (no VAT)
    - AK16: Sale price total (no VAT)
    - AL16: Sale price total (with VAT)
    - AM16: Sale price/unit (with VAT)
    - AN16: VAT from sales
    - AO16: VAT on import (deductible)
    - AP16: Net VAT payable
    - BA16: Initial financing cost
    - BB16: Credit interest cost
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any organization"
        )

    try:
        # Get quote and verify organization ownership
        quote_result = supabase.table("quotes").select("*").eq("id", quote_id).execute()
        if not quote_result.data:
            raise HTTPException(status_code=404, detail="Quote not found")

        quote = quote_result.data[0]
        if quote["organization_id"] != str(user.current_organization_id):
            raise HTTPException(status_code=403, detail="Not authorized")

        # Get quote items
        items_result = supabase.table("quote_items").select("*").eq("quote_id", quote_id).execute()
        if not items_result.data:
            raise HTTPException(status_code=404, detail="No items found for quote")

        # Get calculation results from quote_calculation_results table
        calc_results_query = supabase.table("quote_calculation_results")\
            .select("quote_item_id, phase_results")\
            .eq("quote_id", quote_id)\
            .execute()

        # Build lookup dict: quote_item_id -> phase_results
        calc_results_by_item = {}
        for calc_row in calc_results_query.data:
            item_id = calc_row.get("quote_item_id")
            if item_id:
                calc_results_by_item[item_id] = calc_row.get("phase_results", {})

        # Get exchange rate for quote currency conversion
        quote_currency = quote.get("currency", "USD")
        usd_to_quote_rate = Decimal("1.0")

        if quote_currency != "USD":
            rate_result = supabase.table("exchange_rates")\
                .select("rate")\
                .eq("from_currency", "USD")\
                .eq("to_currency", quote_currency)\
                .order("fetched_at", desc=True)\
                .limit(1)\
                .execute()

            if rate_result.data:
                usd_to_quote_rate = Decimal(str(rate_result.data[0]["rate"]))

        # Build flat CSV rows - one row per product
        rows = []

        # Excel cell reference to phase_results field mapping
        # Based on ProductCalculationResult model in calculation_models.py
        field_mapping = {
            # Phase 1: Purchase price
            "N16": "purchase_price_no_vat",
            "O16": None,  # Supplier discount % - input field
            "P16": "purchase_price_after_discount",
            "Q16": None,  # Exchange rate - derived
            "R16": "purchase_price_per_unit_quote_currency",
            "S16": "purchase_price_total_quote_currency",

            # Phase 3: Logistics
            "T16": "logistics_first_leg",  # Supplier→Hub (+ insurance)
            "U16": "logistics_last_leg",   # Hub→Customs
            "V16": "logistics_total",

            # Phase 4: Brokerage (breakdown)
            "W16_hub": "brokerage_hub",
            "W16_customs": "brokerage_customs",
            "W16_warehousing": "brokerage_warehousing",
            "W16_docs": "brokerage_documentation",
            "W16_extra": "brokerage_extra",
            "W16": "brokerage_total",

            # Phase 5: Duties & Taxes
            "Y16": "customs_fee",
            "Z16": "excise_tax_amount",

            # Phase 7: COGS
            "AA16": "cogs_per_unit",
            "AB16": "cogs_per_product",

            # Phase 8: Sale price (excl financial)
            "AD16": "sale_price_per_unit_excl_financial",
            "AE16": "sale_price_total_excl_financial",

            # Phase 9: Profit & fees
            "AF16": "profit",
            "AG16": "dm_fee",
            "AH16": "forex_reserve",
            "AI16": "financial_agent_fee",

            # Phase 10: Final sales price
            "AJ16": "sales_price_per_unit_no_vat",
            "AK16": "sales_price_total_no_vat",
            "AL16": "sales_price_total_with_vat",
            "AM16": "sales_price_per_unit_with_vat",

            # Phase 11: VAT
            "AN16": "vat_from_sales",
            "AO16": "vat_on_import",
            "AP16": "vat_net_payable",

            # Phase 6: Financing
            "BA16": "financing_cost_initial",
            "BB16": "financing_cost_credit",
        }

        for item in items_result.data:
            item_id = item.get("id")
            calc_results = calc_results_by_item.get(item_id, {})

            # Build row with all fields
            # Use sku if available, otherwise use product_name (handle None values)
            row = {
                "C16 Артикул": item.get("sku") or item.get("product_name") or "Unknown",
                "L16 Страна закупки": item.get("supplier_country", ""),
                "J16 Валюта закупки": item.get("currency_of_base_price", "USD"),
                "K16 Цена закупки (с VAT)": item.get("base_price_vat", 0),
                "E16 Количество": item.get("quantity", 1),
            }

            # Add all mapped fields
            for excel_ref, field_name in field_mapping.items():
                if field_name is None:
                    row[excel_ref] = ""
                else:
                    value = calc_results.get(field_name, "")
                    if value != "" and value is not None:
                        try:
                            row[excel_ref] = float(Decimal(str(value)).quantize(Decimal("0.01")))
                        except:
                            row[excel_ref] = value
                    else:
                        row[excel_ref] = ""

            # Calculate Q16 (exchange rate) from R16/P16
            r16 = calc_results.get("purchase_price_per_unit_quote_currency", 0)
            p16 = calc_results.get("purchase_price_after_discount", 0)
            if p16 and float(p16) > 0:
                row["Q16 Курс к валюте КП"] = round(float(r16) / float(p16), 4)
            else:
                row["Q16 Курс к валюте КП"] = ""

            # Add quote currency conversion
            row["Курс USD/EUR"] = float(usd_to_quote_rate)

            # AK16 and AL16 in quote currency (EUR)
            ak16 = calc_results.get("sales_price_total_no_vat", 0)
            al16 = calc_results.get("sales_price_total_with_vat", 0)
            if ak16:
                row["AK16 в EUR (без НДС)"] = float(Decimal(str(ak16)) * usd_to_quote_rate)
            if al16:
                row["AL16 в EUR (с НДС)"] = float(Decimal(str(al16)) * usd_to_quote_rate)

            rows.append(row)

        # Create DataFrame with ordered columns
        column_order = [
            "C16 Артикул", "L16 Страна закупки", "J16 Валюта закупки",
            "K16 Цена закупки (с VAT)", "E16 Количество",
            "N16", "O16", "P16", "Q16 Курс к валюте КП", "R16", "S16",
            "T16", "U16", "V16",
            "W16_hub", "W16_customs", "W16_warehousing", "W16_docs", "W16_extra", "W16",
            "Y16", "Z16",
            "AA16", "AB16",
            "AD16", "AE16",
            "AF16", "AG16", "AH16", "AI16",
            "AJ16", "AK16", "AL16", "AM16",
            "AN16", "AO16", "AP16",
            "BA16", "BB16",
            "Курс USD/EUR", "AK16 в EUR (без НДС)", "AL16 в EUR (с НДС)"
        ]

        df = pd.DataFrame(rows)
        # Reorder columns (keep only those that exist)
        existing_cols = [c for c in column_order if c in df.columns]
        df = df[existing_cols]

        # Generate CSV
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)

        quote_number = quote.get('quote_number', quote_id)
        safe_quote_number = ''.join(c if ord(c) < 128 else '_' for c in str(quote_number))
        filename = f"validation_{safe_quote_number}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error exporting validation data: {str(e)}"
        )
