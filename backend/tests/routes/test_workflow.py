import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_transition_endpoint_exists():
    """Test that transition endpoint exists and responds"""
    # This test doesn't require auth - just checking endpoint exists
    response = client.post(
        "/api/quotes/test-id/transition",
        json={"action": "submit_procurement"}
    )

    # Should get 400 (validation error), 401 (unauthorized), or 422 (validation)
    # Should NOT get 404 (endpoint not found)
    assert response.status_code in [400, 401, 422]
    assert response.status_code != 404  # Endpoint exists


def test_workflow_router_imported():
    """Test that workflow router can be imported"""
    try:
        from routes import workflow
        assert hasattr(workflow, 'router')
    except ImportError:
        pytest.fail("workflow module not found")
