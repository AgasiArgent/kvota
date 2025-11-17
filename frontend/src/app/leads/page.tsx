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
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  PhoneOutlined,
  MailOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import {
  listLeads,
  deleteLead,
  assignLead,
  qualifyLead,
  type LeadWithDetails,
  type LeadListParams,
} from '@/lib/api/lead-service';
import { listLeadStages, type LeadStage } from '@/lib/api/lead-stage-service';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

export default function LeadsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');
  const [segmentFilter, setSegmentFilter] = useState<string>('');

  // Load data on mount - fetch stages and leads in parallel
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [stagesData, leadsResponse] = await Promise.all([
          listLeadStages(),
          listLeads({
            page: currentPage,
            limit: pageSize,
          }),
        ]);

        setStages(stagesData);
        setLeads(leadsResponse.data || []);
        setTotalCount(leadsResponse.total || 0);
      } catch (error: any) {
        message.error(`Ошибка загрузки: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Re-fetch leads when filters change (stages already loaded)
  useEffect(() => {
    if (stages.length > 0) {
      fetchLeads();
    }
  }, [currentPage, pageSize, searchTerm, stageFilter, assignedFilter, segmentFilter]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params: LeadListParams = {
        page: currentPage,
        limit: pageSize,
      };

      if (searchTerm) params.search = searchTerm;
      if (stageFilter) params.stage_id = stageFilter;
      if (assignedFilter) params.assigned_to = assignedFilter;
      if (segmentFilter) params.segment = segmentFilter;

      const response = await listLeads(params);
      setLeads(response.data || []);
      setTotalCount(response.total || 0);
    } catch (error: any) {
      message.error(`Ошибка загрузки лидов: ${error.message}`);
      setLeads([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, companyName: string) => {
    try {
      await deleteLead(id);
      message.success(`Лид "${companyName}" успешно удален`);
      fetchLeads();
    } catch (error: any) {
      message.error(`Ошибка удаления: ${error.message}`);
    }
  };

  const handleQualify = async (id: string, companyName: string) => {
    try {
      const response = await qualifyLead(id);
      message.success(
        `Лид "${companyName}" квалифицирован. Создан клиент "${response.customer_name}"`
      );
      fetchLeads();
      // Optionally redirect to customer
      // router.push(`/customers/${response.customer_id}`);
    } catch (error: any) {
      message.error(`Ошибка квалификации: ${error.message}`);
    }
  };

  const getStageTag = (stageName?: string, stageColor?: string) => {
    if (!stageName) return <Tag>—</Tag>;
    return (
      <Tag color={stageColor || '#1890ff'} style={{ borderRadius: 4 }}>
        {stageName}
      </Tag>
    );
  };

  // Calculate statistics
  const statsData = {
    total: totalCount,
    newLeads: leads.filter((l) => l.stage_name === 'Новый').length,
    qualified: leads.filter((l) => l.stage_name === 'Квалифицирован').length,
    unassigned: leads.filter((l) => !l.assigned_to).length,
  };

  const columns = [
    {
      title: 'Компания',
      dataIndex: 'company_name',
      key: 'company_name',
      width: 250,
      render: (text: string, record: LeadWithDetails) => (
        <Space direction="vertical" size={0}>
          <a
            onClick={() => router.push(`/leads/${record.id}`)}
            style={{ fontWeight: 500, cursor: 'pointer' }}
          >
            {text}
          </a>
          {record.segment && (
            <span style={{ fontSize: '12px', color: '#888' }}>{record.segment}</span>
          )}
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
      title: 'Контакты',
      key: 'contacts',
      width: 200,
      render: (_: any, record: LeadWithDetails) => (
        <Space direction="vertical" size={0}>
          {record.email && (
            <Space size={4}>
              <MailOutlined style={{ color: '#888' }} />
              <span style={{ fontSize: '12px' }}>{record.email}</span>
            </Space>
          )}
          {record.primary_phone && (
            <Space size={4}>
              <PhoneOutlined style={{ color: '#888' }} />
              <span style={{ fontSize: '12px' }}>{record.primary_phone}</span>
            </Space>
          )}
          {record.contacts && record.contacts.length > 0 && (
            <Tooltip title={record.contacts.map((c) => c.full_name).join(', ')}>
              <Space size={4}>
                <UserOutlined style={{ color: '#888' }} />
                <span style={{ fontSize: '12px' }}>ЛПР: {record.contacts.length}</span>
              </Space>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Этап',
      key: 'stage',
      width: 150,
      render: (_: any, record: LeadWithDetails) =>
        getStageTag(record.stage_name, record.stage_color),
    },
    {
      title: 'Ответственный',
      dataIndex: 'assigned_to_name',
      key: 'assigned_to',
      width: 150,
      render: (name: string) =>
        name ? (
          <Space size={4}>
            <UserOutlined style={{ color: '#888' }} />
            <span>{name}</span>
          </Space>
        ) : (
          <Tag color="orange">Не назначен</Tag>
        ),
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString('ru-RU'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: LeadWithDetails) => {
        const isQualified = record.stage_name === 'Квалифицирован';
        const isFailed = record.stage_name === 'Отказ';

        return (
          <Space size="small">
            <Tooltip title="Открыть">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => router.push(`/leads/${record.id}`)}
              />
            </Tooltip>

            {!isQualified && !isFailed && (
              <Tooltip title="Квалифицировать">
                <Popconfirm
                  title="Квалифицировать лид?"
                  description={`Создать клиента из лида "${record.company_name}"?`}
                  onConfirm={() => handleQualify(record.id, record.company_name)}
                  okText="Да"
                  cancelText="Нет"
                >
                  <Button type="text" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} />
                </Popconfirm>
              </Tooltip>
            )}

            <Tooltip title="Удалить">
              <Popconfirm
                title="Удалить лид?"
                description={`Вы уверены, что хотите удалить "${record.company_name}"?`}
                onConfirm={() => handleDelete(record.id, record.company_name)}
                okText="Да"
                cancelText="Нет"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <MainLayout>
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2}>Лиды</Title>
          </Col>
          <Col>
            <Space>
              <Button type="default" onClick={() => router.push('/leads/pipeline')}>
                Воронка
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => router.push('/leads/create')}
              >
                Создать лид
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Statistics */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="Всего лидов" value={statsData.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Новые"
                value={statsData.newLeads}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Квалифицированы"
                value={statsData.qualified}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Не назначены"
                value={statsData.unassigned}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Search
                placeholder="Поиск по названию, email, ИНН"
                allowClear
                enterButton={<SearchOutlined />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onSearch={() => setCurrentPage(1)}
              />
            </Col>
            <Col span={5}>
              <Select
                placeholder="Этап"
                allowClear
                style={{ width: '100%' }}
                value={stageFilter || undefined}
                onChange={(value) => {
                  setStageFilter(value || '');
                  setCurrentPage(1);
                }}
              >
                {stages.map((stage) => (
                  <Option key={stage.id} value={stage.id}>
                    <Tag color={stage.color} style={{ marginRight: 8 }}>
                      {stage.name}
                    </Tag>
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={5}>
              <Select
                placeholder="Ответственный"
                allowClear
                style={{ width: '100%' }}
                value={assignedFilter || undefined}
                onChange={(value) => {
                  setAssignedFilter(value || '');
                  setCurrentPage(1);
                }}
              >
                <Option value="me">Мои лиды</Option>
                <Option value="unassigned">Не назначены</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Input
                placeholder="Сегмент"
                allowClear
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
                onPressEnter={() => setCurrentPage(1)}
              />
            </Col>
          </Row>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={leads}
            rowKey="id"
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalCount,
              onChange: (page, size) => {
                setCurrentPage(page);
                setPageSize(size || 20);
              },
              showSizeChanger: true,
              showTotal: (total) => `Всего: ${total} лидов`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            scroll={{ x: 1200 }}
          />
        </Card>
      </div>
    </MainLayout>
  );
}
