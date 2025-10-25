# Export System User Guide

## Overview

The B2B quotation platform supports 6 export formats for quotes:
- 4 PDF formats (supply, open book, and formal letter versions)
- 2 Excel formats (validation and professional grid)

## Exporting a Quote

### 1. Navigate to Quote Detail Page

- Go to **Quotes** page
- Click on a quote number to open detail page

### 2. Click Export Button

- Locate the **"Экспорт"** button (near Edit/Delete buttons)
- Click to open export dropdown menu

### 3. Select Export Format

**PDF Formats:**
1. **КП поставка (9 колонок)** - Simple supply quote with 9 columns
   - Best for: Quick quotes, standard customers
   - Columns: Brand, SKU, Name, Quantity, Prices, VAT

2. **КП open book (21 колонка)** - Detailed quote with full cost breakdown
   - Best for: Transparent pricing, complex deals
   - Additional columns: Currency, purchase price, logistics, customs, taxes

3. **КП поставка письмо** - Formal letter with supply quote
   - Best for: Official correspondence
   - Includes: Greeting, introduction, quote table, CEO signature

4. **КП open book письмо** - Formal letter with detailed quote
   - Best for: Official correspondence with full transparency

**Excel Formats:**
1. **Проверка расчетов** - Calculation validation format
   - Best for: Comparing against old Excel file
   - Format: [Cell] | [Name] | [Value]
   - Includes: All 42 input variables + all calculation outputs

2. **Таблицы (2 листа)** - Professional grid export
   - Best for: Data analysis, archiving
   - Sheet 1: 9-column supply quote
   - Sheet 2: 21-column open book

### 4. Download File

- File downloads automatically
- Filename format: `KP_{format}_{quote_number}_{date}_{customer}.{ext}`
- Example: `KP_supply_KP-2025-001_20251024_OOO_TORGOVAYA.pdf`

## Troubleshooting

### Export Button Disabled

**Problem:** Export button is grayed out

**Solutions:**
- Ensure quote has items (not empty)
- Refresh page and try again
- Check if you're logged in

### File Won't Download

**Problem:** Click export but nothing happens

**Solutions:**
- Check browser pop-up blocker settings
- Try different browser (Chrome, Firefox)
- Check internet connection
- Verify backend server is running

### Russian Text Displays Incorrectly

**Problem:** PDF shows squares/question marks instead of Russian text

**Solutions:**
- Re-download file (may have been corrupted)
- Update PDF viewer (Adobe Reader, Browser PDF viewer)
- Contact support if issue persists

### Excel File Won't Open

**Problem:** Excel shows error when opening file

**Solutions:**
- Ensure you have Excel 2007+ or LibreOffice
- Try opening in Google Sheets
- Re-download file
- Check file size (should be >0 KB)

## Contact Management

### Adding Customer Contacts

1. Go to **Customers** page
2. Click on a customer
3. Go to **Contacts** tab
4. Click **"Добавить контакт"** button
5. Fill in contact information:
   - Name (required)
   - Phone, Email, Position (optional)
   - Check "Основной контакт" for primary contact
6. Click **Save**

### Using Contacts in Quotes

When creating a new quote:
1. Select customer
2. Contact dropdown appears automatically
3. Primary contact is pre-selected (if exists)
4. Can change contact if needed
5. Contact info appears in exported PDFs

## Export Format Details

### PDF Supply Quote (9 Columns)

**Includes:**
- Seller information (company, manager, phone, email)
- Client information (company, contact, phone, email)
- Quote information (address, incoterms, payment, date, delivery)
- Product table: Brand, SKU, Name, Qty, Price, Total, VAT, Price with VAT, Total with VAT
- Totals row

**File size:** ~150-200 KB for 50 products

### PDF Open Book (21 Columns)

**Includes:** All from supply quote, plus:
- Currency
- Purchase price without VAT
- Invoice amount (calculated)
- Purchase price in quote currency
- Logistics costs
- Customs code
- Import tariff
- Customs fee
- Excise tax
- Utilization fee
- Transit commission

**File size:** ~180-250 KB for 50 products

### Formal Letters

**Includes:** All from respective quote format, plus:
- Formal greeting
- Introduction paragraph
- Company description
- CEO signature block

**Best for:** Official business correspondence

### Excel Validation Export

**Purpose:** Compare calculations against old Excel file

**Structure:**
- Section A: Input Variables
  - All 42 input variables with Excel cell references
  - Format: K16 | Цена закупки (с НДС) | 1200.00

- Section B: Calculated Outputs
  - All intermediate and final calculations
  - Format: AJ16 | Цена продажи (за ед.) | 120.85

**Use case:** Copy-paste values to compare with old calculation Excel

### Excel Professional Grid

**Sheet 1: "КП поставка"**
- 9-column supply quote format
- Professional styling (blue headers, currency formatting)
- Frozen header row
- Totals row

**Sheet 2: "КП open book"**
- 21-column detailed quote format
- Column 7 has formula (Invoice Amount = Price × Quantity)
- Same professional styling

**Use case:** Data analysis, archiving, importing to other systems

## Best Practices

1. **Calculate before export** - Ensure quote has been calculated before exporting
2. **Check data accuracy** - Review quote details before exporting
3. **Use validation export** - Compare against old Excel to verify calculations
4. **Save exports** - Keep copies of exported files for records
5. **Update contacts** - Keep customer contact information current

## Support

For issues or questions:
- Check this guide first
- Review SESSION_PROGRESS.md for technical details
- Contact development team
