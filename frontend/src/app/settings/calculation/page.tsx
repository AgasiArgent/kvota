'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Button,
  message,
  Spin,
  Typography,
  Space,
  Divider,
  Alert,
  Statistic,
} from 'antd';
import { SaveOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import {
  calculationSettingsService,
  CalculationSettings,
  CalculationSettingsUpdate,
} from '@/lib/api/calculation-settings-service';

const { Title, Text, Paragraph } = Typography;

export default function CalculationSettingsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CalculationSettings | null>(null);
  const [annualRate, setAnnualRate] = useState<number>(25.0);
  const [messageApi, contextHolder] = message.useMessage();

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await calculationSettingsService.getSettings();

      if (response.success && response.data) {
        setSettings(response.data);

        // Convert daily rate to annual rate for display
        const annualFromDaily =
          calculationSettingsService.dailyToAnnualRate(response.data.rate_loan_interest_daily) *
          100;
        setAnnualRate(annualFromDaily);

        // Set form values
        form.setFieldsValue({
          rate_forex_risk: response.data.rate_forex_risk,
          rate_fin_comm: response.data.rate_fin_comm,
          annual_interest_rate: annualFromDaily,
        });
      } else {
        messageApi.error(response.error || 'Не удалось загрузить настройки');
      }
    } catch (error) {
      messageApi.error('Ошибка при загрузке настроек');
      console.error('Load settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    // Convert annual rate to daily rate for backend
    const dailyRate = calculationSettingsService.annualToDailyRate(
      values.annual_interest_rate / 100
    );

    const settingsData: CalculationSettingsUpdate = {
      rate_forex_risk: values.rate_forex_risk,
      rate_fin_comm: values.rate_fin_comm,
      rate_loan_interest_daily: dailyRate,
    };

    // Validate
    const validation = calculationSettingsService.validateSettings(settingsData);
    if (!validation.isValid) {
      validation.errors.forEach((error) => messageApi.error(error));
      return;
    }

    setSaving(true);
    try {
      const response = await calculationSettingsService.saveSettings(settingsData);

      if (response.success && response.data) {
        setSettings(response.data);
        messageApi.success('Настройки успешно сохранены');
      } else {
        if (response.error?.includes('403') || response.error?.includes('Forbidden')) {
          messageApi.error(
            'У вас нет прав для изменения настроек. Требуются права администратора или владельца организации.'
          );
        } else {
          messageApi.error(response.error || 'Не удалось сохранить настройки');
        }
      }
    } catch (error) {
      messageApi.error('Ошибка при сохранении настроек');
      console.error('Save settings error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = calculationSettingsService.getDefaultSettings();
    const defaultAnnual =
      calculationSettingsService.dailyToAnnualRate(defaults.rate_loan_interest_daily) * 100;

    form.setFieldsValue({
      rate_forex_risk: defaults.rate_forex_risk,
      rate_fin_comm: defaults.rate_fin_comm,
      annual_interest_rate: defaultAnnual,
    });
    setAnnualRate(defaultAnnual);

    // Save the default values to backend
    setSaving(true);
    try {
      const response = await calculationSettingsService.saveSettings(defaults);

      if (response.success && response.data) {
        setSettings(response.data);
        messageApi.success('Настройки сброшены до значений по умолчанию и сохранены');
      } else {
        if (response.error?.includes('403') || response.error?.includes('Forbidden')) {
          messageApi.error(
            'У вас нет прав для изменения настроек. Требуются права администратора или владельца организации.'
          );
        } else {
          messageApi.error(response.error || 'Не удалось сохранить настройки');
        }
      }
    } catch (error) {
      messageApi.error('Ошибка при сохранении настроек');
      console.error('Reset settings error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Calculate daily rate from annual rate for display
  const dailyRate = calculationSettingsService.annualToDailyRate(annualRate / 100);

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {contextHolder}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Title level={2}>Настройки расчетов</Title>
          <Paragraph type="secondary">
            Общие параметры расчета для всей организации. Эти настройки могут изменять только
            администраторы.
          </Paragraph>
        </div>

        {/* Info Alert */}
        <Alert
          message="Важно"
          description="Изменение этих настроек повлияет на все новые расчеты котировок. Существующие котировки останутся без изменений."
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
        />

        {/* Main Form Card */}
        <Card loading={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={{
              rate_forex_risk: 3.0,
              rate_fin_comm: 2.0,
              annual_interest_rate: 25.0, // Default annual rate
            }}
          >
            {/* Currency Exchange Risk */}
            <Form.Item
              label={
                <Space>
                  <Text strong>Резерв на потери на курсовой разнице</Text>
                  <Text type="secondary">(rate_forex_risk)</Text>
                </Space>
              }
              name="rate_forex_risk"
              rules={[
                { required: true, message: 'Обязательное поле' },
                { type: 'number', min: 0, max: 100, message: 'Значение должно быть от 0 до 100' },
              ]}
              tooltip="Процент резерва для покрытия возможных потерь при колебаниях курса валют"
            >
              <InputNumber
                style={{ width: '200px' }}
                min={0}
                max={100}
                step={0.1}
                precision={2}
                addonAfter="%"
                placeholder="3.0"
              />
            </Form.Item>

            <Divider />

            {/* Financial Agent Commission */}
            <Form.Item
              label={
                <Space>
                  <Text strong>Комиссия финансового агента</Text>
                  <Text type="secondary">(rate_fin_comm)</Text>
                </Space>
              }
              name="rate_fin_comm"
              rules={[
                { required: true, message: 'Обязательное поле' },
                { type: 'number', min: 0, max: 100, message: 'Значение должно быть от 0 до 100' },
              ]}
              tooltip="Процент комиссии финансового агента за услуги финансирования"
            >
              <InputNumber
                style={{ width: '200px' }}
                min={0}
                max={100}
                step={0.1}
                precision={2}
                addonAfter="%"
                placeholder="2.0"
              />
            </Form.Item>

            <Divider />

            {/* Annual Interest Rate (User Input) */}
            <Form.Item
              label={
                <Space>
                  <Text strong>Годовая процентная ставка</Text>
                  <Text type="secondary">(annual interest rate)</Text>
                </Space>
              }
              name="annual_interest_rate"
              rules={[
                { required: true, message: 'Обязательное поле' },
                {
                  type: 'number',
                  min: 0.01,
                  max: 100,
                  message: 'Значение должно быть от 0.01% до 100%',
                },
              ]}
              tooltip="Годовая процентная ставка кредита (автоматически конвертируется в дневную ставку)"
            >
              <InputNumber
                style={{ width: '200px' }}
                min={0.01}
                max={100}
                step={0.01}
                precision={2}
                addonAfter="%"
                placeholder="25.0"
                onChange={(value) => setAnnualRate(value || 0)}
              />
            </Form.Item>

            {/* Daily Rate Display (Calculated, Read-Only) */}
            <Card
              size="small"
              style={{ marginTop: '-16px', marginBottom: '24px', backgroundColor: '#f5f5f5' }}
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Statistic
                  title="Дневная ставка (rate_loan_interest_daily)"
                  value={dailyRate.toFixed(8)}
                  precision={8}
                  valueStyle={{ fontSize: '16px', fontFamily: 'monospace' }}
                />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Рассчитано как: годовая ставка ÷ 365 = {annualRate.toFixed(2)}% ÷ 365 ={' '}
                  {dailyRate.toFixed(8)}
                </Text>
                <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                  Это значение будет сохранено в базе данных и использовано в расчетах
                </Text>
              </Space>
            </Card>

            <Divider />

            {/* Buttons */}
            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
                  Сохранить настройки
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  Сбросить до значений по умолчанию
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        {/* Metadata Card */}
        {settings && settings.id && (
          <Card size="small" title="Информация о настройках">
            <Space direction="vertical" size="small">
              <Text>
                <Text type="secondary">Последнее обновление: </Text>
                {new Date(settings.updated_at).toLocaleString('ru-RU')}
              </Text>
              {settings.updated_by_name && (
                <Text>
                  <Text type="secondary">Обновил: </Text>
                  <Text strong>{settings.updated_by_name}</Text>
                  {settings.updated_by_role && (
                    <Text type="secondary"> ({settings.updated_by_role})</Text>
                  )}
                </Text>
              )}
              {settings.organization_name && (
                <Text>
                  <Text type="secondary">Организация: </Text>
                  <Text strong>{settings.organization_name}</Text>
                  {settings.organization_inn && (
                    <Text type="secondary"> (ИНН: {settings.organization_inn})</Text>
                  )}
                </Text>
              )}
            </Space>
          </Card>
        )}
      </Space>
    </div>
  );
}
