'use client';

import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Divider,
  Alert,
  Row,
  Col,
  Select,
} from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import Link from 'next/link';

const { Title, Text, Paragraph } = Typography;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (values: {
    email: string;
    password: string;
    confirmPassword: string;
    full_name: string;
  }) => {
    setLoading(true);
    setError(null);

    // Validate password confirmation
    if (values.password !== values.confirmPassword) {
      setError('Пароли не совпадают');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signUp(values.email, values.password, {
        full_name: values.full_name,
        role: 'member', // Default role, actual role assigned in organization
      });

      if (error) {
        // Transform Supabase error messages to user-friendly Russian
        let errorMessage = error.message;

        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('User already registered')
        ) {
          errorMessage =
            'Этот email уже зарегистрирован. Попробуйте войти в систему или используйте другой email.';
        } else if (errorMessage.includes('Invalid email')) {
          errorMessage = 'Некорректный формат email';
        } else if (errorMessage.includes('Password')) {
          errorMessage = 'Пароль должен содержать минимум 6 символов';
        }

        setError(errorMessage);
        setLoading(false);
        return;
      }

      setRegisteredEmail(values.email);
      setSuccess(true);
      // Note: User needs to confirm email before they can login
    } catch (_err) {
      setError('Произошла неожиданная ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <Row justify="center" style={{ width: '100%', maxWidth: '600px' }}>
          <Col span={24}>
            <Card style={{ borderRadius: '12px', textAlign: 'center' }}>
              <Space direction="vertical" size="large" style={{ textAlign: 'center' }}>
                <Title level={2} style={{ color: '#52c41a' }}>
                  Регистрация успешна!
                </Title>
                <Paragraph style={{ fontSize: '16px' }}>
                  📧 Мы отправили письмо с подтверждением на ваш email:
                  <br />
                  <strong>{registeredEmail}</strong>
                </Paragraph>
                <Paragraph>
                  Пожалуйста, перейдите по ссылке в письме для подтверждения email. После
                  подтверждения вы сможете войти в систему и создать свою первую организацию!
                </Paragraph>
                <Divider />
                <Paragraph type="secondary">Подтвердили email?</Paragraph>
                <Button type="primary" size="large" onClick={() => router.push('/auth/login')}>
                  Войти в систему
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <Row justify="center" style={{ width: '100%', maxWidth: '1200px' }}>
        <Col xs={24} sm={20} md={16} lg={12} xl={10}>
          <Card
            style={{
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Header */}
              <div style={{ textAlign: 'center' }}>
                <Title level={2} style={{ marginBottom: '8px', color: '#1890ff' }}>
                  Регистрация
                </Title>
                <Paragraph style={{ color: '#666', marginBottom: 0 }}>
                  Создайте аккаунт для работы с коммерческими предложениями
                </Paragraph>
              </div>

              <Divider />

              {/* Error Alert */}
              {error && (
                <Alert
                  message="Ошибка регистрации"
                  description={error}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setError(null)}
                />
              )}

              {/* Registration Form */}
              <Form
                name="register"
                onFinish={handleSubmit}
                layout="vertical"
                size="large"
                autoComplete="off"
              >
                <Form.Item
                  label="Полное имя"
                  name="full_name"
                  rules={[
                    { required: true, message: 'Пожалуйста, введите полное имя' },
                    { min: 2, message: 'Имя должно содержать минимум 2 символа' },
                  ]}
                >
                  <Input prefix={<UserOutlined />} placeholder="Иван Иванов" autoComplete="name" />
                </Form.Item>

                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { required: true, message: 'Пожалуйста, введите email' },
                    { type: 'email', message: 'Введите корректный email' },
                  ]}
                >
                  <Input
                    prefix={<MailOutlined />}
                    placeholder="your@email.com"
                    autoComplete="email"
                  />
                </Form.Item>

                <Form.Item
                  label="Пароль"
                  name="password"
                  rules={[
                    { required: true, message: 'Пожалуйста, введите пароль' },
                    { min: 6, message: 'Пароль должен содержать минимум 6 символов' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Минимум 6 символов"
                    autoComplete="new-password"
                  />
                </Form.Item>

                <Form.Item
                  label="Подтверждение пароля"
                  name="confirmPassword"
                  rules={[{ required: true, message: 'Пожалуйста, подтвердите пароль' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Повторите пароль"
                    autoComplete="new-password"
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: '16px' }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{ height: '48px', fontSize: '16px' }}
                  >
                    Зарегистрироваться
                  </Button>
                </Form.Item>
              </Form>

              <Divider />

              {/* Login Link */}
              <div style={{ textAlign: 'center' }}>
                <Text>
                  Уже есть аккаунт?{' '}
                  <Link href="/auth/login" style={{ color: '#1890ff' }}>
                    Войти в систему
                  </Link>
                </Text>
              </div>

              {/* Next Steps */}
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
                <Title level={5} style={{ marginBottom: '12px' }}>
                  Что дальше?
                </Title>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                  <li>Создайте свою организацию или присоединитесь к существующей</li>
                  <li>Получите роль в организации (владелец, менеджер, финансист и т.д.)</li>
                  <li>Начните работать с коммерческими предложениями</li>
                </ul>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
