'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Popconfirm,
  Typography,
  Spin,
} from 'antd';
import {
  PlayCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  getSavedReports,
  deleteSavedReport,
  updateSavedReport,
  createSavedReport,
  type SavedReport,
} from '@/lib/api/analytics-service';
import MainLayout from '@/components/layout/MainLayout';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function SavedReportsPage() {
  const router = useRouter();
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<SavedReport[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'personal' | 'shared'>('all');
  const [searchText, setSearchText] = useState('');

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingReport, setEditingReport] = useState<SavedReport | null>(null);
  const [editForm] = Form.useForm();

  // Load reports
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSavedReports();
      setReports(data);
      setFilteredReports(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка загрузки отчётов');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Apply filters
  useEffect(() => {
    let filtered = reports;

    // Filter by visibility
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter((r) => r.visibility === visibilityFilter);
    }

    // Filter by search text
    if (searchText) {
      const lower = searchText.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(lower) ||
          (r.description && r.description.toLowerCase().includes(lower))
      );
    }

    setFilteredReports(filtered);
  }, [reports, visibilityFilter, searchText]);

  // Delete report
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteSavedReport(id);
        message.success('Отчёт удалён');
        loadReports();
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Ошибка удаления');
      }
    },
    [loadReports]
  );

  // Clone report
  const handleClone = useCallback(
    async (report: SavedReport) => {
      try {
        await createSavedReport({
          name: `${report.name} (копия)`,
          description: report.description,
          filters: report.filters,
          selected_fields: report.selected_fields,
          aggregations: report.aggregations,
          visibility: 'personal',
        });
        message.success('Отчёт скопирован');
        loadReports();
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Ошибка копирования');
      }
    },
    [loadReports]
  );

  // Edit report
  const handleEdit = useCallback(
    (report: SavedReport) => {
      setEditingReport(report);
      editForm.setFieldsValue({
        name: report.name,
        description: report.description,
        visibility: report.visibility,
      });
      setEditModalVisible(true);
    },
    [editForm]
  );

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    try {
      const values = await editForm.validateFields();
      if (!editingReport) return;

      await updateSavedReport(editingReport.id, values);
      message.success('Отчёт обновлён');
      setEditModalVisible(false);
      setEditingReport(null);
      loadReports();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка обновления');
    }
  }, [editForm, editingReport, loadReports]);

  // Run report (navigate to analytics page with filters loaded)
  const handleRun = useCallback(
    (report: SavedReport) => {
      // Store report in localStorage for analytics page to load
      localStorage.setItem('analytics_load_report', JSON.stringify(report));
      router.push('/analytics');
    },
    [router]
  );

  // Table columns
  const columns: ColumnsType<SavedReport> = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (text, record) => (
        <div>
          <div>
            <strong>{text}</strong>
          </div>
          {record.description && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.description}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Видимость',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 120,
      filters: [
        { text: 'Личный', value: 'personal' },
        { text: 'Общий', value: 'shared' },
      ],
      onFilter: (value, record) => record.visibility === value,
      render: (visibility) => (
        <Tag color="default">{visibility === 'shared' ? 'Общий' : 'Личный'}</Tag>
      ),
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Обновлён',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      sorter: (a, b) => dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
      render: (date) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRun(record)}
          >
            Запустить
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button size="small" icon={<CopyOutlined />} onClick={() => handleClone(record)} />
          <Popconfirm
            title="Удалить отчёт?"
            description="Это действие нельзя отменить"
            onConfirm={() => handleDelete(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (pageLoading) {
    return (
      <MainLayout>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '80vh',
          }}
        >
          <Spin size="large" tip="Загрузка отчётов..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={2}>
            <EyeOutlined /> Сохранённые отчёты
          </Title>
          <Text type="secondary">Управление шаблонами отчётов</Text>
        </div>

        {/* Filters */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
          <Input.Search
            placeholder="Поиск по названию или описанию"
            allowClear
            style={{ width: 300 }}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            value={visibilityFilter}
            onChange={setVisibilityFilter}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: 'Все отчёты' },
              { value: 'personal', label: 'Личные' },
              { value: 'shared', label: 'Общие' },
            ]}
          />
        </div>

        {/* Table */}
        <Table
          loading={loading}
          columns={columns}
          dataSource={filteredReports}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total}`,
          }}
        />
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Редактировать отчёт"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingReport(null);
        }}
        okText="Сохранить"
        cancelText="Отмена"
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="Название"
            name="name"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Описание" name="description">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item label="Видимость" name="visibility">
            <Select
              options={[
                { value: 'personal', label: 'Личный' },
                { value: 'shared', label: 'Общий (доступен всем в организации)' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </MainLayout>
  );
}
