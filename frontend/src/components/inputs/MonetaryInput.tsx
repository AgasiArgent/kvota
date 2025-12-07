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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

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

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\s/g, '');
    const newValue = parseFloat(rawValue) || 0;
    const updated: MonetaryValue = {
      ...currentValue,
      value: Math.max(min, newValue),
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Format input display value
  const displayValue = currentValue.value
    ? currentValue.value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    : '';

  return (
    <div style={{ ...style, width }}>
      {label && <Label className="mb-1.5 block">{label}</Label>}
      <div className="flex">
        <Input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleValueChange}
          disabled={disabled}
          placeholder={placeholder}
          className="rounded-r-none flex-1"
        />
        <Select
          value={currentValue.currency}
          onValueChange={handleCurrencyChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-[100px] rounded-l-none border-l-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* USD equivalent hint */}
      {showUsdHint && (
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs text-muted-foreground">≈ ${formatValue(usdEquivalent)} USD</span>
          {showRateTooltip && rateUsed && rateSource && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div>Курс: {rateUsed.toFixed(6)}</div>
                    <div>
                      Источник:{' '}
                      {rateSource === 'cbr'
                        ? 'ЦБ РФ'
                        : rateSource === 'manual'
                          ? 'Ручной'
                          : rateSource}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
};

export default MonetaryInput;
