'use client';

/**
 * MonetaryInput - Multi-currency input component
 *
 * Allows users to enter monetary values in any supported currency.
 * Shows USD equivalent hint when entering in foreign currency.
 *
 * Usage:
 * <MonetaryInput
 *   value={logistics}
 *   onChange={setLogistics}
 *   label="Логистика"
 *   defaultCurrency="EUR"
 * />
 */

import React, { useState, useEffect } from 'react';
import { InputNumber, Select, Space, Typography, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

// Supported currencies - matches backend SUPPORTED_CURRENCIES
export type Currency = 'USD' | 'EUR' | 'RUB' | 'TRY' | 'CNY';

export const SUPPORTED_CURRENCIES: Currency[] = ['USD', 'EUR', 'RUB', 'TRY', 'CNY'];

// Currency display options with symbols
export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string; name: string }[] =
  [
    { value: 'USD', label: '$ USD', symbol: '$', name: 'US Dollar' },
    { value: 'EUR', label: '€ EUR', symbol: '€', name: 'Euro' },
    { value: 'RUB', label: '₽ RUB', symbol: '₽', name: 'Russian Ruble' },
    { value: 'TRY', label: '₺ TRY', symbol: '₺', name: 'Turkish Lira' },
    { value: 'CNY', label: '¥ CNY', symbol: '¥', name: 'Chinese Yuan' },
  ];

/**
 * MonetaryValue - value with currency (for form state)
 */
export interface MonetaryValue {
  value: number;
  currency: Currency;
}

/**
 * MonetaryValueFull - includes USD conversion (from backend)
 */
export interface MonetaryValueFull {
  value: number;
  currency: Currency;
  value_usd: number;
  rate_used: number;
  rate_source: string;
  rate_timestamp?: string;
}

interface MonetaryInputProps {
  /** Current value (value + currency) */
  value?: MonetaryValue;
  /** Called when value or currency changes */
  onChange?: (value: MonetaryValue) => void;
  /** Optional label shown above input */
  label?: string;
  /** Default currency when no value provided */
  defaultCurrency?: Currency;
  /** Disable input */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** USD equivalent to show as hint (fetched from API) */
  usdEquivalent?: number;
  /** Exchange rate being used (for tooltip) */
  rateUsed?: number;
  /** Rate source for tooltip */
  rateSource?: string;
  /** Custom style */
  style?: React.CSSProperties;
  /** Input width (default: 100%) */
  width?: string | number;
  /** Show rate info tooltip */
  showRateTooltip?: boolean;
  /** Minimum value (default: 0) */
  min?: number;
  /** Decimal precision (default: 2) */
  precision?: number;
}

/**
 * MonetaryInput Component
 *
 * A compound input for monetary values with currency selection.
 * Integrates with Ant Design form system.
 */
export const MonetaryInput: React.FC<MonetaryInputProps> = ({
  value,
  onChange,
  label,
  defaultCurrency = 'USD',
  disabled = false,
  placeholder = '0.00',
  usdEquivalent,
  rateUsed,
  rateSource,
  style,
  width = '100%',
  showRateTooltip = true,
  min = 0,
  precision = 2,
}) => {
  // Internal state for controlled component
  const [internalValue, setInternalValue] = useState<MonetaryValue>({
    value: 0,
    currency: defaultCurrency,
  });

  // Sync with external value prop
  useEffect(() => {
    if (value) {
      setInternalValue(value);
    }
  }, [value]);

  const currentValue = value || internalValue;

  const handleValueChange = (newValue: number | null) => {
    const updated: MonetaryValue = {
      ...currentValue,
      value: newValue || 0,
    };
    setInternalValue(updated);
    onChange?.(updated);
  };

  const handleCurrencyChange = (newCurrency: Currency) => {
    const updated: MonetaryValue = {
      ...currentValue,
      currency: newCurrency,
    };
    setInternalValue(updated);
    onChange?.(updated);
  };

  // Show USD hint when not in USD and we have an equivalent
  const showUsdHint =
    currentValue.currency !== 'USD' && usdEquivalent !== undefined && currentValue.value > 0;

  // Format number with thousand separators
  const formatValue = (val: number | undefined): string => {
    if (val === undefined) return '';
    return val.toLocaleString('ru-RU', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  };

  // Rate info tooltip content
  const rateTooltipContent =
    rateUsed && rateSource ? (
      <div>
        <div>Курс: {rateUsed.toFixed(6)}</div>
        <div>
          Источник:{' '}
          {rateSource === 'cbr' ? 'ЦБ РФ' : rateSource === 'manual' ? 'Ручной' : rateSource}
        </div>
      </div>
    ) : null;

  return (
    <div style={{ ...style, width }}>
      {label && (
        <div style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: '14px' }}>{label}</Text>
        </div>
      )}
      <Space.Compact style={{ width: '100%' }}>
        <InputNumber
          value={currentValue.value || undefined}
          onChange={handleValueChange}
          disabled={disabled}
          placeholder={placeholder}
          style={{ width: '70%' }}
          min={min}
          precision={precision}
          formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
          parser={(val) => val?.replace(/\s/g, '') as unknown as number}
        />
        <Select
          value={currentValue.currency}
          onChange={handleCurrencyChange}
          disabled={disabled}
          style={{ width: '30%' }}
          options={CURRENCY_OPTIONS.map((c) => ({
            value: c.value,
            label: c.label,
          }))}
        />
      </Space.Compact>

      {/* USD equivalent hint */}
      {showUsdHint && (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ≈ ${formatValue(usdEquivalent)} USD
          </Text>
          {showRateTooltip && rateTooltipContent && (
            <Tooltip title={rateTooltipContent}>
              <InfoCircleOutlined style={{ fontSize: '12px', color: '#999' }} />
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
};

export default MonetaryInput;
