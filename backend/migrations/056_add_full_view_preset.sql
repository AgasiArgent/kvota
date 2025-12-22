-- Migration: 056_add_full_view_preset
-- Description: Add "Full View" system preset with all available columns
-- Date: 2025-12-21
-- Task: TASK-008 - Quote List Constructor with Department Presets

-- ============================================================
-- System Preset: Full View (Полный вид)
-- Shows ALL 61 columns for comprehensive data review
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
    'Полный вид',
    'system',
    NULL,  -- No specific department
    NULL,
    '{
        "columnDefs": [
            {"field": "quote_number", "hide": false, "width": 140, "headerName": "№ КП"},
            {"field": "idn_quote", "hide": false, "width": 200, "headerName": "IDN КП"},
            {"field": "created_at", "hide": false, "width": 150, "headerName": "Дата создания"},
            {"field": "updated_at", "hide": false, "width": 150, "headerName": "Изменено"},
            {"field": "workflow_state", "hide": false, "width": 150, "headerName": "Статус"},
            {"field": "status", "hide": false, "width": 120, "headerName": "Статус КП"},
            {"field": "document_folder_link", "hide": false, "width": 200, "headerName": "Ссылка на папку"},
            {"field": "spec_sign_date", "hide": false, "width": 150, "headerName": "Дата подписания"},
            {"field": "manager_name", "hide": false, "width": 180, "headerName": "Менеджер"},
            {"field": "manager_email", "hide": false, "width": 200, "headerName": "Email менеджера"},
            {"field": "financial_reviewed_at", "hide": false, "width": 160, "headerName": "Дата согласования"},
            {"field": "customer_name", "hide": false, "width": 250, "headerName": "Заказчик"},
            {"field": "customer_inn", "hide": false, "width": 140, "headerName": "ИНН заказчика"},
            {"field": "customer_company_type", "hide": false, "width": 130, "headerName": "Форма заказчика"},
            {"field": "currency", "hide": false, "width": 90, "headerName": "Валюта"},
            {"field": "total_with_vat_quote", "hide": false, "width": 150, "headerName": "Сумма с НДС"},
            {"field": "total_with_vat_usd", "hide": false, "width": 140, "headerName": "Сумма USD"},
            {"field": "total_profit_usd", "hide": false, "width": 140, "headerName": "Прибыль USD"},
            {"field": "total_quantity", "hide": false, "width": 100, "headerName": "Кол-во"},
            {"field": "total_weight_kg", "hide": false, "width": 110, "headerName": "Вес (кг)"},
            {"field": "delivery_terms", "hide": false, "width": 130, "headerName": "Базис поставки"},
            {"field": "delivery_days", "hide": false, "width": 110, "headerName": "Срок (дни)"},
            {"field": "payment_terms", "hide": false, "width": 200, "headerName": "Условия оплаты"},
            {"field": "seller_company", "hide": false, "width": 180, "headerName": "Орг-продавец"},
            {"field": "offer_sale_type", "hide": false, "width": 130, "headerName": "Тип сделки"},
            {"field": "client_advance_percent", "hide": false, "width": 140, "headerName": "Аванс клиента %"},
            {"field": "supplier_advance_percent", "hide": false, "width": 150, "headerName": "Аванс пост-ку %"},
            {"field": "time_to_advance_on_receiving", "hide": false, "width": 140, "headerName": "Дни до оплаты"},
            {"field": "logistics_supplier_hub", "hide": false, "width": 150, "headerName": "Логист. пост-хаб"},
            {"field": "logistics_hub_customs", "hide": false, "width": 150, "headerName": "Логист. хаб-там."},
            {"field": "logistics_customs_client", "hide": false, "width": 160, "headerName": "Логист. там-клиент"},
            {"field": "calc_ak16_final_price_total_quote", "hide": false, "width": 150, "headerName": "Сумма без НДС"},
            {"field": "calc_s13_sum_purchase_prices", "hide": false, "width": 150, "headerName": "Сумма закупки"},
            {"field": "calc_bj11_total_financing_cost", "hide": false, "width": 150, "headerName": "Стоим. финанс."},
            {"field": "calc_bl5_credit_sales_interest", "hide": false, "width": 160, "headerName": "Комис. рассрочки"},
            {"field": "calc_bh3_client_advance", "hide": false, "width": 150, "headerName": "Аванс клиента"},
            {"field": "calc_supplier_advance_total", "hide": false, "width": 150, "headerName": "Аванс пост-ку"},
            {"field": "calc_purchase_with_vat_usd_total", "hide": false, "width": 150, "headerName": "Закупка с НДС"},
            {"field": "calc_ah13_forex_risk_reserve_total", "hide": false, "width": 160, "headerName": "Резерв курс. разн."},
            {"field": "calc_ai13_financial_agent_fee_total", "hide": false, "width": 170, "headerName": "Комис. фин. агента"},
            {"field": "calc_ab13_cogs_total", "hide": false, "width": 150, "headerName": "Себестоимость"},
            {"field": "calc_y13_customs_duty_total", "hide": false, "width": 130, "headerName": "Пошлина"},
            {"field": "calc_z13_excise_tax_total", "hide": false, "width": 120, "headerName": "Акциз"},
            {"field": "calc_an13_sales_vat_total", "hide": false, "width": 140, "headerName": "НДС с продаж"},
            {"field": "calc_ao13_import_vat_total", "hide": false, "width": 150, "headerName": "Импортный НДС"},
            {"field": "calc_ap13_net_vat_payable_total", "hide": false, "width": 140, "headerName": "НДС к уплате"},
            {"field": "calc_aq13_transit_commission_total", "hide": false, "width": 150, "headerName": "Комис. транзит"},
            {"field": "calc_ag13_dm_fee_total", "hide": false, "width": 160, "headerName": "Вознагражд. ЛПР"},
            {"field": "calc_internal_margin_total", "hide": false, "width": 150, "headerName": "Внутр. наценка"},
            {"field": "calc_tax_turkey_total", "hide": false, "width": 140, "headerName": "Налог Турция"},
            {"field": "calc_tax_russia_total", "hide": false, "width": 140, "headerName": "Налог Россия"},
            {"field": "logistics_eu_tr", "hide": false, "width": 150, "headerName": "Логистика ЕС+ТР"},
            {"field": "logistics_total", "hide": false, "width": 160, "headerName": "Итого логистика"},
            {"field": "tax_total_tr_rf", "hide": false, "width": 140, "headerName": "Налог ТР+РФ"},
            {"field": "week_number", "hide": false, "width": 100, "headerName": "№ недели"},
            {"field": "month_number", "hide": false, "width": 90, "headerName": "Месяц"},
            {"field": "year_number", "hide": false, "width": 80, "headerName": "Год"},
            {"field": "is_current_week", "hide": false, "width": 130, "headerName": "Текущ. неделя"},
            {"field": "is_current_month", "hide": false, "width": 130, "headerName": "Текущ. месяц"}
        ],
        "columnOrder": [
            "quote_number", "idn_quote", "created_at", "updated_at", "workflow_state", "status",
            "document_folder_link", "spec_sign_date",
            "manager_name", "manager_email", "financial_reviewed_at",
            "customer_name", "customer_inn", "customer_company_type",
            "currency", "total_with_vat_quote", "total_with_vat_usd", "total_profit_usd",
            "total_quantity", "total_weight_kg",
            "delivery_terms", "delivery_days", "payment_terms",
            "seller_company", "offer_sale_type",
            "client_advance_percent", "supplier_advance_percent", "time_to_advance_on_receiving",
            "logistics_supplier_hub", "logistics_hub_customs", "logistics_customs_client",
            "calc_ak16_final_price_total_quote", "calc_s13_sum_purchase_prices",
            "calc_bj11_total_financing_cost", "calc_bl5_credit_sales_interest",
            "calc_bh3_client_advance", "calc_supplier_advance_total",
            "calc_purchase_with_vat_usd_total", "calc_ah13_forex_risk_reserve_total",
            "calc_ai13_financial_agent_fee_total", "calc_ab13_cogs_total",
            "calc_y13_customs_duty_total", "calc_z13_excise_tax_total",
            "calc_an13_sales_vat_total", "calc_ao13_import_vat_total",
            "calc_ap13_net_vat_payable_total", "calc_aq13_transit_commission_total",
            "calc_ag13_dm_fee_total", "calc_internal_margin_total",
            "calc_tax_turkey_total", "calc_tax_russia_total",
            "logistics_eu_tr", "logistics_total", "tax_total_tr_rf",
            "week_number", "month_number", "year_number",
            "is_current_week", "is_current_month"
        ]
    }'::jsonb,
    '{}'::jsonb,
    '[{"colId": "created_at", "sort": "desc"}]'::jsonb,
    false
);

-- ============================================================
-- Verify preset created
-- ============================================================

DO $$
DECLARE
    preset_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO preset_count FROM list_presets WHERE name = 'Полный вид' AND preset_type = 'system';

    IF preset_count = 1 THEN
        RAISE NOTICE 'Successfully created "Полный вид" system preset with all 59 columns';
    ELSE
        RAISE WARNING 'Failed to create "Полный вид" preset, found % records', preset_count;
    END IF;
END $$;
