'use client';

import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Badge, Button, theme } from 'antd';
import {
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ApartmentOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import OrganizationSwitcher from '@/components/organizations/OrganizationSwitcher';
import FeedbackButton from '@/components/FeedbackButton';
import ExchangeRates from './ExchangeRates';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { token } = theme.useToken();

  // Menu items based on user role
  const getMenuItems = () => {
    // Get the user's role - prefer organizationRole from organization_members table
    const userRole = profile?.organizationRole || profile?.role || '';
    const isAdmin = userRole && ['admin', 'owner'].includes(userRole.toLowerCase());

    // Common items for all users
    const menuItems: any[] = [
      {
        key: '/quotes',
        icon: <FileTextOutlined />,
        label: 'Коммерческие предложения',
      },
      {
        key: '/customers',
        icon: <TeamOutlined />,
        label: 'Клиенты',
      },
      {
        key: '/profile',
        icon: <UserOutlined />,
        label: 'Профиль',
      },
    ];

    // Admin-only section
    if (isAdmin) {
      // Divider before admin section
      menuItems.push({
        type: 'divider',
        key: 'admin-divider',
      });

      // Admin section header
      menuItems.push({
        key: 'admin-group',
        type: 'group',
        label: 'Управление',
        children: [
          {
            key: 'crm-menu',
            icon: <UserOutlined />,
            label: 'CRM',
            children: [
              {
                key: '/leads',
                label: 'Лиды',
              },
              {
                key: '/leads/pipeline',
                label: 'Воронка',
              },
            ],
          },
          {
            key: '/organizations',
            icon: <ApartmentOutlined />,
            label: 'Организации',
          },
          {
            key: 'analytics-menu',
            icon: <BarChartOutlined />,
            label: 'Аналитика',
            children: [
              {
                key: '/analytics',
                label: 'Запросы',
              },
              {
                key: '/analytics/saved',
                label: 'Сохранённые отчёты',
              },
              {
                key: '/analytics/history',
                label: 'История',
              },
              {
                key: '/analytics/scheduled',
                label: 'Расписание',
              },
            ],
          },
          {
            key: 'settings-menu',
            icon: <SettingOutlined />,
            label: 'Настройки',
            children: [
              {
                key: '/settings/team',
                label: 'Команда',
              },
              {
                key: '/settings/calculation',
                label: 'Настройки расчета',
              },
              {
                key: '/settings/exchange-rates',
                label: 'Курсы валют',
              },
            ],
          },
          {
            key: '/admin',
            icon: <SettingOutlined />,
            label: 'Администрирование',
            children: [
              {
                key: '/admin/users',
                label: 'Пользователи',
              },
              {
                key: '/admin/settings',
                label: 'Настройки',
              },
              {
                key: '/activity',
                label: 'История действий',
              },
              {
                key: '/admin/feedback',
                label: 'Обратная связь',
              },
              {
                key: '/admin/excel-validation',
                label: 'Валидация Excel',
              },
            ],
          },
        ],
      });
    }

    return menuItems;
  };

  // User dropdown menu
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Профиль',
      onClick: () => router.push('/profile'),
    },
    {
      key: 'divider1',
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Выйти',
      onClick: signOut,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            height: '64px',
            margin: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {collapsed ? (
            <Title level={4} style={{ color: 'white', margin: 0 }}>
              КП
            </Title>
          ) : (
            <OrganizationSwitcher darkMode />
          )}
        </div>

        {!collapsed && <ExchangeRates />}

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={getMenuItems()}
          onClick={({ key }) => router.push(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200 }}>
        <Header
          style={{
            padding: '0 24px',
            background: token.colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${token.colorBorder}`,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />

          <Space size="large">
            {/* Notifications */}
            <Badge count={5} size="small">
              <Button type="text" icon={<BellOutlined />} style={{ fontSize: '16px' }} />
            </Badge>

            {/* User dropdown */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" arrow>
              <Space style={{ cursor: 'pointer' }} align="center">
                <Avatar size="large" icon={<UserOutlined />} src={profile?.avatar_url} />
                {!collapsed && (
                  <Text strong style={{ display: 'block' }}>
                    {profile?.full_name || user?.email}
                  </Text>
                )}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px',
            padding: '24px',
            minHeight: 280,
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* Floating Feedback Button */}
      {user && <FeedbackButton />}
    </Layout>
  );
}
