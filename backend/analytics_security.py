"""
Analytics Query Security Module

Prevents SQL injection and validates all user inputs for analytics queries.
"""

from typing import List, Dict, Any, Tuple
from uuid import UUID
import re


class QuerySecurityValidator:
    """Validate and sanitize analytics queries"""

    # Whitelist of allowed fields
    ALLOWED_FIELDS = {
        'quotes': [
            'id', 'quote_number', 'status', 'sale_type', 'seller_company',
            'created_at', 'updated_at', 'total_amount', 'quote_date',
            'customer_id', 'organization_id'
        ],
        'calculated': [
            'import_vat', 'export_vat', 'customs_duty', 'excise_tax',
            'logistics_cost', 'cogs', 'profit', 'margin_percent'
        ]
    }

    # SQL injection patterns to reject
    FORBIDDEN_PATTERNS = [
        r'(DROP|ALTER|CREATE|TRUNCATE|DELETE|INSERT|UPDATE)\s+',
        r'(SELECT\s+.*\s+FROM\s+auth\.)',  # No auth table access
        r'(pg_|information_schema)',  # No system tables
        r'(\\x[0-9a-fA-F]+)',  # No hex injection
        r'(UNION\s+ALL|UNION\s+SELECT)',  # No UNION attacks
    ]

    @classmethod
    def validate_fields(cls, fields: List[str]) -> List[str]:
        """Return only whitelisted fields"""
        all_allowed = cls.ALLOWED_FIELDS['quotes'] + cls.ALLOWED_FIELDS['calculated']
        return [f for f in fields if f in all_allowed]

    @classmethod
    def is_safe_value(cls, value: Any) -> bool:
        """Check if value is safe for queries"""
        if value is None:
            return True

        str_value = str(value)

        # Check forbidden patterns
        for pattern in cls.FORBIDDEN_PATTERNS:
            if re.search(pattern, str_value, re.IGNORECASE):
                return False

        # Limit length
        if len(str_value) > 1000:
            return False

        return True

    @classmethod
    def sanitize_filters(cls, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize filter values"""
        safe_filters = {}

        for key, value in filters.items():
            # Validate key
            if key not in cls.ALLOWED_FIELDS['quotes']:
                continue

            # Validate value(s)
            if isinstance(value, list):
                safe_values = [v for v in value if cls.is_safe_value(v)]
                if safe_values:
                    safe_filters[key] = safe_values
            elif cls.is_safe_value(value):
                safe_filters[key] = value

        return safe_filters


def build_analytics_query(
    organization_id: UUID,
    filters: Dict[str, Any],
    selected_fields: List[str],
    limit: int = 1000,
    offset: int = 0
) -> Tuple[str, List[Any]]:
    """
    Build parameterized query with SQL injection protection.

    Returns: (sql_query, parameters)
    """
    # Validate and sanitize inputs
    validated_fields = QuerySecurityValidator.validate_fields(selected_fields)
    safe_filters = QuerySecurityValidator.sanitize_filters(filters)

    if not validated_fields:
        validated_fields = ['id', 'quote_number', 'total_amount']

    # Build parameterized query
    params = []
    where_clauses = ["organization_id = $1"]
    params.append(str(organization_id))

    # Add filters with parameterization
    param_count = 2
    for key, value in safe_filters.items():
        if isinstance(value, list):
            placeholders = [f"${i}" for i in range(param_count, param_count + len(value))]
            where_clauses.append(f"{key} = ANY(ARRAY[{','.join(placeholders)}])")
            params.extend(value)
            param_count += len(value)
        else:
            where_clauses.append(f"{key} = ${param_count}")
            params.append(value)
            param_count += 1

    sql = f"""
        SELECT {', '.join(validated_fields)}
        FROM quotes
        WHERE {' AND '.join(where_clauses)}
        ORDER BY created_at DESC
        LIMIT ${param_count} OFFSET ${param_count + 1}
    """
    params.extend([limit, offset])

    return sql, params


def build_aggregation_query(
    organization_id: UUID,
    filters: Dict[str, Any],
    aggregations: Dict[str, Dict[str, str]]
) -> Tuple[str, List[Any]]:
    """
    Build aggregation query with parameterized filters.

    aggregations format:
    {
        "import_vat": {"function": "sum", "label": "Total VAT"},
        "quote_count": {"function": "count", "label": "Number of Quotes"}
    }

    Returns: (sql_query, parameters)
    """
    safe_filters = QuerySecurityValidator.sanitize_filters(filters)

    # Build aggregation clauses
    agg_clauses = []
    all_allowed_fields = QuerySecurityValidator.ALLOWED_FIELDS['quotes'] + QuerySecurityValidator.ALLOWED_FIELDS['calculated']

    for field, config in aggregations.items():
        func = config.get('function', 'sum').upper()
        if func not in ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX']:
            continue

        if func == 'COUNT':
            agg_clauses.append(f"COUNT(*) as {field}")
        elif field in all_allowed_fields:
            agg_clauses.append(f"{func}({field}) as {field}")

    if not agg_clauses:
        agg_clauses = ["COUNT(*) as quote_count"]

    # Build WHERE clause
    params = [str(organization_id)]
    where_clauses = ["organization_id = $1"]

    param_count = 2
    for key, value in safe_filters.items():
        if isinstance(value, list):
            placeholders = [f"${i}" for i in range(param_count, param_count + len(value))]
            where_clauses.append(f"{key} = ANY(ARRAY[{','.join(placeholders)}])")
            params.extend(value)
            param_count += len(value)
        else:
            where_clauses.append(f"{key} = ${param_count}")
            params.append(value)
            param_count += 1

    sql = f"""
        SELECT {', '.join(agg_clauses)}
        FROM quotes
        WHERE {' AND '.join(where_clauses)}
    """

    return sql, params
