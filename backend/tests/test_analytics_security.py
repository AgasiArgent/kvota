import pytest
from analytics_security import QuerySecurityValidator, build_analytics_query, build_aggregation_query
from uuid import uuid4


def test_validate_fields_accepts_whitelisted_fields():
    """Test that whitelisted fields are accepted"""
    fields = ['quote_number', 'status', 'total_amount']
    result = QuerySecurityValidator.validate_fields(fields)
    assert result == fields


def test_validate_fields_rejects_non_whitelisted_fields():
    """Test that non-whitelisted fields are rejected"""
    fields = ['quote_number', 'password', 'secret_key']
    result = QuerySecurityValidator.validate_fields(fields)
    assert result == ['quote_number']


def test_is_safe_value_rejects_sql_injection():
    """Test that SQL injection attempts are rejected"""
    dangerous = "'; DROP TABLE quotes; --"
    assert QuerySecurityValidator.is_safe_value(dangerous) == False


def test_is_safe_value_accepts_normal_values():
    """Test that normal values are accepted"""
    assert QuerySecurityValidator.is_safe_value("approved") == True
    assert QuerySecurityValidator.is_safe_value(12345) == True
    assert QuerySecurityValidator.is_safe_value(None) == True


def test_sanitize_filters_removes_dangerous_filters():
    """Test that dangerous filter values are removed"""
    filters = {
        'status': 'approved',
        'quote_number': "'; DROP TABLE quotes; --"
    }
    result = QuerySecurityValidator.sanitize_filters(filters)
    assert 'status' in result
    assert 'quote_number' not in result


def test_build_analytics_query_uses_parameterized_queries():
    """Test that query builder uses parameterized queries"""
    org_id = uuid4()
    filters = {'status': 'approved', 'sale_type': 'поставка'}
    fields = ['quote_number', 'total_amount']

    sql, params = build_analytics_query(
        organization_id=org_id,
        filters=filters,
        selected_fields=fields,
        limit=100,
        offset=0
    )

    # Should use $1, $2, etc (not string interpolation)
    assert '$1' in sql
    assert '$2' in sql
    assert 'DROP' not in sql.upper()

    # Params should match
    assert str(org_id) in params
    assert 'approved' in params


def test_build_aggregation_query_uses_parameterized_queries():
    """Test that aggregation query builder uses parameterized queries"""
    org_id = uuid4()
    filters = {'status': 'approved'}
    aggregations = {
        'total_profit': {'function': 'sum', 'label': 'Total Profit'}  # Use real calculated field
    }

    sql, params = build_aggregation_query(
        organization_id=org_id,
        filters=filters,
        aggregations=aggregations
    )

    # Should use $1, $2, etc
    assert '$1' in sql
    assert 'SUM' in sql.upper() or 'COALESCE' in sql.upper()  # May use COALESCE wrapper
    assert 'DROP' not in sql.upper()

    # Params should match
    assert str(org_id) in params
    assert 'approved' in params


def test_validate_fields_returns_empty_list_for_all_invalid():
    """Test that all invalid fields returns empty list"""
    fields = ['password', 'secret_key', 'auth_token']
    result = QuerySecurityValidator.validate_fields(fields)
    assert result == []


def test_build_aggregation_rejects_dangerous_alias():
    """Test that dangerous alias names are rejected (especially for COUNT)"""
    org_id = uuid4()

    # The vulnerability is specifically with COUNT which uses field name as alias
    aggregations = {
        "total_count; DROP TABLE quotes; --": {"function": "count"},
        "quote_count; DELETE FROM quotes WHERE 1=1; --": {"function": "count"}
    }

    sql, params = build_aggregation_query(org_id, {}, aggregations)

    # Should NOT contain SQL injection attempts
    assert "DROP" not in sql.upper()
    assert "DELETE" not in sql.upper()
    assert "; DROP" not in sql
    assert "; DELETE" not in sql
    assert "total_count;" not in sql


def test_build_aggregation_accepts_whitelisted_aliases():
    """Test that whitelisted alias names are accepted"""
    org_id = uuid4()

    aggregations = {
        "quote_count": {"function": "count"},
        "total_import_vat": {"function": "sum"},
        "avg_profit": {"function": "avg"}
    }

    sql, params = build_aggregation_query(org_id, {}, aggregations)

    # Should contain valid aliases
    assert "quote_count" in sql
    # Should be safe SQL
    assert "DROP" not in sql.upper()
    assert ";" not in sql or sql.count(";") == 0  # No semicolons in safe SQL


def test_build_analytics_query_with_calculated_fields():
    """Test that calculated fields use JOIN with quote_calculation_results"""
    org_id = uuid4()
    fields = ['quote_number', 'cogs', 'profit']

    sql, params = build_analytics_query(org_id, {}, fields)

    # Should have JOIN
    assert 'quote_calculation_results' in sql
    assert 'LEFT JOIN' in sql

    # Should extract JSONB
    assert "phase_results->>" in sql
    assert "cogs_per_product" in sql
    assert "profit" in sql

    # Should have proper GROUP BY
    assert 'GROUP BY' in sql


def test_build_analytics_query_without_calculated_fields():
    """Test that query without calculated fields doesn't include JOIN"""
    org_id = uuid4()
    fields = ['quote_number', 'status', 'total_amount']

    sql, params = build_analytics_query(org_id, {}, fields)

    # Should NOT have JOIN
    assert 'quote_calculation_results' not in sql
    assert 'LEFT JOIN' not in sql

    # Should be simple query
    assert 'FROM quotes q' in sql


def test_build_aggregation_query_with_calculated_fields():
    """Test that aggregation with calculated fields uses JOIN"""
    org_id = uuid4()
    aggregations = {
        "total_cogs": {"function": "sum"},
        "avg_profit": {"function": "avg"}
    }

    sql, params = build_aggregation_query(org_id, {}, aggregations)

    # Should have JOIN
    assert 'quote_calculation_results' in sql
    assert 'LEFT JOIN' in sql

    # Should extract JSONB
    assert "phase_results->>" in sql
    assert "cogs_per_product" in sql


def test_build_analytics_query_export_vat_calculation():
    """Test that export_vat is calculated from two JSONB fields"""
    org_id = uuid4()
    fields = ['quote_number', 'export_vat']

    sql, params = build_analytics_query(org_id, {}, fields)

    # Should calculate export_vat
    assert 'sales_price_total_with_vat' in sql
    assert 'sales_price_total_no_vat' in sql
    assert 'export_vat' in sql


def test_build_analytics_query_margin_percent_calculation():
    """Test that margin_percent is calculated correctly"""
    org_id = uuid4()
    fields = ['quote_number', 'margin_percent']

    sql, params = build_analytics_query(org_id, {}, fields)

    # Should calculate margin_percent with division check
    assert 'margin_percent' in sql
    assert 'CASE WHEN' in sql  # Should have division by zero protection
    assert 'profit' in sql
