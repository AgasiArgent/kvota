"""
Quote Upload from Simplified Excel Template

Endpoint: POST /api/quotes/upload-excel
Accepts simplified Excel template, parses it, and runs calculation engine.

Created: 2025-11-28
"""

import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from auth import get_current_user, User
from excel_parser.simplified_parser import (
    SimplifiedExcelParser,
    SimplifiedQuoteInput,
    parse_simplified_template,
)
# Note: Calculation integration pending - imports will be added when ready
# from calculation_models import (
#     QuoteCalculationInput, MultiProductQuoteInput, ...
# )
# from calculation_engine import calculate_quote


router = APIRouter(prefix="/api/quotes", tags=["quotes-upload"])


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class UploadResponse(BaseModel):
    """Response from upload endpoint"""
    success: bool
    message: str
    quote_input: Optional[dict] = None
    calculation_results: Optional[dict] = None
    errors: Optional[list] = None


class ParseOnlyResponse(BaseModel):
    """Response when only parsing (no calculation)"""
    success: bool
    parsed_data: dict
    errors: Optional[list] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# TODO: Implement map_to_calculation_input when integrating with calculation engine
# The function will map SimplifiedQuoteInput to QuoteCalculationInput/MultiProductQuoteInput
# for use with the calculation engine. Currently, the endpoint only parses and returns data.


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/upload-excel", response_model=UploadResponse)
async def upload_excel_quote(
    file: UploadFile = File(...),
    calculate: bool = True,
    user: User = Depends(get_current_user),
):
    """
    Upload simplified Excel template and optionally run calculation.

    Args:
        file: Excel file (.xlsx)
        calculate: If True, run calculation engine after parsing

    Returns:
        UploadResponse with parsed data and calculation results
    """
    # Validate file type
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an Excel file (.xlsx)"
        )

    try:
        # Read file content
        content = await file.read()
        file_stream = io.BytesIO(content)

        # Parse Excel
        parser = SimplifiedExcelParser(file_stream)
        parsed_data = parser.parse()

        # Return parsed data
        # TODO: Add calculation integration when ready
        return UploadResponse(
            success=True,
            message="File parsed successfully" + (" (calculation not yet integrated)" if calculate else ""),
            quote_input=parsed_data.dict(),
            calculation_results=None,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )


@router.post("/parse-excel", response_model=ParseOnlyResponse)
async def parse_excel_only(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """
    Parse Excel template without running calculation.
    Useful for validation and preview.

    Args:
        file: Excel file (.xlsx)

    Returns:
        ParseOnlyResponse with parsed data
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Please upload an Excel file (.xlsx)"
        )

    try:
        content = await file.read()
        file_stream = io.BytesIO(content)

        parser = SimplifiedExcelParser(file_stream)
        parsed_data = parser.parse()

        return ParseOnlyResponse(
            success=True,
            parsed_data=parsed_data.dict(),
        )

    except ValueError as e:
        return ParseOnlyResponse(
            success=False,
            parsed_data={},
            errors=[str(e)],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )
