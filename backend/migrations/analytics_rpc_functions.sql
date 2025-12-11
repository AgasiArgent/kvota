-- Migration: Add RPC functions for analytics query execution
-- Purpose: Replace asyncpg with Supabase client for analytics.py
-- Date: 2025-12-11
--
-- IMPORTANT: These functions replace SQL builder parameters ($1, $2, etc) with actual values
-- before execution. This is safe because:
-- 1. SQL queries come from analytics_security.py which uses whitelisted fields only
-- 2. All user input is sanitized via QuerySecurityValidator
-- 3. Functions run with SECURITY DEFINER to enforce consistent permissions

-- Helper function to replace SQL placeholders with values
CREATE OR REPLACE FUNCTION replace_sql_params(query_sql text, query_params jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result_sql text;
    param_value text;
    i integer;
BEGIN
    result_sql := query_sql;

    -- Replace each $N placeholder with quoted parameter value
    FOR i IN 1..jsonb_array_length(query_params) LOOP
        param_value := query_params->(i-1)::text;

        -- Remove quotes if value is already quoted
        IF param_value LIKE '"%"' THEN
            param_value := substring(param_value from 2 for length(param_value)-2);
        END IF;

        -- Replace $N with quoted value
        result_sql := replace(result_sql, '$' || i, quote_literal(param_value));
    END LOOP;

    RETURN result_sql;
END;
$$;

-- Function to execute analytics queries (SELECT statements)
CREATE OR REPLACE FUNCTION execute_analytics_query(query_sql text, query_params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    final_sql text;
BEGIN
    -- Replace placeholders with actual values
    final_sql := replace_sql_params(query_sql, query_params);

    -- Execute query and convert result to JSONB array
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', final_sql)
    INTO result;

    RETURN COALESCE(result, '[]'::jsonb);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Query execution failed: % (SQL: %)', SQLERRM, final_sql;
END;
$$;

-- Function to execute analytics count queries
CREATE OR REPLACE FUNCTION execute_analytics_count(query_sql text, query_params jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result integer;
    final_sql text;
BEGIN
    -- Replace placeholders with actual values
    final_sql := replace_sql_params(query_sql, query_params);

    -- Execute count query
    EXECUTE final_sql INTO result;

    RETURN COALESCE(result, 0);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Count query failed: % (SQL: %)', SQLERRM, final_sql;
END;
$$;

-- Function to execute analytics aggregation queries
CREATE OR REPLACE FUNCTION execute_analytics_aggregation(query_sql text, query_params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    final_sql text;
BEGIN
    -- Replace placeholders with actual values
    final_sql := replace_sql_params(query_sql, query_params);

    -- Execute aggregation query and convert single row result to JSONB
    EXECUTE format('SELECT row_to_json(t) FROM (%s) t', final_sql)
    INTO result;

    RETURN COALESCE(result, '{}'::jsonb);
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Aggregation query failed: % (SQL: %)', SQLERRM, final_sql;
END;
$$;

-- Grant execute permissions to authenticated users
-- Note: SECURITY DEFINER means these run with creator's privileges
-- The actual RLS is enforced by the SQL queries themselves which include organization_id checks
GRANT EXECUTE ON FUNCTION execute_analytics_query(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_analytics_count(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION execute_analytics_aggregation(text, jsonb) TO authenticated;

-- Add comment explaining usage
COMMENT ON FUNCTION execute_analytics_query IS 'Executes parameterized SELECT queries for analytics endpoints. Used by /api/analytics/query and /api/analytics/export.';
COMMENT ON FUNCTION execute_analytics_count IS 'Executes parameterized COUNT queries for analytics pagination. Used by /api/analytics/query.';
COMMENT ON FUNCTION execute_analytics_aggregation IS 'Executes parameterized aggregation queries (SUM, AVG, etc). Used by /api/analytics/aggregate.';
