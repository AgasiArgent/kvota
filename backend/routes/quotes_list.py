"""
Quotes List API - Dynamic list query with preset support

TASK-008: Quote List Constructor with Department Presets

This API provides a flexible list endpoint for quotes that:
- Accepts dynamic column selection based on presets
- Only fetches data from tables needed for requested columns
- Supports filtering, sorting, and pagination
- Returns data optimized for ag-Grid consumption
"""

from fastapi import APIRouter, HTTPException, Depends, Query, status
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
import os
import asyncpg

from auth import get_current_user, User
from services.list_query_builder import ListQueryBuilder, get_available_columns, validate_columns


router = APIRouter(prefix="/api/quotes-list", tags=["quotes-list"])


# =============================================================================
# Pydantic Models
# =============================================================================

class ListRequest(BaseModel):
    """Request model for list query"""
    columns: List[str] = Field(
        default=["quote_number", "customer_name", "total_with_vat_quote", "status", "created_at"],
        description="List of column keys to fetch"
    )
    filters: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Filter conditions as {column: value} or {column: {from, to, in, contains}}"
    )
    sort_model: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="Sort model as [{colId: string, sort: 'asc'|'desc'}]"
    )
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=50, ge=1, le=500, description="Rows per page")


class ListResponse(BaseModel):
    """Response model for list query"""
    rows: List[Dict[str, Any]]
    total: int
    page: int
    page_size: int
    total_pages: int


class ColumnsResponse(BaseModel):
    """Response model for available columns"""
    columns: Dict[str, Dict[str, str]]


# =============================================================================
# Helper Functions
# =============================================================================

async def get_db_connection():
    """Get a database connection"""
    return await asyncpg.connect(os.getenv("DATABASE_URL"))


def serialize_row(row: asyncpg.Record) -> Dict[str, Any]:
    """Convert a database row to a JSON-serializable dict"""
    result = {}
    for key, value in row.items():
        if value is None:
            result[key] = None
        elif hasattr(value, 'isoformat'):  # datetime, date
            result[key] = value.isoformat()
        elif isinstance(value, UUID):
            result[key] = str(value)
        else:
            result[key] = value
    return result


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/columns", response_model=ColumnsResponse)
async def get_columns(
    user: User = Depends(get_current_user)
) -> ColumnsResponse:
    """
    Get list of all available columns for the list constructor.

    Returns column keys with their types and source tables.
    Used by frontend to build column picker and validate presets.
    """
    return ColumnsResponse(columns=get_available_columns())


@router.post("/", response_model=ListResponse)
async def query_list(
    request: ListRequest,
    user: User = Depends(get_current_user)
) -> ListResponse:
    """
    Query quotes list with dynamic columns.

    This endpoint accepts:
    - columns: List of column keys to fetch
    - filters: Optional filter conditions
    - sort_model: Optional sort configuration
    - page/page_size: Pagination parameters

    Returns:
    - rows: List of quote data matching the query
    - total: Total number of matching quotes
    - page/page_size/total_pages: Pagination info
    """
    # Validate columns
    valid_columns = validate_columns(request.columns)
    if not valid_columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid columns specified"
        )

    # Build query
    builder = ListQueryBuilder(user.current_organization_id)
    builder.set_columns(valid_columns)

    if request.filters:
        builder.set_filters(request.filters)

    if request.sort_model:
        builder.set_sort(request.sort_model)

    builder.set_pagination(request.page, request.page_size)

    # Execute queries
    conn = await get_db_connection()
    try:
        # Get data
        data_query, data_params = builder.build_query()
        rows = await conn.fetch(data_query, *data_params)

        # Get total count
        count_query, count_params = builder.build_count_query()
        count_result = await conn.fetchrow(count_query, *count_params)
        total = count_result["total"] if count_result else 0

        # Serialize rows
        serialized_rows = [serialize_row(row) for row in rows]

        # Calculate pagination
        total_pages = (total + request.page_size - 1) // request.page_size if total > 0 else 1

        return ListResponse(
            rows=serialized_rows,
            total=total,
            page=request.page,
            page_size=request.page_size,
            total_pages=total_pages
        )

    except asyncpg.PostgresError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )
    finally:
        await conn.close()


@router.get("/", response_model=ListResponse)
async def query_list_get(
    columns: str = Query(
        default="quote_number,customer_name,total_with_vat_quote,status,created_at",
        description="Comma-separated list of column keys"
    ),
    filters: Optional[str] = Query(
        default=None,
        description="JSON-encoded filter conditions"
    ),
    sort: Optional[str] = Query(
        default=None,
        description="JSON-encoded sort model"
    ),
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=50, ge=1, le=500, description="Rows per page"),
    user: User = Depends(get_current_user)
) -> ListResponse:
    """
    Query quotes list with dynamic columns (GET method).

    Same as POST but with query parameters for simpler integration.
    Columns are comma-separated, filters and sort are JSON-encoded.
    """
    import json

    # Parse columns
    column_list = [c.strip() for c in columns.split(",") if c.strip()]

    # Parse filters
    filter_dict = None
    if filters:
        try:
            filter_dict = json.loads(filters)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filters JSON"
            )

    # Parse sort
    sort_model = None
    if sort:
        try:
            sort_model = json.loads(sort)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid sort JSON"
            )

    # Delegate to POST handler
    request = ListRequest(
        columns=column_list,
        filters=filter_dict,
        sort_model=sort_model,
        page=page,
        page_size=page_size
    )

    return await query_list(request, user)


@router.post("/export")
async def export_list(
    request: ListRequest,
    format: str = Query(default="csv", regex="^(csv|xlsx)$"),
    user: User = Depends(get_current_user)
):
    """
    Export quotes list to CSV or Excel.

    Same parameters as query endpoint, but returns file download.
    """
    from fastapi.responses import StreamingResponse
    import csv
    import io

    # Validate columns
    valid_columns = validate_columns(request.columns)
    if not valid_columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid columns specified"
        )

    # Build query (no pagination for export)
    builder = ListQueryBuilder(user.current_organization_id)
    builder.set_columns(valid_columns)

    if request.filters:
        builder.set_filters(request.filters)

    if request.sort_model:
        builder.set_sort(request.sort_model)

    # Set large page size for export (max 10000 rows)
    builder.set_pagination(1, 10000)

    # Execute query
    conn = await get_db_connection()
    try:
        data_query, data_params = builder.build_query()
        rows = await conn.fetch(data_query, *data_params)

        if format == "csv":
            # Generate CSV
            output = io.StringIO()
            writer = csv.writer(output)

            # Header
            writer.writerow(valid_columns)

            # Data rows
            for row in rows:
                writer.writerow([row.get(col) for col in valid_columns])

            output.seek(0)

            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={
                    "Content-Disposition": "attachment; filename=quotes_export.csv"
                }
            )

        else:
            # Excel export would require openpyxl
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="Excel export not yet implemented"
            )

    finally:
        await conn.close()


@router.get("/preset/{preset_id}", response_model=ListResponse)
async def query_with_preset(
    preset_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    filters: Optional[str] = Query(default=None),
    sort: Optional[str] = Query(default=None),
    user: User = Depends(get_current_user)
) -> ListResponse:
    """
    Query quotes list using a saved preset.

    Loads column configuration from the preset and executes query.
    Optional filters and sort can override preset defaults.
    """
    import json
    from supabase import create_client

    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # Load preset
    result = supabase.table("list_presets").select("*").eq("id", str(preset_id)).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Preset not found"
        )

    preset = result.data[0]

    # Check access (system presets are visible to all, org presets to org members)
    if preset["organization_id"] is not None:
        if str(preset["organization_id"]) != str(user.current_organization_id):
            # Check if personal preset belongs to user
            if preset["preset_type"] == "personal" and str(preset["created_by"]) != str(user.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this preset"
                )

    # Extract columns from preset
    columns_config = preset.get("columns", [])
    if isinstance(columns_config, str):
        columns_config = json.loads(columns_config)

    # Get visible column fields
    column_keys = []
    for col in columns_config:
        if isinstance(col, dict):
            if not col.get("hide", False):
                column_keys.append(col.get("field"))
        elif isinstance(col, str):
            column_keys.append(col)

    if not column_keys:
        column_keys = ["quote_number", "customer_name", "total_with_vat_quote", "status"]

    # Parse filters
    filter_dict = None
    if filters:
        try:
            filter_dict = json.loads(filters)
        except json.JSONDecodeError:
            filter_dict = None

    # Use preset filters if no override
    if not filter_dict and preset.get("filters"):
        filter_dict = preset["filters"]
        if isinstance(filter_dict, str):
            filter_dict = json.loads(filter_dict)

    # Parse sort
    sort_model = None
    if sort:
        try:
            sort_model = json.loads(sort)
        except json.JSONDecodeError:
            sort_model = None

    # Use preset sort if no override
    if not sort_model and preset.get("sort_model"):
        sort_model = preset["sort_model"]
        if isinstance(sort_model, str):
            sort_model = json.loads(sort_model)

    # Build request
    request = ListRequest(
        columns=column_keys,
        filters=filter_dict,
        sort_model=sort_model,
        page=page,
        page_size=page_size
    )

    return await query_list(request, user)
