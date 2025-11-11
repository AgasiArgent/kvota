'use client';

import React, { useState } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Typography,
  Space,
  Badge,
  Divider,
  Button,
  theme,
} from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ApartmentOutlined,
  DeleteOutlined,
  HistoryOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import OrganizationSwitcher from '@/components/organizations/OrganizationSwitcher';
import FeedbackButton from '@/components/FeedbackButton';

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

    const baseItems = [
      {
        key: '/dashboard',
        icon: <DashboardOutlined />,
        label: 'Панель управления',
      },
      {
        key: 'quotes-menu',
        icon: <FileTextOutlined />,
        label: 'Коммерческие предложения',
        children: [
          {
            key: '/quotes',
            label: 'Все КП',
          },
          {
            key: '/quotes/create',
            label: 'Создать КП',
          },
          {
            key: '/quotes/drafts',
            label: 'Черновики',
          },
          {
            key: '/quotes/bin',
            label: 'Корзина',
          },
        ],
      },
      {
        key: '/customers',
        icon: <TeamOutlined />,
        label: 'Клиенты',
      },
      {
        key: '/organizations',
        icon: <ApartmentOutlined />,
        label: 'Организации',
      },
      {
        key: '/activity',
        icon: <HistoryOutlined />,
        label: 'История действий',
      },
    ];

    // Add approval items for managers and above
    if (
      userRole &&
      ['finance_manager', 'department_manager', 'director', 'admin', 'owner', 'manager'].includes(
        userRole.toLowerCase()
      )
    ) {
      baseItems[1].children?.push({
        key: '/quotes/approval',
        label: 'На утверждении',
      });
    }

    // Add analytics menu for admin/owner
    if (userRole && ['admin', 'owner'].includes(userRole.toLowerCase())) {
      baseItems.push({
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
      });
    }

    // Add settings items
    const settingsChildren = [];

    // All users can access profile
    settingsChildren.push({
      key: '/profile',
      label: 'Профиль',
    });

    // Admin/manager/owner can access team management
    const managerRoles = [
      'admin',
      'owner',
      'manager',
      'sales_manager',
      'finance_manager',
      'department_manager',
      'director',
    ];
    if (userRole && managerRoles.includes(userRole.toLowerCase())) {
      settingsChildren.push({
        key: '/settings/team',
        label: 'Команда',
      });
    }

    // Admin/owner can access calculation settings (case-insensitive)
    if (userRole && ['admin', 'owner'].includes(userRole.toLowerCase())) {
      settingsChildren.push({
        key: '/settings/calculation',
        label: 'Настройки расчета',
      });
    }

    baseItems.push({
      key: 'settings-menu',
      icon: <SettingOutlined />,
      label: 'Настройки',
      children: settingsChildren,
    });

    // Add admin items
    if (userRole && userRole.toLowerCase() === 'admin') {
      baseItems.push({
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
            key: '/admin/feedback',
            label: 'Обратная связь',
          },
          {
            key: '/admin/excel-validation',
            label: 'Валидация Excel',
          },
        ],
      });
    }

    return baseItems;
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

  // Role display in Russian
  const _getRoleDisplay = (role: string) => {
    const roleMap = {
      sales_manager: 'Менеджер по продажам',
      finance_manager: 'Финансовый менеджер',
      department_manager: 'Руководитель отдела',
      director: 'Директор',
      admin: 'Администратор',
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

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
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Title level={4} style={{ color: 'white', margin: 0 }}>
            {collapsed ? 'КП' : 'Коммерческие предложения'}
          </Title>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          defaultOpenKeys={['quotes-menu']}
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
          <Space>
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
            <Divider type="vertical" style={{ height: '32px' }} />
            <OrganizationSwitcher />
          </Space>

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
