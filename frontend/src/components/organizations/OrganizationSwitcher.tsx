'use client';

import React, { useState, useEffect } from 'react';
import { Button, Dropdown, Space, Typography, message } from 'antd';
import { DownOutlined, CheckOutlined, ApartmentOutlined, SwapOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useRouter } from 'next/navigation';
import { organizationService } from '@/lib/api/organization-service';
import { UserOrganization } from '@/lib/types/organization';
import { useAuth } from '@/lib/auth/AuthProvider';
import { userService } from '@/lib/api/user-service';
import {
  getOrganizationCache,
  setOrganizationCache,
  updateCurrentOrgId,
} from '@/lib/cache/organization-cache';

const { Text } = Typography;

interface OrganizationSwitcherProps {
  onSwitch?: () => void;
}

export default function OrganizationSwitcher({ onSwitch }: OrganizationSwitcherProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<UserOrganization | null>(null);

  useEffect(() => {
    if (profile) {
      fetchOrganizations();
    }
  }, [profile?.organization_id]); // Re-fetch when profile org changes

  const fetchOrganizations = async () => {
    // Try cache first
    const cached = getOrganizationCache();
    if (cached) {
      console.log('📦 Using cached organizations (TTL: 5 min)');
      setOrganizations(cached.organizations);

      // Set current org from cache
      const activeOrg = cached.organizations.find(
        (org) => org.organization_id === cached.currentOrgId
      );
      if (activeOrg) {
        setCurrentOrg(activeOrg);
      } else if (cached.organizations.length > 0) {
        setCurrentOrg(cached.organizations[0]);
      }

      return; // Skip API call
    }

    // Cache miss or expired - fetch from API
    console.log('🌐 Fetching organizations from API...');
    setLoading(true);
    try {
      const [orgsResult, profileResult] = await Promise.all([
        organizationService.listOrganizations(),
        userService.getProfile(),
      ]);

      console.log('Organization fetch result:', orgsResult);

      if (orgsResult.success && orgsResult.data) {
        setOrganizations(orgsResult.data);

        // Get current organization from user profile's last_active_organization_id
        let currentOrgId: string | null = null;
        if (profileResult.success && profileResult.data?.last_active_organization_id) {
          currentOrgId = profileResult.data.last_active_organization_id;
          const activeOrg = orgsResult.data.find((org) => org.organization_id === currentOrgId);
          if (activeOrg) {
            setCurrentOrg(activeOrg);
          } else if (orgsResult.data.length > 0) {
            // Fallback to first org if last_active not found
            setCurrentOrg(orgsResult.data[0]);
            currentOrgId = orgsResult.data[0].organization_id;
          }
        } else if (orgsResult.data.length > 0) {
          // Fallback to first org if no profile data
          setCurrentOrg(orgsResult.data[0]);
          currentOrgId = orgsResult.data[0].organization_id;
        }

        // Cache the result
        setOrganizationCache(orgsResult.data, currentOrgId);
      } else {
        console.error('Failed to fetch organizations:', orgsResult.error);
      }
    } catch (error: any) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitch = async (organizationId: string) => {
    if (currentOrg?.organization_id === organizationId) {
      // Already on this organization
      return;
    }

    setSwitching(true);
    try {
      const result = await organizationService.switchOrganization(organizationId);

      if (result.success) {
        const newOrg = organizations.find((org) => org.organization_id === organizationId);

        if (newOrg) {
          setCurrentOrg(newOrg);

          // Update cache with new current org
          updateCurrentOrgId(organizationId);

          message.success(`Переключено на ${newOrg.organization_name}`);

          // Callback to parent (e.g., to refresh data)
          if (onSwitch) {
            onSwitch();
          }

          // Refresh the page to reload data for new organization
          window.location.reload();
        }
      } else {
        message.error(result.error || 'Ошибка переключения организации');
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`);
    } finally {
      setSwitching(false);
    }
  };

  const menuItems: MenuProps['items'] = [
    ...organizations.map((org) => ({
      key: org.organization_id,
      label: (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space direction="vertical" size={0}>
            <Text strong>{org.organization_name}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {org.role_name}
            </Text>
          </Space>
          {currentOrg?.organization_id === org.organization_id && (
            <CheckOutlined style={{ color: '#52c41a' }} />
          )}
        </Space>
      ),
      onClick: () => handleSwitch(org.organization_id),
    })),
    {
      type: 'divider',
    },
    {
      key: 'all-orgs',
      label: (
        <Space>
          <ApartmentOutlined />
          <Text>Все организации</Text>
        </Space>
      ),
      onClick: () => router.push('/organizations'),
    },
  ];

  if (organizations.length === 0 && !loading) {
    return (
      <Button icon={<ApartmentOutlined />} onClick={() => router.push('/organizations')}>
        Организации
      </Button>
    );
  }

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']} disabled={switching || loading}>
      <Button loading={loading || switching}>
        <Space>
          <SwapOutlined />
          {currentOrg ? currentOrg.organization_name : 'Выберите организацию'}
          <DownOutlined />
        </Space>
      </Button>
    </Dropdown>
  );
}
