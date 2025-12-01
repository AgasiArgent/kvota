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
  Popover,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { customerService, Customer, CustomerContact } from '@/lib/api/customer-service';

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

  // Contacts per customer
  const [contactsMap, setContactsMap] = useState<Record<string, CustomerContact[]>>({});

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, pageSize, searchTerm, statusFilter]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerService.listCustomers({
        page: currentPage,
        limit: pageSize,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      });

      if (response.success && response.data) {
        const customersList = response.data.customers || [];
        setCustomers(customersList);
        setTotalCount(response.data.total || 0);

        // Fetch contacts for all customers in parallel
        const contactPromises = customersList.map((customer) =>
          customerService.listContacts(customer.id).then((res) => ({
            customerId: customer.id,
            contacts: res.success && res.data ? res.data.contacts : [],
          }))
        );

        const contactResults = await Promise.all(contactPromises);
        const newContactsMap: Record<string, CustomerContact[]> = {};
        contactResults.forEach(({ customerId, contacts }) => {
          newContactsMap[customerId] = contacts;
        });
        setContactsMap(newContactsMap);
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
          <span style={{ fontWeight: 500 }}>{text}</span>
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
      title: 'Город',
      dataIndex: 'city',
      key: 'city',
      width: 120,
    },
    {
      title: 'ЛПР',
      key: 'lpr',
      width: 200,
      render: (_: any, record: Customer) => {
        const contacts = contactsMap[record.id] || [];
        if (contacts.length === 0) {
          return <span style={{ color: '#999' }}>—</span>;
        }

        return (
          <Space size={4} wrap>
            {contacts.map((contact) => (
              <Popover
                key={contact.id}
                title={
                  <Space>
                    <UserOutlined />
                    {contact.name} {contact.last_name || ''}
                    {contact.is_primary && (
                      <Tag color="blue" style={{ marginLeft: 4 }}>
                        Основной
                      </Tag>
                    )}
                  </Space>
                }
                content={
                  <Space direction="vertical" size={4}>
                    {contact.position && <span style={{ color: '#666' }}>{contact.position}</span>}
                    {contact.phone && (
                      <Space>
                        <PhoneOutlined />
                        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                      </Space>
                    )}
                    {contact.email && (
                      <Space>
                        <MailOutlined />
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      </Space>
                    )}
                  </Space>
                }
                trigger="click"
              >
                <Tag
                  style={{ cursor: 'pointer', marginBottom: 2 }}
                  color={contact.is_primary ? 'blue' : 'default'}
                >
                  {contact.name}
                </Tag>
              </Popover>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => getStatusTag(status),
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
            <Col xs={24} md={12}>
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
            <Col xs={24} md={12}>
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
          </Row>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={customers}
            rowKey="id"
            loading={loading}
            scroll={{ x: 900 }}
            onRow={(record) => ({
              onClick: () => router.push(`/customers/${record.id}`),
              style: { cursor: 'pointer' },
            })}
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
