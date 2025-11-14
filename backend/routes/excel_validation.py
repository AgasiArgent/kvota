"""
Excel Validation API Endpoints
Admin-only endpoints for validating Excel files against calculation engine
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status
from typing import List
from decimal import Decimal
import os
import tempfile

from auth import get_current_user, check_admin_permissions, User
from excel_parser.quote_parser import ExcelQuoteParser
from validation.calculator_validator import CalculatorValidator, ValidationMode

router = APIRouter(prefix="/api/admin/excel-validation", tags=["admin-validation"])


@router.post("/validate")
async def validate_excel_files(
    files: List[UploadFile] = File(...),
    mode: str = "summary",
    tolerance: float = 0.011,  # Tolerance in percent (default 0.011%)
    user: User = Depends(get_current_user)
):
    """
    Validate uploaded Excel files against calculation engine

    Admin-only endpoint that:
    - Accepts up to 10 Excel files
    - Parses each file using ExcelQuoteParser
    - Validates calculations using CalculatorValidator
    - Returns summary statistics and detailed comparison results

    Args:
        files: List of Excel files to validate (max 10)
        mode: Validation mode ("summary" or "detailed")
        tolerance: Tolerance in percent for deviation (default 0.01%)
        user: Authenticated user (must be admin/owner)

    Returns:
        JSON with summary statistics and per-file results
    """
    # Admin only
    await check_admin_permissions(user)

    # Limit files
    if len(files) > 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 10 files allowed"
        )

    results = []
    temp_files = []  # Track temp files for cleanup

    try:
        for file in files:
            temp_path = None
            try:
                # Save to temp
                with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
                    tmp.write(await file.read())
                    temp_path = tmp.name
                    temp_files.append(temp_path)

                # Parse Excel
                parser = ExcelQuoteParser(temp_path)
                excel_data = parser.parse()

                # Validate
                validator = CalculatorValidator(
                    tolerance_percent=Decimal(str(tolerance)),
                    mode=ValidationMode.SUMMARY if mode == "summary" else ValidationMode.DETAILED
                )
                result = validator.validate_quote(excel_data)

                # Convert to JSON-serializable format
                results.append({
                    "filename": file.filename,
                    "passed": result.passed,
                    "max_deviation": float(result.max_deviation),
                    "total_products": result.total_products,
                    "failed_fields": result.failed_fields,
                    "comparisons": [
                        {
                            "product_index": c.product_index,
                            "passed": c.passed,
                            "max_deviation": float(c.max_deviation),
                            "fields": [
                                {
                                    "field": fc.field,
                                    "field_name": fc.field_name,
                                    "our_value": float(fc.our_value),
                                    "excel_value": float(fc.excel_value),
                                    "difference": float(fc.difference),
                                    "passed": fc.passed,
                                    "phase": fc.phase
                                }
                                for fc in c.field_comparisons
                            ]
                        }
                        for c in result.comparisons
                    ]
                })

            except Exception as e:
                # If specific file fails, continue with others
                import traceback
                error_details = traceback.format_exc()
                print(f"[excel_validation] Error validating {file.filename}: {error_details}")
                results.append({
                    "filename": file.filename,
                    "passed": False,
                    "error": str(e)
                })

    finally:
        # Cleanup all temp files
        for temp_path in temp_files:
            if os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception as e:
                    print(f"Warning: Failed to delete temp file {temp_path}: {e}")

    # Summary stats
    total = len(results)
    passed = sum(1 for r in results if r.get("passed", False))
    failed = total - passed
    avg_dev = sum(r.get("max_deviation", 0) for r in results) / total if total > 0 else 0
    max_dev = max((r.get("max_deviation", 0) for r in results), default=0)

    return {
        "summary": {
            "total": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": (passed / total * 100) if total > 0 else 0,
            "avg_deviation": avg_dev,
            "max_deviation": max_dev
        },
        "results": results
    }
