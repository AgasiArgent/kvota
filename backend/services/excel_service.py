"""
Excel Export Service

Generates Excel exports in 2 formats:
1. Validation Export - Input/Output comparison for checking against old Excel
2. Grid Export - Professional 2-sheet export (КП поставка + КП open book)
"""
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter
from io import BytesIO
from decimal import Decimal
from typing import Dict, Any, List
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.export_data_mapper import ExportData


class QuoteExcelService:
    """Excel export service for quotes"""

    @staticmethod
    def format_russian_number(value: Any) -> str:
        """
        Format number with Russian style: 1 234,56

        Args:
            value: Number to format (Decimal, float, int, or None)

        Returns:
            Formatted string with space as thousand separator and comma as decimal
        """
        if value is None:
            return "0,00"

        # Convert to float
        try:
            num_value = float(value)
        except (ValueError, TypeError):
            return "0,00"

        # Format with 2 decimals
        str_val = f"{num_value:,.2f}"

        # Replace comma (thousand separator) with space, dot (decimal) with comma
        # Python's format uses comma for thousands and dot for decimal
        return str_val.replace(',', ' ').replace('.', ',')

    @staticmethod
    def generate_validation_export(export_data: ExportData) -> bytes:
        """
        Generate Input/Output validation Excel.
        Single sheet with:
        - Section A: Input Variables (all 42 per product)
        - Section B: Calculated Outputs (all intermediate + final)

        Format: [Excel Cell] | [Russian Name] | [Value]

        Args:
            export_data: Export data with quote, items, calculations

        Returns:
            Excel file as bytes
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "Проверка расчетов"

        # Headers
        ws['A1'] = 'Excel Cell'
        ws['B1'] = 'Название'
        ws['C1'] = 'Значение'

        # Style headers
        header_fill = PatternFill(start_color="2C5AA0", end_color="2C5AA0", fill_type="solid")
        header_font = Font(bold=True, size=12, color="FFFFFF")

        for cell in ['A1', 'B1', 'C1']:
            ws[cell].fill = header_fill
            ws[cell].font = header_font
            ws[cell].alignment = Alignment(horizontal='center', vertical='center')

        row = 3

        # Section A: Input Variables
        ws[f'A{row}'] = 'ВХОДНЫЕ ДАННЫЕ'
        ws[f'A{row}'].font = Font(bold=True, size=14)
        row += 2

        # Map variables to Excel cells (from VARIABLES.md)
        # Quote-level variables
        quote_vars = [
            ('D5', 'Компания-продавец', 'seller_company'),
            ('D6', 'Вид КП', 'offer_sale_type'),
            ('D7', 'Базис поставки Incoterms', 'offer_incoterms'),
            ('D8', 'Валюта КП', 'currency_of_quote'),
            ('D9', 'Срок поставки (дней)', 'delivery_time'),
            ('J5', 'Аванс (%)', 'advance_from_client'),
            ('K5', 'Дней от подписания до аванса', 'time_to_advance'),
            ('AC16', 'Наценка (%)', 'markup'),
        ]

        for cell_ref, name, var_key in quote_vars:
            value = export_data.variables.get(var_key, '')
            ws[f'A{row}'] = cell_ref
            ws[f'B{row}'] = name
            ws[f'C{row}'] = str(value)
            row += 1

        row += 2

        # Section B: Calculated Outputs (per product)
        ws[f'A{row}'] = 'РАССЧИТАННЫЕ ЗНАЧЕНИЯ'
        ws[f'A{row}'].font = Font(bold=True, size=14)
        row += 2

        # For each item, show calculations
        for idx, item in enumerate(export_data.items, 1):
            # Get calculation results
            calc_results = item.get('calculation_results', {})

            # Item header
            product_name = item.get('product_name', '')
            brand = item.get('brand', '')
            sku = item.get('sku', '')
            item_title = f'Товар {idx}: {brand} {sku} - {product_name}'

            ws[f'A{row}'] = item_title
            ws[f'A{row}'].font = Font(bold=True, size=11)
            ws.merge_cells(f'A{row}:C{row}')
            row += 1

            # Input data for this item
            input_mappings = [
                ('B16', 'Бренд', brand),
                ('C16', 'Артикул', sku),
                ('E16', 'Количество', item.get('quantity', 0)),
                ('K16', 'Цена закупки (с НДС)', QuoteExcelService.format_russian_number(item.get('base_price_vat', 0))),
                ('G16', 'Вес (кг)', QuoteExcelService.format_russian_number(item.get('weight_in_kg', 0))),
                ('W16', 'Код ТН ВЭД', item.get('customs_code', '')),
            ]

            for cell_ref, name, value in input_mappings:
                ws[f'A{row}'] = cell_ref
                ws[f'B{row}'] = name
                ws[f'C{row}'] = str(value)
                row += 1

            # Calculation outputs
            if calc_results:
                output_mappings = [
                    ('N16', 'Цена без НДС', calc_results.get('purchase_price_no_vat', 0)),
                    ('S16', 'Цена в валюте КП', calc_results.get('purchase_price_total_quote_currency', 0)),
                    ('V16', 'Логистика на товар', calc_results.get('logistics_total', 0)),
                    ('Y16', 'Таможенный сбор', calc_results.get('customs_fee', 0)),
                    ('AJ16', 'Цена продажи (за ед.)', calc_results.get('sales_price_per_unit', 0)),
                    ('AK16', 'Сумма продажи', calc_results.get('sales_price_total_no_vat', 0)),
                    ('AN16', 'НДС от продаж', calc_results.get('vat_amount', 0)),
                    ('AM16', 'Цена с НДС (за ед.)', calc_results.get('sales_price_per_unit_with_vat', 0)),
                    ('AL16', 'Сумма с НДС', calc_results.get('sales_price_total_with_vat', 0)),
                ]

                for cell_ref, name, calc_value in output_mappings:
                    ws[f'A{row}'] = cell_ref
                    ws[f'B{row}'] = name
                    ws[f'C{row}'] = QuoteExcelService.format_russian_number(calc_value)
                    row += 1

            row += 1  # Space between items

        # Adjust column widths
        ws.column_dimensions['A'].width = 15
        ws.column_dimensions['B'].width = 40
        ws.column_dimensions['C'].width = 20

        # Save to bytes
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output.read()

    @staticmethod
    def generate_grid_export(export_data: ExportData) -> bytes:
        """
        Generate professional 2-sheet Excel.
        Sheet 1: "КП поставка" (9 columns)
        Sheet 2: "КП open book" (21 columns)

        Args:
            export_data: Export data with quote, items, calculations

        Returns:
            Excel file as bytes
        """
        wb = Workbook()

        # ========== Sheet 1: КП поставка (9 columns) ==========
        ws1 = wb.active
        ws1.title = "КП поставка"

        # Headers (9 columns)
        headers_supply = [
            'Бренд', 'Артикул', 'Наименование', 'Кол-во',
            'Цена за ед. (₽)', 'Сумма (₽)', 'НДС (₽)',
            'Цена с НДС за ед. (₽)', 'Сумма с НДС (₽)'
        ]

        # Style headers
        header_fill = PatternFill(start_color="2C5AA0", end_color="2C5AA0", fill_type="solid")
        header_font = Font(bold=True, size=11, color="FFFFFF")
        header_alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

        for col_idx, header in enumerate(headers_supply, 1):
            cell = ws1.cell(row=1, column=col_idx)
            cell.value = header
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment

        # Data rows
        row_idx = 2
        totals = {'quantity': 0, 'col5': Decimal('0'), 'col6': Decimal('0'), 'col7': Decimal('0'), 'col8': Decimal('0'), 'col9': Decimal('0')}

        for item in export_data.items:
            calc_results = item.get('calculation_results', {})

            # Basic info
            ws1.cell(row=row_idx, column=1).value = item.get('brand', '')
            ws1.cell(row=row_idx, column=2).value = item.get('sku', '')
            ws1.cell(row=row_idx, column=3).value = item.get('product_name', '')
            ws1.cell(row=row_idx, column=4).value = item.get('quantity', 0)

            # Selling prices from calculations
            selling_price_per_unit = Decimal(str(calc_results.get('sales_price_per_unit', 0)))
            selling_price_total = Decimal(str(calc_results.get('sales_price_total_no_vat', 0)))
            vat_from_sales = Decimal(str(calc_results.get('vat_amount', 0)))
            selling_price_with_vat_per_unit = Decimal(str(calc_results.get('sales_price_per_unit_with_vat', 0)))
            selling_price_with_vat_total = Decimal(str(calc_results.get('sales_price_total_with_vat', 0)))

            ws1.cell(row=row_idx, column=5).value = float(selling_price_per_unit)
            ws1.cell(row=row_idx, column=6).value = float(selling_price_total)
            ws1.cell(row=row_idx, column=7).value = float(vat_from_sales)
            ws1.cell(row=row_idx, column=8).value = float(selling_price_with_vat_per_unit)
            ws1.cell(row=row_idx, column=9).value = float(selling_price_with_vat_total)

            # Accumulate totals
            totals['quantity'] += item.get('quantity', 0)
            totals['col5'] += selling_price_per_unit
            totals['col6'] += selling_price_total
            totals['col7'] += vat_from_sales
            totals['col8'] += selling_price_with_vat_per_unit
            totals['col9'] += selling_price_with_vat_total

            # Apply currency format to monetary columns (5-9)
            for col in range(5, 10):
                ws1.cell(row=row_idx, column=col).number_format = '#,##0.00 ₽'

            row_idx += 1

        # Totals row
        ws1.cell(row=row_idx, column=1).value = 'ИТОГО'
        ws1.cell(row=row_idx, column=1).font = Font(bold=True, size=12)
        ws1.cell(row=row_idx, column=4).value = totals['quantity']
        ws1.cell(row=row_idx, column=4).font = Font(bold=True)

        for col_idx, col_key in enumerate(['col5', 'col6', 'col7', 'col8', 'col9'], 5):
            cell = ws1.cell(row=row_idx, column=col_idx)
            cell.value = float(totals[col_key])
            cell.number_format = '#,##0.00 ₽'
            cell.font = Font(bold=True)

        # Set column widths
        ws1.column_dimensions['A'].width = 12  # Бренд
        ws1.column_dimensions['B'].width = 15  # Артикул
        ws1.column_dimensions['C'].width = 35  # Наименование
        ws1.column_dimensions['D'].width = 10  # Кол-во
        for col_letter in ['E', 'F', 'G', 'H', 'I']:
            ws1.column_dimensions[col_letter].width = 15

        # Freeze header row
        ws1.freeze_panes = 'A2'

        # ========== Sheet 2: КП open book (20 columns) ==========
        ws2 = wb.create_sheet("КП open book")

        headers_openbook = [
            'Бренд', 'Артикул', 'Наименование', 'Кол-во', 'Валюта',
            'Цена без НДС', 'Сумма инвойса', 'Цена в валюте КП (₽)',
            'Логистика (₽)', 'Код ТН ВЭД', 'Пошлина (%)', 'Таможенный сбор (₽)',
            'Акциз (₽)', 'Утиль. сбор (₽)', 'Комиссия транзит (₽)',
            'Цена за ед. (₽)', 'Сумма (₽)', 'НДС (₽)',
            'Цена с НДС за ед. (₽)', 'Сумма с НДС (₽)'
        ]

        for col_idx, header in enumerate(headers_openbook, 1):
            cell = ws2.cell(row=1, column=col_idx)
            cell.value = header
            cell.font = Font(bold=True, size=10, color="FFFFFF")
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

        # Data rows for Sheet 2
        row_idx = 2
        for item in export_data.items:
            calc_results = item.get('calculation_results', {})

            # Columns 1-4: Same as Sheet 1
            ws2.cell(row=row_idx, column=1).value = item.get('brand', '')
            ws2.cell(row=row_idx, column=2).value = item.get('sku', '')
            ws2.cell(row=row_idx, column=3).value = item.get('product_name', '')
            ws2.cell(row=row_idx, column=4).value = item.get('quantity', 0)

            # Column 5: Currency
            ws2.cell(row=row_idx, column=5).value = export_data.variables.get('currency_of_base_price', 'USD')

            # Column 6: Price without VAT
            purchase_price_no_vat = Decimal(str(calc_results.get('purchase_price_no_vat', 0)))
            ws2.cell(row=row_idx, column=6).value = float(purchase_price_no_vat)

            # Column 7: Invoice amount (FORMULA: Price × Quantity)
            quantity = item.get('quantity', 0)
            invoice_amount = purchase_price_no_vat * Decimal(str(quantity))
            ws2.cell(row=row_idx, column=7).value = float(invoice_amount)

            # Column 8: Price in quote currency
            ws2.cell(row=row_idx, column=8).value = float(Decimal(str(calc_results.get('purchase_price_total_quote_currency', 0))))

            # Column 9: Logistics
            ws2.cell(row=row_idx, column=9).value = float(Decimal(str(calc_results.get('logistics_total', 0))))

            # Column 10: Customs code
            ws2.cell(row=row_idx, column=10).value = item.get('customs_code', '')

            # Column 11: Import tariff (%)
            ws2.cell(row=row_idx, column=11).value = float(item.get('import_tariff', 0))

            # Column 12: Customs fee
            ws2.cell(row=row_idx, column=12).value = float(Decimal(str(calc_results.get('customs_fee', 0))))

            # Column 13: Excise tax
            ws2.cell(row=row_idx, column=13).value = float(item.get('excise_tax', 0))

            # Column 14: Util fee
            ws2.cell(row=row_idx, column=14).value = float(Decimal(str(calc_results.get('util_fee', 0))))

            # Column 15: Transit commission
            ws2.cell(row=row_idx, column=15).value = float(Decimal(str(calc_results.get('transit_commission', 0))))

            # Columns 16-20: Same selling prices as Sheet 1
            ws2.cell(row=row_idx, column=16).value = float(Decimal(str(calc_results.get('sales_price_per_unit', 0))))
            ws2.cell(row=row_idx, column=17).value = float(Decimal(str(calc_results.get('sales_price_total_no_vat', 0))))
            ws2.cell(row=row_idx, column=18).value = float(Decimal(str(calc_results.get('vat_amount', 0))))
            ws2.cell(row=row_idx, column=19).value = float(Decimal(str(calc_results.get('sales_price_per_unit_with_vat', 0))))
            ws2.cell(row=row_idx, column=20).value = float(Decimal(str(calc_results.get('sales_price_total_with_vat', 0))))

            # Apply number formats
            # Monetary columns: 6, 7, 8, 9, 12, 14, 15, 16, 17, 18, 19, 20
            for col in [6, 7, 8, 9, 12, 14, 15, 16, 17, 18, 19, 20]:
                ws2.cell(row=row_idx, column=col).number_format = '#,##0.00 ₽'

            # Percentage columns: 11
            ws2.cell(row=row_idx, column=11).number_format = '0.00%'

            # Excise tax (column 13) - monetary
            ws2.cell(row=row_idx, column=13).number_format = '#,##0.00 ₽'

            row_idx += 1

        # Set column widths for Sheet 2
        ws2.column_dimensions['A'].width = 10  # Бренд
        ws2.column_dimensions['B'].width = 12  # Артикул
        ws2.column_dimensions['C'].width = 30  # Наименование
        ws2.column_dimensions['D'].width = 8   # Кол-во
        ws2.column_dimensions['E'].width = 8   # Валюта
        ws2.column_dimensions['J'].width = 13  # Код ТН ВЭД

        # Other columns default to 12
        for col_letter in ['F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T']:
            ws2.column_dimensions[col_letter].width = 12

        # Freeze header row
        ws2.freeze_panes = 'A2'

        # Save to bytes
        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output.read()
