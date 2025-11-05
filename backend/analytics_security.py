"""
Analytics Query Security Module

Prevents SQL injection and validates all user inputs for analytics queries.
"""

from typing import List, Dict, Any, Tuple
from uuid import UUID
import re
import logging

logger = logging.getLogger(__name__)


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

    # Whitelist of allowed alias names (for aggregations)
    ALLOWED_ALIAS_NAMES = {
        'quote_count', 'total_import_vat', 'avg_import_vat', 'sum_import_vat',
        'total_export_vat', 'avg_export_vat', 'sum_export_vat',
        'total_customs_duty', 'avg_customs_duty', 'sum_customs_duty',
        'total_excise_tax', 'avg_excise_tax', 'sum_excise_tax',
        'total_logistics_cost', 'avg_logistics_cost', 'sum_logistics_cost',
        'total_cogs', 'avg_cogs', 'sum_cogs',
        'total_profit', 'avg_profit', 'sum_profit', 'min_profit', 'max_profit',
        'total_amount', 'avg_total_amount', 'sum_total_amount', 'min_total_amount', 'max_total_amount',
        'avg_margin_percent', 'min_margin_percent', 'max_margin_percent'
    }

    # Map analytics field names to JSONB keys in quote_calculation_results.phase_results
    CALCULATION_FIELD_MAP = {
        'customs_duty': 'customs_fee',
        'excise_tax': 'excise_tax_amount',
        'logistics_cost': 'logistics_total',
        'cogs': 'cogs_per_product',
        'profit': 'profit',
        # Calculated from other fields:
        'export_vat': None,  # sales_price_total_with_vat - sales_price_total_no_vat
        'import_vat': None,  # Not stored directly - need to research or calculate
        'margin_percent': None  # (profit / sales_price_total_no_vat) * 100
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
    Build parameterized query with JOIN to quote_calculation_results.

    Returns: (sql_query, parameters)
    """
    # Validate and sanitize inputs
    validated_fields = QuerySecurityValidator.validate_fields(selected_fields)
    safe_filters = QuerySecurityValidator.sanitize_filters(filters)

    if not validated_fields:
        validated_fields = ['quote_number', 'status', 'total_amount']

    # Separate quote fields vs calculated fields
    quote_fields = []
    calc_fields = []

    for field in validated_fields:
        if field in QuerySecurityValidator.ALLOWED_FIELDS['quotes']:
            quote_fields.append(f'q.{field}')
        elif field in QuerySecurityValidator.ALLOWED_FIELDS['calculated']:
            calc_fields.append(field)

    # Build SELECT clause
    select_clauses = []

    # Quote-level fields (no aggregation needed)
    if quote_fields:
        select_clauses.extend(quote_fields)

    # Calculated fields (aggregate from products)
    for field in calc_fields:
        jsonb_key = QuerySecurityValidator.CALCULATION_FIELD_MAP.get(field)

        if jsonb_key:
            # Direct JSONB extraction with SUM
            select_clauses.append(
                f"COALESCE(SUM((qcr.phase_results->>'{jsonb_key}')::numeric), 0) as {field}"
            )
        elif field == 'export_vat':
            # Calculate from two JSONB fields
            select_clauses.append(
                "COALESCE(SUM((qcr.phase_results->>'sales_price_total_with_vat')::numeric - "
                "(qcr.phase_results->>'sales_price_total_no_vat')::numeric), 0) as export_vat"
            )
        elif field == 'margin_percent':
            # Calculate percentage (average across products)
            select_clauses.append(
                "COALESCE(AVG(CASE WHEN (qcr.phase_results->>'sales_price_total_no_vat')::numeric > 0 "
                "THEN ((qcr.phase_results->>'profit')::numeric / "
                "(qcr.phase_results->>'sales_price_total_no_vat')::numeric) * 100 "
                "ELSE 0 END), 0) as margin_percent"
            )
        elif field == 'import_vat':
            # TODO: Research how import_vat is calculated/stored
            # For now, return 0 as placeholder
            select_clauses.append("0 as import_vat")

    # Build WHERE clause with parameterized filters
    params = []
    where_clauses = ["q.organization_id = $1"]
    params.append(str(organization_id))

    param_count = 2

    # Date range filters (special handling)
    if 'created_at_from' in safe_filters:
        where_clauses.append(f"q.created_at >= ${param_count}::timestamp")
        params.append(safe_filters['created_at_from'])
        param_count += 1

    if 'created_at_to' in safe_filters:
        where_clauses.append(f"q.created_at <= ${param_count}::timestamp + interval '1 day'")
        params.append(safe_filters['created_at_to'])
        param_count += 1

    if 'quote_date_from' in safe_filters:
        where_clauses.append(f"q.quote_date >= ${param_count}::date")
        params.append(safe_filters['quote_date_from'])
        param_count += 1

    if 'quote_date_to' in safe_filters:
        where_clauses.append(f"q.quote_date <= ${param_count}::date")
        params.append(safe_filters['quote_date_to'])
        param_count += 1

    # Other filters
    for key, value in safe_filters.items():
        # Skip date range keys (already handled above)
        if key in ['created_at_from', 'created_at_to', 'quote_date_from', 'quote_date_to']:
            continue
        if key in QuerySecurityValidator.ALLOWED_FIELDS['quotes']:
            # Quote-level filter
            if isinstance(value, list):
                placeholders = [f"${i}" for i in range(param_count, param_count + len(value))]
                where_clauses.append(f"q.{key} = ANY(ARRAY[{','.join(placeholders)}])")
                params.extend(value)
                param_count += len(value)
            else:
                where_clauses.append(f"q.{key} = ${param_count}")
                params.append(value)
                param_count += 1

    # Build GROUP BY (needed because of aggregations)
    group_by_fields = quote_fields.copy() if quote_fields else []

    # When using JOIN (calculated fields), ALWAYS need q.id and q.created_at in GROUP BY
    # (for ORDER BY and uniqueness)
    if calc_fields:
        # Ensure q.id is first
        if 'q.id' not in group_by_fields:
            group_by_fields.insert(0, 'q.id')

        # Ensure q.created_at is included (for ORDER BY)
        if 'q.created_at' not in group_by_fields:
            group_by_fields.append('q.created_at')

        # Also ensure created_at is in SELECT if not already
        if 'q.created_at' not in select_clauses:
            select_clauses.append('q.created_at')

    # Build SQL with JOIN
    if calc_fields:
        # Need JOIN when calculated fields requested
        sql = f"""
            SELECT {', '.join(select_clauses)}
            FROM quotes q
            LEFT JOIN quote_items qi ON qi.quote_id = q.id
            LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
            WHERE {' AND '.join(where_clauses)}
            GROUP BY {", ".join(group_by_fields)}
            ORDER BY q.created_at DESC
            LIMIT ${param_count} OFFSET ${param_count + 1}
        """
    else:
        # No calculated fields - simple query without JOIN
        sql = f"""
            SELECT {', '.join([f.replace('q.', '') for f in select_clauses])}
            FROM quotes q
            WHERE {' AND '.join(where_clauses)}
            ORDER BY q.created_at DESC
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
    Build aggregation query with JOIN to quote_calculation_results.

    aggregations format:
    {
        "total_import_vat": {"function": "sum", "label": "Total VAT"},
        "quote_count": {"function": "count", "label": "Number of Quotes"}
    }

    Returns: (sql_query, parameters)
    """
    safe_filters = QuerySecurityValidator.sanitize_filters(filters)

    # Build aggregation clauses
    agg_clauses = []
    all_allowed_fields = QuerySecurityValidator.ALLOWED_FIELDS['quotes'] + QuerySecurityValidator.ALLOWED_FIELDS['calculated']
    needs_join = False  # Track if we need JOIN for calculated fields

    for field, config in aggregations.items():
        # Validate alias name
        if field not in QuerySecurityValidator.ALLOWED_ALIAS_NAMES:
            logger.warning(f"Rejected aggregation with invalid alias: {field}")
            continue

        func = config.get('function', 'sum').upper()
        if func not in ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX']:
            continue

        if func == 'COUNT':
            agg_clauses.append(f"COUNT(DISTINCT q.id) as {field}")
        else:
            # Get the column name from config or derive from alias
            col_name = config.get('field')

            if not col_name:
                # Extract actual column name from alias
                # Remove prefixes: total_, avg_, sum_, min_, max_
                col_name = field
                for prefix in ['total_', 'avg_', 'sum_', 'min_', 'max_']:
                    if col_name.startswith(prefix):
                        col_name = col_name[len(prefix):]
                        break

            # Validate column name
            if col_name not in all_allowed_fields:
                logger.warning(f"Rejected aggregation with invalid column: {col_name}")
                continue

            # Check if it's a calculated field
            if col_name in QuerySecurityValidator.ALLOWED_FIELDS['calculated']:
                needs_join = True
                jsonb_key = QuerySecurityValidator.CALCULATION_FIELD_MAP.get(col_name)

                if jsonb_key:
                    # Direct JSONB extraction
                    agg_clauses.append(
                        f"COALESCE({func}((qcr.phase_results->>'{jsonb_key}')::numeric), 0) as {field}"
                    )
                elif col_name == 'export_vat':
                    # Calculate from two JSONB fields
                    agg_clauses.append(
                        f"COALESCE({func}((qcr.phase_results->>'sales_price_total_with_vat')::numeric - "
                        f"(qcr.phase_results->>'sales_price_total_no_vat')::numeric), 0) as {field}"
                    )
                elif col_name == 'margin_percent':
                    # Calculate percentage
                    if func == 'AVG':
                        agg_clauses.append(
                            "COALESCE(AVG(CASE WHEN (qcr.phase_results->>'sales_price_total_no_vat')::numeric > 0 "
                            "THEN ((qcr.phase_results->>'profit')::numeric / "
                            "(qcr.phase_results->>'sales_price_total_no_vat')::numeric) * 100 "
                            "ELSE 0 END), 0) as " + field
                        )
                    else:
                        # MIN/MAX of margin_percent
                        agg_clauses.append(
                            f"COALESCE({func}(CASE WHEN (qcr.phase_results->>'sales_price_total_no_vat')::numeric > 0 "
                            "THEN ((qcr.phase_results->>'profit')::numeric / "
                            "(qcr.phase_results->>'sales_price_total_no_vat')::numeric) * 100 "
                            "ELSE 0 END), 0) as " + field
                        )
                elif col_name == 'import_vat':
                    # TODO: Research how import_vat is calculated
                    agg_clauses.append(f"0 as {field}")
            else:
                # Quote-level field
                agg_clauses.append(f"COALESCE({func}(q.{col_name}), 0) as {field}")

    if not agg_clauses:
        agg_clauses = ["COUNT(DISTINCT q.id) as quote_count"]

    # Build WHERE clause
    params = [str(organization_id)]
    where_clauses = ["q.organization_id = $1"]

    param_count = 2
    for key, value in safe_filters.items():
        if isinstance(value, list):
            placeholders = [f"${i}" for i in range(param_count, param_count + len(value))]
            where_clauses.append(f"q.{key} = ANY(ARRAY[{','.join(placeholders)}])")
            params.extend(value)
            param_count += len(value)
        else:
            where_clauses.append(f"q.{key} = ${param_count}")
            params.append(value)
            param_count += 1

    # Build SQL with or without JOIN
    if needs_join:
        sql = f"""
            SELECT {', '.join(agg_clauses)}
            FROM quotes q
            LEFT JOIN quote_items qi ON qi.quote_id = q.id
            LEFT JOIN quote_calculation_results qcr ON qcr.quote_item_id = qi.id
            WHERE {' AND '.join(where_clauses)}
        """
    else:
        sql = f"""
            SELECT {', '.join(agg_clauses)}
            FROM quotes q
            WHERE {' AND '.join(where_clauses)}
        """

    return sql, params
