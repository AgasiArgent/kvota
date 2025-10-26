"""
Minimal test to verify imports work in CI environment
"""

def test_basic_imports():
    """Test that basic Python imports work"""
    import sys
    import os
    assert sys.version_info.major == 3
    assert sys.version_info.minor >= 12


def test_project_imports():
    """Test that project modules can be imported"""
    # Test calculation models import
    from calculation_models import (
        ProductInfo,
        FinancialParams,
        LogisticsParams,
        QuoteCalculationInput
    )

    # Test calculation engine import
    from calculation_engine import calculate_single_product_quote

    # Verify they're importable
    assert ProductInfo is not None
    assert QuoteCalculationInput is not None
    assert calculate_single_product_quote is not None


def test_routes_imports():
    """Test that routes modules can be imported"""
    from routes.quotes_calc import (
        safe_decimal,
        safe_str,
        safe_int,
        get_value,
        map_variables_to_calculation_input
    )

    # Verify they're callable
    assert callable(safe_decimal)
    assert callable(map_variables_to_calculation_input)


if __name__ == "__main__":
    test_basic_imports()
    test_project_imports()
    test_routes_imports()
    print("✅ All imports successful!")
