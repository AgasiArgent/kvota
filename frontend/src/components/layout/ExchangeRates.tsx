'use client';

import React, { useState, useEffect } from 'react';
import { Space, Typography, Spin, Tooltip } from 'antd';

const { Text } = Typography;

interface ExchangeRate {
  currency: string;
  rate: number;
}

interface AllRatesResponse {
  rates: Record<string, number>;
  last_updated: string | null;
  cbr_date: string | null;
  currencies_count: number;
}

export default function ExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Key currencies to display
  const currencies = ['USD', 'EUR', 'TRY', 'CNY'];

  const fetchRates = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/exchange-rates/all');
      if (!response.ok) {
        console.error('Failed to fetch rates:', response.statusText);
        return;
      }

      const data: AllRatesResponse = await response.json();

      // Extract rates for display currencies
      const displayRates: ExchangeRate[] = currencies
        .filter((currency) => currency in data.rates)
        .map((currency) => ({
          currency,
          rate: data.rates[currency],
        }));

      setRates(displayRates);
      setLastUpdated(data.last_updated);
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    // No interval needed - rates are static and updated once daily by backend cron
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatRate = (rate: number) => {
    return rate.toFixed(4);
  };

  const formatLastUpdated = (isoString: string | null): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  if (loading && rates.length === 0) {
    return (
      <div style={{ padding: '12px 24px', textAlign: 'center' }}>
        <Spin size="small" />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      }}
    >
      <div
        style={{
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'rgba(255, 255, 255, 0.45)',
          }}
        >
          Курсы валют ЦБ РФ
        </Text>
      </div>

      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        {rates.map((rate) => (
          <div
            key={rate.currency}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '2px 0',
            }}
          >
            <Text style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.65)' }}>
              {rate.currency}/RUB
            </Text>
            <Text strong style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)' }}>
              {formatRate(rate.rate)}
            </Text>
          </div>
        ))}
      </Space>

      {lastUpdated && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Tooltip title={`Данные ЦБ РФ от ${formatLastUpdated(lastUpdated)}`}>
            <Text style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)' }}>
              Обновлено {formatLastUpdated(lastUpdated)}
            </Text>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
