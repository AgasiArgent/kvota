'use client'

import React, { useState, useEffect } from 'react'
import { Button, Dropdown, Space, Typography, Divider, message } from 'antd'
import {
  DownOutlined,
  CheckOutlined,
  ApartmentOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { useRouter } from 'next/navigation'
import { organizationService } from '@/lib/api/organization-service'
import { UserOrganization } from '@/lib/types/organization'

const { Text } = Typography

interface OrganizationSwitcherProps {
  onSwitch?: () => void
}

export default function OrganizationSwitcher({
  onSwitch,
}: OrganizationSwitcherProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [organizations, setOrganizations] = useState<UserOrganization[]>([])
  const [currentOrg, setCurrentOrg] = useState<UserOrganization | null>(null)

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    setLoading(true)
    try {
      const result = await organizationService.listOrganizations()

      if (result.success && result.data) {
        setOrganizations(result.data)

        // Try to get current organization from user profile
        // For now, we'll use the first organization as current
        // TODO: Get from user profile's last_active_organization_id
        if (result.data.length > 0) {
          setCurrentOrg(result.data[0])
        }
      }
    } catch (error: any) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSwitch = async (organizationId: string) => {
    if (currentOrg?.organization_id === organizationId) {
      // Already on this organization
      return
    }

    setSwitching(true)
    try {
      const result = await organizationService.switchOrganization(organizationId)

      if (result.success) {
        const newOrg = organizations.find(
          (org) => org.organization_id === organizationId
        )

        if (newOrg) {
          setCurrentOrg(newOrg)
          message.success(`Переключено на ${newOrg.organization_name}`)

          // Callback to parent (e.g., to refresh data)
          if (onSwitch) {
            onSwitch()
          }

          // Refresh the page to reload data for new organization
          window.location.reload()
        }
      } else {
        message.error(result.error || 'Ошибка переключения организации')
      }
    } catch (error: any) {
      message.error(`Ошибка: ${error.message}`)
    } finally {
      setSwitching(false)
    }
  }

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
  ]

  if (organizations.length === 0 && !loading) {
    return (
      <Button
        icon={<ApartmentOutlined />}
        onClick={() => router.push('/organizations')}
      >
        Организации
      </Button>
    )
  }

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={['click']}
      disabled={switching || loading}
    >
      <Button loading={loading || switching}>
        <Space>
          <SwapOutlined />
          {currentOrg ? currentOrg.organization_name : 'Выберите организацию'}
          <DownOutlined />
        </Space>
      </Button>
    </Dropdown>
  )
}
