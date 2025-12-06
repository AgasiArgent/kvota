'use client';

/**
 * Exchange Rate Settings Page
 *
 * Admin page for managing organization exchange rates.
 * - Toggle between automatic CBR rates and manual rates
 * - View/edit individual currency rates
 * - Sync rates from CBR
 */

import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Switch,
  Button,
  message,
  Spin,
  Typography,
  Space,
  Alert,
  Modal,
  InputNumber,
  Form,
  Tag,
  Tooltip,
} from 'antd';
import {
  SyncOutlined,
  EditOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import {
  getOrgExchangeRates,
  updateExchangeRateSettings,
  updateOrgRate,
  syncRatesFromCBR,
  OrgExchangeRate,
  OrgExchangeRateSettings,
} from '@/lib/api/org-exchange-rates-service';

const { Title, Text, Paragraph } = Typography;

// Currency display info
const CURRENCY_INFO: Record<string, { symbol: string; name: string }> = {
  EUR: { symbol: '€', name: 'Евро' },
  RUB: { symbol: '₽', name: 'Российский рубль' },
  TRY: { symbol: '₺', name: 'Турецкая лира' },
  CNY: { symbol: '¥', name: 'Китайский юань' },
};

export default function ExchangeRateSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState<OrgExchangeRateSettings | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRate, setEditingRate] = useState<OrgExchangeRate | null>(null);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getOrgExchangeRates();
      setSettings(data);
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      } else {
        messageApi.error('Не удалось загрузить настройки курсов валют');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleManualRates = async (checked: boolean) => {
    setSaving(true);
    try {
      await updateExchangeRateSettings({ use_manual_exchange_rates: checked });
      setSettings((prev) => (prev ? { ...prev, use_manual_exchange_rates: checked } : null));
      messageApi.success(
        checked ? 'Включены ручные курсы валют' : 'Включены автоматические курсы ЦБ РФ'
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          messageApi.error(
            'У вас нет прав для изменения настроек. Требуются права администратора.'
          );
        } else {
          messageApi.error(error.message);
        }
      } else {
        messageApi.error('Не удалось изменить настройки');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromCBR = async () => {
    setSyncing(true);
    try {
      const result = await syncRatesFromCBR();
      messageApi.success(result.message);
      await loadSettings();
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      } else {
        messageApi.error('Не удалось синхронизировать курсы с ЦБ РФ');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleEditRate = (rate: OrgExchangeRate) => {
    setEditingRate(rate);
    form.setFieldsValue({ rate: rate.rate });
    setEditModalVisible(true);
  };

  const handleSaveRate = async () => {
    if (!editingRate) return;

    try {
      const values = await form.validateFields();
      setSaving(true);

      await updateOrgRate(editingRate.from_currency, values.rate);
      messageApi.success(`Курс ${editingRate.from_currency}/USD обновлен`);

      // Reload settings to get fresh data
      await loadSettings();
      setEditModalVisible(false);
      setEditingRate(null);
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Валюта',
      dataIndex: 'from_currency',
      key: 'from_currency',
      render: (currency: string) => {
        const info = CURRENCY_INFO[currency];
        return (
          <Space>
            <Text strong>
              {info?.symbol} {currency}
            </Text>
            <Text type="secondary">{info?.name}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Курс к USD',
      dataIndex: 'rate',
      key: 'rate',
      render: (rate: number, record: OrgExchangeRate) => (
        <Space>
          <Text style={{ fontFamily: 'monospace' }}>{rate.toFixed(6)}</Text>
          <Tooltip title={`1 ${record.from_currency} = ${rate.toFixed(6)} USD`}>
            <InfoCircleOutlined style={{ color: '#999' }} />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Источник',
      dataIndex: 'source',
      key: 'source',
      render: (source: string) => (
        <Tag color={source === 'manual' ? 'default' : 'green'}>
          {source === 'manual' ? 'Ручной' : source === 'cbr_sync' ? 'ЦБ РФ' : source}
        </Tag>
      ),
    },
    {
      title: 'Обновлено',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString('ru-RU')}>
          <Space>
            <ClockCircleOutlined />
            <Text type="secondary">{new Date(date).toLocaleDateString('ru-RU')}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, record: OrgExchangeRate) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => handleEditRate(record)}
          disabled={!settings?.use_manual_exchange_rates}
        >
          Изменить
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {contextHolder}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Title level={2}>Курсы валют</Title>
          <Paragraph type="secondary">
            Управление курсами валют для расчета котировок. Все валюты конвертируются в USD для
            хранения и аналитики.
          </Paragraph>
        </div>

        {/* Mode Toggle Card */}
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
              <Space direction="vertical" size="small">
                <Text strong>Режим курсов валют</Text>
                <Text type="secondary">
                  {settings?.use_manual_exchange_rates
                    ? 'Используются ручные курсы из таблицы ниже'
                    : 'Используются автоматические курсы ЦБ РФ'}
                </Text>
              </Space>
              <Space>
                <Text type="secondary">Автоматические (ЦБ)</Text>
                <Switch
                  checked={settings?.use_manual_exchange_rates}
                  onChange={handleToggleManualRates}
                  loading={saving}
                  checkedChildren={<CheckCircleOutlined />}
                />
                <Text type="secondary">Ручные</Text>
              </Space>
            </Space>

            {settings?.use_manual_exchange_rates && (
              <Alert
                message="Ручные курсы активны"
                description="Курсы из таблицы ниже будут использоваться для всех новых котировок. Не забывайте периодически обновлять курсы."
                type="warning"
                showIcon
              />
            )}

            {!settings?.use_manual_exchange_rates && (
              <Alert
                message="Автоматические курсы ЦБ РФ"
                description="Курсы автоматически обновляются ежедневно из данных Центрального Банка России."
                type="info"
                showIcon
              />
            )}
          </Space>
        </Card>

        {/* Rates Table Card */}
        <Card
          title="Текущие курсы"
          extra={
            <Button
              type="primary"
              icon={<SyncOutlined spin={syncing} />}
              onClick={handleSyncFromCBR}
              loading={syncing}
              disabled={!settings?.use_manual_exchange_rates}
            >
              Синхронизировать с ЦБ РФ
            </Button>
          }
        >
          {!settings?.use_manual_exchange_rates && (
            <Alert
              message="Редактирование недоступно"
              description="Включите ручные курсы для редактирования. Кнопка синхронизации скопирует текущие курсы ЦБ в вашу таблицу."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Table
            dataSource={settings?.rates || []}
            columns={columns}
            rowKey={(record) => `${record.from_currency}-${record.to_currency}`}
            pagination={false}
            size="middle"
          />

          {settings?.rates && settings.rates.length === 0 && settings.use_manual_exchange_rates && (
            <Alert
              message="Нет сохраненных курсов"
              description='Нажмите "Синхронизировать с ЦБ РФ" чтобы загрузить актуальные курсы.'
              type="warning"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>

        {/* Info Card */}
        <Card size="small" title="Информация о курсах">
          <Space direction="vertical" size="small">
            <Text>
              <InfoCircleOutlined style={{ marginRight: 8 }} />
              <Text type="secondary">
                Курсы хранятся как количество USD за 1 единицу валюты (например: 1 EUR = 1.08 USD)
              </Text>
            </Text>
            <Text>
              <InfoCircleOutlined style={{ marginRight: 8 }} />
              <Text type="secondary">
                При создании котировки курс фиксируется и сохраняется вместе с каждым денежным
                значением
              </Text>
            </Text>
            <Text>
              <InfoCircleOutlined style={{ marginRight: 8 }} />
              <Text type="secondary">
                Пересчет котировки по новым курсам создает новую версию с сохранением истории
              </Text>
            </Text>
          </Space>
        </Card>
      </Space>

      {/* Edit Rate Modal */}
      <Modal
        title={`Изменить курс ${editingRate?.from_currency}/USD`}
        open={editModalVisible}
        onOk={handleSaveRate}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRate(null);
        }}
        confirmLoading={saving}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={
              <Space>
                <Text>Курс к USD</Text>
                <Tooltip
                  title={`Сколько USD за 1 ${editingRate?.from_currency}. Например: 1 EUR = 1.08 USD`}
                >
                  <InfoCircleOutlined />
                </Tooltip>
              </Space>
            }
            name="rate"
            rules={[
              { required: true, message: 'Введите курс' },
              { type: 'number', min: 0.000001, message: 'Курс должен быть положительным числом' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.000001}
              step={0.0001}
              precision={6}
              placeholder="1.080000"
              addonAfter="USD"
              addonBefore={`1 ${editingRate?.from_currency} =`}
            />
          </Form.Item>

          {editingRate && (
            <Alert
              message={`Текущий курс: ${editingRate.rate.toFixed(6)} USD`}
              description={`Источник: ${editingRate.source === 'manual' ? 'Ручной' : 'ЦБ РФ'}`}
              type="info"
              showIcon
            />
          )}
        </Form>
      </Modal>
    </div>
  );
}
