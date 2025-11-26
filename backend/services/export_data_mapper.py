"""
Export Data Mapper Service

Unified data fetcher for all 6 export formats (4 PDFs + 2 Excel).
Fetches all necessary data in a single structure and maps calculation results to Excel cell references.
"""
from typing import Optional, Dict, Any, List
from decimal import Decimal
from pydantic import BaseModel
from uuid import UUID
import os
from supabase import create_client, Client

# Lazy-initialize Supabase client to avoid issues during test collection
_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create Supabase client singleton"""
    global _supabase_client
    if _supabase_client is None:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _supabase_client = create_client(supabase_url, supabase_key)
    return _supabase_client


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class ExportData(BaseModel):
    """Unified export data structure for all export formats"""
    quote: Dict[str, Any]
    items: List[Dict[str, Any]]  # with calculation results
    customer: Optional[Dict[str, Any]] = None
    contact: Optional[Dict[str, Any]] = None
    manager: Optional[Dict[str, Any]] = None
    organization: Dict[str, Any]
    variables: Dict[str, Any]
    calculations: Dict[str, Any]  # Excel cell mapping for totals

    class Config:
        arbitrary_types_allowed = True


# ============================================================================
# EXCEL CELL MAPPING
# ============================================================================

# Cell references for all calculation outputs (from Variables_specification_notion.md)
EXCEL_CELL_MAP = {
    # Input variables (product-level and quote-level)
    'base_price_vat': 'K16',
    'quantity': 'E16',
    'brand': 'B16',
    'sku': 'C16',
    'product_name': 'D16',
    'weight_in_kg': 'G16',
    'currency_of_base_price': 'J16',
    'supplier_country': 'L16',
    'customs_code': 'W16',
    'import_tariff': 'X16',
    'excise_tax': 'Z16',

    # Quote-level variables
    'supplier_discount': 'O16',
    'currency_of_quote': 'D8',
    'exchange_rate_base_price_to_quote': 'Q16',
    'markup': 'AC16',

    # Calculation outputs (Final-X numbers)
    'purchase_price_no_vat': 'N16',  # Final-34
    'invoice_amount_orig_currency': 'N16*E16',  # Calculated: Price × Quantity
    'purchase_price_quote_currency': 'S16',  # Final-9
    'logistics_per_product': 'V16',  # Final-10
    'customs_fee': 'Y16',  # Final-11
    'transit_commission': 'AQ16',  # Final-44
    'selling_price_per_unit': 'AJ16',  # Final-2
    'selling_price_total': 'AK16',  # Final-1
    'vat_from_sales': 'AN16',  # Final-41
    'selling_price_with_vat_per_unit': 'AM16',  # Final-39
    'selling_price_with_vat_total': 'AL16',  # Final-40
}


def map_calculation_to_cells(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map calculation result fields to Excel cell references.

    Args:
        item: Quote item with calculation_results from quote_calculation_results table

    Returns:
        Dict with Excel cell references as keys
    """
    if not item.get('calculation_results'):
        return {}

    calc = item['calculation_results']

    # Map calculation results to Excel cells
    cell_data = {
        # Input data (from item)
        'B16': item.get('brand', ''),
        'C16': item.get('sku', ''),
        'D16': item.get('product_name', ''),
        'E16': item.get('quantity', 0),
        'G16': item.get('weight_in_kg', 0),
        'K16': item.get('base_price_vat', 0),
        'W16': item.get('customs_code', ''),
        'X16': item.get('import_tariff', 0),
        'Z16': item.get('excise_tax', 0),

        # Calculated outputs (in USD for internal tracking)
        'N16': calc.get('purchase_price_no_vat', 0),  # Final-34
        'S16': calc.get('purchase_price_total_quote_currency', 0),  # Final-9 (USD)
        'V16': calc.get('logistics_total', 0),  # Final-10 (USD)
        'Y16': calc.get('customs_fee', 0),  # Final-11 (USD)
        'AQ16': calc.get('transit_commission', 0),  # Final-44

        # Client-facing prices - prefer quote currency if available, fallback to USD
        'AJ16': calc.get('sales_price_per_unit_quote', calc.get('sales_price_per_unit', 0)),  # Final-2 (quote currency)
        'AK16': calc.get('sales_price_total_quote', calc.get('sales_price_total_no_vat', 0)),  # Final-1 (quote currency)
        'AN16': calc.get('vat_amount', 0),  # Final-41
        'AM16': calc.get('sales_price_per_unit_with_vat_quote', calc.get('sales_price_per_unit_with_vat', 0)),  # Final-39 (quote currency)
        'AL16': calc.get('sales_price_total_with_vat_quote', calc.get('sales_price_total_with_vat', 0)),  # Final-40 (quote currency)
    }

    # Calculate invoice amount (N16 × E16)
    if 'N16' in cell_data and 'E16' in cell_data:
        cell_data['invoice_amount'] = Decimal(str(cell_data['N16'])) * Decimal(str(cell_data['E16']))

    return cell_data


# ============================================================================
# DATA FETCHING
# ============================================================================

async def fetch_export_data(quote_id: str, organization_id: str) -> ExportData:
    """
    Fetch all data needed for export formats.

    This function retrieves:
    1. Quote with variables
    2. Quote items with calculation results
    3. Customer information
    4. Customer contact (optional)
    5. Manager (user who created quote)
    6. Organization (for CEO info)
    7. Excel cell mappings for calculations

    Args:
        quote_id: Quote UUID
        organization_id: Organization UUID (for RLS validation)

    Returns:
        ExportData with all information needed for any export format

    Raises:
        ValueError: If quote not found or doesn't belong to organization
    """

    # Get Supabase client
    supabase = get_supabase_client()

    # ========== Step 1: Get quote ==========
    quote_response = supabase.table("quotes").select("*").eq("id", quote_id).eq(
        "organization_id", organization_id
    ).execute()

    if not quote_response.data:
        raise ValueError(f"Quote {quote_id} not found or doesn't belong to organization {organization_id}")

    quote = quote_response.data[0]


    # ========== Step 2: Get quote items with calculation results ==========
    items_response = supabase.table("quote_items").select(
        "*, quote_calculation_results(phase_results, calculated_at)"
    ).eq("quote_id", quote_id).order("position").execute()

    items = []
    for item_row in items_response.data:
        item_dict = dict(item_row)

        # Extract calculation results if present
        calc_results = item_row.get('quote_calculation_results')

        # Handle different return types from Supabase:
        # - list: multiple calculation results
        # - dict: single calculation result
        # - None/empty: no calculation results
        if calc_results:
            if isinstance(calc_results, list) and len(calc_results) > 0:
                # List case: take the most recent (first) calculation
                latest_calc = calc_results[0]
            elif isinstance(calc_results, dict):
                # Dict case: single calculation result
                latest_calc = calc_results
            else:
                # Empty or invalid data
                latest_calc = None

            if latest_calc:
                item_dict['calculation_results'] = latest_calc.get('phase_results', {})
                item_dict['calculated_at'] = latest_calc.get('calculated_at')
            else:
                item_dict['calculation_results'] = None
                item_dict['calculated_at'] = None
        else:
            item_dict['calculation_results'] = None
            item_dict['calculated_at'] = None

        # Remove nested quote_calculation_results array (we've extracted it)
        item_dict.pop('quote_calculation_results', None)

        items.append(item_dict)


    # ========== Step 3: Get customer ==========
    customer = None
    if quote.get('customer_id'):
        customer_response = supabase.table("customers").select("*").eq(
            "id", quote['customer_id']
        ).execute()

        if customer_response.data:
            customer = customer_response.data[0]


    # ========== Step 4: Get customer contact (optional) ==========
    contact = None
    if quote.get('contact_id'):
        contact_response = supabase.table("customer_contacts").select("*").eq(
            "id", quote['contact_id']
        ).execute()

        if contact_response.data:
            contact = contact_response.data[0]


    # ========== Step 5: Get manager (user who created quote) ==========
    manager = None
    if quote.get('created_by_user_id'):
        # Get user profile (includes manager info)
        try:
            profile_response = supabase.table("user_profiles").select("*").eq(
                "user_id", quote['created_by_user_id']
            ).execute()

            if profile_response.data and len(profile_response.data) > 0:
                profile = profile_response.data[0]

                # Get email from auth.users
                user_response = supabase.auth.admin.get_user_by_id(quote['created_by_user_id'])
                email = user_response.user.email if user_response and user_response.user else None

                manager = {
                    'id': profile.get('user_id'),
                    'email': email,
                    'full_name': profile.get('manager_name') or profile.get('full_name'),
                    'phone': profile.get('manager_phone') or profile.get('phone'),
                    'manager_email': profile.get('manager_email'),
                }
        except Exception as e:
            print(f"Warning: Could not fetch manager info: {e}")
            manager = None


    # ========== Step 6: Get organization (for CEO info) ==========
    org_response = supabase.table("organizations").select("*").eq(
        "id", organization_id
    ).execute()

    if not org_response.data:
        raise ValueError(f"Organization {organization_id} not found")

    organization = org_response.data[0]


    # ========== Step 7: Get calculation variables ==========
    variables = {}
    variables_response = supabase.table("quote_calculation_variables").select("*").eq(
        "quote_id", quote_id
    ).execute()

    if variables_response.data:
        variables = variables_response.data[0].get('variables', {})


    # ========== Step 8: Calculate totals and Excel cell mappings ==========
    total_subtotal = Decimal("0")
    total_with_vat = Decimal("0")

    for item in items:
        if item.get('calculation_results'):
            calc = item['calculation_results']
            # Sum sales prices (AK16 - Final-1)
            total_subtotal += Decimal(str(calc.get('sales_price_total_no_vat', 0)))
            # Sum sales prices with VAT (AL16 - Final-40)
            total_with_vat += Decimal(str(calc.get('sales_price_total_with_vat', 0)))

    calculations = {
        'total_subtotal': float(total_subtotal),
        'total_with_vat': float(total_with_vat),
        'currency': variables.get('currency_of_quote', 'USD'),
    }


    # ========== Return unified structure ==========
    return ExportData(
        quote=quote,
        items=items,
        customer=customer,
        contact=contact,
        manager=manager,
        organization=organization,
        variables=variables,
        calculations=calculations
    )


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_manager_info(export_data: ExportData) -> Dict[str, str]:
    """
    Get manager information with quote-level overrides.

    Priority:
    1. Quote-level manager fields (manager_name, manager_phone, manager_email)
    2. Manager user profile (manager_name/manager_phone/manager_email from user_profiles)
    3. Manager fallback fields (full_name, phone, email)
    4. Empty strings

    Args:
        export_data: Export data with quote, manager info

    Returns:
        Dict with name, phone, email
    """
    quote = export_data.quote
    manager = export_data.manager

    return {
        'name': quote.get('manager_name') or (manager.get('full_name') if manager else ''),
        'phone': quote.get('manager_phone') or (manager.get('phone') if manager else ''),
        'email': quote.get('manager_email') or (manager.get('manager_email') or manager.get('email') if manager else ''),
    }


def get_contact_info(export_data: ExportData) -> Dict[str, str]:
    """
    Get customer contact information.

    Args:
        export_data: Export data with contact info

    Returns:
        Dict with name, phone, email (empty strings if no contact)
    """
    contact = export_data.contact

    if not contact:
        return {'name': '', 'phone': '', 'email': ''}

    return {
        'name': contact.get('name', ''),
        'phone': contact.get('phone', ''),
        'email': contact.get('email', ''),
    }


def format_payment_terms(variables: Dict[str, Any]) -> str:
    """
    Format payment terms for display in exports.

    Args:
        variables: Quote calculation variables

    Returns:
        Formatted payment terms string (Russian)
    """
    advance = variables.get('advance_from_client', 100)

    if advance == 100:
        return "100% предоплата"
    elif advance == 0:
        return "Постоплата"
    else:
        return f"{advance}% аванс"


def format_delivery_description(variables: Dict[str, Any]) -> str:
    """
    Format delivery description based on incoterms.

    Args:
        variables: Quote calculation variables

    Returns:
        Delivery description string (Russian)
    """
    incoterms = variables.get('offer_incoterms', 'DDP')

    if incoterms == 'DDP':
        return "Цена включает: НДС, страховку, таможенную очистку и доставку товара до склада"
    else:
        return "Цена включает: затраты на доставку и страховку"
