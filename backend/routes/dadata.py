"""
DaData API routes - Company lookup by INN

Provides endpoint to fetch company information from DaData.ru
for auto-filling customer creation forms.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from auth import get_current_user, User
from services.dadata_service import get_dadata_service, CompanyInfo
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dadata", tags=["dadata"])


@router.get("/company/{inn}", response_model=CompanyInfo)
async def get_company_by_inn(
    inn: str,
    user: User = Depends(get_current_user)
) -> CompanyInfo:
    """
    Get company information by INN from DaData.

    Returns company details including:
    - Name (short and full)
    - KPP, OGRN
    - Full address with postal code
    - Director name and position
    - Company type and status

    Args:
        inn: Russian tax identification number (10 digits for orgs, 12 for individuals)

    Returns:
        CompanyInfo with all available fields

    Raises:
        404: Company not found
        400: Invalid INN format
        503: DaData service unavailable
    """
    # Validate INN format
    inn_clean = ''.join(filter(str.isdigit, inn))
    if len(inn_clean) not in [10, 12]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ИНН должен содержать 10 цифр (организация) или 12 цифр (ИП/физлицо)"
        )

    service = get_dadata_service()

    try:
        company = await service.find_by_inn(inn_clean)

        if company is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Компания с ИНН {inn_clean} не найдена в ЕГРЮЛ/ЕГРИП"
            )

        logger.info(f"Company found for INN {inn_clean}: {company.name}")
        return company

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"DaData lookup failed for INN {inn_clean}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис DaData временно недоступен. Попробуйте позже."
        )
