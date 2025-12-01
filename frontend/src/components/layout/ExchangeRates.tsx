'use client';

import React, { useState, useEffect } from 'react';
import { Space, Typography, Tooltip, Spin, message } from 'antd';
import { SyncOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import { createClient } from '@/lib/supabase/client';

const { Text } = Typography;

interface ExchangeRate {
  currency: string;
  rate: number;
  change?: number; // Percentage change from yesterday
}

export default function ExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Key currencies to display
  const currencies = ['USD', 'EUR', 'TRY', 'CNY'];

  const fetchRates = async () => {
    try {
      setLoading(true);

      // Fetch all rates in parallel
      const promises = currencies.map(async (currency) => {
        const response = await fetch(`/api/exchange-rates/${currency}/RUB`);
        if (!response.ok) return null;

        const data = await response.json();
        return {
          currency,
          rate: parseFloat(data.rate),
          // TODO: Add change calculation when we have historical data
          // change: undefined  // Don't set change for now
        };
      });

      const results = await Promise.all(promises);
      const validRates = results.filter((r) => r !== null) as ExchangeRate[];

      setRates(validRates);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshFromCBR = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        message.error('Необходима авторизация');
        return;
      }

      // Call admin refresh endpoint to force fetch from CBR
      const response = await fetch('/api/exchange-rates/refresh', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        message.error(error.detail || 'Ошибка обновления курсов');
        return;
      }

      message.success('Курсы обновлены из ЦБ РФ');
      // Re-fetch to display updated rates
      await fetchRates();
    } catch (error) {
      console.error('Failed to refresh rates from CBR:', error);
      message.error('Ошибка обновления курсов');
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

  const getChangeIcon = (change?: number) => {
    if (!change) return null;
    if (change > 0) return <RiseOutlined style={{ color: '#cf1322' }} />;
    if (change < 0) return <FallOutlined style={{ color: '#52c41a' }} />;
    return null;
  };

  const getChangeColor = (change?: number) => {
    if (!change) return '#8c8c8c';
    if (change > 0) return '#cf1322'; // Red for RUB weakening
    if (change < 0) return '#52c41a'; // Green for RUB strengthening
    return '#8c8c8c';
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
        <Tooltip title="Обновить из ЦБ РФ">
          <SyncOutlined
            spin={loading}
            style={{ fontSize: '12px', cursor: 'pointer', color: 'rgba(255, 255, 255, 0.45)' }}
            onClick={refreshFromCBR}
          />
        </Tooltip>
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
            <Space size={4}>
              <Text strong style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)' }}>
                {formatRate(rate.rate)}
              </Text>
              {rate.change && rate.change !== 0 && (
                <>
                  {getChangeIcon(rate.change)}
                  <Text
                    style={{
                      fontSize: '11px',
                      color: getChangeColor(rate.change),
                    }}
                  >
                    {Math.abs(rate.change).toFixed(2)}%
                  </Text>
                </>
              )}
            </Space>
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
          <Tooltip title={`Последнее обновление: ${lastUpdated.toLocaleTimeString('ru-RU')}`}>
            <Text style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)' }}>
              Обновлено{' '}
              {lastUpdated.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
