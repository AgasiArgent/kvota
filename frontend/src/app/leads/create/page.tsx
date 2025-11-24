'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  message,
  Divider,
  Row,
  Col,
  Tag,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { createLead, type LeadCreate } from '@/lib/api/lead-service';
import { listLeadStages, type LeadStage } from '@/lib/api/lead-stage-service';

const { Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export default function CreateLeadPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<LeadStage[]>([]);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      const stagesData = await listLeadStages();
      setStages(stagesData);
      // Set default stage to "Новый"
      const defaultStage = stagesData.find((s) => s.name === 'Новый');
      if (defaultStage) {
        form.setFieldsValue({ stage_id: defaultStage.id });
      }
    } catch (error: any) {
      message.error(`Ошибка загрузки этапов: ${error.message}`);
    }
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // Parse phones array from comma-separated string
      const phones = values.phones_input
        ? values.phones_input
            .split(',')
            .map((p: string) => p.trim())
            .filter(Boolean)
        : [];

      const leadData: LeadCreate = {
        company_name: values.company_name,
        inn: values.inn,
        email: values.email,
        phones: phones.length > 0 ? phones : undefined,
        primary_phone: values.primary_phone,
        segment: values.segment,
        notes: values.notes,
        stage_id: values.stage_id,
        contacts: values.contacts
          ?.filter((c: any) => c?.full_name?.trim()) // Only include contacts with names
          ?.map((c: any) => ({
            full_name: c.full_name,
            position: c.position,
            phone: c.phone,
            email: c.email,
            is_primary: c.is_primary || false,
          })),
      };

      const lead = await createLead(leadData);
      message.success(`Лид "${lead.company_name}" успешно создан`);
      router.push(`/leads/${lead.id}`);
    } catch (error: any) {
      message.error(`Ошибка создания лида: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <Space style={{ marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/leads')}>
            Назад
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            Создать лид
          </Title>
        </Space>

        {/* Form */}
        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              contacts: [{ is_primary: true }],
            }}
          >
            <Row gutter={16}>
              {/* Company Information */}
              <Col span={24}>
                <Title level={4}>Информация о компании</Title>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Название компании"
                  name="company_name"
                  rules={[{ required: true, message: 'Введите название компании' }]}
                >
                  <Input placeholder="ООО Компания" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="ИНН" name="inn">
                  <Input placeholder="1234567890" maxLength={12} />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ type: 'email', message: 'Введите корректный email' }]}
                >
                  <Input placeholder="info@company.com" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Основной телефон" name="primary_phone">
                  <Input placeholder="89991234567" />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item
                  label="Дополнительные телефоны"
                  name="phones_input"
                  help="Введите через запятую"
                >
                  <Input placeholder="89991234567, 88123456789" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Сегмент" name="segment">
                  <Input placeholder="Производство, IT, Торговля" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item label="Этап" name="stage_id">
                  <Select placeholder="Выберите этап">
                    {stages.map((stage) => (
                      <Option key={stage.id} value={stage.id}>
                        <Tag color={stage.color} style={{ marginRight: 8 }}>
                          {stage.name}
                        </Tag>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item label="Заметки" name="notes">
                  <TextArea rows={3} placeholder="Дополнительная информация о лиде" />
                </Form.Item>
              </Col>

              {/* Contacts (ЛПР) */}
              <Col span={24}>
                <Divider />
                <Title level={4}>Контактные лица (ЛПР)</Title>
              </Col>

              <Col span={24}>
                <Form.List name="contacts">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }, index) => (
                        <Card
                          key={key}
                          size="small"
                          style={{ marginBottom: 16 }}
                          title={`Контакт ${index + 1}`}
                          extra={
                            fields.length > 1 && (
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<MinusCircleOutlined />}
                                onClick={() => remove(name)}
                              />
                            )
                          }
                        >
                          <Row gutter={16}>
                            <Col span={12}>
                              <Form.Item {...restField} label="Ф.И.О." name={[name, 'full_name']}>
                                <Input placeholder="Иван Иванов (необязательно)" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item {...restField} label="Должность" name={[name, 'position']}>
                                <Input placeholder="Директор" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item {...restField} label="Телефон" name={[name, 'phone']}>
                                <Input placeholder="89991234567" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item {...restField} label="Email" name={[name, 'email']}>
                                <Input placeholder="ivanov@company.com" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Card>
                      ))}
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                        style={{ marginBottom: 16 }}
                      >
                        Добавить контакт
                      </Button>
                    </>
                  )}
                </Form.List>
              </Col>

              {/* Submit Button */}
              <Col span={24}>
                <Divider />
                <Space>
                  <Button onClick={() => router.push('/leads')}>Отмена</Button>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Создать лид
                  </Button>
                </Space>
              </Col>
            </Row>
          </Form>
        </Card>
      </div>
    </MainLayout>
  );
}
