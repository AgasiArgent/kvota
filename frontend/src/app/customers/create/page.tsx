'use client';

import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Space,
  Typography,
  Row,
  Col,
  message,
  Divider,
  InputNumber,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { customerService } from '@/lib/api/customer-service';
import { organizationService } from '@/lib/api/organization-service';
import {
  validateINN,
  validateKPP,
  validateOGRN,
  formatINN,
  formatKPP,
  formatOGRN,
} from '@/lib/validation/russian-business';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CustomerFormData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  company_type: string;
  industry?: string;
  credit_limit?: number;
  payment_terms?: number;
  status: string;
  notes?: string;
}

export default function CreateCustomerPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [companyType, setCompanyType] = useState<string>('ooo');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  // Fetch user's organization on mount
  useEffect(() => {
    const fetchOrganization = async () => {
      setLoadingOrg(true);
      try {
        const result = await organizationService.listOrganizations();

        if (result.success && result.data && result.data.length > 0) {
          // Use the first organization (or active one if available)
          const orgId = result.data[0].organization_id;
          setOrganizationId(orgId);
          console.log('✅ Organization loaded:', orgId);
        } else {
          message.error(
            'У вас нет доступа к организации. Создайте или присоединитесь к организации.'
          );
          router.push('/organizations');
        }
      } catch (error: any) {
        console.error('Failed to load organization:', error);
        message.error(`Ошибка загрузки организации: ${error.message}`);
      } finally {
        setLoadingOrg(false);
      }
    };

    fetchOrganization();
  }, [router]);

  const handleSubmit = async (values: CustomerFormData) => {
    console.log('handleSubmit called with values:', values);

    if (!organizationId) {
      console.error('No organization ID');
      message.error('Организация не выбрана');
      return;
    }

    console.log('Organization ID:', organizationId);
    setLoading(true);

    try {
      // Add organization_id and country to the request
      const customerData = {
        ...values,
        organization_id: organizationId,
        country: values.country || 'Russia',
      };

      console.log('Sending customer data:', customerData);
      const response = await customerService.createCustomer(customerData);
      console.log('Response:', response);

      if (!response.success) {
        console.error('API error:', response.error);
        message.error(`Ошибка создания клиента: ${response.error}`);
        return;
      }

      message.success('Клиент успешно создан');
      router.push('/customers');
    } catch (error: any) {
      console.error('Exception caught:', error);
      message.error(`Ошибка создания клиента: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Custom validator for INN
  const validateINNField = (_: any, value: string) => {
    if (!value) return Promise.resolve();

    const validation = validateINN(value);
    if (!validation.isValid) {
      return Promise.reject(new Error(validation.error));
    }
    return Promise.resolve();
  };

  // Custom validator for KPP
  const validateKPPField = (_: any, value: string) => {
    if (!value) return Promise.resolve();

    const validation = validateKPP(value);
    if (!validation.isValid) {
      return Promise.reject(new Error(validation.error));
    }
    return Promise.resolve();
  };

  // Custom validator for OGRN
  const validateOGRNField = (_: any, value: string) => {
    if (!value) return Promise.resolve();

    const validation = validateOGRN(value);
    if (!validation.isValid) {
      return Promise.reject(new Error(validation.error));
    }
    return Promise.resolve();
  };

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/customers')}>
                Назад
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                Создать клиента
              </Title>
            </Space>
          </Col>
        </Row>

        {/* Form */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            company_type: 'ooo',
            status: 'active',
            payment_terms: 30,
            credit_limit: 0,
          }}
          requiredMark="optional"
        >
          <Row gutter={24}>
            {/* Basic Information */}
            <Col xs={24} lg={16}>
              <Card title="Основная информация">
                <Row gutter={16}>
                  <Col xs={24}>
                    <Form.Item
                      name="name"
                      label="Название организации"
                      rules={[
                        { required: true, message: 'Введите название' },
                        { min: 2, message: 'Минимум 2 символа' },
                      ]}
                    >
                      <Input size="large" placeholder='ООО "Название компании"' />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="company_type"
                      label="Организационно-правовая форма"
                      rules={[{ required: true, message: 'Выберите тип' }]}
                    >
                      <Select
                        size="large"
                        onChange={(value) => setCompanyType(value)}
                        options={[
                          { label: 'ООО (Общество с ограниченной ответственностью)', value: 'ooo' },
                          { label: 'АО (Акционерное общество)', value: 'ao' },
                          { label: 'ПАО (Публичное акционерное общество)', value: 'pao' },
                          { label: 'ЗАО (Закрытое акционерное общество)', value: 'zao' },
                          { label: 'ИП (Индивидуальный предприниматель)', value: 'ip' },
                          { label: 'Физическое лицо', value: 'individual' },
                        ]}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item name="industry" label="Отрасль">
                      <Select
                        size="large"
                        placeholder="Выберите отрасль"
                        options={[
                          { label: 'Промышленность', value: 'manufacturing' },
                          { label: 'Торговля', value: 'trade' },
                          { label: 'IT и технологии', value: 'it_tech' },
                          { label: 'Строительство', value: 'construction' },
                          { label: 'Транспорт', value: 'transport' },
                          { label: 'Финансы', value: 'finance' },
                          { label: 'Другое', value: 'other' },
                        ]}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="email"
                      label="Email"
                      rules={[{ type: 'email', message: 'Неверный формат email' }]}
                    >
                      <Input size="large" placeholder="info@company.ru" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item name="phone" label="Телефон">
                      <Input size="large" placeholder="+7 (495) 123-45-67" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
                      <Select
                        size="large"
                        options={[
                          { label: 'Активный', value: 'active' },
                          { label: 'Неактивный', value: 'inactive' },
                          { label: 'Приостановлен', value: 'suspended' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card title="Адрес" style={{ marginTop: 24 }}>
                <Row gutter={16}>
                  <Col xs={24}>
                    <Form.Item name="address" label="Адрес">
                      <TextArea placeholder="ул. Тверская, д. 1, оф. 101" rows={2} />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item name="city" label="Город">
                      <Input size="large" placeholder="Москва" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item name="region" label="Регион / Область">
                      <Select
                        size="large"
                        showSearch
                        placeholder="Выберите регион"
                        options={[
                          { label: 'Москва', value: 'Москва' },
                          { label: 'Санкт-Петербург', value: 'Санкт-Петербург' },
                          { label: 'Московская область', value: 'Московская область' },
                          { label: 'Ленинградская область', value: 'Ленинградская область' },
                          { label: 'Свердловская область', value: 'Свердловская область' },
                          { label: 'Новосибирская область', value: 'Новосибирская область' },
                          // Add more regions as needed
                        ]}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      name="postal_code"
                      label="Почтовый индекс"
                      rules={[
                        {
                          pattern: /^\d{6}$/,
                          message: 'Индекс должен содержать 6 цифр',
                        },
                      ]}
                    >
                      <Input size="large" placeholder="123456" maxLength={6} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>

              <Card title="Реквизиты (ИНН, КПП, ОГРН)" style={{ marginTop: 24 }}>
                <Row gutter={16}>
                  <Col xs={24}>
                    <Text type="secondary">
                      {(companyType === 'ooo' ||
                        companyType === 'ao' ||
                        companyType === 'pao' ||
                        companyType === 'zao') && (
                        <>
                          <strong>ИНН организации:</strong> 10 цифр, <strong>КПП:</strong> 9 цифр,{' '}
                          <strong>ОГРН:</strong> 13 цифр
                        </>
                      )}
                      {companyType === 'ip' && (
                        <>
                          <strong>ИНН ИП:</strong> 12 цифр (не 10!), <strong>ОГРНИП:</strong> 15
                          цифр
                        </>
                      )}
                      {companyType === 'individual' && (
                        <>
                          <strong>ИНН физ. лица:</strong> 12 цифр (необязательно)
                        </>
                      )}
                    </Text>
                    <Divider />
                  </Col>

                  <Col xs={24} md={8}>
                    <Form.Item
                      name="inn"
                      label={companyType === 'individual' ? 'ИНН (необязательно)' : 'ИНН'}
                      rules={[{ validator: validateINNField }]}
                      tooltip={
                        companyType === 'ooo' ||
                        companyType === 'ao' ||
                        companyType === 'pao' ||
                        companyType === 'zao'
                          ? 'ИНН организации: 10 цифр с проверкой контрольной суммы'
                          : companyType === 'ip'
                            ? 'ИНН ИП: 12 цифр с проверкой контрольной суммы'
                            : 'ИНН физ.лица: 12 цифр, необязательное поле'
                      }
                    >
                      <Input
                        size="large"
                        placeholder={
                          companyType === 'ooo' ||
                          companyType === 'ao' ||
                          companyType === 'pao' ||
                          companyType === 'zao'
                            ? '7701234567'
                            : '770123456789'
                        }
                        maxLength={12}
                      />
                    </Form.Item>
                  </Col>

                  {(companyType === 'ooo' ||
                    companyType === 'ao' ||
                    companyType === 'pao' ||
                    companyType === 'zao') && (
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="kpp"
                        label="КПП"
                        rules={[{ validator: validateKPPField }]}
                        tooltip="КПП организации (9 цифр)"
                      >
                        <Input size="large" placeholder="770101001" maxLength={9} />
                      </Form.Item>
                    </Col>
                  )}

                  {(companyType === 'ooo' ||
                    companyType === 'ao' ||
                    companyType === 'pao' ||
                    companyType === 'zao' ||
                    companyType === 'ip') && (
                    <Col xs={24} md={8}>
                      <Form.Item
                        name="ogrn"
                        label={
                          companyType === 'ooo' ||
                          companyType === 'ao' ||
                          companyType === 'pao' ||
                          companyType === 'zao'
                            ? 'ОГРН'
                            : 'ОГРНИП'
                        }
                        rules={[{ validator: validateOGRNField }]}
                        tooltip={
                          companyType === 'ooo' ||
                          companyType === 'ao' ||
                          companyType === 'pao' ||
                          companyType === 'zao'
                            ? 'ОГРН (13 цифр)'
                            : 'ОГРНИП (15 цифр)'
                        }
                      >
                        <Input
                          size="large"
                          placeholder={
                            companyType === 'ooo' ||
                            companyType === 'ao' ||
                            companyType === 'pao' ||
                            companyType === 'zao'
                              ? '1234567890123'
                              : '123456789012345'
                          }
                          maxLength={15}
                        />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
              </Card>
            </Col>

            {/* Financial & Notes */}
            <Col xs={24} lg={8}>
              <Card title="Финансовые условия">
                <Form.Item
                  name="credit_limit"
                  label="Кредитный лимит (₽)"
                  tooltip="Максимальная задолженность клиента"
                >
                  <InputNumber
                    size="large"
                    style={{ width: '100%' }}
                    min={0}
                    formatter={(value) => `₽ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                    parser={(value) => value?.replace(/₽\s?|(\s*)/g, '') as any}
                  />
                </Form.Item>

                <Form.Item
                  name="payment_terms"
                  label="Условия оплаты (дней)"
                  tooltip="Количество дней на оплату"
                >
                  <InputNumber
                    size="large"
                    style={{ width: '100%' }}
                    min={0}
                    max={365}
                    addonAfter="дней"
                  />
                </Form.Item>
              </Card>

              <Card title="Примечания" style={{ marginTop: 24 }}>
                <Form.Item name="notes">
                  <TextArea rows={6} placeholder="Дополнительная информация о клиенте..." />
                </Form.Item>
              </Card>

              {/* Actions */}
              <Card style={{ marginTop: 24 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    size="large"
                    block
                    loading={loading || loadingOrg}
                    disabled={!organizationId || loadingOrg}
                  >
                    Создать клиента
                  </Button>
                  <Button size="large" block onClick={() => router.push('/customers')}>
                    Отмена
                  </Button>
                </Space>
              </Card>
            </Col>
          </Row>
        </Form>
      </Space>
    </MainLayout>
  );
}
