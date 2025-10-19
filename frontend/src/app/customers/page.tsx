'use client';

import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Card,
  Tag,
  Typography,
  message,
  Popconfirm,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { customerService, Customer } from '@/lib/api/customer-service';

const { Title } = Typography;
const { Search } = Input;

export default function CustomersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, pageSize, searchTerm, statusFilter, regionFilter]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerService.listCustomers();

      if (response.success && response.data) {
        setCustomers(response.data.customers || []);
        setTotalCount(response.data.total || 0);
      } else {
        message.error(`Ошибка загрузки клиентов: ${response.error}`);
        setCustomers([]);
        setTotalCount(0);
      }
    } catch (error: any) {
      message.error(`Ошибка загрузки клиентов: ${error.message}`);
      setCustomers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await customerService.deleteCustomer(id);
      if (response.success) {
        message.success('Клиент успешно удален');
      } else {
        message.error(`Ошибка удаления: ${response.error}`);
        return;
      }
      fetchCustomers();
    } catch (error: any) {
      message.error(`Ошибка удаления: ${error.message}`);
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap = {
      active: { color: 'green', text: 'Активный' },
      inactive: { color: 'default', text: 'Неактивный' },
      suspended: { color: 'red', text: 'Приостановлен' },
    };
    const config = statusMap[status as keyof typeof statusMap] || {
      color: 'default',
      text: status,
    };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getCompanyTypeDisplay = (type: string) => {
    const typeMap = {
      organization: 'ООО',
      individual_entrepreneur: 'ИП',
      individual: 'Физ. лицо',
      government: 'Гос. орган',
    };
    return typeMap[type as keyof typeof typeMap] || type;
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text: string, record: Customer) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => router.push(`/customers/${record.id}`)} style={{ fontWeight: 500 }}>
            {text}
          </a>
          <span style={{ fontSize: '12px', color: '#888' }}>
            {getCompanyTypeDisplay(record.company_type)}
          </span>
        </Space>
      ),
    },
    {
      title: 'ИНН',
      dataIndex: 'inn',
      key: 'inn',
      width: 130,
      render: (inn: string) => inn || '—',
    },
    {
      title: 'КПП',
      dataIndex: 'kpp',
      key: 'kpp',
      width: 110,
      render: (kpp: string) => kpp || '—',
    },
    {
      title: 'Город',
      dataIndex: 'city',
      key: 'city',
      width: 120,
    },
    {
      title: 'Регион',
      dataIndex: 'region',
      key: 'region',
      width: 150,
    },
    {
      title: 'Контакты',
      key: 'contacts',
      width: 200,
      render: (_: any, record: Customer) => (
        <Space direction="vertical" size={0}>
          {record.email && <span style={{ fontSize: '12px' }}>{record.email}</span>}
          {record.phone && <span style={{ fontSize: '12px' }}>{record.phone}</span>}
        </Space>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Customer) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/customers/${record.id}`)}
            title="Просмотр"
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => router.push(`/customers/${record.id}?mode=edit`)}
            title="Редактировать"
          />
          <Popconfirm
            title="Удалить клиента?"
            description="Это действие нельзя отменить"
            onConfirm={() => handleDelete(record.id)}
            okText="Удалить"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} title="Удалить" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Stats calculation
  const activeCustomers = customers.filter((c) => c.status === 'active').length;
  const inactiveCustomers = customers.filter((c) => c.status === 'inactive').length;

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2}>Клиенты</Title>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              onClick={() => router.push('/customers/create')}
            >
              Добавить клиента
            </Button>
          </Col>
        </Row>

        {/* Stats */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Всего клиентов"
                value={totalCount}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Активные"
                value={activeCustomers}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Неактивные"
                value={inactiveCustomers}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Search
                placeholder="Поиск по названию, ИНН..."
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                onSearch={(value) => {
                  setSearchTerm(value);
                  setCurrentPage(1);
                }}
                onChange={(e) => {
                  if (!e.target.value) {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }
                }}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                placeholder="Статус"
                allowClear
                size="large"
                style={{ width: '100%' }}
                onChange={(value) => {
                  setStatusFilter(value || '');
                  setCurrentPage(1);
                }}
                options={[
                  { label: 'Активный', value: 'active' },
                  { label: 'Неактивный', value: 'inactive' },
                  { label: 'Приостановлен', value: 'suspended' },
                ]}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                placeholder="Регион"
                allowClear
                size="large"
                style={{ width: '100%' }}
                showSearch
                onChange={(value) => {
                  setRegionFilter(value || '');
                  setCurrentPage(1);
                }}
                options={[
                  { label: 'Москва', value: 'Москва' },
                  { label: 'Санкт-Петербург', value: 'Санкт-Петербург' },
                  { label: 'Московская область', value: 'Московская область' },
                  { label: 'Ленинградская область', value: 'Ленинградская область' },
                  // Add more regions as needed
                ]}
              />
            </Col>
          </Row>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={customers}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1200 }}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalCount,
              showSizeChanger: true,
              showTotal: (total) => `Всего: ${total} клиентов`,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size);
              },
            }}
          />
        </Card>
      </Space>
    </MainLayout>
  );
}
