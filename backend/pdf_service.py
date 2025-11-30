"""
PDF Generation Service for Russian B2B Quotation System
Professional Russian business document generation using WeasyPrint
"""
import os
import io
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID

import jinja2
from weasyprint import HTML, CSS

from models import Quote, QuoteItem, Customer, QuoteWithItems


def parse_iso_date(value) -> str:
    """
    Parse ISO date string to DD.MM.YYYY format.
    Handles: ISO strings from Supabase, datetime objects, date objects
    """
    if isinstance(value, str):
        # Try to parse ISO date
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00')).date()
        except:
            return value

    if isinstance(value, datetime):
        value = value.date()

    if isinstance(value, date):
        return value.strftime('%d.%m.%Y')

    return str(value) if value else ''


class QuotePDFService:
    """Service for generating professional Russian business quote PDFs"""

    def __init__(self):
        """Initialize PDF service with templates and styling"""
        self.template_dir = os.path.join(os.path.dirname(__file__), 'templates')

        # Ensure templates directory exists
        os.makedirs(self.template_dir, exist_ok=True)

        # Setup Jinja2 environment
        self.jinja_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(self.template_dir),
            autoescape=True
        )

        # Register custom filters
        self._register_filters()

        # Initialize templates
        self._create_templates()

    def _register_filters(self):
        """Register custom Jinja2 filters for Russian formatting"""

        def ru_currency(value: Decimal, currency: str = 'RUB') -> str:
            """Format currency in Russian style"""
            if value is None:
                return '0,00 ₽'

            # Format number with Russian decimal separator
            formatted = f"{float(value):,.2f}".replace(',', ' ').replace('.', ',')

            # Add currency symbol
            if currency == 'RUB':
                return f"{formatted} ₽"
            elif currency == 'USD':
                return f"${formatted}"
            elif currency == 'EUR':
                return f"{formatted} €"
            elif currency == 'CNY':
                return f"{formatted} ¥"
            else:
                return f"{formatted} {currency}"

        def ru_date(value) -> str:
            """Format date in Russian style (DD.MM.YYYY)"""
            if isinstance(value, str):
                # Try to parse ISO date
                try:
                    value = datetime.fromisoformat(value.replace('Z', '+00:00')).date()
                except:
                    return value

            if isinstance(value, datetime):
                value = value.date()

            if isinstance(value, date):
                return value.strftime('%d.%m.%Y')

            return str(value) if value else ''

        def ru_number(value: Decimal) -> str:
            """Format number with Russian decimal separator"""
            if value is None:
                return '0,00'

            return f"{float(value):,.2f}".replace(',', ' ').replace('.', ',')

        def vat_label(vat_included: bool) -> str:
            """Return VAT label based on inclusion"""
            return "в т.ч. НДС" if vat_included else "НДС"

        # Register filters
        self.jinja_env.filters['ru_currency'] = ru_currency
        self.jinja_env.filters['ru_date'] = ru_date
        self.jinja_env.filters['ru_number'] = ru_number
        self.jinja_env.filters['vat_label'] = vat_label

    def _create_templates(self):
        """Create HTML and CSS templates for Russian business documents"""

        # Main quote template
        quote_template = """<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <title>{{ quote.quote_number }} - {{ quote.customer_name }}</title>
    <style>
        {{ css_content }}
    </style>
</head>
<body>
    <div class="document">
        <!-- Header with company info -->
        <header class="company-header">
            <div class="company-logo">
                <h1>{{ company.name }}</h1>
                <p class="company-slogan">{{ company.slogan or 'Поставщик качественного оборудования' }}</p>
            </div>
            <div class="company-info">
                <div class="company-details">
                    <strong>{{ company.legal_name or company.name }}</strong><br>
                    {% if company.inn %}ИНН: {{ company.inn }}<br>{% endif %}
                    {% if company.kpp %}КПП: {{ company.kpp }}<br>{% endif %}
                    {% if company.ogrn %}ОГРН: {{ company.ogrn }}<br>{% endif %}
                    {% if company.address %}{{ company.address }}<br>{% endif %}
                    {% if company.phone %}Тел: {{ company.phone }}<br>{% endif %}
                    {% if company.email %}Email: {{ company.email }}{% endif %}
                </div>
            </div>
        </header>

        <!-- Quote title and number -->
        <div class="quote-title">
            <h2>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ № {{ quote.quote_number }}</h2>
            <p class="quote-date">от {{ quote.quote_date|ru_date }} г.</p>
        </div>

        <!-- Customer information -->
        <div class="customer-section">
            <h3>Заказчик:</h3>
            <div class="customer-info">
                <strong>{{ quote.customer_name }}</strong><br>
                {% if quote.customer_address %}{{ quote.customer_address }}<br>{% endif %}
                {% if quote.customer_email %}Email: {{ quote.customer_email }}{% endif %}
            </div>
        </div>

        <!-- Quote details -->
        {% if quote.title or quote.description %}
        <div class="quote-details">
            {% if quote.title %}<h3>{{ quote.title }}</h3>{% endif %}
            {% if quote.description %}<p>{{ quote.description }}</p>{% endif %}
        </div>
        {% endif %}

        <!-- Items table -->
        <div class="items-section">
            <table class="items-table">
                <thead>
                    <tr>
                        <th class="col-no">№</th>
                        <th class="col-description">Наименование товара</th>
                        <th class="col-quantity">Кол-во</th>
                        <th class="col-unit">Ед.</th>
                        <th class="col-price">Цена</th>
                        <th class="col-total">Сумма</th>
                    </tr>
                </thead>
                <tbody>
                    {% for item in quote.items %}
                    <tr>
                        <td class="col-no">{{ loop.index }}</td>
                        <td class="col-description">
                            <strong>{{ item.description }}</strong>
                            {% if item.product_code %}<br><small>Артикул: {{ item.product_code }}</small>{% endif %}
                            {% if item.brand %}<br><small>Производитель: {{ item.brand }}</small>{% endif %}
                            {% if item.model %}<br><small>Модель: {{ item.model }}</small>{% endif %}
                            {% if item.country_of_origin %}<br><small>Страна: {{ item.country_of_origin }}</small>{% endif %}
                            {% if item.lead_time_days %}<br><small>Срок поставки: {{ item.lead_time_days }} дн.</small>{% endif %}
                        </td>
                        <td class="col-quantity">{{ item.quantity|ru_number }}</td>
                        <td class="col-unit">{{ item.unit }}</td>
                        <td class="col-price">{{ item.unit_price|ru_currency(quote.currency) }}</td>
                        <td class="col-total">{{ item.line_total|ru_currency(quote.currency) }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <!-- Totals section -->
        <div class="totals-section">
            <div class="totals-table">
                <table>
                    <tr>
                        <td>Итого без НДС:</td>
                        <td class="amount">{{ quote.subtotal|ru_currency(quote.currency) }}</td>
                    </tr>
                    {% if quote.discount_rate and quote.discount_rate > 0 %}
                    <tr>
                        <td>Скидка ({{ quote.discount_rate|ru_number }}%):</td>
                        <td class="amount discount">-{{ (quote.subtotal * quote.discount_rate / 100)|ru_currency(quote.currency) }}</td>
                    </tr>
                    {% endif %}
                    <tr class="vat-row">
                        <td>{{ quote.vat_included|vat_label }} ({{ quote.vat_rate|ru_number }}%):</td>
                        <td class="amount">{{ quote.vat_amount|ru_currency(quote.currency) }}</td>
                    </tr>
                    {% if quote.import_duty_amount > 0 %}
                    <tr>
                        <td>Таможенная пошлина ({{ quote.import_duty_rate|ru_number }}%):</td>
                        <td class="amount">{{ quote.import_duty_amount|ru_currency(quote.currency) }}</td>
                    </tr>
                    {% endif %}
                    <tr class="total-row">
                        <td><strong>ИТОГО к оплате:</strong></td>
                        <td class="amount"><strong>{{ quote.total_amount|ru_currency(quote.currency) }}</strong></td>
                    </tr>
                </table>
            </div>
        </div>

        <!-- Terms and conditions -->
        <div class="terms-section">
            <div class="terms-grid">
                <div class="terms-column">
                    <h4>Условия поставки:</h4>
                    <ul>
                        <li><strong>Срок действия:</strong> до {{ quote.valid_until|ru_date or 'не ограничен' }}</li>
                        <li><strong>Условия оплаты:</strong> {{ quote.payment_terms }} дн. с момента поставки</li>
                        {% if quote.delivery_date %}<li><strong>Срок поставки:</strong> {{ quote.delivery_date|ru_date }}</li>{% endif %}
                        {% if quote.delivery_terms %}<li><strong>Условия поставки:</strong> {{ quote.delivery_terms }}</li>{% endif %}
                        {% if quote.warranty_terms %}<li><strong>Гарантия:</strong> {{ quote.warranty_terms }}</li>{% endif %}
                    </ul>
                </div>
                <div class="terms-column">
                    <h4>Дополнительная информация:</h4>
                    <ul>
                        <li>Цены указаны в {{ currency_names[quote.currency] or quote.currency }}</li>
                        <li>НДС {% if quote.vat_included %}включен в стоимость{% else %}не включен в стоимость{% endif %}</li>
                        {% if quote.currency != 'RUB' %}
                        <li>Курс валют: 1 {{ quote.currency }} = {{ quote.exchange_rate|ru_number }} ₽</li>
                        {% endif %}
                        <li>Оплата по безналичному расчету</li>
                    </ul>
                </div>
            </div>

            {% if quote.notes %}
            <div class="notes-section">
                <h4>Примечания:</h4>
                <p>{{ quote.notes }}</p>
            </div>
            {% endif %}
        </div>

        <!-- Footer -->
        <footer class="document-footer">
            <div class="signature-section">
                <div class="signature-left">
                    <p>С уважением,<br>
                    <strong>{{ company.name }}</strong></p>

                    {% if manager_info %}
                    <div class="manager-info">
                        <p>{{ manager_info.title or 'Менеджер по продажам' }}: {{ manager_info.name }}<br>
                        {% if manager_info.phone %}Тел: {{ manager_info.phone }}<br>{% endif %}
                        {% if manager_info.email %}Email: {{ manager_info.email }}{% endif %}</p>
                    </div>
                    {% endif %}
                </div>

                <div class="signature-right">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <p class="signature-label">Подпись</p>
                    </div>
                    <div class="date-box">
                        <div class="date-line">{{ today|ru_date }}</div>
                        <p class="date-label">Дата</p>
                    </div>
                </div>
            </div>
        </footer>
    </div>
</body>
</html>"""

        # CSS styles for professional Russian business documents
        css_content = """
@page {
    size: A4;
    margin: 2cm 1.5cm;

    @top-center {
        content: "КП" counter(page) " / " counter(pages);
        font-size: 10pt;
        color: #666;
    }
}

* {
    box-sizing: border-box;
}

body {
    font-family: 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.3;
    color: #333;
    margin: 0;
    padding: 0;
}

.document {
    max-width: 100%;
}

/* Header styles */
.company-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #2c5aa0;
    padding-bottom: 15px;
    margin-bottom: 20px;
}

.company-logo h1 {
    color: #2c5aa0;
    font-size: 18pt;
    margin: 0 0 5px 0;
    font-weight: bold;
}

.company-slogan {
    color: #666;
    font-size: 9pt;
    margin: 0;
    font-style: italic;
}

.company-info {
    text-align: right;
    font-size: 9pt;
    line-height: 1.4;
}

.company-details {
    max-width: 250px;
}

/* Quote title */
.quote-title {
    text-align: center;
    margin-bottom: 25px;
}

.quote-title h2 {
    color: #2c5aa0;
    font-size: 16pt;
    font-weight: bold;
    margin: 0 0 8px 0;
    letter-spacing: 0.5px;
}

.quote-date {
    font-size: 11pt;
    color: #666;
    margin: 0;
}

/* Customer section */
.customer-section {
    margin-bottom: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-left: 4px solid #2c5aa0;
}

.customer-section h3 {
    margin: 0 0 10px 0;
    color: #2c5aa0;
    font-size: 12pt;
}

.customer-info {
    font-size: 10pt;
    line-height: 1.4;
}

/* Quote details */
.quote-details {
    margin-bottom: 20px;
}

.quote-details h3 {
    color: #2c5aa0;
    font-size: 13pt;
    margin: 0 0 10px 0;
}

/* Items table */
.items-section {
    margin-bottom: 20px;
}

.items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
}

.items-table th {
    background-color: #2c5aa0;
    color: white;
    padding: 8px 6px;
    text-align: center;
    font-weight: bold;
    font-size: 9pt;
}

.items-table td {
    padding: 8px 6px;
    border: 1px solid #ddd;
    vertical-align: top;
}

.col-no { width: 5%; text-align: center; }
.col-description { width: 45%; }
.col-quantity { width: 8%; text-align: right; }
.col-unit { width: 7%; text-align: center; }
.col-price { width: 15%; text-align: right; }
.col-total { width: 15%; text-align: right; }

.items-table tbody tr:nth-child(even) {
    background-color: #f8f9fa;
}

.items-table tbody tr:hover {
    background-color: #e8f4fd;
}

/* Totals section */
.totals-section {
    margin-bottom: 25px;
    display: flex;
    justify-content: flex-end;
}

.totals-table {
    min-width: 300px;
}

.totals-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11pt;
}

.totals-table td {
    padding: 6px 12px;
    border-bottom: 1px solid #eee;
}

.totals-table .amount {
    text-align: right;
    font-weight: 500;
}

.totals-table .discount {
    color: #d63384;
}

.vat-row td {
    border-bottom: 2px solid #2c5aa0;
}

.total-row td {
    border-top: 2px solid #2c5aa0;
    border-bottom: 3px double #2c5aa0;
    font-size: 12pt;
    padding: 10px 12px;
}

/* Terms section */
.terms-section {
    margin-bottom: 30px;
}

.terms-grid {
    display: flex;
    gap: 20px;
    margin-bottom: 15px;
}

.terms-column {
    flex: 1;
}

.terms-section h4 {
    color: #2c5aa0;
    font-size: 11pt;
    margin: 0 0 8px 0;
    border-bottom: 1px solid #ddd;
    padding-bottom: 4px;
}

.terms-section ul {
    margin: 0;
    padding-left: 20px;
    font-size: 10pt;
}

.terms-section li {
    margin-bottom: 4px;
    line-height: 1.3;
}

.notes-section {
    margin-top: 15px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 4px;
}

.notes-section h4 {
    border-bottom: none;
    margin-bottom: 8px;
}

.notes-section p {
    margin: 0;
    font-size: 10pt;
    line-height: 1.4;
}

/* Footer */
.document-footer {
    border-top: 1px solid #ddd;
    padding-top: 20px;
    page-break-inside: avoid;
}

.signature-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}

.signature-left {
    flex: 1;
}

.manager-info {
    margin-top: 15px;
    font-size: 10pt;
    color: #666;
}

.signature-right {
    display: flex;
    gap: 30px;
}

.signature-box, .date-box {
    text-align: center;
}

.signature-line {
    width: 120px;
    border-bottom: 1px solid #333;
    height: 20px;
}

.date-line {
    width: 80px;
    border-bottom: 1px solid #333;
    padding-bottom: 2px;
    font-size: 10pt;
}

.signature-label, .date-label {
    font-size: 9pt;
    color: #666;
    margin: 4px 0 0 0;
}

/* Print optimizations */
@media print {
    .document {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
    }
}
"""

        # Write templates to files
        template_path = os.path.join(self.template_dir, 'quote_template.html')
        with open(template_path, 'w', encoding='utf-8') as f:
            f.write(quote_template)

        css_path = os.path.join(self.template_dir, 'quote_styles.css')
        with open(css_path, 'w', encoding='utf-8') as f:
            f.write(css_content)

    def generate_quote_pdf(self, quote_with_items: QuoteWithItems,
                          company_info: Optional[dict] = None,
                          manager_info: Optional[dict] = None) -> bytes:
        """
        Generate PDF for a quote with proper Russian formatting

        Args:
            quote_with_items: Quote with items and approval data
            company_info: Company information dictionary
            manager_info: Sales manager information dictionary

        Returns:
            PDF content as bytes
        """
        try:
            # Default company information
            default_company = {
                'name': 'ООО "ТОРГОВАЯ КОМПАНИЯ"',
                'legal_name': 'Общество с ограниченной ответственностью "ТОРГОВАЯ КОМПАНИЯ"',
                'slogan': 'Надежный поставщик промышленного оборудования',
                'inn': '7707083893',
                'kpp': '772501001',
                'ogrn': '1027700132195',
                'address': '125009, г. Москва, Тверская ул., д. 12, стр. 1',
                'phone': '+7 (495) 123-45-67',
                'email': 'info@company.ru'
            }

            # Merge with provided company info
            company = {**default_company, **(company_info or {})}

            # Currency display names
            currency_names = {
                'RUB': 'российских рублях',
                'USD': 'долларах США',
                'EUR': 'евро',
                'CNY': 'китайских юанях'
            }

            # Load and render template
            template = self.jinja_env.get_template('quote_template.html')

            # Read CSS content
            css_path = os.path.join(self.template_dir, 'quote_styles.css')
            with open(css_path, 'r', encoding='utf-8') as f:
                css_content = f.read()

            # Render HTML with context
            html_content = template.render(
                quote=quote_with_items,
                company=company,
                manager_info=manager_info,
                currency_names=currency_names,
                today=date.today(),
                css_content=css_content
            )

            # Generate PDF
            html_doc = HTML(string=html_content, encoding='utf-8')
            pdf_bytes = html_doc.write_pdf()

            return pdf_bytes

        except Exception as e:
            raise Exception(f"Failed to generate PDF: {str(e)}")

    def get_quote_filename(self, quote: Quote) -> str:
        """Generate standardized filename for quote PDF"""
        # Clean quote number for filename
        clean_number = quote.quote_number.replace('/', '-').replace('\\', '-')
        # Clean customer name for filename
        clean_customer = ''.join(c for c in quote.customer_name if c.isalnum() or c in '-_. ')[:30]

        return f"KP_{clean_number}_{clean_customer}.pdf"

    # ========================================================================
    # NEW EXPORT FORMATS (Session 23)
    # ========================================================================

    @staticmethod
    def format_russian_currency(value) -> str:
        """Format Decimal/float as Russian currency: 1 234,56 ₽"""
        if value is None:
            return "0,00 ₽"

        # Convert to float if Decimal
        if isinstance(value, Decimal):
            value = float(value)

        # Format with thousand separator and 2 decimals
        str_val = f"{value:,.2f}"
        # Replace comma with space (thousands) and period with comma (decimals)
        str_val = str_val.replace(',', ' ').replace('.', ',')
        return f"{str_val} ₽"

    @staticmethod
    def format_russian_number(value) -> str:
        """Format Decimal/float as Russian number without currency: 1 234,56"""
        if value is None:
            return "0,00"

        # Convert to float if Decimal
        if isinstance(value, Decimal):
            value = float(value)

        # Format with thousand separator and 2 decimals
        str_val = f"{value:,.2f}"
        # Replace comma with space (thousands) and period with comma (decimals)
        str_val = str_val.replace(',', ' ').replace('.', ',')
        return str_val

    def render_template(self, template_name: str, context: dict) -> str:
        """Render Jinja2 template with context"""
        template = self.jinja_env.get_template(template_name)
        return template.render(**context)

    def html_to_pdf(self, html: str) -> bytes:
        """Convert HTML string to PDF bytes using WeasyPrint"""
        html_doc = HTML(string=html, encoding='utf-8')
        return html_doc.write_pdf()

    def generate_supply_pdf(self, export_data) -> bytes:
        """
        Generate КП поставка (9-column supply quote)

        Args:
            export_data: ExportData object from export_data_mapper

        Returns:
            PDF bytes
        """
        from services.export_data_mapper import get_manager_info, get_contact_info, format_payment_terms, format_delivery_description

        # Get helper info
        manager = get_manager_info(export_data)
        contact = get_contact_info(export_data)

        # Build context for template
        context = {
            # Seller block
            'seller_company': export_data.variables.get('seller_company', ''),
            'manager_name': manager.get('name', ''),
            'manager_phone': manager.get('phone', ''),
            'manager_email': manager.get('email', ''),

            # Client block
            'customer_company_name': export_data.customer.get('name', '') if export_data.customer else '',
            'contact_person_name': contact.get('name', ''),
            'contact_phone': contact.get('phone', ''),
            'contact_email': contact.get('email', ''),

            # Quote info
            'delivery_address': export_data.quote.get('delivery_address', ''),
            'offer_incoterms': export_data.variables.get('offer_incoterms', ''),
            'payment_terms': format_payment_terms(export_data.variables),
            'quote_date': parse_iso_date(export_data.quote.get('created_at', '')),
            'delivery_time': export_data.variables.get('delivery_time', 60),
            'delivery_description': format_delivery_description(export_data.variables),

            # Items and totals
            'items': [],
            'totals': {}
        }

        # Build items list with 9 columns
        totals = {'quantity': 0, 'total_vat': Decimal('0')}

        for item in export_data.items:
            calc = item.get('calculation_results', {})

            item_data = {
                'brand': item.get('brand', ''),
                'sku': item.get('sku', ''),
                'product_name': item.get('product_name', ''),
                'quantity': item.get('quantity', 0),
                'selling_price_per_unit': self.format_russian_currency(calc.get('sales_price_per_unit_no_vat', 0)),
                'selling_price_total': self.format_russian_currency(calc.get('sales_price_total_no_vat', 0)),
                'vat_from_sales': self.format_russian_currency(calc.get('vat_from_sales', 0)),
                'selling_price_with_vat_per_unit': self.format_russian_currency(calc.get('sales_price_per_unit_with_vat', 0)),
                'selling_price_with_vat_total': self.format_russian_currency(calc.get('sales_price_total_with_vat', 0))
            }

            context['items'].append(item_data)

            # Accumulate totals
            totals['quantity'] += item.get('quantity', 0)
            totals['total_vat'] += Decimal(str(calc.get('sales_price_total_with_vat', 0)))

        context['totals'] = {
            'quantity': totals['quantity'],
            'total_with_vat': self.format_russian_currency(totals['total_vat'])
        }

        # Render HTML template
        html = self.render_template('supply_quote.html', context)

        # Convert to PDF
        return self.html_to_pdf(html)

    def generate_openbook_pdf(self, export_data) -> bytes:
        """
        Generate КП open book (21-column detailed quote)

        Args:
            export_data: ExportData object from export_data_mapper

        Returns:
            PDF bytes
        """
        from services.export_data_mapper import get_manager_info, get_contact_info, format_payment_terms, format_delivery_description

        # Get helper info
        manager = get_manager_info(export_data)
        contact = get_contact_info(export_data)

        # Build context for template
        context = {
            # Seller block
            'seller_company': export_data.variables.get('seller_company', ''),
            'manager_name': manager.get('name', ''),
            'manager_phone': manager.get('phone', ''),
            'manager_email': manager.get('email', ''),

            # Client block
            'customer_company_name': export_data.customer.get('name', '') if export_data.customer else '',
            'contact_person_name': contact.get('name', ''),
            'contact_phone': contact.get('phone', ''),
            'contact_email': contact.get('email', ''),

            # Quote info
            'delivery_address': export_data.quote.get('delivery_address', ''),
            'offer_incoterms': export_data.variables.get('offer_incoterms', ''),
            'payment_terms': format_payment_terms(export_data.variables),
            'quote_date': parse_iso_date(export_data.quote.get('created_at', '')),
            'delivery_time': export_data.variables.get('delivery_time', 60),
            'delivery_description': format_delivery_description(export_data.variables),

            # Items and totals
            'items': [],
            'totals': {}
        }

        # Build items list with 21 columns
        totals = {'quantity': 0, 'total_vat': Decimal('0')}

        for item in export_data.items:
            calc = item.get('calculation_results', {})

            # Calculate invoice amount (purchase price × quantity)
            purchase_price_no_vat = Decimal(str(calc.get('purchase_price_no_vat', 0)))
            quantity = item.get('quantity', 0)
            invoice_amount = purchase_price_no_vat * Decimal(str(quantity))

            item_data = {
                # Columns 1-4: Basic info
                'brand': item.get('brand', ''),
                'sku': item.get('sku', ''),
                'product_name': item.get('product_name', ''),
                'quantity': quantity,

                # Columns 5-15: Purchase & cost details
                'currency': export_data.variables.get('currency_of_base_price', 'USD'),
                'purchase_price_no_vat': self.format_russian_number(purchase_price_no_vat),
                'invoice_amount': self.format_russian_number(invoice_amount),
                'purchase_price_quote_currency': self.format_russian_number(calc.get('purchase_price_total_quote_currency', 0)),
                'logistics': self.format_russian_number(calc.get('logistics_total', 0)),
                'customs_code': item.get('customs_code', ''),
                'import_tariff': f"{export_data.variables.get('import_tariff', 0)}%",
                'customs_fee': self.format_russian_number(calc.get('customs_fee', 0)),
                'excise_tax': self.format_russian_number(calc.get('excise_tax', 0)),
                'util_fee': self.format_russian_number(calc.get('util_fee', 0)),
                'transit_commission': self.format_russian_number(calc.get('transit_commission', 0)),

                # Columns 16-21: Selling prices
                'selling_price_per_unit': self.format_russian_number(calc.get('sales_price_per_unit_no_vat', 0)),
                'selling_price_total': self.format_russian_number(calc.get('sales_price_total_no_vat', 0)),
                'vat_from_sales': self.format_russian_number(calc.get('vat_from_sales', 0)),
                'selling_price_with_vat_per_unit': self.format_russian_number(calc.get('sales_price_per_unit_with_vat', 0)),
                'selling_price_with_vat_total': self.format_russian_number(calc.get('sales_price_total_with_vat', 0))
            }

            context['items'].append(item_data)

            # Accumulate totals
            totals['quantity'] += quantity
            totals['total_vat'] += Decimal(str(calc.get('sales_price_total_with_vat', 0)))

        context['totals'] = {
            'quantity': totals['quantity'],
            'total_with_vat': self.format_russian_currency(totals['total_vat'])
        }

        # Render HTML template
        html = self.render_template('openbook_quote.html', context)

        # Convert to PDF
        return self.html_to_pdf(html)

    def generate_supply_letter_pdf(self, export_data) -> bytes:
        """
        Generate КП поставка письмо (formal letter + 9-column grid)

        Args:
            export_data: ExportData object from export_data_mapper

        Returns:
            PDF bytes
        """
        from services.export_data_mapper import get_manager_info, get_contact_info, format_payment_terms, format_delivery_description

        # Get helper info
        manager = get_manager_info(export_data)
        contact = get_contact_info(export_data)

        # Build context (same as supply_pdf + letter-specific fields)
        context = {
            # Seller block
            'seller_company': export_data.variables.get('seller_company', ''),
            'manager_name': manager.get('name', ''),
            'manager_phone': manager.get('phone', ''),
            'manager_email': manager.get('email', ''),

            # Client block
            'customer_company_name': export_data.customer.get('name', '') if export_data.customer else '',
            'contact_person_name': contact.get('name', ''),
            'contact_phone': contact.get('phone', ''),
            'contact_email': contact.get('email', ''),

            # Quote info
            'delivery_address': export_data.quote.get('delivery_address', ''),
            'offer_incoterms': export_data.variables.get('offer_incoterms', ''),
            'payment_terms': format_payment_terms(export_data.variables),
            'quote_date': parse_iso_date(export_data.quote.get('created_at', '')),
            'delivery_time': export_data.variables.get('delivery_time', 60),
            'delivery_description': format_delivery_description(export_data.variables),

            # Letter-specific fields
            'letter_greeting': f"Уважаемый {contact.get('name', '')}!" if contact.get('name') else "Уважаемые партнеры!",
            'ceo_title': export_data.organization.get('ceo_title', 'Генеральный директор'),
            'ceo_name': export_data.organization.get('ceo_name', 'Не указано'),

            # Items and totals
            'items': [],
            'totals': {}
        }

        # Build items list (same as supply_pdf)
        totals = {'quantity': 0, 'total_vat': Decimal('0')}

        for item in export_data.items:
            calc = item.get('calculation_results', {})

            item_data = {
                'brand': item.get('brand', ''),
                'sku': item.get('sku', ''),
                'product_name': item.get('product_name', ''),
                'quantity': item.get('quantity', 0),
                'selling_price_per_unit': self.format_russian_currency(calc.get('sales_price_per_unit_no_vat', 0)),
                'selling_price_total': self.format_russian_currency(calc.get('sales_price_total_no_vat', 0)),
                'vat_from_sales': self.format_russian_currency(calc.get('vat_from_sales', 0)),
                'selling_price_with_vat_per_unit': self.format_russian_currency(calc.get('sales_price_per_unit_with_vat', 0)),
                'selling_price_with_vat_total': self.format_russian_currency(calc.get('sales_price_total_with_vat', 0))
            }

            context['items'].append(item_data)

            totals['quantity'] += item.get('quantity', 0)
            totals['total_vat'] += Decimal(str(calc.get('sales_price_total_with_vat', 0)))

        context['totals'] = {
            'quantity': totals['quantity'],
            'total_with_vat': self.format_russian_currency(totals['total_vat'])
        }

        # Render HTML template
        html = self.render_template('supply_letter.html', context)

        # Convert to PDF
        return self.html_to_pdf(html)

    def generate_openbook_letter_pdf(self, export_data) -> bytes:
        """
        Generate КП open book письмо (formal letter + 21-column grid)

        Args:
            export_data: ExportData object from export_data_mapper

        Returns:
            PDF bytes
        """
        from services.export_data_mapper import get_manager_info, get_contact_info, format_payment_terms, format_delivery_description

        # Get helper info
        manager = get_manager_info(export_data)
        contact = get_contact_info(export_data)

        # Build context (same as openbook_pdf + letter-specific fields)
        context = {
            # Seller block
            'seller_company': export_data.variables.get('seller_company', ''),
            'manager_name': manager.get('name', ''),
            'manager_phone': manager.get('phone', ''),
            'manager_email': manager.get('email', ''),

            # Client block
            'customer_company_name': export_data.customer.get('name', '') if export_data.customer else '',
            'contact_person_name': contact.get('name', ''),
            'contact_phone': contact.get('phone', ''),
            'contact_email': contact.get('email', ''),

            # Quote info
            'delivery_address': export_data.quote.get('delivery_address', ''),
            'offer_incoterms': export_data.variables.get('offer_incoterms', ''),
            'payment_terms': format_payment_terms(export_data.variables),
            'quote_date': parse_iso_date(export_data.quote.get('created_at', '')),
            'delivery_time': export_data.variables.get('delivery_time', 60),
            'delivery_description': format_delivery_description(export_data.variables),

            # Letter-specific fields
            'letter_greeting': f"Уважаемый {contact.get('name', '')}!" if contact.get('name') else "Уважаемые партнеры!",
            'ceo_title': export_data.organization.get('ceo_title', 'Генеральный директор'),
            'ceo_name': export_data.organization.get('ceo_name', 'Не указано'),

            # Items and totals
            'items': [],
            'totals': {}
        }

        # Build items list (same as openbook_pdf)
        totals = {'quantity': 0, 'total_vat': Decimal('0')}

        for item in export_data.items:
            calc = item.get('calculation_results', {})

            # Calculate invoice amount
            purchase_price_no_vat = Decimal(str(calc.get('purchase_price_no_vat', 0)))
            quantity = item.get('quantity', 0)
            invoice_amount = purchase_price_no_vat * Decimal(str(quantity))

            item_data = {
                # Columns 1-4: Basic info
                'brand': item.get('brand', ''),
                'sku': item.get('sku', ''),
                'product_name': item.get('product_name', ''),
                'quantity': quantity,

                # Columns 5-15: Purchase & cost details
                'currency': export_data.variables.get('currency_of_base_price', 'USD'),
                'purchase_price_no_vat': self.format_russian_currency(purchase_price_no_vat),
                'invoice_amount': self.format_russian_currency(invoice_amount),
                'purchase_price_quote_currency': self.format_russian_currency(calc.get('purchase_price_total_quote_currency', 0)),
                'logistics': self.format_russian_currency(calc.get('logistics_total', 0)),
                'customs_code': item.get('customs_code', ''),
                'import_tariff': f"{export_data.variables.get('import_tariff', 0)}%",
                'customs_fee': self.format_russian_currency(calc.get('customs_fee', 0)),
                'excise_tax': self.format_russian_currency(calc.get('excise_tax', 0)),
                'util_fee': self.format_russian_currency(calc.get('util_fee', 0)),
                'transit_commission': self.format_russian_currency(calc.get('transit_commission', 0)),

                # Columns 16-21: Selling prices
                'selling_price_per_unit': self.format_russian_currency(calc.get('sales_price_per_unit_no_vat', 0)),
                'selling_price_total': self.format_russian_currency(calc.get('sales_price_total_no_vat', 0)),
                'vat_from_sales': self.format_russian_currency(calc.get('vat_from_sales', 0)),
                'selling_price_with_vat_per_unit': self.format_russian_currency(calc.get('sales_price_per_unit_with_vat', 0)),
                'selling_price_with_vat_total': self.format_russian_currency(calc.get('sales_price_total_with_vat', 0))
            }

            context['items'].append(item_data)

            totals['quantity'] += quantity
            totals['total_vat'] += Decimal(str(calc.get('sales_price_total_with_vat', 0)))

        context['totals'] = {
            'quantity': totals['quantity'],
            'total_with_vat': self.format_russian_currency(totals['total_vat'])
        }

        # Render HTML template
        html = self.render_template('openbook_letter.html', context)

        # Convert to PDF
        return self.html_to_pdf(html)