"""
Dashboard Statistics API - Business Intelligence Dashboard
Provides aggregated statistics for quotes, revenue, and recent activity
"""
from typing import List, Dict
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from collections import OrderedDict
import time
import os

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel

from auth import get_current_user, User
from dependencies import get_supabase
from supabase import Client

# ============================================================================
# ROUTER SETUP
# ============================================================================

router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"],
    dependencies=[Depends(get_current_user)]
)

# ============================================================================
# RESPONSE MODELS
# ============================================================================

class RecentQuote(BaseModel):
    id: str
    quote_number: str
    customer_name: str
    total_amount: str
    status: str
    created_at: str

class DashboardStats(BaseModel):
    total_quotes: int
    draft_quotes: int
    sent_quotes: int
    accepted_quotes: int
    revenue_this_month: str
    revenue_last_month: str
    revenue_trend: float
    recent_quotes: List[RecentQuote]

# ============================================================================
# IN-MEMORY CACHE WITH SIZE LIMIT
# ============================================================================

# LRU cache to prevent unbounded memory growth
# Max 100 organizations cached (typical deployment: 10-50 orgs)
MAX_CACHE_SIZE = 100
dashboard_cache: OrderedDict = OrderedDict()

def get_supabase_client(supabase: Client):
    """Pass-through for supabase client"""
    return supabase

# ============================================================================
# STATISTICS CALCULATION
# ============================================================================

def calculate_stats(organization_id: str, supabase: Client) -> DashboardStats:
    """
    Calculate dashboard statistics from database

    Aggregates:
    - Quote counts by status
    - Revenue this month vs last month
    - Recent quotes (top 5)
    """

    # Get current date for month calculations
    now = datetime.now()
    this_month_start = date(now.year, now.month, 1)

    # Calculate last month
    if now.month == 1:
        last_month_start = date(now.year - 1, 12, 1)
        last_month_end = date(now.year, 1, 1)
    else:
        last_month_start = date(now.year, now.month - 1, 1)
        last_month_end = this_month_start

    # Get all quotes (excluding soft-deleted)
    quotes_result = supabase.table("quotes").select(
        "id, status, total_amount, created_at"
    ).eq("organization_id", organization_id).is_("deleted_at", "null").execute()

    all_quotes = quotes_result.data if quotes_result.data else []

    # Count by status
    total_quotes = len(all_quotes)
    draft_quotes = len([q for q in all_quotes if q['status'] == 'draft'])
    sent_quotes = len([q for q in all_quotes if q['status'] == 'sent'])
    accepted_quotes = len([q for q in all_quotes if q['status'] == 'accepted'])

    # Calculate revenue (sum of accepted quotes)
    revenue_this_month = Decimal("0")
    revenue_last_month = Decimal("0")

    for quote in all_quotes:
        if quote['status'] == 'accepted':
            quote_date = datetime.fromisoformat(quote['created_at'].replace('Z', '+00:00')).date()
            quote_amount = Decimal(str(quote['total_amount']))

            if quote_date >= this_month_start:
                revenue_this_month += quote_amount
            elif last_month_start <= quote_date < last_month_end:
                revenue_last_month += quote_amount

    # Calculate trend
    if revenue_last_month > 0:
        revenue_trend = float((revenue_this_month - revenue_last_month) / revenue_last_month * 100)
    else:
        revenue_trend = 100.0 if revenue_this_month > 0 else 0.0

    # Get recent quotes (top 5 with customer info)
    recent_result = supabase.table("quotes").select(
        "id, quote_number, total_amount, status, created_at, customers(name)"
    ).eq("organization_id", organization_id).is_("deleted_at", "null").order(
        "created_at", desc=True
    ).limit(5).execute()

    recent_quotes_data = recent_result.data if recent_result.data else []

    recent_quotes = [
        RecentQuote(
            id=str(q['id']),
            quote_number=q['quote_number'],
            customer_name=q['customers']['name'] if q.get('customers') and isinstance(q['customers'], dict) else "Unknown",
            total_amount=str(q['total_amount']),
            status=q['status'],
            created_at=q['created_at']
        )
        for q in recent_quotes_data
    ]

    return DashboardStats(
        total_quotes=total_quotes,
        draft_quotes=draft_quotes,
        sent_quotes=sent_quotes,
        accepted_quotes=accepted_quotes,
        revenue_this_month=str(revenue_this_month),
        revenue_last_month=str(revenue_last_month),
        revenue_trend=round(revenue_trend, 1),
        recent_quotes=recent_quotes
    )

# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(user: User = Depends(get_current_user),
    supabase: Client = Depends(get_supabase)):
    """
    Get dashboard statistics

    Returns:
    - Total quotes count
    - Quotes by status (draft, sent, accepted)
    - Revenue this month vs last month
    - Revenue trend percentage
    - Recent quotes (top 5)

    Cache: 5 minutes TTL
    """
    organization_id = str(user.current_organization_id)
    cache_key = f"dashboard_{organization_id}"

    # Check cache
    cached = dashboard_cache.get(cache_key)
    if cached and (time.time() - cached['timestamp']) < 300:  # 5 min = 300 sec
        # Move to end (mark as recently used)
        dashboard_cache.move_to_end(cache_key)
        return cached['data']

    # Calculate fresh stats
    try:
        stats = calculate_stats(organization_id, supabase)

        # Evict oldest entry if cache is full
        if len(dashboard_cache) >= MAX_CACHE_SIZE:
            dashboard_cache.popitem(last=False)  # Remove oldest (FIFO)

        # Update cache
        dashboard_cache[cache_key] = {
            'data': stats,
            'timestamp': time.time()
        }

        return stats

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard statistics: {str(e)}"
        )
