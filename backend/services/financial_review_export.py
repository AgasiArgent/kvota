"""
Financial Review Excel Export Service

Generates Excel files for financial manager review with:
- Quote data and calculation results
- Auto-validation highlighting (red cells for issues)
- Comments explaining problems
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.comments import Comment
from decimal import Decimal
from typing import Dict, List, Any, Optional


# Color fills for validation
RED_FILL = PatternFill(start_color="FFCCCC", end_color="FFCCCC", fill_type="solid")
GREEN_FILL = PatternFill(start_color="CCFFCC", end_color="CCFFCC", fill_type="solid")
YELLOW_FILL = PatternFill(start_color="FFFFCC", end_color="FFFFCC", fill_type="solid")


def create_financial_review_excel(quote_data: Dict[str, Any]) -> Workbook:
    """
    Create Excel workbook for financial manager review

    Args:
        quote_data: Quote data with calculation results including:
            - quote_number: str
            - customer_name: str
            - seller_company: str (D5)
            - offer_sale_type: str (D6)
            - offer_incoterms: str (D7)
            - currency_of_quote: str (D8)
            - delivery_time: int (D9, days)
            - advance_to_supplier: Decimal (D11, %)
            - advance_from_client: Decimal (J5, %)
            - time_to_advance: int (K5, days)
            - logistics fields: W2-W10
            - totals: V13, AB13, AC13, AK13, AL13, AM13
            - dm_fee_type: str (AG3)
            - dm_fee_value: Decimal (AG7)
            - products: List[Dict] - product-level data
            - vat_removed: bool - Was VAT removed from purchase price?

    Returns:
        openpyxl Workbook ready for download
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Review"

    # ========== HEADER ==========
    ws['A1'] = 'Financial Review'
    ws['A1'].font = Font(bold=True, size=14)
    ws.merge_cells('A1:D1')

    # ========== QUOTE INFO SECTION ==========
    row = 3
    ws[f'A{row}'] = 'Quote Number:'
    ws[f'B{row}'] = quote_data.get('quote_number', '')
    ws[f'B{row}'].font = Font(bold=True)

    row += 1
    ws[f'A{row}'] = 'Customer:'
    ws[f'B{row}'] = quote_data.get('customer_name', '')

    row += 1
    ws[f'A{row}'] = 'Total Amount (with VAT):'
    ws[f'B{row}'] = float(quote_data.get('total_amount', 0))
    ws[f'B{row}'].number_format = '#,##0.00 ₽'

    # ========== BASIC INFO (D5:D11) ==========
    row += 2
    ws[f'A{row}'] = 'Basic Information'
    ws[f'A{row}'].font = Font(bold=True, size=12)

    row += 1
    info_fields = [
        ('Seller Company', 'seller_company'),
        ('Sale Type', 'offer_sale_type'),
        ('Incoterms', 'offer_incoterms'),
        ('Currency', 'currency_of_quote'),
        ('Delivery Time (days)', 'delivery_time'),
        ('Advance to Supplier (%)', 'advance_to_supplier'),
    ]

    for label, key in info_fields:
        ws[f'A{row}'] = label
        value = quote_data.get(key, '')
        ws[f'B{row}'] = float(value) if isinstance(value, Decimal) else value
        row += 1

    # ========== PAYMENT TERMS (J5:K9) ==========
    row += 1
    ws[f'A{row}'] = 'Payment Terms'
    ws[f'A{row}'].font = Font(bold=True, size=12)

    row += 1
    ws[f'A{row}'] = 'Advance from Client (%)'
    ws[f'B{row}'] = float(quote_data.get('advance_from_client', 0))

    row += 1
    ws[f'A{row}'] = 'Time to Advance (days)'
    ws[f'B{row}'] = quote_data.get('time_to_advance', 0)

    # ========== LOGISTICS (W2:W10) ==========
    row += 2
    ws[f'A{row}'] = 'Logistics Breakdown'
    ws[f'A{row}'].font = Font(bold=True, size=12)

    row += 1
    logistics_fields = [
        ('Supplier → Hub', 'logistics_supplier_hub'),
        ('Hub → Customs', 'logistics_hub_customs'),
        ('Customs → Client', 'logistics_customs_client'),
        ('Brokerage Hub', 'brokerage_hub'),
        ('Brokerage Customs', 'brokerage_customs'),
        ('Warehousing at Customs', 'warehousing_at_customs'),
        ('Customs Documentation', 'customs_documentation'),
        ('Extra Brokerage', 'brokerage_extra'),
        ('Insurance', 'insurance'),
    ]

    for label, key in logistics_fields:
        ws[f'A{row}'] = label
        value = quote_data.get(key, 0)
        ws[f'B{row}'] = float(value) if value else 0
        ws[f'B{row}'].number_format = '#,##0.00 ₽'
        row += 1

    # ========== QUOTE TOTALS (Row 13 equivalents) ==========
    row += 1
    ws[f'A{row}'] = 'Quote Totals'
    ws[f'A{row}'].font = Font(bold=True, size=12)

    row += 1
    totals_fields = [
        ('Total Logistics (V13)', 'total_logistics'),
        ('Total COGS (AB13)', 'total_cogs'),
        ('Markup % (AC13)', 'markup'),
        ('Price without VAT (AK13)', 'total_revenue_no_vat'),
        ('Price with VAT (AL13)', 'total_revenue_with_vat'),
        ('Margin (AM13)', 'total_margin'),
    ]

    markup_row = None
    for label, key in totals_fields:
        ws[f'A{row}'] = label
        value = quote_data.get(key, 0)
        ws[f'B{row}'] = float(value) if value else 0

        # Format based on field type
        if 'markup' in key.lower() or key == 'markup':
            ws[f'B{row}'].number_format = '0.00"%"'
            markup_row = row  # Save for validation below
        else:
            ws[f'B{row}'].number_format = '#,##0.00 ₽'

        row += 1

    # Validate quote-level markup
    if markup_row:
        advance = Decimal(str(quote_data.get('advance_from_client', 0)))
        delivery = quote_data.get('delivery_time', 0)
        markup = Decimal(str(quote_data.get('markup', 0)))

        is_valid, error_msg = validate_markup(markup, advance, delivery, level='quote')
        apply_validation_to_cell(ws[f'B{markup_row}'], is_valid, error_msg)

    # ========== DM FEE ==========
    row += 1
    ws[f'A{row}'] = 'DM Fee'
    ws[f'A{row}'].font = Font(bold=True, size=12)

    row += 1
    ws[f'A{row}'] = 'DM Fee Type'
    ws[f'B{row}'] = quote_data.get('dm_fee_type', '')

    row += 1
    ws[f'A{row}'] = 'DM Fee Value'
    dm_fee = Decimal(str(quote_data.get('dm_fee_value', 0)))
    margin = Decimal(str(quote_data.get('total_margin', 0)))
    ws[f'B{row}'] = float(dm_fee)
    ws[f'B{row}'].number_format = '#,##0.00 ₽'

    # Validate DM fee vs margin
    is_valid, error_msg = validate_dm_fee(dm_fee, margin)
    apply_validation_to_cell(ws[f'B{row}'], is_valid, error_msg)

    # ========== VAT REMOVAL CHECK ==========
    row += 2
    ws[f'A{row}'] = 'VAT Removal Status'
    ws[f'A{row}'].font = Font(bold=True, size=12)

    row += 1
    ws[f'A{row}'] = 'Was VAT removed from purchase price?'
    vat_removed = quote_data.get('vat_removed', False)
    ws[f'B{row}'] = 'YES' if vat_removed else 'NO'

    # Highlight if VAT not removed
    if not vat_removed:
        ws[f'B{row}'].fill = YELLOW_FILL
        ws[f'B{row}'].comment = Comment(
            "⚠️ VAT was not removed from purchase price. Verify if this is intentional.",
            "System"
        )

    # ========== PRODUCTS TABLE ==========
    row += 2
    ws[f'A{row}'] = 'Products'
    ws[f'A{row}'].font = Font(bold=True, size=12)

    row += 1
    # Headers
    headers = ['#', 'Product Name', 'Qty', 'Markup %', 'COGS', 'Price (no VAT)', 'Price (with VAT)']
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=col_idx)
        cell.value = header
        cell.font = Font(bold=True)

    row += 1
    # Products data
    products = quote_data.get('products', [])
    advance = Decimal(str(quote_data.get('advance_from_client', 0)))
    delivery = quote_data.get('delivery_time', 0)

    for idx, product in enumerate(products, start=1):
        ws.cell(row=row, column=1, value=idx)
        ws.cell(row=row, column=2, value=product.get('name', f'Product {idx}'))
        ws.cell(row=row, column=3, value=product.get('quantity', 0))

        # Markup with validation
        product_markup = Decimal(str(product.get('markup', 0)))
        markup_cell = ws.cell(row=row, column=4, value=float(product_markup))
        markup_cell.number_format = '0.00"%"'

        # Validate product-level markup
        is_valid, error_msg = validate_markup(product_markup, advance, delivery, level='product')
        apply_validation_to_cell(markup_cell, is_valid, error_msg)

        # Other fields
        ws.cell(row=row, column=5, value=float(product.get('cogs', 0)))
        ws.cell(row=row, column=6, value=float(product.get('price_no_vat', 0)))
        ws.cell(row=row, column=7, value=float(product.get('price_with_vat', 0)))

        # Format
        ws.cell(row=row, column=5).number_format = '#,##0.00 ₽'
        ws.cell(row=row, column=6).number_format = '#,##0.00 ₽'
        ws.cell(row=row, column=7).number_format = '#,##0.00 ₽'

        row += 1

    # Auto-size columns (skip merged cells)
    for col_letter in ['A', 'B', 'C', 'D', 'E', 'F', 'G']:
        max_length = 0
        for row in ws.iter_rows(min_col=ws[col_letter + '1'].column, max_col=ws[col_letter + '1'].column):
            for cell in row:
                try:
                    if cell.value and len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[col_letter].width = max(adjusted_width, 15)

    return wb


def validate_vat_removal(product: Dict[str, Any]) -> tuple[bool, str]:
    """
    Check if VAT was properly removed from purchase price

    Args:
        product: Product data with purchase_price_with_vat, purchase_price_no_vat, vat_rate

    Returns:
        (is_valid, error_message)
    """
    price_with_vat = Decimal(str(product.get('purchase_price_with_vat', 0)))
    price_no_vat = Decimal(str(product.get('purchase_price_no_vat', 0)))
    vat_rate = Decimal(str(product.get('vat_seller_country', 0)))

    if vat_rate == 0:
        return (True, '')  # No VAT expected

    # Calculate expected price without VAT
    expected_no_vat = price_with_vat / (Decimal('1') + vat_rate / Decimal('100'))

    # Allow 1% tolerance for rounding
    diff = abs(price_no_vat - expected_no_vat)
    tolerance = expected_no_vat * Decimal('0.01')

    if diff > tolerance:
        return (False, f"⚠️ VAT not removed properly. Expected: {expected_no_vat:.2f}, Got: {price_no_vat:.2f}")

    return (True, '')


def calculate_required_markup(advance_percent: Decimal, delivery_days: int) -> Decimal:
    """
    Calculate required markup based on advance and delivery time

    Rules:
    - If advance > 50%: require 5% minimum
    - If advance ≤ 50%: add 5% penalty per 30 days of delivery

    Examples:
    - advance=50%, delivery=60 days → required=10% (5% base + 10% penalty)
    - advance=30%, delivery=90 days → required=20% (5% base + 15% penalty)
    - advance=70%, delivery=60 days → required=5% (no penalty)

    Args:
        advance_percent: Client advance payment percentage
        delivery_days: Delivery time in days

    Returns:
        Required markup percentage
    """
    base_markup = Decimal('5.0')

    if advance_percent <= 50:
        penalty_periods = Decimal(str(delivery_days)) / Decimal('30')
        penalty = penalty_periods * Decimal('5.0')
        return base_markup + penalty

    return base_markup


def validate_markup(
    markup: Decimal,
    advance_percent: Decimal,
    delivery_days: int,
    level: str = 'quote'
) -> tuple[bool, str]:
    """
    Validate markup meets threshold requirements

    Args:
        markup: Actual markup percentage
        advance_percent: Client advance percentage
        delivery_days: Delivery time in days
        level: 'quote' or 'product' (for error message)

    Returns:
        (is_valid, error_message)
    """
    required_markup = calculate_required_markup(advance_percent, delivery_days)

    if markup < required_markup:
        return (
            False,
            f"⚠️ {level.capitalize()}-level markup {markup:.2f}% below required threshold {required_markup:.2f}%.\n"
            f"Advance: {advance_percent}%, Delivery: {delivery_days} days."
        )

    return (True, '')


def validate_dm_fee(dm_fee_value: Decimal, margin_value: Decimal) -> tuple[bool, str]:
    """
    Check if DM fee exceeds deal margin

    Args:
        dm_fee_value: DM fee amount
        margin_value: Deal margin amount

    Returns:
        (is_valid, error_message)
    """
    if dm_fee_value > margin_value:
        return (
            False,
            f"⚠️ DM fee ({dm_fee_value:,.2f} ₽) exceeds deal margin ({margin_value:,.2f} ₽)"
        )

    return (True, '')


def apply_validation_to_cell(cell, is_valid: bool, error_message: str):
    """
    Apply color and comment to cell based on validation result

    Args:
        cell: openpyxl cell object
        is_valid: True if validation passed
        error_message: Error message to show in comment (if failed)
    """
    if not is_valid:
        cell.fill = RED_FILL
        if error_message:
            cell.comment = Comment(error_message, "System")
    else:
        # Optionally apply green for passed validations
        # cell.fill = GREEN_FILL
        pass
