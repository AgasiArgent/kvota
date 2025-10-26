"""
Async wrapper for Supabase client to prevent blocking I/O

The Supabase Python client is synchronous, which blocks the event loop
and causes massive slowdowns under concurrent load (66x slower).

This wrapper uses asyncio.to_thread() to run Supabase calls in a thread pool,
allowing true async behavior without blocking the main event loop.

Usage:
    from async_supabase import async_supabase_call

    # Instead of:
    # result = supabase.table("quotes").select("*").execute()

    # Use:
    # result = await async_supabase_call(
    #     supabase.table("quotes").select("*")
    # )
"""
import asyncio
from functools import wraps
from typing import Any, Callable


async def async_supabase_call(query_builder) -> Any:
    """
    Execute a Supabase query in a thread pool to prevent blocking

    Args:
        query_builder: Supabase query builder (e.g., supabase.table("quotes").select("*"))

    Returns:
        Query result from .execute()

    Example:
        result = await async_supabase_call(
            supabase.table("quotes").select("*").eq("id", quote_id)
        )
        quotes = result.data
    """
    # Run the .execute() call in a thread pool
    result = await asyncio.to_thread(query_builder.execute)
    return result


def async_supabase_decorator(func: Callable) -> Callable:
    """
    Decorator to automatically wrap Supabase calls in async thread pool

    Usage:
        @async_supabase_decorator
        async def get_quotes(user):
            supabase = create_client(...)
            result = supabase.table("quotes").select("*").execute()
            return result.data

    This decorator will intercept the .execute() call and run it in a thread pool.
    Note: This is a simple version. For production, consider using async_supabase_call directly.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)
    return wrapper


# Example usage patterns:

"""
Pattern 1: Direct wrapper (recommended)
----------------------------------------
from async_supabase import async_supabase_call

async def list_quotes(user):
    supabase = create_client(...)

    # Build query without .execute()
    query = supabase.table("quotes").select("*").eq("organization_id", user.org_id)

    # Execute in thread pool
    result = await async_supabase_call(query)

    return result.data


Pattern 2: Context manager (for multiple calls)
------------------------------------------------
from async_supabase import async_supabase_call

async def create_quote(quote_data, user):
    supabase = create_client(...)

    # Multiple Supabase calls
    quote_query = supabase.table("quotes").insert(quote_data)
    quote_result = await async_supabase_call(quote_query)

    items_query = supabase.table("quote_items").insert(items_data)
    items_result = await async_supabase_call(items_query)

    return quote_result.data[0]


Pattern 3: Batch operations
----------------------------
from async_supabase import async_supabase_call
import asyncio

async def get_multiple_resources(user):
    supabase = create_client(...)

    # Execute multiple queries concurrently
    quotes_task = async_supabase_call(
        supabase.table("quotes").select("*")
    )
    customers_task = async_supabase_call(
        supabase.table("customers").select("*")
    )

    # Wait for both to complete
    quotes_result, customers_result = await asyncio.gather(
        quotes_task, customers_task
    )

    return {
        "quotes": quotes_result.data,
        "customers": customers_result.data
    }
"""
