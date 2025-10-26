'use client';

import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Typography, Space, Alert, Spin } from 'antd';
import { SaveOutlined, UserOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { userService, UserProfile } from '@/lib/api/user-service';

const { Title, Paragraph } = Typography;

export default function ProfilePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await userService.getProfile();

      if (response.success && response.data) {
        form.setFieldsValue({
          manager_name: response.data.manager_name || '',
          manager_phone: response.data.manager_phone || '',
          manager_email: response.data.manager_email || '',
        });
      } else {
        messageApi.error(response.error || 'Не удалось загрузить профиль');
      }
    } catch (error) {
      messageApi.error('Ошибка при загрузке профиля');
      console.error('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: Partial<UserProfile>) => {
    setSaving(true);
    try {
      const response = await userService.updateProfile(values);

      if (response.success) {
        messageApi.success('Профиль обновлен');
      } else {
        messageApi.error(response.error || 'Не удалось сохранить профиль');
      }
    } catch (error) {
      messageApi.error('Ошибка при сохранении профиля');
      console.error('Save profile error:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {contextHolder}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Title level={2}>Профиль пользователя</Title>
          <Paragraph type="secondary">
            Информация о менеджере для использования в экспорте коммерческих предложений
          </Paragraph>
        </div>

        {/* Info Alert */}
        <Alert
          message="Информация"
          description="Эти данные будут отображаться в экспортированных коммерческих предложениях (PDF, Excel) как контактная информация менеджера."
          type="info"
          showIcon
        />

        {/* Profile Form */}
        <Card loading={loading}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
            </div>
          ) : (
            <Form form={form} layout="vertical" onFinish={handleSave} autoComplete="off">
              {/* Manager Name */}
              <Form.Item
                label="Имя менеджера"
                name="manager_name"
                rules={[
                  { required: false },
                  { max: 255, message: 'Максимальная длина 255 символов' },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="Иванов Иван Иванович"
                  size="large"
                  autoFocus
                />
              </Form.Item>

              {/* Manager Phone */}
              <Form.Item
                label="Телефон менеджера"
                name="manager_phone"
                rules={[
                  { required: false },
                  {
                    pattern: /^[\d\s\+\-\(\)]+$/,
                    message: 'Некорректный формат телефона',
                  },
                  { max: 50, message: 'Максимальная длина 50 символов' },
                ]}
              >
                <Input prefix={<PhoneOutlined />} placeholder="+7 (999) 123-45-67" size="large" />
              </Form.Item>

              {/* Manager Email */}
              <Form.Item
                label="Email менеджера"
                name="manager_email"
                rules={[
                  { required: false },
                  { type: 'email', message: 'Некорректный формат email' },
                  { max: 255, message: 'Максимальная длина 255 символов' },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  type="email"
                  placeholder="manager@example.com"
                  size="large"
                />
              </Form.Item>

              {/* Save Button */}
              <Form.Item style={{ marginBottom: 0 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saving}
                  size="large"
                  block
                >
                  Сохранить профиль
                </Button>
              </Form.Item>
            </Form>
          )}
        </Card>
      </Space>
    </div>
  );
}
