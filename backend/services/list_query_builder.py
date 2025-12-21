"""
List Query Builder Service - Dynamic SQL query generation for quote list

TASK-008: Quote List Constructor with Department Presets

This service builds dynamic SQL queries based on requested columns,
joining only the tables needed and computing derived fields on the fly.

Tables involved:
- quotes (q)
- customers (c)
- quote_calculation_summaries (qcs)
- quote_calculation_variables (qcv)
- user_profiles (up) - for manager name
- seller_companies (sc)
- purchasing_companies (pc)
- suppliers (s)
"""

from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID
from decimal import Decimal
import json


# =============================================================================
# Column Definitions - Maps column keys to their source tables and SQL
# =============================================================================

COLUMN_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    # -------------------------------------------------------------------------
    # IDENTITY & DATES
    # -------------------------------------------------------------------------
    "created_at": {
        "table": "quotes",
        "sql": "q.created_at",
        "type": "timestamp"
    },
    "quote_number": {
        "table": "quotes",
        "sql": "q.quote_number",
        "type": "text"
    },
    "idn_quote": {
        "table": "quotes",
        "sql": "q.idn_quote",
        "type": "text"
    },
    "updated_at": {
        "table": "quotes",
        "sql": "q.updated_at",
        "type": "timestamp"
    },
    "workflow_state": {
        "table": "quotes",
        "sql": "q.workflow_state",
        "type": "text"
    },
    "status": {
        "table": "quotes",
        "sql": "q.status",
        "type": "text"
    },

    # -------------------------------------------------------------------------
    # MANAGER & APPROVALS
    # -------------------------------------------------------------------------
    "manager_name": {
        "table": "user_profiles",
        "sql": "up.full_name",
        "type": "text",
        "join": "LEFT JOIN user_profiles up ON q.created_by = up.user_id"
    },
    "manager_email": {
        "table": "auth_users",
        "sql": "au.email",
        "type": "text",
        "join": "LEFT JOIN auth.users au ON q.created_by = au.id"
    },
    "financial_reviewed_at": {
        "table": "quotes",
        "sql": "q.financial_reviewed_at",
        "type": "timestamp"
    },
    "financial_reviewed_by": {
        "table": "quotes",
        "sql": "q.financial_reviewed_by",
        "type": "uuid"
    },

    # -------------------------------------------------------------------------
    # CUSTOMER
    # -------------------------------------------------------------------------
    "customer_name": {
        "table": "customers",
        "sql": "c.name",
        "type": "text",
        "join": "LEFT JOIN customers c ON q.customer_id = c.id"
    },
    "customer_inn": {
        "table": "customers",
        "sql": "c.inn",
        "type": "text",
        "join": "LEFT JOIN customers c ON q.customer_id = c.id"
    },
    "customer_company_type": {
        "table": "customers",
        "sql": "c.company_type",
        "type": "text",
        "join": "LEFT JOIN customers c ON q.customer_id = c.id"
    },

    # -------------------------------------------------------------------------
    # QUOTE FINANCIALS
    # -------------------------------------------------------------------------
    "currency": {
        "table": "quotes",
        "sql": "q.currency",
        "type": "text"
    },
    "total_with_vat_quote": {
        "table": "quotes",
        "sql": "q.total_with_vat_quote",
        "type": "decimal"
    },
    "total_with_vat_usd": {
        "table": "quotes",
        "sql": "q.total_with_vat_usd",
        "type": "decimal"
    },
    "total_profit_usd": {
        "table": "quotes",
        "sql": "q.total_profit_usd",
        "type": "decimal"
    },
    "total_quantity": {
        "table": "quotes",
        "sql": "q.total_quantity",
        "type": "integer"
    },
    "total_weight_kg": {
        "table": "quotes",
        "sql": "q.total_weight_kg",
        "type": "decimal"
    },

    # -------------------------------------------------------------------------
    # DELIVERY & PAYMENT TERMS
    # -------------------------------------------------------------------------
    "delivery_terms": {
        "table": "quotes",
        "sql": "q.delivery_terms",
        "type": "text"
    },
    "delivery_days": {
        "table": "quotes",
        "sql": "q.delivery_days",
        "type": "integer"
    },
    "payment_terms": {
        "table": "quotes",
        "sql": "q.payment_terms",
        "type": "text"
    },

    # -------------------------------------------------------------------------
    # CALCULATION VARIABLES (from JSONB)
    # -------------------------------------------------------------------------
    "seller_company": {
        "table": "quote_calculation_variables",
        "sql": "qcv.variables->>'seller_company'",
        "type": "text",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },
    "offer_sale_type": {
        "table": "quote_calculation_variables",
        "sql": "qcv.variables->>'offer_sale_type'",
        "type": "text",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },
    "client_advance_percent": {
        "table": "quote_calculation_variables",
        "sql": "(qcv.variables->>'client_advance_percent')::decimal",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },
    "supplier_advance_percent": {
        "table": "quote_calculation_variables",
        "sql": "(qcv.variables->>'supplier_advance_percent')::decimal",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },
    "time_to_advance_on_receiving": {
        "table": "quote_calculation_variables",
        "sql": "(qcv.variables->>'time_to_advance_on_receiving')::integer",
        "type": "integer",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },

    # Logistics variables
    "logistics_supplier_hub": {
        "table": "quote_calculation_variables",
        "sql": "(qcv.variables->>'logistics_supplier_hub')::decimal",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },
    "logistics_hub_customs": {
        "table": "quote_calculation_variables",
        "sql": "(qcv.variables->>'logistics_hub_customs')::decimal",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },
    "logistics_customs_client": {
        "table": "quote_calculation_variables",
        "sql": "(qcv.variables->>'logistics_customs_client')::decimal",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },

    # -------------------------------------------------------------------------
    # CALCULATION SUMMARIES
    # -------------------------------------------------------------------------
    "calc_ak16_final_price_total_quote": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_ak16_final_price_total_quote",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_s13_sum_purchase_prices": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_s13_sum_purchase_prices",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_bj11_total_financing_cost": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_bj11_total_financing_cost",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_bl5_credit_sales_interest": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_bl5_credit_sales_interest",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_bh3_client_advance": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_bh3_client_advance",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },

    # New aggregated fields from migration 053
    "calc_supplier_advance_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_supplier_advance_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_purchase_with_vat_usd_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_purchase_with_vat_usd_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_ah13_forex_risk_reserve_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_ah13_forex_risk_reserve_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_ai13_financial_agent_fee_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_ai13_financial_agent_fee_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_ab13_cogs_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_ab13_cogs_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_y13_customs_duty_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_y13_customs_duty_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_z13_excise_tax_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_z13_excise_tax_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_an13_sales_vat_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_an13_sales_vat_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_ao13_import_vat_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_ao13_import_vat_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_ap13_net_vat_payable_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_ap13_net_vat_payable_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_aq13_transit_commission_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_aq13_transit_commission_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_ag13_dm_fee_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_ag13_dm_fee_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_internal_margin_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_internal_margin_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_tax_turkey_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_tax_turkey_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "calc_tax_russia_total": {
        "table": "quote_calculation_summaries",
        "sql": "qcs.calc_tax_russia_total",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },

    # -------------------------------------------------------------------------
    # NEW QUOTE FIELDS (from migration 053)
    # -------------------------------------------------------------------------
    "document_folder_link": {
        "table": "quotes",
        "sql": "q.document_folder_link",
        "type": "text"
    },
    "executor_user_id": {
        "table": "quotes",
        "sql": "q.executor_user_id",
        "type": "uuid"
    },
    "spec_sign_date": {
        "table": "quotes",
        "sql": "q.spec_sign_date",
        "type": "date"
    },

    # -------------------------------------------------------------------------
    # DERIVED FIELDS (calculated on the fly)
    # -------------------------------------------------------------------------
    "logistics_eu_tr": {
        "table": "derived",
        "sql": "COALESCE((qcv.variables->>'logistics_supplier_hub')::decimal, 0) + COALESCE((qcv.variables->>'logistics_hub_customs')::decimal, 0)",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },
    "logistics_total": {
        "table": "derived",
        "sql": """COALESCE((qcv.variables->>'logistics_supplier_hub')::decimal, 0) +
                  COALESCE((qcv.variables->>'logistics_hub_customs')::decimal, 0) +
                  COALESCE((qcv.variables->>'logistics_customs_client')::decimal, 0) +
                  COALESCE((qcv.variables->>'brokerage_hub')::decimal, 0) +
                  COALESCE((qcv.variables->>'brokerage_customs')::decimal, 0) +
                  COALESCE((qcv.variables->>'brokerage_warehousing')::decimal, 0) +
                  COALESCE((qcv.variables->>'brokerage_documentation')::decimal, 0) +
                  COALESCE((qcv.variables->>'brokerage_extra')::decimal, 0)""",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_variables qcv ON q.id = qcv.quote_id"
    },
    "tax_total_tr_rf": {
        "table": "derived",
        "sql": "COALESCE(qcs.calc_tax_turkey_total, 0) + COALESCE(qcs.calc_tax_russia_total, 0)",
        "type": "decimal",
        "join": "LEFT JOIN quote_calculation_summaries qcs ON q.id = qcs.quote_id"
    },
    "week_number": {
        "table": "derived",
        "sql": "EXTRACT(WEEK FROM q.created_at)::integer",
        "type": "integer"
    },
    "month_number": {
        "table": "derived",
        "sql": "EXTRACT(MONTH FROM q.created_at)::integer",
        "type": "integer"
    },
    "year_number": {
        "table": "derived",
        "sql": "EXTRACT(YEAR FROM q.created_at)::integer",
        "type": "integer"
    },
    "is_current_week": {
        "table": "derived",
        "sql": "EXTRACT(WEEK FROM q.created_at) = EXTRACT(WEEK FROM CURRENT_DATE) AND EXTRACT(YEAR FROM q.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)",
        "type": "boolean"
    },
    "is_current_month": {
        "table": "derived",
        "sql": "EXTRACT(MONTH FROM q.created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM q.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)",
        "type": "boolean"
    },
}


# =============================================================================
# Query Builder Class
# =============================================================================

class ListQueryBuilder:
    """
    Builds dynamic SQL queries for the quote list based on requested columns.

    Features:
    - Only joins tables that are needed for requested columns
    - Supports filtering and sorting
    - Handles pagination efficiently
    - Computes derived fields on the fly
    """

    def __init__(self, organization_id: UUID):
        self.organization_id = organization_id
        self.columns: List[str] = []
        self.filters: Dict[str, Any] = {}
        self.sort_model: List[Dict[str, str]] = []
        self.page: int = 1
        self.page_size: int = 50

    def set_columns(self, columns: List[str]) -> "ListQueryBuilder":
        """Set the columns to select"""
        # Always include id
        self.columns = ["id"] + [c for c in columns if c != "id"]
        return self

    def set_filters(self, filters: Dict[str, Any]) -> "ListQueryBuilder":
        """Set filter conditions"""
        self.filters = filters
        return self

    def set_sort(self, sort_model: List[Dict[str, str]]) -> "ListQueryBuilder":
        """Set sort order"""
        self.sort_model = sort_model
        return self

    def set_pagination(self, page: int, page_size: int) -> "ListQueryBuilder":
        """Set pagination parameters"""
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), 500)  # Max 500 rows
        return self

    def _get_required_joins(self) -> List[str]:
        """Determine which JOINs are needed based on requested columns"""
        joins = set()

        for col in self.columns:
            if col == "id":
                continue
            if col in COLUMN_DEFINITIONS:
                col_def = COLUMN_DEFINITIONS[col]
                if "join" in col_def:
                    joins.add(col_def["join"])

        # Also check filter columns
        for col in self.filters.keys():
            if col in COLUMN_DEFINITIONS:
                col_def = COLUMN_DEFINITIONS[col]
                if "join" in col_def:
                    joins.add(col_def["join"])

        # Also check sort columns
        for sort in self.sort_model:
            col = sort.get("colId")
            if col in COLUMN_DEFINITIONS:
                col_def = COLUMN_DEFINITIONS[col]
                if "join" in col_def:
                    joins.add(col_def["join"])

        # Deduplicate joins (same table might be referenced multiple times)
        # Group by table alias
        unique_joins = {}
        for join in joins:
            # Extract alias from join (e.g., "LEFT JOIN customers c ON..." -> "c")
            parts = join.split()
            if len(parts) >= 4:
                alias = parts[3]  # The alias after table name
                if alias not in unique_joins:
                    unique_joins[alias] = join

        return list(unique_joins.values())

    def _get_select_clause(self) -> str:
        """Build the SELECT clause"""
        select_parts = ["q.id"]

        for col in self.columns:
            if col == "id":
                continue
            if col in COLUMN_DEFINITIONS:
                col_def = COLUMN_DEFINITIONS[col]
                select_parts.append(f"{col_def['sql']} AS {col}")
            else:
                # Unknown column - skip it
                pass

        return ", ".join(select_parts)

    def _get_where_clause(self) -> Tuple[str, List[Any]]:
        """Build the WHERE clause with parameters"""
        conditions = ["q.organization_id = $1", "q.deleted_at IS NULL"]
        params = [str(self.organization_id)]
        param_idx = 2

        for col, value in self.filters.items():
            if col not in COLUMN_DEFINITIONS:
                continue

            col_def = COLUMN_DEFINITIONS[col]
            col_sql = col_def["sql"]
            col_type = col_def["type"]

            if isinstance(value, dict):
                # Complex filter (range, in, etc.)
                if "from" in value and value["from"] is not None:
                    conditions.append(f"{col_sql} >= ${param_idx}")
                    params.append(value["from"])
                    param_idx += 1
                if "to" in value and value["to"] is not None:
                    conditions.append(f"{col_sql} <= ${param_idx}")
                    params.append(value["to"])
                    param_idx += 1
                if "in" in value and value["in"]:
                    placeholders = ", ".join([f"${i}" for i in range(param_idx, param_idx + len(value["in"]))])
                    conditions.append(f"{col_sql} IN ({placeholders})")
                    params.extend(value["in"])
                    param_idx += len(value["in"])
                if "contains" in value and value["contains"]:
                    conditions.append(f"{col_sql} ILIKE ${param_idx}")
                    params.append(f"%{value['contains']}%")
                    param_idx += 1
            else:
                # Simple equality
                if col_type == "text":
                    conditions.append(f"{col_sql} ILIKE ${param_idx}")
                    params.append(f"%{value}%")
                else:
                    conditions.append(f"{col_sql} = ${param_idx}")
                    params.append(value)
                param_idx += 1

        return " AND ".join(conditions), params

    def _get_order_clause(self) -> str:
        """Build the ORDER BY clause"""
        if not self.sort_model:
            return "ORDER BY q.created_at DESC"

        order_parts = []
        for sort in self.sort_model:
            col = sort.get("colId")
            direction = "DESC" if sort.get("sort") == "desc" else "ASC"

            if col in COLUMN_DEFINITIONS:
                col_def = COLUMN_DEFINITIONS[col]
                order_parts.append(f"{col_def['sql']} {direction}")

        if not order_parts:
            return "ORDER BY q.created_at DESC"

        return "ORDER BY " + ", ".join(order_parts)

    def build_query(self) -> Tuple[str, List[Any]]:
        """Build the complete SQL query"""
        select_clause = self._get_select_clause()
        joins = self._get_required_joins()
        where_clause, params = self._get_where_clause()
        order_clause = self._get_order_clause()

        offset = (self.page - 1) * self.page_size

        query = f"""
            SELECT {select_clause}
            FROM quotes q
            {' '.join(joins)}
            WHERE {where_clause}
            {order_clause}
            LIMIT {self.page_size} OFFSET {offset}
        """

        return query.strip(), params

    def build_count_query(self) -> Tuple[str, List[Any]]:
        """Build a COUNT query for pagination"""
        joins = self._get_required_joins()
        where_clause, params = self._get_where_clause()

        # For count, only include joins needed for filters
        filter_joins = set()
        for col in self.filters.keys():
            if col in COLUMN_DEFINITIONS:
                col_def = COLUMN_DEFINITIONS[col]
                if "join" in col_def:
                    filter_joins.add(col_def["join"])

        query = f"""
            SELECT COUNT(*) as total
            FROM quotes q
            {' '.join(filter_joins)}
            WHERE {where_clause}
        """

        return query.strip(), params


# =============================================================================
# Helper Functions
# =============================================================================

def get_available_columns() -> Dict[str, Dict[str, str]]:
    """
    Return list of available columns with their types and descriptions.
    Used by frontend to build column picker.
    """
    return {
        key: {
            "type": value["type"],
            "table": value["table"]
        }
        for key, value in COLUMN_DEFINITIONS.items()
    }


def validate_columns(columns: List[str]) -> List[str]:
    """
    Validate column names and return only valid ones.
    Unknown columns are silently ignored.
    """
    return [c for c in columns if c in COLUMN_DEFINITIONS or c == "id"]
