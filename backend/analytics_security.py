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
            'id', 'idn_quote', 'status', 'created_at', 'updated_at',
            'total_amount', 'quote_date', 'customer_id', 'organization_id'
        ],
        'variables': [
            # Fields from quote_calculation_variables.variables JSONB
            'offer_sale_type', 'seller_company', 'currency_of_quote',
            'markup', 'discount'
        ],
        'quote_calculation_summaries': [
            # Pre-aggregated quote-level totals (all 45 calculated fields)
            # Phase 1-2: Purchase prices
            'calc_n16_price_without_vat', 'calc_p16_after_supplier_discount',
            'calc_r16_per_unit_quote_currency', 'calc_s16_total_purchase_price',
            'calc_s13_sum_purchase_prices',
            # Phase 3: Logistics
            'calc_t16_first_leg_logistics', 'calc_u16_last_leg_logistics', 'calc_v16_total_logistics',
            # Brokerage (custom calculated fields)
            'calc_total_brokerage', 'calc_total_logistics_and_brokerage',
            # Phase 4: Duties and internal pricing
            'calc_ax16_internal_price_unit', 'calc_ay16_internal_price_total',
            'calc_y16_customs_duty', 'calc_z16_excise_tax', 'calc_az16_with_vat_restored',
            # Phase 5-8: Financing
            'calc_bh6_supplier_payment', 'calc_bh4_before_forwarding', 'calc_bh2_revenue_estimated',
            'calc_bh3_client_advance', 'calc_bh7_supplier_financing_need', 'calc_bj7_supplier_financing_cost',
            'calc_bh10_operational_financing', 'calc_bj10_operational_cost', 'calc_bj11_total_financing_cost',
            'calc_bl3_credit_sales_amount', 'calc_bl4_credit_sales_with_interest', 'calc_bl5_credit_sales_interest',
            # Phase 9: Financing distribution
            'calc_ba16_financing_per_product', 'calc_bb16_credit_interest_per_product',
            # Phase 10: COGS
            'calc_aa16_cogs_per_unit', 'calc_ab16_cogs_total',
            # Phase 11: Sales pricing
            'calc_af16_profit_margin', 'calc_ag16_dm_fee', 'calc_ah16_forex_risk_reserve',
            'calc_ai16_agent_fee', 'calc_ad16_sale_price_unit', 'calc_ae16_sale_price_total',
            'calc_aj16_final_price_unit', 'calc_ak16_final_price_total',
            # Phase 12: VAT
            'calc_am16_price_with_vat', 'calc_al16_total_with_vat', 'calc_an16_sales_vat',
            'calc_ao16_deductible_vat', 'calc_ap16_net_vat_payable',
            # Phase 13: Transit commission
            'calc_aq16_transit_commission'
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

    @classmethod
    def is_valid_custom_alias(cls, alias: str) -> bool:
        """Check if custom aggregation alias is valid (starts with agg_ and alphanumeric)"""
        if alias.startswith('agg_') and len(alias) > 4:
            # Check that part after 'agg_' is alphanumeric
            suffix = alias[4:]
            return suffix.replace('_', '').isalnum()
        return False

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
        all_allowed = (cls.ALLOWED_FIELDS['quotes'] +
                      cls.ALLOWED_FIELDS['variables'] +
                      cls.ALLOWED_FIELDS['quote_calculation_summaries'])
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

        # Allowed filter keys (including special date range keys)
        allowed_filter_keys = (cls.ALLOWED_FIELDS['quotes'] +
                              cls.ALLOWED_FIELDS['variables'] + [
            'created_at_from', 'created_at_to',
            'quote_date_from', 'quote_date_to'
        ])

        for key, value in filters.items():
            # Validate key
            if key not in allowed_filter_keys:
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
        validated_fields = ['idn_quote', 'status', 'total_amount']

    # Separate quote fields vs variable fields vs summary fields
    quote_fields = []
    variable_fields = []
    summary_fields = []

    for field in validated_fields:
        if field in QuerySecurityValidator.ALLOWED_FIELDS['quotes']:
            quote_fields.append(f'q.{field}')
        elif field in QuerySecurityValidator.ALLOWED_FIELDS['variables']:
            variable_fields.append(field)
        elif field in QuerySecurityValidator.ALLOWED_FIELDS['quote_calculation_summaries']:
            summary_fields.append(field)

    # Build SELECT clause
    select_clauses = []

    # Quote-level fields (no aggregation needed)
    if quote_fields:
        select_clauses.extend(quote_fields)

    # Variable fields from JSONB
    for field in variable_fields:
        select_clauses.append(f"qcv.variables->>'{field}' as {field}")

    # Summary fields (pre-aggregated quote-level totals)
    for field in summary_fields:
        select_clauses.append(f"qcs.{field}")

    # Build WHERE clause with parameterized filters
    params = []
    where_clauses = ["q.organization_id = $1"]
    params.append(str(organization_id))

    param_count = 2

    # Date range filters (special handling)
    from datetime import datetime, timedelta

    if 'created_at_from' in safe_filters:
        where_clauses.append(f"q.created_at >= ${param_count}")
        # Convert string to datetime
        date_from = datetime.fromisoformat(safe_filters['created_at_from'])
        params.append(date_from)
        param_count += 1

    if 'created_at_to' in safe_filters:
        where_clauses.append(f"q.created_at <= ${param_count}")
        # Convert string to datetime + 1 day to include full day
        date_to = datetime.fromisoformat(safe_filters['created_at_to']) + timedelta(days=1)
        params.append(date_to)
        param_count += 1

    if 'quote_date_from' in safe_filters:
        where_clauses.append(f"q.quote_date >= ${param_count}")
        date_from = datetime.fromisoformat(safe_filters['quote_date_from']).date()
        params.append(date_from)
        param_count += 1

    if 'quote_date_to' in safe_filters:
        where_clauses.append(f"q.quote_date <= ${param_count}")
        date_to = datetime.fromisoformat(safe_filters['quote_date_to']).date()
        params.append(date_to)
        param_count += 1

    # Track if we need variable JOIN (either in SELECT or in WHERE filters)
    has_variable_filters = False

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

        elif key in QuerySecurityValidator.ALLOWED_FIELDS['variables']:
            # Variable-level filter (from JSONB)
            has_variable_filters = True  # Mark that we need JOIN
            if isinstance(value, list):
                placeholders = [f"${i}" for i in range(param_count, param_count + len(value))]
                where_clauses.append(f"qcv.variables->>'{key}' = ANY(ARRAY[{','.join(placeholders)}])")
                params.extend(value)
                param_count += len(value)
            else:
                where_clauses.append(f"qcv.variables->>'{key}' = ${param_count}")
                params.append(value)
                param_count += 1

    # Check if we need JOINs
    needs_variable_join = variable_fields or has_variable_filters
    needs_summary_join = summary_fields

    # Build SQL with appropriate JOINs
    from_clause = "FROM quotes q"

    if needs_variable_join:
        from_clause += "\n            LEFT JOIN quote_calculation_variables qcv ON qcv.quote_id = q.id"

    if needs_summary_join:
        from_clause += "\n            LEFT JOIN quote_calculation_summaries qcs ON qcs.quote_id = q.id"

    # Build SQL
    sql = f"""
        SELECT {', '.join(select_clauses)}
        {from_clause}
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
    all_allowed_fields = (QuerySecurityValidator.ALLOWED_FIELDS['quotes'] +
                         QuerySecurityValidator.ALLOWED_FIELDS['variables'] +
                         QuerySecurityValidator.ALLOWED_FIELDS['quote_calculation_summaries'])
    needs_summary_join = False  # Track if we need JOIN for summary fields
    needs_variable_join = False  # Track if we need JOIN for variable fields

    for field, config in aggregations.items():
        # Validate alias name (whitelist OR custom agg_* pattern)
        if field not in QuerySecurityValidator.ALLOWED_ALIAS_NAMES and not QuerySecurityValidator.is_valid_custom_alias(field):
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

            # Check field type and build appropriate SQL
            if col_name in QuerySecurityValidator.ALLOWED_FIELDS['quotes']:
                # Quote table field (e.g., total_amount)
                agg_clauses.append(f"COALESCE({func}(q.{col_name}), 0) as {field}")

            elif col_name in QuerySecurityValidator.ALLOWED_FIELDS['variables']:
                # Variable field from JSONB (e.g., seller_company)
                needs_variable_join = True
                # For text fields in variables, only COUNT makes sense
                if func == 'COUNT':
                    agg_clauses.append(f"COUNT(DISTINCT q.id) as {field}")
                else:
                    # For numeric variables, extract and aggregate
                    agg_clauses.append(
                        f"COALESCE({func}((qcv.variables->>'{col_name}')::numeric), 0) as {field}"
                    )

            elif col_name in QuerySecurityValidator.ALLOWED_FIELDS['quote_calculation_summaries']:
                # Summary field (pre-aggregated quote totals)
                needs_summary_join = True

                # Special handling for profit margin - calculate from revenue and COGS totals
                if col_name == 'calc_af16_profit_margin':
                    # Calculate overall margin from aggregated revenue and COGS
                    # Margin = (total_revenue - total_cogs) / total_revenue
                    agg_clauses.append(
                        f"CASE WHEN SUM(qcs.calc_ak16_final_price_total) > 0 "
                        f"THEN (SUM(qcs.calc_ak16_final_price_total) - SUM(qcs.calc_ab16_cogs_total)) / SUM(qcs.calc_ak16_final_price_total) "
                        f"ELSE 0 END as {field}"
                    )
                else:
                    agg_clauses.append(f"COALESCE({func}(qcs.{col_name}), 0) as {field}")

    if not agg_clauses:
        agg_clauses = ["COUNT(DISTINCT q.id) as quote_count"]

    # Build WHERE clause (same logic as build_analytics_query)
    params = [str(organization_id)]
    where_clauses = ["q.organization_id = $1"]

    param_count = 2

    # Handle date range filters FIRST (before the loop)
    from datetime import datetime, timedelta

    if 'created_at_from' in safe_filters:
        where_clauses.append(f"q.created_at >= ${param_count}")
        date_from = datetime.fromisoformat(safe_filters['created_at_from'])
        params.append(date_from)
        param_count += 1

    if 'created_at_to' in safe_filters:
        where_clauses.append(f"q.created_at <= ${param_count}")
        date_to = datetime.fromisoformat(safe_filters['created_at_to']) + timedelta(days=1)
        params.append(date_to)
        param_count += 1

    if 'quote_date_from' in safe_filters:
        where_clauses.append(f"q.quote_date >= ${param_count}")
        date_from = datetime.fromisoformat(safe_filters['quote_date_from']).date()
        params.append(date_from)
        param_count += 1

    if 'quote_date_to' in safe_filters:
        where_clauses.append(f"q.quote_date <= ${param_count}")
        date_to = datetime.fromisoformat(safe_filters['quote_date_to']).date()
        params.append(date_to)
        param_count += 1

    # Handle other filters
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

        elif key in QuerySecurityValidator.ALLOWED_FIELDS['variables']:
            # Variable-level filter
            needs_variable_join = True
            if isinstance(value, list):
                placeholders = [f"${i}" for i in range(param_count, param_count + len(value))]
                where_clauses.append(f"qcv.variables->>'{key}' = ANY(ARRAY[{','.join(placeholders)}])")
                params.extend(value)
                param_count += len(value)
            else:
                where_clauses.append(f"qcv.variables->>'{key}' = ${param_count}")
                params.append(value)
                param_count += 1

    # Build SQL with appropriate JOINs (1:1 only, no duplication!)
    from_clause = "FROM quotes q"

    if needs_variable_join:
        from_clause += "\n            LEFT JOIN quote_calculation_variables qcv ON qcv.quote_id = q.id"

    if needs_summary_join:
        from_clause += "\n            LEFT JOIN quote_calculation_summaries qcs ON qcs.quote_id = q.id"

    sql = f"""
        SELECT {', '.join(agg_clauses)}
        {from_clause}
        WHERE {' AND '.join(where_clauses)}
    """

    return sql, params
