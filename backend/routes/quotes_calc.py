"""
Quote Calculation Routes - Excel/CSV Upload and Calculation Engine Integration
Uses Supabase client (NOT asyncpg) following customers.py pattern
"""
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime
import os
import io

from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from supabase import create_client, Client
import pandas as pd

from auth import get_current_user, User
from pydantic import BaseModel, Field
from decimal import Decimal

# Import calculation engine
from calculation_engine import calculate_single_product_quote
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


# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)


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
    title: str
    description: Optional[str] = None
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


def map_variables_to_calculation_input(
    product: ProductFromFile,
    variables: Dict[str, Any],
    admin_settings: Dict[str, Decimal]
) -> QuoteCalculationInput:
    """
    Transform flat variables dict + product into nested QuoteCalculationInput.

    Implements two-tier variable system:
    - Product-level values override quote-level defaults
    - Quote-level defaults override hardcoded fallbacks

    Args:
        product: Product from Excel/CSV with potential field overrides
        variables: Quote-level default variables (flat dict from frontend)
        admin_settings: Admin settings with rate_forex_risk, rate_fin_comm, rate_loan_interest_daily

    Returns:
        QuoteCalculationInput with all nested models populated

    Raises:
        ValueError: If required fields are missing
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
    financial = FinancialParams(
        currency_of_quote=Currency(variables.get('currency_of_quote', 'USD')),
        exchange_rate_base_price_to_quote=safe_decimal(variables.get('exchange_rate_base_price_to_quote'), Decimal("1")),
        supplier_discount=safe_decimal(variables.get('supplier_discount'), Decimal("0")),
        markup=safe_decimal(variables.get('markup'), Decimal("15")),  # Required in validation
        rate_forex_risk=admin_settings.get('rate_forex_risk', Decimal("3")),
        dm_fee_type=DMFeeType(variables.get('dm_fee_type', 'fixed')),
        dm_fee_value=safe_decimal(variables.get('dm_fee_value'), Decimal("0"))
    )

    # ========== LogisticsParams (6 fields) ==========
    logistics = LogisticsParams(
        supplier_country=SupplierCountry(get_value('supplier_country', product, variables, 'Турция')),
        offer_incoterms=Incoterms(variables.get('offer_incoterms', 'DDP')),
        delivery_time=safe_int(variables.get('delivery_time'), 60),  # Default 60 days
        logistics_supplier_hub=safe_decimal(variables.get('logistics_supplier_hub'), Decimal("0")),
        logistics_hub_customs=safe_decimal(variables.get('logistics_hub_customs'), Decimal("0")),
        logistics_customs_client=safe_decimal(variables.get('logistics_customs_client'), Decimal("0"))
    )

    # ========== TaxesAndDuties (3 fields) ==========
    taxes = TaxesAndDuties(
        import_tariff=safe_decimal(get_value('import_tariff', product, variables), Decimal("0")),
        excise_tax=safe_decimal(get_value('excise_tax', product, variables), Decimal("0")),
        util_fee=safe_decimal(get_value('util_fee', product, variables), Decimal("0"))
    )

    # ========== PaymentTerms (10 fields) ==========
    payment = PaymentTerms(
        advance_from_client=safe_decimal(variables.get('advance_from_client'), Decimal("100")),
        advance_to_supplier=safe_decimal(variables.get('advance_to_supplier'), Decimal("100")),
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
    customs = CustomsAndClearance(
        brokerage_hub=safe_decimal(variables.get('customs_brokerage_fee_turkey'), Decimal("0")),
        brokerage_customs=safe_decimal(variables.get('customs_brokerage_fee_russia'), Decimal("0")),
        warehousing_at_customs=safe_decimal(variables.get('temporary_storage_cost'), Decimal("0")),
        customs_documentation=safe_decimal(variables.get('permitting_documents_cost'), Decimal("0")),
        brokerage_extra=safe_decimal(variables.get('miscellaneous_costs'), Decimal("0"))
    )

    # ========== CompanySettings (2 fields) ==========
    company = CompanySettings(
        seller_company=SellerCompany(variables.get('seller_company', 'МАСТЕР БЭРИНГ ООО')),
        offer_sale_type=OfferSaleType(variables.get('offer_sale_type', 'поставка'))
    )

    # ========== SystemConfig (3 fields from admin) ==========
    system = SystemConfig(
        rate_fin_comm=admin_settings.get('rate_fin_comm', Decimal("2")),
        rate_loan_interest_daily=admin_settings.get('rate_loan_interest_daily', Decimal("0.00069")),
        rate_insurance=safe_decimal(variables.get('rate_insurance'), Decimal("0.00047"))
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


async def fetch_admin_settings(organization_id: str) -> Dict[str, Decimal]:
    """
    Fetch admin calculation settings for organization.

    Args:
        organization_id: Organization UUID

    Returns:
        Dict with rate_forex_risk, rate_fin_comm, rate_loan_interest_daily
        Returns defaults if settings not found in database

    Default values:
        - rate_forex_risk: 3%
        - rate_fin_comm: 2%
        - rate_loan_interest_daily: 0.00069 (25.19% annual)
    """
    try:
        # Fetch from calculation_settings table
        response = supabase.table("calculation_settings")\
            .select("rate_forex_risk, rate_fin_comm, rate_loan_interest_daily")\
            .eq("organization_id", organization_id)\
            .execute()

        if response.data and len(response.data) > 0:
            settings = response.data[0]
            return {
                'rate_forex_risk': Decimal(str(settings.get('rate_forex_risk', "3"))),
                'rate_fin_comm': Decimal(str(settings.get('rate_fin_comm', "2"))),
                'rate_loan_interest_daily': Decimal(str(settings.get('rate_loan_interest_daily', "0.00069")))
            }
        else:
            # Return defaults if no settings found
            return {
                'rate_forex_risk': Decimal("3"),
                'rate_fin_comm': Decimal("2"),
                'rate_loan_interest_daily': Decimal("0.00069")
            }

    except Exception as e:
        # Log error and return defaults
        print(f"Error fetching admin settings: {e}")
        return {
            'rate_forex_risk': Decimal("3"),
            'rate_fin_comm': Decimal("2"),
            'rate_loan_interest_daily': Decimal("0.00069")
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

    # Markup validation
    markup = get_value('markup', product, variables, None)
    if not markup:
        errors.append(
            f"Товар '{product_id}': отсутствует 'Наценка (%)' (markup). "
            "Укажите значение в карточке 'Финансовые параметры' или в таблице для конкретного товара."
        )
    elif safe_decimal(markup) <= 0:
        errors.append(
            f"Товар '{product_id}': 'Наценка (%)' должна быть больше нуля (текущее значение: {markup})."
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
                product = ProductFromFile(
                    product_name=str(row['product_name']),
                    product_code=str(row.get('product_code', '')) if pd.notna(row.get('product_code')) else None,
                    base_price_vat=float(row['base_price_vat']),
                    quantity=int(row['quantity']),
                    weight_in_kg=float(row.get('weight_in_kg', 0)) if pd.notna(row.get('weight_in_kg')) else 0,
                    customs_code=str(row.get('customs_code', '')) if pd.notna(row.get('customs_code')) else None,
                    supplier_country=str(row.get('supplier_country', '')) if pd.notna(row.get('supplier_country')) else None
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


# ============================================================================
# QUOTE CALCULATION ENDPOINT
# ============================================================================

@router.post("/calculate", response_model=QuoteCalculationResult, status_code=status.HTTP_201_CREATED)
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

    try:
        # Generate quote number (format: КП25-0001)
        # Get count of existing quotes to generate next number
        count_response = supabase.table("quotes")\
            .select("id", count="exact")\
            .eq("organization_id", str(user.current_organization_id))\
            .execute()

        quote_count = count_response.count if count_response.count else 0
        quote_number = f"КП25-{str(quote_count + 1).zfill(4)}"

        # 1. Create quote record
        quote_data = {
            "organization_id": str(user.current_organization_id),
            "customer_id": request.customer_id,
            "quote_number": quote_number,
            "title": request.title,
            "description": request.description,
            "status": "draft",
            "created_by": str(user.id),
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

        # 2. Create quote_items records
        items_data = []
        for idx, product in enumerate(request.products):
            item_data = {
                "quote_id": quote_id,
                "position": idx,
                "product_name": product.product_name,
                "product_code": product.product_code,
                "base_price_vat": float(product.base_price_vat),
                "quantity": product.quantity,
                "weight_in_kg": float(product.weight_in_kg) if product.weight_in_kg else 0,
                "customs_code": product.customs_code,
                "supplier_country": product.supplier_country or request.variables.get('supplier_country', 'Турция')
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
        admin_settings = await fetch_admin_settings(str(user.current_organization_id))

        # 5. Run calculation engine for each product
        calculation_results = []
        total_subtotal = Decimal("0")
        total_amount = Decimal("0")

        for idx, (product, item_record) in enumerate(zip(request.products, items_response.data)):
            try:
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
                calc_input = map_variables_to_calculation_input(
                    product=product,
                    variables=request.variables,
                    admin_settings=admin_settings
                )

                # Calculate using engine
                result = calculate_single_product_quote(calc_input)

                # Save calculation results
                results_data = {
                    "quote_id": quote_id,
                    "quote_item_id": item_record['id'],
                    "phase_results": convert_decimals_to_float(result.dict())  # Convert Decimals for JSON
                }

                results_response = supabase.table("quote_calculation_results")\
                    .insert(results_data)\
                    .execute()

                # Accumulate totals
                total_subtotal += result.purchase_price_total_quote_currency  # S16 - Purchase price
                total_amount += result.sales_price_total_no_vat  # AK16 - Final sales price total

                # Calculate import duties (tariff only)
                import_duties_total = result.customs_fee  # Y16 - Import tariff

                # Calculate excise + util fees (Акциз + Утиль)
                util_fee_value = Decimal(str(request.variables.get('util_fee', 0)))
                excise_and_util = result.excise_tax_amount + util_fee_value  # Z16 + util_fee

                # Calculate financing costs
                financing_costs_total = result.financing_cost_initial + result.financing_cost_credit

                # Calculate brokerage costs (distributed per product) - these are included in COGS/operational costs
                total_brokerage = (
                    Decimal(str(request.variables.get('brokerage_hub', 0))) +
                    Decimal(str(request.variables.get('brokerage_customs', 0))) +
                    Decimal(str(request.variables.get('warehousing_at_customs', 0))) +
                    Decimal(str(request.variables.get('customs_documentation', 0))) +
                    Decimal(str(request.variables.get('brokerage_extra', 0)))
                )
                brokerage_per_product = total_brokerage * result.distribution_base

                # Calculate comprehensive total cost (COGS + duties + excise/util + financing + brokerage)
                total_cost_comprehensive = (
                    result.cogs_per_product +
                    import_duties_total +
                    excise_and_util +
                    financing_costs_total +
                    brokerage_per_product +
                    result.dm_fee
                )

                # Add to response - map backend field names to frontend interface
                calculation_results.append({
                    "item_id": item_record['id'],
                    "product_name": product.product_name,
                    "product_code": product.product_code,
                    "quantity": product.quantity,
                    # Map backend fields to frontend interface (ProductCalculationResult in quotes-calc-service.ts)
                    "base_price_vat": float(product.base_price_vat),
                    "base_price_no_vat": float(result.purchase_price_no_vat),
                    "purchase_price_rub": float(result.purchase_price_total_quote_currency),  # S16 - Total purchase in quote currency
                    "logistics_costs": float(result.logistics_total),  # V16 - Total logistics (transport only, not brokerage)
                    "cogs": float(result.cogs_per_product),  # AB16 - Cost of goods sold
                    "cogs_with_vat": float(result.cogs_per_product * Decimal("1.2")),  # COGS + 20% VAT estimate
                    "import_duties": float(import_duties_total),  # Y16 - Import tariff (Пошлина)
                    "customs_fees": float(excise_and_util),  # Z16 + util_fee - Excise tax + Utilization fee (Акциз + Утиль)
                    "financing_costs": float(financing_costs_total),  # BA16 + BB16 - Supplier + operational financing
                    "dm_fee": float(result.dm_fee),  # AG16 - Decision maker fee
                    "total_cost": float(total_cost_comprehensive),  # COGS + duties + excise/util + financing + brokerage + DM fee
                    "sale_price": float(result.sales_price_total_no_vat),  # AK16 - Final sales price
                    "margin": float(result.profit)  # AF16 - Profit margin
                })

            except Exception as e:
                # If calculation fails for one product, roll back the quote
                supabase.table("quotes").delete().eq("id", quote_id).execute()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Calculation failed for product {product.product_name}: {str(e)}"
                )

        # 6. Update quote totals
        supabase.table("quotes").update({
            "subtotal": float(total_subtotal),
            "total_amount": float(total_amount)
        }).eq("id", quote_id).execute()

        # 7. Return complete result
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
