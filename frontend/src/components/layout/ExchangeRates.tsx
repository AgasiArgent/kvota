'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExchangeRatesData {
  rates: Record<string, number>;
  last_updated: string;
  currencies_count: number;
}

const DISPLAY_CURRENCIES = ['USD', 'EUR', 'CNY', 'TRY'];

export default function ExchangeRates() {
  const [data, setData] = useState<ExchangeRatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/exchange-rates/all');
      if (!response.ok) throw new Error('Failed to fetch rates');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    // Refresh every 30 minutes
    const interval = setInterval(fetchRates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatRate = (rate: number) => {
    return rate.toFixed(4);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Курсы ЦБ РФ
        </span>
        <button
          onClick={fetchRates}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <div className="space-y-1">
          {DISPLAY_CURRENCIES.map((currency) => (
            <div key={currency} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{currency}</span>
              <span className="font-mono-numbers text-foreground">
                {data?.rates[currency] ? formatRate(data.rates[currency]) : '—'}
              </span>
            </div>
          ))}
          {data?.last_updated && (
            <p className="text-[10px] text-muted-foreground mt-2">
              {formatDate(data.last_updated)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
