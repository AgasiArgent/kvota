"""
Quote Version Models

Models for quote versioning - each save/recalculation creates a new immutable version.
"""
from decimal import Decimal
from datetime import datetime
from typing import Optional, Literal, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


# Valid status values for quote versions
QuoteVersionStatus = Literal["draft", "sent", "confirmed", "rejected", "archived"]
RatesSource = Literal["cbr", "manual", "mixed"]


class QuoteVersionCreate(BaseModel):
    """
    Input model for creating a new quote version.
    Used when saving or recalculating a quote.
    """
    quote_id: UUID = Field(..., description="Parent quote ID")
    quote_variables: dict[str, Any] = Field(..., description="Complete quote-level variables snapshot")
    products_snapshot: list[dict[str, Any]] = Field(..., description="Complete products snapshot with calculations")
    exchange_rates_used: dict[str, Any] = Field(..., description="Exchange rates at calculation time")
    rates_source: RatesSource = Field(..., description="Source of rates: cbr, manual, or mixed")
    rates_fetched_at: Optional[datetime] = Field(None, description="When rates were fetched")
    calculation_results: dict[str, Any] = Field(..., description="Full calculation results")
    total_usd: Decimal = Field(..., ge=0, description="Total in USD")
    total_quote_currency: Decimal = Field(..., ge=0, description="Total in quote currency")
    change_reason: Optional[str] = Field(None, description="Why this version was created")
    parent_version_id: Optional[UUID] = Field(None, description="Previous version if recalculating")
    created_by: UUID = Field(..., description="User who created this version")


class QuoteVersion(BaseModel):
    """
    Full quote version model.
    Represents an immutable snapshot of a quote at a point in time.
    """
    id: UUID = Field(..., description="Version UUID")
    quote_id: UUID = Field(..., description="Parent quote ID")
    version_number: int = Field(..., ge=1, description="Sequential version number (1, 2, 3...)")
    status: QuoteVersionStatus = Field("draft", description="Version status")

    # Snapshots - complete data at time of version
    quote_variables: dict[str, Any] = Field(..., description="Complete quote-level variables")
    products_snapshot: list[dict[str, Any]] = Field(..., description="Products with calculations")

    # Exchange rates used for this version
    exchange_rates_used: dict[str, Any] = Field(..., description="Rates at calculation time")
    rates_source: RatesSource = Field(..., description="Source: cbr, manual, mixed")
    rates_fetched_at: Optional[datetime] = Field(None, description="When rates were fetched")

    # Calculation results
    calculation_results: dict[str, Any] = Field(..., description="Full calculation output")
    total_usd: Decimal = Field(..., ge=0, description="Total in USD")
    total_quote_currency: Decimal = Field(..., ge=0, description="Total in quote currency")

    # Audit trail
    change_reason: Optional[str] = Field(None, description="Reason for this version")
    parent_version_id: Optional[UUID] = Field(None, description="Previous version ID")
    created_by: UUID = Field(..., description="User who created this version")
    created_at: datetime = Field(..., description="When this version was created")

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = ["draft", "sent", "confirmed", "rejected", "archived"]
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of {valid_statuses}")
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "quote_id": "550e8400-e29b-41d4-a716-446655440001",
                "version_number": 1,
                "status": "draft",
                "quote_variables": {
                    "currency_of_quote": "USD",
                    "delivery_time": 45
                },
                "products_snapshot": [
                    {"sku": "SKF-6205", "quantity": 100, "calculated_price": 5.50}
                ],
                "exchange_rates_used": {
                    "USD": "1.0",
                    "EUR": "1.08",
                    "RUB": "0.0105"
                },
                "rates_source": "cbr",
                "calculation_results": {"total_usd": 1000.00},
                "total_usd": "1000.00",
                "total_quote_currency": "1000.00",
                "created_by": "550e8400-e29b-41d4-a716-446655440002",
                "created_at": "2025-11-25T10:00:00Z"
            }
        }


class QuoteVersionSummary(BaseModel):
    """
    Summary model for version history listings.
    Lighter weight than full QuoteVersion.
    """
    id: UUID
    version_number: int
    status: QuoteVersionStatus
    total_usd: Decimal
    total_quote_currency: Decimal
    rates_source: RatesSource
    change_reason: Optional[str]
    created_by: UUID
    created_at: datetime

    class Config:
        from_attributes = True
