import pytest
from models import (
    SavedReportCreate, SavedReportUpdate, SavedReport,
    AnalyticsQueryRequest, AnalyticsQueryResponse
)
from pydantic import ValidationError


def test_saved_report_create_validates_required_fields():
    """Test that SavedReportCreate requires name and selected_fields"""
    with pytest.raises(ValidationError):
        SavedReportCreate(filters={})


def test_saved_report_create_accepts_valid_data():
    """Test that SavedReportCreate accepts valid data"""
    report = SavedReportCreate(
        name="Monthly VAT Report",
        description="Sum VAT for approved quotes",
        filters={'status': ['approved']},
        selected_fields=['quote_number', 'import_vat', 'total_amount'],
        aggregations={'import_vat': {'function': 'sum', 'label': 'Total VAT'}},
        visibility='shared'
    )
    assert report.name == "Monthly VAT Report"
    assert report.visibility == 'shared'


def test_analytics_query_request_requires_filters():
    """Test that AnalyticsQueryRequest requires filters"""
    with pytest.raises(ValidationError):
        AnalyticsQueryRequest(selected_fields=['quote_number'])


def test_analytics_query_request_defaults():
    """Test AnalyticsQueryRequest default values"""
    request = AnalyticsQueryRequest(
        filters={'status': 'approved'},
        selected_fields=['quote_number']
    )
    assert request.limit == 1000
    assert request.offset == 0


def test_saved_report_update_optional_fields():
    """Test that SavedReportUpdate has all optional fields"""
    # Should work with empty dict
    update = SavedReportUpdate()
    assert update.name is None
    assert update.description is None

    # Should work with partial update
    update = SavedReportUpdate(name="Updated Name")
    assert update.name == "Updated Name"
    assert update.description is None
