"""
API tests for quotes upload endpoints

Tests the /api/quotes/upload-excel and /api/quotes/parse-excel endpoints.
"""

import pytest
from pathlib import Path
from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock


# Create a simple mock for auth
class MockUser:
    id = "test-user-id"
    email = "test@example.com"
    role = "member"
    org_id = "test-org-id"
    current_organization_id = "test-org-id"


@pytest.fixture
def test_app():
    """Create a minimal test app with just the upload router"""
    from routes.quotes_upload import router
    from auth import get_current_user

    app = FastAPI()
    app.include_router(router)

    # Override auth
    app.dependency_overrides[get_current_user] = lambda: MockUser()

    return app


@pytest.fixture
def client(test_app):
    """Create test client"""
    with TestClient(test_app) as client:
        yield client


@pytest.fixture
def template_v5_path():
    """Path to the v5 template file"""
    return Path(__file__).parent.parent.parent.parent / "validation_data" / "template_quote_input_v5.xlsx"


@pytest.fixture
def template_file_bytes(template_v5_path):
    """Template file as bytes"""
    with open(template_v5_path, 'rb') as f:
        return f.read()


class TestUploadExcel:
    """Tests for POST /api/quotes/upload-excel"""

    def test_upload_valid_excel(self, client, template_v5_path):
        """Should successfully parse valid Excel file"""
        with open(template_v5_path, 'rb') as f:
            response = client.post(
                "/api/quotes/upload-excel",
                files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "quote_input" in data
        assert data["quote_input"] is not None

    def test_upload_returns_parsed_products(self, client, template_v5_path):
        """Should return parsed products"""
        with open(template_v5_path, 'rb') as f:
            response = client.post(
                "/api/quotes/upload-excel",
                files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )

        data = response.json()
        assert "products" in data["quote_input"]
        assert len(data["quote_input"]["products"]) > 0

    def test_upload_returns_payment_milestones(self, client, template_v5_path):
        """Should return payment milestones"""
        with open(template_v5_path, 'rb') as f:
            response = client.post(
                "/api/quotes/upload-excel",
                files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )

        data = response.json()
        assert "payment_milestones" in data["quote_input"]
        assert len(data["quote_input"]["payment_milestones"]) == 5

    def test_upload_rejects_invalid_file_type(self, client):
        """Should reject non-Excel files"""
        response = client.post(
            "/api/quotes/upload-excel",
            files={"file": ("doc.txt", b"not an excel file", "text/plain")}
        )

        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]

    def test_upload_rejects_pdf(self, client):
        """Should reject PDF files"""
        response = client.post(
            "/api/quotes/upload-excel",
            files={"file": ("doc.pdf", b"fake pdf content", "application/pdf")}
        )

        assert response.status_code == 400

    def test_upload_handles_corrupt_excel(self, client):
        """Should handle corrupt Excel files gracefully"""
        response = client.post(
            "/api/quotes/upload-excel",
            files={"file": ("corrupt.xlsx", b"corrupted data", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        )

        # Should return 500 for internal error
        assert response.status_code == 500


class TestParseExcel:
    """Tests for POST /api/quotes/parse-excel"""

    def test_parse_valid_excel(self, client, template_v5_path):
        """Should successfully parse valid Excel file"""
        with open(template_v5_path, 'rb') as f:
            response = client.post(
                "/api/quotes/parse-excel",
                files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "parsed_data" in data

    def test_parse_returns_quote_settings(self, client, template_v5_path):
        """Should return quote settings"""
        with open(template_v5_path, 'rb') as f:
            response = client.post(
                "/api/quotes/parse-excel",
                files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )

        data = response.json()
        parsed = data["parsed_data"]
        assert "seller_company" in parsed
        assert "sale_type" in parsed
        assert "incoterms" in parsed
        assert "quote_currency" in parsed

    def test_parse_returns_logistics(self, client, template_v5_path):
        """Should return logistics costs"""
        with open(template_v5_path, 'rb') as f:
            response = client.post(
                "/api/quotes/parse-excel",
                files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )

        data = response.json()
        parsed = data["parsed_data"]
        assert "logistics_supplier_hub" in parsed
        assert "logistics_hub_customs" in parsed
        assert "logistics_customs_client" in parsed

    def test_parse_returns_brokerage(self, client, template_v5_path):
        """Should return brokerage costs"""
        with open(template_v5_path, 'rb') as f:
            response = client.post(
                "/api/quotes/parse-excel",
                files={"file": ("quote.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
            )

        data = response.json()
        parsed = data["parsed_data"]
        assert "brokerage_hub" in parsed
        assert "brokerage_customs" in parsed
        assert "warehousing" in parsed
        assert "documentation" in parsed
        assert "other_costs" in parsed

    def test_parse_rejects_invalid_file_type(self, client):
        """Should reject non-Excel files"""
        response = client.post(
            "/api/quotes/parse-excel",
            files={"file": ("doc.csv", b"a,b,c\n1,2,3", "text/csv")}
        )

        assert response.status_code == 400
