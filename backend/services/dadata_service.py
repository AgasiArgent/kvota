"""
DaData Service - Company lookup by INN

Uses DaData.ru API to fetch company information from EGRUL/EGRIP.
Free tier: 10,000 requests/day
"""

import os
import httpx
from typing import Optional
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

DADATA_API_URL = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party"


class CompanyInfo(BaseModel):
    """Company information from DaData"""
    # Basic info
    name: str  # Short name with OPF
    full_name: Optional[str] = None  # Full name with OPF
    inn: str
    kpp: Optional[str] = None
    ogrn: Optional[str] = None

    # Address
    address: Optional[str] = None  # Full address
    postal_code: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None

    # Director/Management
    director_name: Optional[str] = None
    director_position: Optional[str] = None

    # Company type
    company_type: str  # LEGAL, INDIVIDUAL (ИП)
    opf: Optional[str] = None  # Organizational-legal form (ООО, АО, ИП, etc.)

    # Status
    status: str  # ACTIVE, LIQUIDATING, LIQUIDATED, BANKRUPT, REORGANIZING

    # Additional
    okved: Optional[str] = None  # Main activity code
    okved_name: Optional[str] = None  # Activity description


class DaDataService:
    """Service for fetching company data from DaData API"""

    def __init__(self):
        self.api_key = os.getenv("DADATA_API_KEY")
        if not self.api_key:
            logger.warning("DADATA_API_KEY not configured")

    async def find_by_inn(self, inn: str) -> Optional[CompanyInfo]:
        """
        Find company by INN.

        Args:
            inn: Russian tax identification number (10 or 12 digits)

        Returns:
            CompanyInfo if found, None otherwise
        """
        if not self.api_key:
            raise ValueError("DaData API key not configured")

        # Clean INN
        inn_clean = ''.join(filter(str.isdigit, inn))
        if len(inn_clean) not in [10, 12]:
            raise ValueError("INN must be 10 or 12 digits")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Token {self.api_key}"
        }

        payload = {"query": inn_clean}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    DADATA_API_URL,
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()

                if not data.get("suggestions"):
                    logger.info(f"No company found for INN: {inn_clean}")
                    return None

                # Get first suggestion
                suggestion = data["suggestions"][0]
                company_data = suggestion.get("data", {})

                return self._parse_company_data(company_data)

        except httpx.HTTPStatusError as e:
            logger.error(f"DaData API error: {e.response.status_code} - {e.response.text}")
            raise
        except httpx.RequestError as e:
            logger.error(f"DaData request error: {str(e)}")
            raise

    def _parse_company_data(self, data: dict) -> CompanyInfo:
        """Parse DaData response into CompanyInfo model"""

        # Extract address components
        address_data = data.get("address", {}) or {}
        address_nested = address_data.get("data", {}) or {}

        # Get management info
        management = data.get("management", {}) or {}

        # Get name info
        name_data = data.get("name", {}) or {}

        # Get state info
        state = data.get("state", {}) or {}

        # Get OPF info
        opf_data = data.get("opf", {}) or {}

        # Determine company type for our system
        dadata_type = data.get("type", "LEGAL")

        return CompanyInfo(
            # Names
            name=name_data.get("short_with_opf") or name_data.get("full_with_opf") or data.get("value", ""),
            full_name=name_data.get("full_with_opf"),

            # Identifiers
            inn=data.get("inn", ""),
            kpp=data.get("kpp"),
            ogrn=data.get("ogrn"),

            # Address - use unrestricted_value for full address with postal code
            address=address_data.get("unrestricted_value") or address_data.get("value"),
            postal_code=address_nested.get("postal_code"),
            city=address_nested.get("city") or address_nested.get("settlement"),
            region=address_nested.get("region_with_type") or address_nested.get("region"),

            # Director
            director_name=management.get("name"),
            director_position=management.get("post"),

            # Type and form
            company_type=dadata_type,
            opf=opf_data.get("short") or opf_data.get("full"),

            # Status
            status=state.get("status", "ACTIVE"),

            # Activity
            okved=data.get("okved"),
            okved_name=None  # Not available in basic response
        )


# Singleton instance
_dadata_service: Optional[DaDataService] = None


def get_dadata_service() -> DaDataService:
    """Get or create DaData service singleton"""
    global _dadata_service
    if _dadata_service is None:
        _dadata_service = DaDataService()
    return _dadata_service
