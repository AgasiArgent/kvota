'use client';

import React, { useState, Suspense } from 'react';
import { Card, Form, Input, Button, Typography, Space, Divider, Alert, Row, Col, Spin } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import Link from 'next/link';

const { Title, Text, Paragraph } = Typography;

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const _router = useRouter(); // Reserved for future navigation
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/onboarding';

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await signIn(values.email, values.password);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Refresh the page to trigger middleware check
      // Middleware will redirect authenticated users from /auth/* to appropriate page
      window.location.href = redirectTo;
    } catch {
      setError('Произошла неожиданная ошибка');
      setLoading(false);
    }
  };

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
        <Col xs={24} sm={20} md={16} lg={12} xl={8}>
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
                  Коммерческие предложения
                </Title>
                <Paragraph style={{ color: '#666', marginBottom: 0 }}>
                  Система управления КП для российского B2B
                </Paragraph>
              </div>

              <Divider />

              {/* Error Alert */}
              {error && (
                <Alert
                  message="Ошибка входа"
                  description={error}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setError(null)}
                />
              )}

              {/* Login Form */}
              <Form
                name="login"
                onFinish={handleSubmit}
                layout="vertical"
                size="large"
                autoComplete="off"
              >
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
                    placeholder="Ваш пароль"
                    autoComplete="current-password"
                  />
                </Form.Item>

                <div style={{ marginBottom: '24px', textAlign: 'right' }}>
                  <Link href="/auth/forgot-password" style={{ color: '#1890ff' }}>
                    Забыли пароль?
                  </Link>
                </div>

                <Form.Item style={{ marginBottom: '16px' }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    style={{ height: '48px', fontSize: '16px' }}
                  >
                    Войти в систему
                  </Button>
                </Form.Item>
              </Form>

              <Divider />

              {/* Registration Link */}
              <div style={{ textAlign: 'center' }}>
                <Text>
                  Нет аккаунта?{' '}
                  <Link href="/auth/register" style={{ color: '#1890ff' }}>
                    Зарегистрироваться
                  </Link>
                </Text>
              </div>

              {/* Features */}
              <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
                <Title level={5} style={{ marginBottom: '12px' }}>
                  Возможности системы:
                </Title>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>Создание и управление коммерческими предложениями</li>
                  <li>Многоуровневое утверждение (менеджер → финансы → директор)</li>
                  <li>Валидация российских реквизитов (ИНН, КПП, ОГРН)</li>
                  <li>Поддержка валют: RUB, CNY, USD, EUR</li>
                  <li>Автоматический расчет НДС (20%, 10%, 0%)</li>
                </ul>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin size="large" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
