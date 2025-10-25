"""
Tests for export_data_mapper service

Tests cover:
- Fetching complete export data
- Handling missing optional fields (contact, manager phone, etc.)
- Excel cell mapping accuracy
- Error handling for non-existent quotes
"""
import pytest
from decimal import Decimal
from unittest.mock import Mock, patch, AsyncMock
from services.export_data_mapper import (
    fetch_export_data,
    map_calculation_to_cells,
    get_manager_info,
    get_contact_info,
    format_payment_terms,
    format_delivery_description,
    ExportData,
    EXCEL_CELL_MAP
)


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture
def mock_quote():
    """Mock quote data"""
    return {
        'id': 'quote-123',
        'organization_id': 'org-456',
        'customer_id': 'customer-789',
        'contact_id': 'contact-001',
        'created_by_user_id': 'user-001',
        'quote_number': 'КП25-0001',
        'title': 'Test Quote',
        'description': 'Test description',
        'status': 'draft',
        'delivery_address': 'Москва, ул. Ленина, д. 1',
        'manager_name': None,  # Will use user profile
        'manager_phone': None,
        'manager_email': None,
        'created_at': '2025-10-24T10:00:00Z'
    }


@pytest.fixture
def mock_items():
    """Mock quote items with calculation results"""
    return [
        {
            'id': 'item-001',
            'quote_id': 'quote-123',
            'position': 0,
            'brand': 'SKF',
            'sku': '6205',
            'product_name': 'Bearing SKF 6205',
            'quantity': 10,
            'base_price_vat': 1200.00,
            'weight_in_kg': 0.5,
            'customs_code': '8482100000',
            'import_tariff': 5.0,
            'excise_tax': 0,
            'calculation_results': {
                'purchase_price_no_vat': 1000.00,  # N16
                'purchase_price_total_quote_currency': 95000.00,  # S16
                'logistics_total': 5000.00,  # V16
                'customs_fee': 4750.00,  # Y16
                'transit_commission': 0,  # AQ16
                'sales_price_per_unit': 120.85,  # AJ16
                'sales_price_total_no_vat': 1208.50,  # AK16
                'vat_amount': 241.70,  # AN16
                'sales_price_per_unit_with_vat': 145.02,  # AM16
                'sales_price_total_with_vat': 1450.20,  # AL16
            },
            'calculated_at': '2025-10-24T10:05:00Z'
        },
        {
            'id': 'item-002',
            'quote_id': 'quote-123',
            'position': 1,
            'brand': 'FAG',
            'sku': '6206',
            'product_name': 'Bearing FAG 6206',
            'quantity': 5,
            'base_price_vat': 1500.00,
            'weight_in_kg': 0.8,
            'customs_code': '8482100000',
            'import_tariff': 5.0,
            'excise_tax': 0,
            'calculation_results': {
                'purchase_price_no_vat': 1250.00,
                'purchase_price_total_quote_currency': 118750.00,
                'logistics_total': 6250.00,
                'customs_fee': 5937.50,
                'transit_commission': 0,
                'sales_price_per_unit': 151.06,
                'sales_price_total_no_vat': 755.30,
                'vat_amount': 151.06,
                'sales_price_per_unit_with_vat': 181.27,
                'sales_price_total_with_vat': 906.36,
            },
            'calculated_at': '2025-10-24T10:05:00Z'
        }
    ]


@pytest.fixture
def mock_customer():
    """Mock customer data"""
    return {
        'id': 'customer-789',
        'name': 'ООО "Тестовая компания"',
        'email': 'test@company.ru',
        'phone': '+7 (495) 123-45-67',
        'address': 'Москва, ул. Пушкина, д. 10',
        'inn': '7701234567',
        'kpp': '770101001',
    }


@pytest.fixture
def mock_contact():
    """Mock customer contact"""
    return {
        'id': 'contact-001',
        'customer_id': 'customer-789',
        'name': 'Иванов Иван Иванович',
        'phone': '+7 (495) 987-65-43',
        'email': 'ivanov@company.ru',
        'position': 'Директор по закупкам',
        'is_primary': True,
    }


@pytest.fixture
def mock_manager():
    """Mock manager (user) data"""
    return {
        'id': 'user-001',
        'email': 'manager@masterbearing.ru',
        'full_name': 'Петров Петр Петрович',
        'phone': '+7 (495) 111-22-33',
    }


@pytest.fixture
def mock_organization():
    """Mock organization data"""
    return {
        'id': 'org-456',
        'name': 'МАСТЕР БЭРИНГ ООО',
        'slug': 'master-bearing',
        'ceo_name': 'Сидоров Сидор Сидорович',
        'ceo_title': 'Генеральный директор',
        'ceo_signature_url': None,
        'letter_template': None,
    }


@pytest.fixture
def mock_variables():
    """Mock calculation variables"""
    return {
        'currency_of_quote': 'RUB',
        'currency_of_base_price': 'USD',
        'exchange_rate_base_price_to_quote': 95.0,
        'seller_company': 'МАСТЕР БЭРИНГ ООО',
        'offer_incoterms': 'DDP',
        'offer_sale_type': 'поставка',
        'delivery_time': 60,
        'advance_from_client': 100,
        'advance_to_supplier': 100,
        'supplier_country': 'Турция',
        'markup': 15.0,
    }


# ============================================================================
# TESTS: fetch_export_data
# ============================================================================

@pytest.mark.asyncio
async def test_fetch_export_data_complete(
    mock_quote, mock_items, mock_customer, mock_contact,
    mock_manager, mock_organization, mock_variables
):
    """Test fetching complete export data with all fields present"""

    with patch('services.export_data_mapper.get_supabase_client') as mock_get_client:
        # Create mock Supabase client
        mock_supabase = Mock()
        mock_get_client.return_value = mock_supabase

        # Mock items with calculation results
        items_with_calc = []
        for item in mock_items:
            item_copy = item.copy()
            item_copy['quote_calculation_results'] = [
                {'phase_results': item['calculation_results'], 'calculated_at': item['calculated_at']}
            ]
            items_with_calc.append(item_copy)

        def mock_table_chain(*args, **kwargs):
            """Mock chained Supabase calls"""
            table_name = args[0] if args else None

            mock_chain = Mock()
            mock_chain.select.return_value = mock_chain
            mock_chain.eq.return_value = mock_chain
            mock_chain.order.return_value = mock_chain

            if table_name == 'quotes':
                mock_chain.execute.return_value.data = [mock_quote]
            elif table_name == 'quote_items':
                mock_chain.execute.return_value.data = items_with_calc
            elif table_name == 'customers':
                mock_chain.execute.return_value.data = [mock_customer]
            elif table_name == 'customer_contacts':
                mock_chain.execute.return_value.data = [mock_contact]
            elif table_name == 'organizations':
                mock_chain.execute.return_value.data = [mock_organization]
            elif table_name == 'quote_calculation_variables':
                mock_chain.execute.return_value.data = [{'quote_id': 'quote-123', 'variables': mock_variables}]

            return mock_chain

        mock_supabase.table.side_effect = mock_table_chain

        # Mock auth.admin.get_user_by_id
        mock_user_response = Mock()
        mock_user_response.user = Mock(
            id=mock_manager['id'],
            email=mock_manager['email'],
            user_metadata={'full_name': mock_manager['full_name'], 'phone': mock_manager['phone']}
        )
        mock_supabase.auth.admin.get_user_by_id.return_value = mock_user_response

        # Execute
        result = await fetch_export_data('quote-123', 'org-456')

        # Assertions
        assert isinstance(result, ExportData)
        assert result.quote['id'] == 'quote-123'
        assert len(result.items) == 2
        assert result.customer['name'] == 'ООО "Тестовая компания"'
        assert result.contact['name'] == 'Иванов Иван Иванович'
        assert result.manager['full_name'] == 'Петров Петр Петрович'
        assert result.organization['name'] == 'МАСТЕР БЭРИНГ ООО'
        assert result.variables['currency_of_quote'] == 'RUB'
        assert 'total_subtotal' in result.calculations
        assert 'total_with_vat' in result.calculations


@pytest.mark.asyncio
async def test_fetch_export_data_missing_optional_fields(
    mock_quote, mock_items, mock_customer, mock_organization, mock_variables
):
    """Test fetching export data with missing optional fields (contact, manager phone)"""

    # Remove optional fields
    mock_quote['contact_id'] = None
    mock_quote['created_by_user_id'] = None

    with patch('services.export_data_mapper.get_supabase_client') as mock_get_client:
        # Create mock Supabase client
        mock_supabase = Mock()
        mock_get_client.return_value = mock_supabase

        items_with_calc = []
        for item in mock_items:
            item_copy = item.copy()
            item_copy['quote_calculation_results'] = [
                {'phase_results': item['calculation_results'], 'calculated_at': item['calculated_at']}
            ]
            items_with_calc.append(item_copy)

        def mock_table_chain(*args, **kwargs):
            table_name = args[0] if args else None
            mock_chain = Mock()
            mock_chain.select.return_value = mock_chain
            mock_chain.eq.return_value = mock_chain
            mock_chain.order.return_value = mock_chain

            if table_name == 'quotes':
                mock_chain.execute.return_value.data = [mock_quote]
            elif table_name == 'quote_items':
                mock_chain.execute.return_value.data = items_with_calc
            elif table_name == 'customers':
                mock_chain.execute.return_value.data = [mock_customer]
            elif table_name == 'organizations':
                mock_chain.execute.return_value.data = [mock_organization]
            elif table_name == 'quote_calculation_variables':
                mock_chain.execute.return_value.data = [{'quote_id': 'quote-123', 'variables': mock_variables}]

            return mock_chain

        mock_supabase.table.side_effect = mock_table_chain

        # Execute
        result = await fetch_export_data('quote-123', 'org-456')

        # Assertions
        assert result.contact is None
        assert result.manager is None
        assert result.customer is not None  # Customer is still present


@pytest.mark.asyncio
async def test_fetch_export_data_quote_not_found():
    """Test error handling when quote doesn't exist"""

    with patch('services.export_data_mapper.get_supabase_client') as mock_get_client:
        # Create mock Supabase client
        mock_supabase = Mock()
        mock_get_client.return_value = mock_supabase

        mock_chain = Mock()
        mock_chain.select.return_value = mock_chain
        mock_chain.eq.return_value = mock_chain
        mock_chain.execute.return_value.data = []

        mock_supabase.table.return_value = mock_chain

        # Execute and expect error
        with pytest.raises(ValueError, match="Quote .* not found"):
            await fetch_export_data('nonexistent-quote', 'org-456')


@pytest.mark.asyncio
async def test_fetch_export_data_wrong_organization():
    """Test error handling when quote belongs to different organization"""

    mock_quote = {
        'id': 'quote-123',
        'organization_id': 'org-999',  # Different org
    }

    with patch('services.export_data_mapper.get_supabase_client') as mock_get_client:
        # Create mock Supabase client
        mock_supabase = Mock()
        mock_get_client.return_value = mock_supabase

        mock_chain = Mock()
        mock_chain.select.return_value = mock_chain
        mock_chain.eq.return_value = mock_chain
        mock_chain.execute.return_value.data = []  # RLS will block

        mock_supabase.table.return_value = mock_chain

        # Execute and expect error
        with pytest.raises(ValueError, match="not found or doesn't belong to organization"):
            await fetch_export_data('quote-123', 'org-456')


# ============================================================================
# TESTS: map_calculation_to_cells
# ============================================================================

def test_map_calculation_to_cells_complete():
    """Test Excel cell mapping with complete calculation results"""

    item = {
        'brand': 'SKF',
        'sku': '6205',
        'product_name': 'Bearing SKF 6205',
        'quantity': 10,
        'base_price_vat': 1200.00,
        'weight_in_kg': 0.5,
        'customs_code': '8482100000',
        'import_tariff': 5.0,
        'excise_tax': 0,
        'calculation_results': {
            'purchase_price_no_vat': 1000.00,
            'purchase_price_total_quote_currency': 95000.00,
            'logistics_total': 5000.00,
            'customs_fee': 4750.00,
            'transit_commission': 0,
            'sales_price_per_unit': 120.85,
            'sales_price_total_no_vat': 1208.50,
            'vat_amount': 241.70,
            'sales_price_per_unit_with_vat': 145.02,
            'sales_price_total_with_vat': 1450.20,
        }
    }

    result = map_calculation_to_cells(item)

    # Check input cells
    assert result['B16'] == 'SKF'
    assert result['C16'] == '6205'
    assert result['D16'] == 'Bearing SKF 6205'
    assert result['E16'] == 10
    assert result['K16'] == 1200.00

    # Check calculation cells
    assert result['N16'] == 1000.00  # Purchase price no VAT
    assert result['S16'] == 95000.00  # Purchase price in quote currency
    assert result['V16'] == 5000.00  # Logistics
    assert result['Y16'] == 4750.00  # Customs fee
    assert result['AJ16'] == 120.85  # Selling price per unit
    assert result['AK16'] == 1208.50  # Selling price total
    assert result['AL16'] == 1450.20  # Selling price with VAT total

    # Check calculated invoice amount
    assert 'invoice_amount' in result
    assert result['invoice_amount'] == Decimal('10000.00')  # 1000 * 10


def test_map_calculation_to_cells_missing_calculations():
    """Test Excel cell mapping when calculation results are missing"""

    item = {
        'brand': 'SKF',
        'sku': '6205',
        'product_name': 'Bearing SKF 6205',
        'quantity': 10,
        'calculation_results': None
    }

    result = map_calculation_to_cells(item)

    assert result == {}


# ============================================================================
# TESTS: Helper Functions
# ============================================================================

def test_get_manager_info_from_quote():
    """Test getting manager info when quote has overrides"""

    export_data = ExportData(
        quote={
            'manager_name': 'Козлов Козел Козлович',
            'manager_phone': '+7 (495) 000-00-00',
            'manager_email': 'kozlov@custom.ru',
        },
        items=[],
        manager={'full_name': 'Петров Петр Петрович', 'phone': '+7 (495) 111-22-33', 'email': 'petrov@company.ru'},
        organization={},
        variables={},
        calculations={}
    )

    result = get_manager_info(export_data)

    assert result['name'] == 'Козлов Козел Козлович'  # Quote override
    assert result['phone'] == '+7 (495) 000-00-00'  # Quote override
    assert result['email'] == 'kozlov@custom.ru'  # Quote override


def test_get_manager_info_from_profile():
    """Test getting manager info from user profile when quote has no overrides"""

    export_data = ExportData(
        quote={'manager_name': None, 'manager_phone': None, 'manager_email': None},
        items=[],
        manager={'full_name': 'Петров Петр Петрович', 'phone': '+7 (495) 111-22-33', 'email': 'petrov@company.ru'},
        organization={},
        variables={},
        calculations={}
    )

    result = get_manager_info(export_data)

    assert result['name'] == 'Петров Петр Петрович'
    assert result['phone'] == '+7 (495) 111-22-33'
    assert result['email'] == 'petrov@company.ru'


def test_get_manager_info_missing():
    """Test getting manager info when manager is None"""

    export_data = ExportData(
        quote={'manager_name': None, 'manager_phone': None, 'manager_email': None},
        items=[],
        manager=None,
        organization={},
        variables={},
        calculations={}
    )

    result = get_manager_info(export_data)

    assert result['name'] == ''
    assert result['phone'] == ''
    assert result['email'] == ''


def test_get_contact_info_present():
    """Test getting contact info when contact exists"""

    export_data = ExportData(
        quote={},
        items=[],
        contact={'name': 'Иванов Иван', 'phone': '+7 (495) 987-65-43', 'email': 'ivanov@company.ru'},
        organization={},
        variables={},
        calculations={}
    )

    result = get_contact_info(export_data)

    assert result['name'] == 'Иванов Иван'
    assert result['phone'] == '+7 (495) 987-65-43'
    assert result['email'] == 'ivanov@company.ru'


def test_get_contact_info_missing():
    """Test getting contact info when contact is None"""

    export_data = ExportData(
        quote={},
        items=[],
        contact=None,
        organization={},
        variables={},
        calculations={}
    )

    result = get_contact_info(export_data)

    assert result['name'] == ''
    assert result['phone'] == ''
    assert result['email'] == ''


def test_format_payment_terms_full_advance():
    """Test formatting payment terms for 100% advance"""
    assert format_payment_terms({'advance_from_client': 100}) == "100% предоплата"


def test_format_payment_terms_partial_advance():
    """Test formatting payment terms for partial advance"""
    assert format_payment_terms({'advance_from_client': 50}) == "50% аванс"


def test_format_payment_terms_postpay():
    """Test formatting payment terms for postpay"""
    assert format_payment_terms({'advance_from_client': 0}) == "Постоплата"


def test_format_delivery_description_ddp():
    """Test delivery description for DDP incoterms"""
    result = format_delivery_description({'offer_incoterms': 'DDP'})
    assert "НДС" in result
    assert "таможенную очистку" in result


def test_format_delivery_description_other():
    """Test delivery description for non-DDP incoterms"""
    result = format_delivery_description({'offer_incoterms': 'DAP'})
    assert "доставку и страховку" in result
    assert "таможенную очистку" not in result
