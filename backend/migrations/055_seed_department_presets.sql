-- Migration: 055_seed_department_presets
-- Description: Seed system presets for 4 departments (Sales, Logistics, Accounting, Management)
-- Date: 2025-12-21
-- Task: TASK-008 - Quote List Constructor with Department Presets

-- ============================================================
-- System Presets (organization_id = NULL, visible to all orgs)
-- ============================================================

-- Note: columns JSONB contains ag-Grid column state:
-- {
--   "columnDefs": [
--     { "field": "idn_quote", "hide": false, "width": 120 },
--     ...
--   ],
--   "columnOrder": ["idn_quote", "customer_name", ...],
--   "groupState": { ... }
-- }

-- Delete existing system presets to allow re-running migration
DELETE FROM list_presets WHERE preset_type = 'system';

-- ============================================================
-- Preset 1: Sales Department (Отдел продаж)
-- Based on ЕРПС LITE spreadsheet
-- Focus: Deal progress, customer interaction, profit tracking
-- ============================================================

INSERT INTO list_presets (
    organization_id,
    name,
    preset_type,
    department,
    created_by,
    columns,
    filters,
    sort_model,
    is_default
) VALUES (
    NULL,  -- System preset, visible to all
    'Продажи (ЕРПС)',
    'system',
    'sales',
    NULL,
    '{
        "columnDefs": [
            {"field": "created_at", "hide": false, "width": 100, "headerName": "Дата"},
            {"field": "idn_quote", "hide": false, "width": 140, "headerName": "IDN"},
            {"field": "workflow_state", "hide": false, "width": 120, "headerName": "Статус"},
            {"field": "customer_name", "hide": false, "width": 200, "headerName": "Заказчик"},
            {"field": "customer_inn", "hide": false, "width": 120, "headerName": "ИНН"},
            {"field": "manager_name", "hide": false, "width": 150, "headerName": "Менеджер"},
            {"field": "seller_company", "hide": false, "width": 180, "headerName": "Орг-продавец"},
            {"field": "offer_sale_type", "hide": false, "width": 100, "headerName": "Тип сделки"},
            {"field": "currency", "hide": false, "width": 80, "headerName": "Валюта"},
            {"field": "total_with_vat_quote", "hide": false, "width": 140, "headerName": "Сумма продажи"},
            {"field": "total_profit_usd", "hide": false, "width": 130, "headerName": "Профит USD"},
            {"field": "client_advance_percent", "hide": false, "width": 100, "headerName": "Аванс %"},
            {"field": "delivery_days", "hide": false, "width": 100, "headerName": "Срок дней"},
            {"field": "delivery_terms", "hide": false, "width": 100, "headerName": "Базис"},
            {"field": "document_folder_link", "hide": false, "width": 120, "headerName": "Папка"},
            {"field": "brand_list", "hide": true, "width": 150, "headerName": "Бренды"},
            {"field": "total_quantity", "hide": true, "width": 100, "headerName": "Кол-во"},
            {"field": "total_weight_kg", "hide": true, "width": 100, "headerName": "Вес кг"}
        ],
        "columnOrder": [
            "created_at", "idn_quote", "workflow_state", "customer_name", "customer_inn",
            "manager_name", "seller_company", "offer_sale_type", "currency",
            "total_with_vat_quote", "total_profit_usd", "client_advance_percent",
            "delivery_days", "delivery_terms", "document_folder_link"
        ]
    }'::jsonb,
    '{}'::jsonb,
    '[{"colId": "created_at", "sort": "desc"}]'::jsonb,
    true  -- Default preset for new users
);


-- ============================================================
-- Preset 2: Logistics Department (Логистика)
-- Focus: Shipping, weight, delivery, logistics costs
-- ============================================================

INSERT INTO list_presets (
    organization_id,
    name,
    preset_type,
    department,
    created_by,
    columns,
    filters,
    sort_model,
    is_default
) VALUES (
    NULL,
    'Логистика',
    'system',
    'logistics',
    NULL,
    '{
        "columnDefs": [
            {"field": "created_at", "hide": false, "width": 100, "headerName": "Дата"},
            {"field": "idn_quote", "hide": false, "width": 140, "headerName": "IDN"},
            {"field": "workflow_state", "hide": false, "width": 120, "headerName": "Статус"},
            {"field": "customer_name", "hide": false, "width": 200, "headerName": "Заказчик"},
            {"field": "delivery_terms", "hide": false, "width": 100, "headerName": "Базис"},
            {"field": "delivery_days", "hide": false, "width": 100, "headerName": "Срок дней"},
            {"field": "total_quantity", "hide": false, "width": 100, "headerName": "Кол-во"},
            {"field": "total_weight_kg", "hide": false, "width": 110, "headerName": "Вес кг"},
            {"field": "production_time_max", "hide": false, "width": 110, "headerName": "Произв. дней"},
            {"field": "logistics_supplier_hub", "hide": false, "width": 120, "headerName": "Лог. ЕС→Хаб"},
            {"field": "logistics_hub_customs", "hide": false, "width": 120, "headerName": "Лог. Хаб→ТМ"},
            {"field": "logistics_customs_client", "hide": false, "width": 120, "headerName": "Лог. ТМ→Клиент"},
            {"field": "logistics_eu_tr_total", "hide": false, "width": 120, "headerName": "Лог. ЕС+ТР"},
            {"field": "logistics_total", "hide": false, "width": 120, "headerName": "Итого логистика"},
            {"field": "purchasing_company_list", "hide": false, "width": 180, "headerName": "Закуп. компания"},
            {"field": "supplier_list", "hide": false, "width": 180, "headerName": "Поставщик"},
            {"field": "currency", "hide": true, "width": 80, "headerName": "Валюта"},
            {"field": "total_with_vat_quote", "hide": true, "width": 140, "headerName": "Сумма"}
        ],
        "columnOrder": [
            "created_at", "idn_quote", "workflow_state", "customer_name",
            "delivery_terms", "delivery_days", "total_quantity", "total_weight_kg",
            "production_time_max", "logistics_supplier_hub", "logistics_hub_customs",
            "logistics_customs_client", "logistics_eu_tr_total", "logistics_total",
            "purchasing_company_list", "supplier_list"
        ]
    }'::jsonb,
    '{}'::jsonb,
    '[{"colId": "delivery_days", "sort": "asc"}]'::jsonb,
    false
);


-- ============================================================
-- Preset 3: Accounting Department (Бухгалтерия / Реестр КА)
-- Focus: Invoices, VAT, taxes, financial details
-- ============================================================

INSERT INTO list_presets (
    organization_id,
    name,
    preset_type,
    department,
    created_by,
    columns,
    filters,
    sort_model,
    is_default
) VALUES (
    NULL,
    'Бухгалтерия (КА)',
    'system',
    'accounting',
    NULL,
    '{
        "columnDefs": [
            {"field": "created_at", "hide": false, "width": 100, "headerName": "Дата"},
            {"field": "idn_quote", "hide": false, "width": 140, "headerName": "IDN"},
            {"field": "spec_number", "hide": false, "width": 140, "headerName": "№ Спец"},
            {"field": "workflow_state", "hide": false, "width": 120, "headerName": "Статус"},
            {"field": "customer_name", "hide": false, "width": 180, "headerName": "Заказчик"},
            {"field": "customer_inn", "hide": false, "width": 120, "headerName": "ИНН"},
            {"field": "seller_company", "hide": false, "width": 160, "headerName": "Продавец"},
            {"field": "currency", "hide": false, "width": 80, "headerName": "Валюта"},
            {"field": "total_with_vat_quote", "hide": false, "width": 140, "headerName": "Сумма спец"},
            {"field": "calc_s13_sum_purchase_prices", "hide": false, "width": 140, "headerName": "Закупка б/НДС"},
            {"field": "calc_purchase_with_vat_usd_total", "hide": false, "width": 140, "headerName": "Закупка с НДС"},
            {"field": "calc_bj11_total_financing_cost", "hide": false, "width": 130, "headerName": "Финансирование"},
            {"field": "calc_bl5_credit_sales_interest", "hide": false, "width": 130, "headerName": "Рассрочка"},
            {"field": "calc_y13_customs_duty_total", "hide": false, "width": 110, "headerName": "Пошлина"},
            {"field": "calc_z13_excise_tax_total", "hide": false, "width": 100, "headerName": "Акциз"},
            {"field": "calc_an13_sales_vat_total", "hide": false, "width": 110, "headerName": "НДС продаж"},
            {"field": "calc_ao13_import_vat_total", "hide": false, "width": 110, "headerName": "НДС импорт"},
            {"field": "calc_ap13_net_vat_payable_total", "hide": false, "width": 120, "headerName": "НДС к уплате"},
            {"field": "calc_tax_turkey_total", "hide": false, "width": 110, "headerName": "Налог ТР"},
            {"field": "calc_tax_russia_total", "hide": false, "width": 110, "headerName": "Налог РФ"},
            {"field": "purchasing_company_list", "hide": false, "width": 160, "headerName": "Компания закупки"},
            {"field": "supplier_list", "hide": false, "width": 160, "headerName": "Поставщик"},
            {"field": "proforma_numbers", "hide": false, "width": 140, "headerName": "№ проформы"},
            {"field": "proforma_dates", "hide": false, "width": 120, "headerName": "Дата проформы"}
        ],
        "columnOrder": [
            "created_at", "idn_quote", "spec_number", "workflow_state",
            "customer_name", "customer_inn", "seller_company", "currency",
            "total_with_vat_quote", "calc_s13_sum_purchase_prices",
            "calc_purchase_with_vat_usd_total", "calc_bj11_total_financing_cost",
            "calc_bl5_credit_sales_interest", "calc_y13_customs_duty_total",
            "calc_z13_excise_tax_total", "calc_an13_sales_vat_total",
            "calc_ao13_import_vat_total", "calc_ap13_net_vat_payable_total",
            "calc_tax_turkey_total", "calc_tax_russia_total",
            "purchasing_company_list", "supplier_list", "proforma_numbers", "proforma_dates"
        ]
    }'::jsonb,
    '{}'::jsonb,
    '[{"colId": "created_at", "sort": "desc"}]'::jsonb,
    false
);


-- ============================================================
-- Preset 4: Management Department (Руководство / Реестр КП)
-- Focus: Overview of all key metrics, approvals, profit
-- ============================================================

INSERT INTO list_presets (
    organization_id,
    name,
    preset_type,
    department,
    created_by,
    columns,
    filters,
    sort_model,
    is_default
) VALUES (
    NULL,
    'Руководство (КП)',
    'system',
    'management',
    NULL,
    '{
        "columnDefs": [
            {"field": "created_at", "hide": false, "width": 100, "headerName": "Дата"},
            {"field": "idn_quote", "hide": false, "width": 140, "headerName": "IDN"},
            {"field": "workflow_state", "hide": false, "width": 120, "headerName": "Статус"},
            {"field": "approver_name", "hide": false, "width": 150, "headerName": "Контроллер"},
            {"field": "manager_name", "hide": false, "width": 150, "headerName": "Менеджер"},
            {"field": "customer_name", "hide": false, "width": 180, "headerName": "Заказчик"},
            {"field": "customer_inn", "hide": false, "width": 120, "headerName": "ИНН"},
            {"field": "seller_company", "hide": false, "width": 160, "headerName": "Орг-продавец"},
            {"field": "offer_sale_type", "hide": false, "width": 100, "headerName": "Тип сделки"},
            {"field": "brand_list", "hide": false, "width": 150, "headerName": "Бренд"},
            {"field": "currency", "hide": false, "width": 80, "headerName": "Валюта"},
            {"field": "total_with_vat_quote", "hide": false, "width": 140, "headerName": "Сумма с НДС"},
            {"field": "total_with_vat_usd", "hide": false, "width": 130, "headerName": "Сумма USD"},
            {"field": "total_profit_usd", "hide": false, "width": 120, "headerName": "Профит USD"},
            {"field": "profit_margin_percent", "hide": false, "width": 100, "headerName": "Маржа %"},
            {"field": "delivery_terms", "hide": false, "width": 100, "headerName": "Базис"},
            {"field": "delivery_days", "hide": false, "width": 90, "headerName": "Срок"},
            {"field": "client_advance_percent", "hide": false, "width": 90, "headerName": "Аванс %"},
            {"field": "supplier_advance_percent", "hide": false, "width": 100, "headerName": "Аванс пост %"},
            {"field": "calc_supplier_advance_total", "hide": false, "width": 130, "headerName": "Аванс пост"},
            {"field": "total_quantity", "hide": false, "width": 90, "headerName": "Кол-во"},
            {"field": "total_weight_kg", "hide": false, "width": 90, "headerName": "Вес кг"},
            {"field": "calc_s13_sum_purchase_prices", "hide": false, "width": 130, "headerName": "Закупка"},
            {"field": "calc_ab13_cogs_total", "hide": false, "width": 130, "headerName": "Себест."},
            {"field": "calc_bj11_total_financing_cost", "hide": false, "width": 120, "headerName": "Финанс."},
            {"field": "logistics_total", "hide": false, "width": 120, "headerName": "Логистика"},
            {"field": "calc_ah13_forex_risk_reserve_total", "hide": false, "width": 110, "headerName": "Резерв курс"},
            {"field": "calc_ai13_financial_agent_fee_total", "hide": false, "width": 110, "headerName": "Комис. агента"},
            {"field": "calc_internal_margin_total", "hide": false, "width": 120, "headerName": "Внутр. маржа"},
            {"field": "calc_ag13_dm_fee_total", "hide": false, "width": 100, "headerName": "Откат"},
            {"field": "updated_at", "hide": false, "width": 100, "headerName": "Обновлено"},
            {"field": "financial_reviewed_at", "hide": false, "width": 110, "headerName": "Согласовано"}
        ],
        "columnOrder": [
            "created_at", "idn_quote", "workflow_state", "approver_name",
            "manager_name", "customer_name", "customer_inn", "seller_company",
            "offer_sale_type", "brand_list", "currency", "total_with_vat_quote",
            "total_with_vat_usd", "total_profit_usd", "profit_margin_percent",
            "delivery_terms", "delivery_days", "client_advance_percent",
            "supplier_advance_percent", "calc_supplier_advance_total",
            "total_quantity", "total_weight_kg", "calc_s13_sum_purchase_prices",
            "calc_ab13_cogs_total", "calc_bj11_total_financing_cost",
            "logistics_total", "calc_ah13_forex_risk_reserve_total",
            "calc_ai13_financial_agent_fee_total", "calc_internal_margin_total",
            "calc_ag13_dm_fee_total", "updated_at", "financial_reviewed_at"
        ]
    }'::jsonb,
    '{}'::jsonb,
    '[{"colId": "created_at", "sort": "desc"}]'::jsonb,
    false
);


-- ============================================================
-- Verify presets created
-- ============================================================

DO $$
DECLARE
    preset_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO preset_count FROM list_presets WHERE preset_type = 'system';

    IF preset_count = 4 THEN
        RAISE NOTICE 'Successfully created 4 system presets: Sales, Logistics, Accounting, Management';
    ELSE
        RAISE WARNING 'Expected 4 system presets, found %', preset_count;
    END IF;
END $$;

