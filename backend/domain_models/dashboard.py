"""
Dashboard models for the dashboard constructor system.

These models handle dashboard configurations, widgets, and campaign data
for email outreach analytics and future kvota metrics.
"""
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Enums
# ============================================================================

class WidgetType(str, Enum):
    """Widget types available in the dashboard constructor"""
    KPI = "kpi"
    CHART = "chart"
    TABLE = "table"
    FILTER = "filter"


class ChartType(str, Enum):
    """Chart types for chart widgets"""
    LINE = "line"
    BAR = "bar"
    PIE = "pie"
    AREA = "area"


class DataSourceType(str, Enum):
    """Data source types for widgets"""
    SMARTLEAD = "smartlead"
    MANUAL = "manual"
    AGGREGATE = "aggregate"


class AggregationType(str, Enum):
    """Aggregation types for metrics"""
    SUM = "sum"
    AVG = "avg"
    MAX = "max"
    MIN = "min"
    COUNT = "count"


class CampaignDataSource(str, Enum):
    """Campaign data source types"""
    SMARTLEAD = "smartlead"
    MANUAL = "manual"


# ============================================================================
# Campaign Metrics
# ============================================================================

class CampaignMetrics(BaseModel):
    """
    Email campaign metrics from SmartLead or manual entry.

    Stores both raw counts and calculated rates.
    """
    # Raw counts
    sent_count: int = Field(default=0, ge=0, description="Total emails sent")
    open_count: int = Field(default=0, ge=0, description="Total opens")
    unique_open_count: int = Field(default=0, ge=0, description="Unique opens")
    click_count: int = Field(default=0, ge=0, description="Total clicks")
    unique_click_count: int = Field(default=0, ge=0, description="Unique clicks")
    reply_count: int = Field(default=0, ge=0, description="Total replies")
    bounce_count: int = Field(default=0, ge=0, description="Bounced emails")
    unsubscribed_count: int = Field(default=0, ge=0, description="Unsubscribes")

    # Lead status (from SmartLead)
    interested_count: int = Field(default=0, ge=0, description="Interested leads")
    not_started_count: int = Field(default=0, ge=0, description="Not started")
    in_progress_count: int = Field(default=0, ge=0, description="In progress")
    completed_count: int = Field(default=0, ge=0, description="Completed")
    blocked_count: int = Field(default=0, ge=0, description="Blocked")
    paused_count: int = Field(default=0, ge=0, description="Paused")
    stopped_count: int = Field(default=0, ge=0, description="Stopped")
    total_leads: int = Field(default=0, ge=0, description="Total leads in campaign")

    # Calculated rates (can be computed or stored)
    open_rate: Optional[Decimal] = Field(default=None, ge=0, le=100, description="Open rate %")
    click_rate: Optional[Decimal] = Field(default=None, ge=0, le=100, description="Click rate %")
    reply_rate: Optional[Decimal] = Field(default=None, ge=0, le=100, description="Reply rate %")
    bounce_rate: Optional[Decimal] = Field(default=None, ge=0, le=100, description="Bounce rate %")

    def calculate_rates(self) -> None:
        """Calculate rates from raw counts"""
        if self.sent_count > 0:
            self.open_rate = Decimal(str(round(self.unique_open_count / self.sent_count * 100, 2)))
            self.click_rate = Decimal(str(round(self.unique_click_count / self.sent_count * 100, 2)))
            self.reply_rate = Decimal(str(round(self.reply_count / self.sent_count * 100, 2)))
            self.bounce_rate = Decimal(str(round(self.bounce_count / self.sent_count * 100, 2)))

    class Config:
        json_schema_extra = {
            "example": {
                "sent_count": 1000,
                "open_count": 450,
                "unique_open_count": 350,
                "click_count": 120,
                "unique_click_count": 80,
                "reply_count": 45,
                "bounce_count": 25,
                "unsubscribed_count": 5,
                "interested_count": 30,
                "total_leads": 1000,
                "open_rate": "35.00",
                "click_rate": "8.00",
                "reply_rate": "4.50"
            }
        }


# ============================================================================
# Campaign Data (Cached from SmartLead or Manual Entry)
# ============================================================================

class CampaignDataBase(BaseModel):
    """Base model for campaign data"""
    campaign_name: str = Field(..., min_length=1, max_length=255)
    metrics: CampaignMetrics = Field(default_factory=CampaignMetrics)
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class CampaignDataCreate(CampaignDataBase):
    """Model for creating campaign data (manual entry)"""
    source: CampaignDataSource = Field(default=CampaignDataSource.MANUAL)
    campaign_id: Optional[str] = Field(default=None, description="SmartLead campaign ID")


class CampaignDataUpdate(BaseModel):
    """Model for updating campaign data"""
    campaign_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    metrics: Optional[CampaignMetrics] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class CampaignData(CampaignDataBase):
    """Full campaign data model with all fields"""
    id: UUID
    organization_id: UUID
    source: CampaignDataSource
    campaign_id: Optional[str] = None
    synced_at: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Widget Data Source
# ============================================================================

class WidgetDataSource(BaseModel):
    """
    Data source configuration for a widget.

    Specifies where to get data for the widget.
    """
    type: DataSourceType = Field(..., description="Data source type")
    campaign_ids: Optional[List[str]] = Field(default=None, description="Campaign IDs to include")
    metric: str = Field(..., description="Metric to display (e.g., 'sent_count', 'open_rate')")
    aggregation: Optional[AggregationType] = Field(default=None, description="Aggregation method")
    date_range: Optional[Dict[str, str]] = Field(default=None, description="Date range filter")

    class Config:
        json_schema_extra = {
            "example": {
                "type": "smartlead",
                "campaign_ids": ["campaign_123", "campaign_456"],
                "metric": "open_rate",
                "aggregation": "avg"
            }
        }


# ============================================================================
# Widget Position
# ============================================================================

class WidgetPosition(BaseModel):
    """Grid position for a widget (react-grid-layout compatible)"""
    x: int = Field(default=0, ge=0, description="X position in grid")
    y: int = Field(default=0, ge=0, description="Y position in grid")
    w: int = Field(default=4, ge=1, le=12, description="Width in grid units")
    h: int = Field(default=3, ge=1, le=12, description="Height in grid units")

    class Config:
        json_schema_extra = {
            "example": {"x": 0, "y": 0, "w": 4, "h": 3}
        }


# ============================================================================
# Widget Configuration (type-specific)
# ============================================================================

class KPIWidgetConfig(BaseModel):
    """Configuration specific to KPI widgets"""
    format: str = Field(default="number", description="Display format: number, percent, currency")
    show_trend: bool = Field(default=True, description="Show trend indicator")
    trend_period: str = Field(default="week", description="Period for trend: day, week, month")
    decimal_places: int = Field(default=0, ge=0, le=4)
    prefix: Optional[str] = None
    suffix: Optional[str] = None


class ChartWidgetConfig(BaseModel):
    """Configuration specific to chart widgets"""
    chart_type: ChartType = Field(default=ChartType.BAR)
    colors: Optional[List[str]] = None
    show_legend: bool = Field(default=True)
    show_labels: bool = Field(default=True)
    stacked: bool = Field(default=False)
    x_axis_label: Optional[str] = None
    y_axis_label: Optional[str] = None


class TableWidgetConfig(BaseModel):
    """Configuration specific to table widgets"""
    columns: List[str] = Field(default_factory=list, description="Columns to display")
    sortable: bool = Field(default=True)
    paginated: bool = Field(default=True)
    page_size: int = Field(default=10, ge=5, le=100)


class FilterWidgetConfig(BaseModel):
    """Configuration specific to filter widgets"""
    filter_type: str = Field(default="date_range", description="Filter type: date_range, campaign_select, multi_select")
    target_widgets: Optional[List[str]] = Field(default=None, description="Widget IDs to filter")
    default_value: Optional[Any] = None


# ============================================================================
# Dashboard Widget
# ============================================================================

class DashboardWidgetBase(BaseModel):
    """Base model for dashboard widget"""
    widget_type: WidgetType
    title: str = Field(..., min_length=1, max_length=255)
    config: Dict[str, Any] = Field(default_factory=dict)
    data_source: WidgetDataSource
    position: WidgetPosition = Field(default_factory=WidgetPosition)


class DashboardWidgetCreate(DashboardWidgetBase):
    """Model for creating a widget"""
    dashboard_id: Optional[UUID] = None  # Set by API


class DashboardWidgetUpdate(BaseModel):
    """Model for updating a widget"""
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    config: Optional[Dict[str, Any]] = None
    data_source: Optional[WidgetDataSource] = None
    position: Optional[WidgetPosition] = None


class DashboardWidget(DashboardWidgetBase):
    """Full widget model with all fields"""
    id: UUID
    dashboard_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Dashboard
# ============================================================================

class DashboardBase(BaseModel):
    """Base model for dashboard"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)


class DashboardCreate(DashboardBase):
    """Model for creating a dashboard"""
    widgets: List[DashboardWidgetCreate] = Field(default_factory=list)


class DashboardUpdate(BaseModel):
    """Model for updating a dashboard"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    layout: Optional[List[Dict[str, Any]]] = None


class DashboardSummary(DashboardBase):
    """Summary model for dashboard list"""
    id: UUID
    widget_count: int = 0
    created_at: datetime
    updated_at: datetime
    created_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class Dashboard(DashboardBase):
    """Full dashboard model with all fields"""
    id: UUID
    organization_id: UUID
    layout: List[Dict[str, Any]] = Field(default_factory=list)
    widgets: List[DashboardWidget] = Field(default_factory=list)
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# SmartLead Sync Models
# ============================================================================

class SmartLeadCampaign(BaseModel):
    """Campaign data from SmartLead API"""
    id: str = Field(..., description="SmartLead campaign ID")
    name: str
    status: Optional[str] = None
    created_at: Optional[datetime] = None


class SmartLeadSyncRequest(BaseModel):
    """Request to sync campaigns from SmartLead"""
    campaign_ids: Optional[List[str]] = Field(default=None, description="Specific campaigns to sync, or all if None")
    force_refresh: bool = Field(default=False, description="Force refresh even if recently synced")


class SmartLeadSyncResult(BaseModel):
    """Result of SmartLead sync operation"""
    synced_count: int
    failed_count: int
    campaigns: List[CampaignData]
    errors: List[str] = Field(default_factory=list)
    synced_at: datetime


# ============================================================================
# API Response Models
# ============================================================================

class DashboardListResponse(BaseModel):
    """Response for dashboard list endpoint"""
    dashboards: List[DashboardSummary]
    total: int


class CampaignDataListResponse(BaseModel):
    """Response for campaign data list endpoint"""
    campaigns: List[CampaignData]
    total: int


class WidgetDataResponse(BaseModel):
    """Response for widget data fetch"""
    widget_id: UUID
    data: Any
    fetched_at: datetime
    cache_ttl: int = Field(default=300, description="Cache TTL in seconds")
