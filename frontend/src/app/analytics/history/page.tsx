'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Tag,
  Typography,
  Badge,
  Descriptions,
  Modal,
  DatePicker,
  Select,
  Spin,
} from 'antd';
import {
  DownloadOutlined,
  HistoryOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  getExecutionHistory,
  downloadExecutionFile,
  type ReportExecution,
  type PaginatedResponse,
} from '@/lib/api/analytics-service';
import MainLayout from '@/components/layout/MainLayout';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// File format icons
const FORMAT_ICONS: Record<string, React.ReactNode> = {
  xlsx: <FileExcelOutlined style={{ color: '#107C41' }} />,
  csv: <FileTextOutlined style={{ color: '#666' }} />,
  pdf: <FilePdfOutlined style={{ color: '#D83B01' }} />,
  json: <FileTextOutlined style={{ color: '#0078D4' }} />,
};

// Execution type colors
const TYPE_COLORS: Record<string, string> = {
  manual: 'blue',
  scheduled: 'green',
  api: 'purple',
};

export default function ExecutionHistoryPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // Filters
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [executionTypeFilter, setExecutionTypeFilter] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<{
    dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;
    executionType: string | null;
  }>({
    dateRange: null,
    executionType: null,
  });

  // Detail modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ReportExecution | null>(null);

  // Load executions
  const loadExecutions = useCallback(
    async (page: number = 1, pageSize: number = 50) => {
      try {
        setLoading(true);
        const data: PaginatedResponse<ReportExecution> = await getExecutionHistory(page, pageSize);

        // Apply client-side filters
        let filtered = data.items;

        if (
          appliedFilters.dateRange &&
          appliedFilters.dateRange[0] &&
          appliedFilters.dateRange[1]
        ) {
          filtered = filtered.filter((exec) => {
            const execDate = dayjs(exec.executed_at);
            const startOfDay = appliedFilters.dateRange![0]!.startOf('day');
            const endOfDay = appliedFilters.dateRange![1]!.endOf('day');
            return (
              (execDate.isAfter(startOfDay) || execDate.isSame(startOfDay)) &&
              (execDate.isBefore(endOfDay) || execDate.isSame(endOfDay))
            );
          });
        }

        if (appliedFilters.executionType) {
          filtered = filtered.filter(
            (exec) => exec.execution_type === appliedFilters.executionType
          );
        }

        setExecutions(filtered);
        setPagination({
          current: data.page,
          pageSize: data.page_size,
          total: filtered.length,
        });
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Ошибка загрузки истории');
      } finally {
        setLoading(false);
        setPageLoading(false);
      }
    },
    [appliedFilters]
  );

  // Apply filters
  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      dateRange,
      executionType: executionTypeFilter,
    });
    loadExecutions(1, pagination.pageSize);
  }, [dateRange, executionTypeFilter, loadExecutions, pagination.pageSize]);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    setDateRange(null);
    setExecutionTypeFilter(null);
    setAppliedFilters({
      dateRange: null,
      executionType: null,
    });
    loadExecutions(1, pagination.pageSize);
  }, [loadExecutions, pagination.pageSize]);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  // Download file
  const handleDownload = useCallback(async (execution: ReportExecution) => {
    if (!execution.export_file_url) {
      message.warning('Файл недоступен');
      return;
    }

    try {
      const blob = await downloadExecutionFile(execution.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with timestamp format: analytics_YYYYMMDD_HHMMSS_history.xlsx
      const timestamp = dayjs(execution.executed_at).format('YYYYMMDD_HHmmss');
      const format = execution.export_format || 'xlsx';
      link.download = `analytics_${timestamp}_history.${format}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('Файл скачан');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка скачивания');
    }
  }, []);

  // Show detail
  const handleShowDetail = useCallback((execution: ReportExecution) => {
    setSelectedExecution(execution);
    setDetailModalVisible(true);
  }, []);

  // Check if file is expired
  const isFileExpired = useCallback((execution: ReportExecution): boolean => {
    if (!execution.file_expires_at) return false;
    return dayjs(execution.file_expires_at).isBefore(dayjs());
  }, []);

  // Format file size
  const formatFileSize = useCallback((bytes?: number): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Table columns
  const columns: ColumnsType<ReportExecution> = [
    {
      title: 'Дата и время',
      dataIndex: 'executed_at',
      key: 'executed_at',
      width: 160,
      sorter: (a, b) => dayjs(a.executed_at).unix() - dayjs(b.executed_at).unix(),
      render: (date) => (
        <div>
          <div>{dayjs(date).format('DD.MM.YYYY')}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(date).format('HH:mm:ss')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Отчёт',
      dataIndex: 'report_name',
      key: 'report_name',
      render: (text, record) => (
        <div>
          <div>{text || 'Разовый запрос'}</div>
          {record.saved_report_id && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              ID: {record.saved_report_id.slice(0, 8)}...
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'execution_type',
      key: 'execution_type',
      width: 120,
      filters: [
        { text: 'Вручную', value: 'manual' },
        { text: 'По расписанию', value: 'scheduled' },
        { text: 'API', value: 'api' },
      ],
      onFilter: (value, record) => record.execution_type === value,
      render: (type) => (
        <Tag color={TYPE_COLORS[type]}>
          {type === 'manual' ? 'Вручную' : type === 'scheduled' ? 'Расписание' : 'API'}
        </Tag>
      ),
    },
    {
      title: 'Записей',
      dataIndex: 'quote_count',
      key: 'quote_count',
      width: 100,
      align: 'right',
      sorter: (a, b) => a.quote_count - b.quote_count,
      render: (count) => count.toLocaleString('ru-RU'),
    },
    {
      title: 'Файл',
      key: 'file',
      width: 150,
      render: (_, record) => {
        if (!record.export_file_url) return '-';

        const expired = isFileExpired(record);

        return (
          <div>
            <div>
              {FORMAT_ICONS[record.export_format || 'xlsx']} {record.export_format?.toUpperCase()}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatFileSize(record.file_size_bytes)}
            </Text>
            {expired && (
              <div>
                <Badge status="error" text="Истёк" />
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Время выполнения',
      dataIndex: 'execution_time_ms',
      key: 'execution_time_ms',
      width: 120,
      sorter: (a, b) => (a.execution_time_ms || 0) - (b.execution_time_ms || 0),
      render: (ms) => {
        if (!ms) return '-';
        if (ms < 1000) return `${ms} мс`;
        return `${(ms / 1000).toFixed(2)} сек`;
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleShowDetail(record)}>
            Детали
          </Button>
          {record.export_file_url && !isFileExpired(record) && (
            <Button
              size="small"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            />
          )}
        </Space>
      ),
    },
  ];

  // Handle table change
  const handleTableChange = useCallback(
    (pagination: any) => {
      loadExecutions(pagination.current, pagination.pageSize);
    },
    [loadExecutions]
  );

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
          <Spin size="large" tip="Загрузка истории..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={2}>
            <HistoryOutlined /> История выполнений
          </Title>
          <Text type="secondary">Журнал всех выполненных запросов и отчётов</Text>
        </div>

        {/* Filters */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          <RangePicker
            style={{ width: 300 }}
            format="DD.MM.YYYY"
            placeholder={['Дата от', 'Дата до']}
            value={dateRange}
            onChange={setDateRange}
          />
          <Select
            placeholder="Тип выполнения"
            allowClear
            style={{ width: 200 }}
            value={executionTypeFilter}
            onChange={setExecutionTypeFilter}
            options={[
              { value: 'manual', label: 'Вручную' },
              { value: 'scheduled', label: 'По расписанию' },
              { value: 'api', label: 'API' },
            ]}
          />
          <Button type="primary" onClick={handleApplyFilters}>
            Применить фильтры
          </Button>
          <Button onClick={handleResetFilters}>Сбросить</Button>
        </div>

        {/* Table */}
        <Table
          loading={loading}
          columns={columns}
          dataSource={executions}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total}`,
            pageSizeOptions: ['20', '50', '100'],
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Детали выполнения"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedExecution(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Закрыть
          </Button>,
          selectedExecution?.export_file_url && !isFileExpired(selectedExecution) && (
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => selectedExecution && handleDownload(selectedExecution)}
            >
              Скачать файл
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedExecution && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="ID" span={2}>
                {selectedExecution.id}
              </Descriptions.Item>
              <Descriptions.Item label="Тип выполнения">
                <Tag color={TYPE_COLORS[selectedExecution.execution_type]}>
                  {selectedExecution.execution_type === 'manual'
                    ? 'Вручную'
                    : selectedExecution.execution_type === 'scheduled'
                      ? 'По расписанию'
                      : 'API'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Дата и время">
                {dayjs(selectedExecution.executed_at).format('DD.MM.YYYY HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Записей найдено">
                {selectedExecution.quote_count.toLocaleString('ru-RU')}
              </Descriptions.Item>
              <Descriptions.Item label="Время выполнения">
                {selectedExecution.execution_time_ms
                  ? selectedExecution.execution_time_ms < 1000
                    ? `${selectedExecution.execution_time_ms} мс`
                    : `${(selectedExecution.execution_time_ms / 1000).toFixed(2)} сек`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Формат файла">
                {selectedExecution.export_format?.toUpperCase() || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Размер файла">
                {formatFileSize(selectedExecution.file_size_bytes)}
              </Descriptions.Item>
            </Descriptions>

            {/* Result Summary */}
            {Object.keys(selectedExecution.result_summary).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>Результаты агрегации</Title>
                <Descriptions bordered column={2} size="small">
                  {Object.entries(selectedExecution.result_summary).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {typeof value === 'number' ? value.toLocaleString('ru-RU') : String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </div>
            )}

            {/* Filters Used */}
            {Object.keys(selectedExecution.filters).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Title level={5}>Примененные фильтры</Title>
                <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                  {JSON.stringify(selectedExecution.filters, null, 2)}
                </pre>
              </div>
            )}

            {/* Selected Fields */}
            <div style={{ marginTop: 16 }}>
              <Title level={5}>Выбранные поля ({selectedExecution.selected_fields.length})</Title>
              <Space wrap>
                {selectedExecution.selected_fields.map((field) => (
                  <Tag key={field}>{field}</Tag>
                ))}
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
}
