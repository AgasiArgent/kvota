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


def test_saved_report_rejects_too_long_description():
    """Test that description is limited to 5000 characters"""
    with pytest.raises(ValidationError):
        SavedReportCreate(
            name="Test",
            description="A" * 6000,  # Exceeds 5000
            selected_fields=["id"]
        )


def test_saved_report_rejects_too_many_fields():
    """Test that selected_fields is limited to 50 items"""
    with pytest.raises(ValidationError):
        SavedReportCreate(
            name="Test",
            selected_fields=["field" + str(i) for i in range(100)]  # Exceeds 50
        )


def test_scheduled_report_rejects_too_long_email_body():
    """Test that email_body is limited to 10000 characters"""
    from models import ScheduledReportCreate
    from uuid import uuid4
    with pytest.raises(ValidationError):
        ScheduledReportCreate(
            saved_report_id=uuid4(),
            name="Test",
            schedule_cron="0 9 * * 1",
            email_recipients=["test@example.com"],
            email_body="B" * 11000  # Exceeds 10000
        )


def test_scheduled_report_rejects_too_many_recipients():
    """Test that email_recipients is limited to 20"""
    from models import ScheduledReportCreate
    from uuid import uuid4
    with pytest.raises(ValidationError):
        ScheduledReportCreate(
            saved_report_id=uuid4(),
            name="Test",
            schedule_cron="0 9 * * 1",
            email_recipients=[f"test{i}@example.com" for i in range(30)]  # Exceeds 20
        )
