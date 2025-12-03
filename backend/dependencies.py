"""
FastAPI Dependencies for Supabase Client

Provides dependency injection for the singleton Supabase client initialized
in FastAPI's lifespan. This pattern avoids creating new HTTP connections
per request, significantly improving performance.

Usage in route files:
    from dependencies import get_supabase
    from supabase import Client
    from fastapi import Depends

    @router.get("/endpoint")
    async def endpoint(supabase: Client = Depends(get_supabase)):
        result = supabase.table("...").select("*").execute()
        return result.data
"""

from fastapi import Request
from supabase import Client


def get_supabase(request: Request) -> Client:
    """
    Get the singleton Supabase client from app.state.

    This client is initialized in FastAPI's lifespan (main.py) and reuses
    HTTP connections across all requests, avoiding the overhead of creating
    new TLS connections for each request.

    Args:
        request: FastAPI Request object (injected automatically)

    Returns:
        Supabase client instance with SERVICE_ROLE_KEY (bypasses RLS)

    Note:
        Since this client bypasses RLS, routes must manually filter
        by organization_id to maintain multi-tenant data isolation.
    """
    return request.app.state.supabase
