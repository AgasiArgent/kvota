from enum import Enum
from decimal import Decimal
from dataclasses import dataclass
from typing import List, Dict
import sys
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
import calculation_engine

class ValidationMode(Enum):
    """Validation comparison modes"""
    SUMMARY = "summary"
    DETAILED = "detailed"

# Field definitions
SUMMARY_FIELDS = {
    "AK16": "Final Price Total",
    "AM16": "Price with VAT",
    "AQ16": "Profit",
}

DETAILED_FIELDS = {
    "M16": "Base price without VAT",
    "S16": "Purchase price in quote currency",
    "T16": "Logistics supplier-hub",
    "V16": "Total logistics",
    "Y16": "Customs duty",
    "AB16": "COGS",
    "AK16": "Final price total",
    "AM16": "Price with VAT",
    "AQ16": "Profit",
}

@dataclass
class FieldComparison:
    """Single field comparison result"""
    field: str
    field_name: str
    our_value: Decimal
    excel_value: Decimal
    difference: Decimal
    passed: bool
    phase: str

@dataclass
class ProductComparison:
    """Product-level comparison result"""
    product_index: int
    passed: bool
    max_deviation: Decimal
    field_comparisons: List[FieldComparison]

@dataclass
class ValidationResult:
    """Complete validation result"""
    mode: ValidationMode
    passed: bool
    comparisons: List[ProductComparison]
    max_deviation: Decimal
    failed_fields: List[str]
    excel_file: str
    total_products: int
    fields_checked: int

class CalculatorValidator:
    """Compare Excel results with calculation engine"""

    def __init__(
        self,
        tolerance_rub: Decimal = Decimal("2.0"),
        mode: ValidationMode = ValidationMode.SUMMARY
    ):
        self.tolerance = tolerance_rub
        self.mode = mode

    def validate_quote(self, excel_data) -> ValidationResult:
        """Run calculation and compare with Excel"""

        # Get fields to check based on mode
        fields_to_check = (
            SUMMARY_FIELDS if self.mode == ValidationMode.SUMMARY
            else DETAILED_FIELDS
        )

        # Run through calculation engine
        # Note: This is a placeholder - actual mapping to QuoteCalculationInput will be added later
        # For now, we pass raw data and expect the calculation engine to handle it
        # (In production, this would be mapped to proper Pydantic models first)
        our_results = calculation_engine.calculate_multiproduct_quote(
            excel_data.inputs["products"]
        )

        # Compare products
        comparisons = []
        for i, (our_product, excel_product) in enumerate(
            zip(our_results, excel_data.expected_results["products"])
        ):
            comparison = self._compare_product(
                our_product,
                excel_product,
                fields_to_check,
                i
            )
            comparisons.append(comparison)

        # Calculate summary stats
        all_passed = all(c.passed for c in comparisons)
        max_dev = max(c.max_deviation for c in comparisons) if comparisons else Decimal("0")
        failed_fields = self._get_failed_fields(comparisons)

        return ValidationResult(
            mode=self.mode,
            passed=all_passed,
            comparisons=comparisons,
            max_deviation=max_dev,
            failed_fields=failed_fields,
            excel_file=excel_data.filename,
            total_products=len(comparisons),
            fields_checked=len(fields_to_check)
        )

    def _compare_product(
        self,
        our: Dict,
        excel: Dict,
        fields_to_check: Dict,
        product_index: int
    ) -> ProductComparison:
        """Compare one product"""
        field_comparisons = []

        for field_code, field_name in fields_to_check.items():
            our_value = Decimal(str(our.get(field_code, 0)))
            excel_value = Decimal(str(excel.get(field_code, 0)))
            diff = abs(our_value - excel_value)
            passed = diff <= self.tolerance

            field_comparisons.append(FieldComparison(
                field=field_code,
                field_name=field_name,
                our_value=our_value,
                excel_value=excel_value,
                difference=diff,
                passed=passed,
                phase=self._get_phase_name(field_code)
            ))

        all_passed = all(fc.passed for fc in field_comparisons)
        max_dev = max(fc.difference for fc in field_comparisons)

        return ProductComparison(
            product_index=product_index,
            passed=all_passed,
            max_deviation=max_dev,
            field_comparisons=field_comparisons
        )

    def _get_phase_name(self, field_code: str) -> str:
        """Map field to phase"""
        phase_map = {
            "M16": "Phase 1: Currency",
            "S16": "Phase 1: Currency",
            "T16": "Phase 3: Logistics",
            "V16": "Phase 3: Logistics",
            "Y16": "Phase 4: Customs",
            "AB16": "Phase 9: COGS",
            "AK16": "Phase 11: Sales Price",
            "AM16": "Phase 12: VAT",
            "AQ16": "Phase 13: Profit",
        }
        return phase_map.get(field_code, "Unknown Phase")

    def _get_failed_fields(self, comparisons: List[ProductComparison]) -> List[str]:
        """Get list of failed field codes"""
        failed = set()
        for comp in comparisons:
            for fc in comp.field_comparisons:
                if not fc.passed:
                    failed.add(fc.field)
        return list(failed)
