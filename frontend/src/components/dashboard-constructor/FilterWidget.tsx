'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { FilterWidgetConfig } from '@/types/dashboard';

interface DateRange {
  from?: Date;
  to?: Date;
}

interface FilterWidgetProps {
  config: FilterWidgetConfig;
  value?: unknown;
  options?: Array<{ value: string; label: string }>;
  onChange?: (value: unknown) => void;
}

/**
 * Filter widget for dashboard-wide filtering
 * Supports date range, single select, and multi select
 */
export function FilterWidget({ config, value, options = [], onChange }: FilterWidgetProps) {
  switch (config.filter_type) {
    case 'date_range':
      return <DateRangeFilter value={value as DateRange | undefined} onChange={onChange} />;
    case 'campaign_select':
      return (
        <CampaignSelectFilter
          value={value as string | undefined}
          options={options}
          onChange={onChange}
        />
      );
    case 'multi_select':
      return (
        <MultiSelectFilter
          value={value as string[] | undefined}
          options={options}
          onChange={onChange}
        />
      );
    default:
      return null;
  }
}

interface DateRangeFilterProps {
  value?: DateRange;
  onChange?: (value: DateRange) => void;
}

function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [dateRange, setDateRange] = React.useState<DateRange>(value || {});

  const handleSelect = (range: DateRange | undefined) => {
    const newRange = range || {};
    setDateRange(newRange);
    onChange?.(newRange);
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              !dateRange.from && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, 'dd.MM.yyyy', { locale: ru })} -{' '}
                  {format(dateRange.to, 'dd.MM.yyyy', { locale: ru })}
                </>
              ) : (
                format(dateRange.from, 'dd.MM.yyyy', { locale: ru })
              )
            ) : (
              'Выберите период'
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={{ from: dateRange.from, to: dateRange.to }}
            onSelect={handleSelect}
            numberOfMonths={2}
            locale={ru}
          />
        </PopoverContent>
      </Popover>

      {/* Quick date range buttons */}
      <div className="flex gap-1 flex-wrap">
        <QuickDateButton
          label="7 дней"
          days={7}
          onSelect={(from, to) => handleSelect({ from, to })}
        />
        <QuickDateButton
          label="30 дней"
          days={30}
          onSelect={(from, to) => handleSelect({ from, to })}
        />
        <QuickDateButton
          label="90 дней"
          days={90}
          onSelect={(from, to) => handleSelect({ from, to })}
        />
      </div>
    </div>
  );
}

interface QuickDateButtonProps {
  label: string;
  days: number;
  onSelect: (from: Date, to: Date) => void;
}

function QuickDateButton({ label, days, onSelect }: QuickDateButtonProps) {
  const handleClick = () => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onSelect(from, to);
  };

  return (
    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClick}>
      {label}
    </Button>
  );
}

interface CampaignSelectFilterProps {
  value?: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
}

function CampaignSelectFilter({ value, options, onChange }: CampaignSelectFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Выберите кампанию" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Все кампании</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface MultiSelectFilterProps {
  value?: string[];
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string[]) => void;
}

function MultiSelectFilter({ value = [], options, onChange }: MultiSelectFilterProps) {
  const toggleOption = (optValue: string) => {
    const newValue = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue];
    onChange?.(newValue);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <Button
          key={opt.value}
          variant={value.includes(opt.value) ? 'default' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => toggleOption(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export default FilterWidget;
