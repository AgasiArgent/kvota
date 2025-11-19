-- Migration: Add region, city, revenue fields to leads table
-- Date: 2025-11-16
-- Description: Add fields needed for email webhook integration

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS revenue BIGINT;

COMMENT ON COLUMN leads.region IS 'Регион компании';
COMMENT ON COLUMN leads.city IS 'Населенный пункт';
COMMENT ON COLUMN leads.revenue IS 'Выручка компании';
