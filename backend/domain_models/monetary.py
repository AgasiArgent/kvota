"""
Monetary value models for multi-currency support.

These models handle monetary values that can be entered in any supported currency
and converted to USD for storage and analytics.
"""
from decimal import Decimal
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator

# Supported currencies - matches database CHECK constraint
SUPPORTED_CURRENCIES = ["USD", "EUR", "RUB", "TRY", "CNY"]
Currency = Literal["USD", "EUR", "RUB", "TRY", "CNY"]


class MonetaryValue(BaseModel):
    """
    Value with currency and USD conversion.

    Used for all monetary fields that support multi-currency input.
    Stores both the original value/currency and the USD equivalent.

    Attributes:
        value: Original value entered by user (in original currency)
        currency: Currency code of the original value
        value_usd: Value converted to USD
        rate_used: Exchange rate used for conversion (currency/USD)
        rate_source: Source of rate - 'cbr', 'manual', or 'identity' (for USD)
        rate_timestamp: When the rate was fetched (for audit trail)

    Example:
        User enters 1500 EUR, rate is 1.08 EUR/USD
        {
            "value": 1500.00,
            "currency": "EUR",
            "value_usd": 1620.00,
            "rate_used": 1.08,
            "rate_source": "cbr",
            "rate_timestamp": "2025-11-25T10:00:00Z"
        }
    """
    value: Decimal = Field(..., ge=0, description="Original value entered by user")
    currency: Currency = Field(..., description="Currency of the value")
    value_usd: Decimal = Field(..., ge=0, description="Value converted to USD")
    rate_used: Decimal = Field(..., gt=0, description="Exchange rate used for conversion")
    rate_source: str = Field(..., description="Source of rate: cbr, manual, identity")
    rate_timestamp: Optional[datetime] = Field(None, description="When rate was fetched")

    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Currency must be one of {SUPPORTED_CURRENCIES}")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "value": "1500.00",
                "currency": "EUR",
                "value_usd": "1620.00",
                "rate_used": "1.08",
                "rate_source": "cbr",
                "rate_timestamp": "2025-11-25T10:00:00Z"
            }
        }


class MonetaryInput(BaseModel):
    """
    Input model for monetary values from frontend.

    Only contains value and currency - USD conversion happens server-side.
    This is what the frontend sends when user enters a monetary value.

    Attributes:
        value: Value entered by user
        currency: Currency selected by user (defaults to USD)

    Example:
        User enters 1500 EUR:
        {"value": 1500.00, "currency": "EUR"}
    """
    value: Decimal = Field(..., ge=0, description="Value entered by user")
    currency: Currency = Field(default="USD", description="Currency selected by user")

    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Currency must be one of {SUPPORTED_CURRENCIES}")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "value": "1500.00",
                "currency": "EUR"
            }
        }
