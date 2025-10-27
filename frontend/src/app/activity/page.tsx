'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Badge,
  Button,
  Space,
  Drawer,
  Typography,
  Select,
  DatePicker,
  message,
} from 'antd';
import {
  ReloadOutlined,
  FileSearchOutlined,
  DownloadOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import {
  activityLogService,
  ActivityLog,
  ActivityLogFilters,
} from '@/lib/api/activity-log-service';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

export default function ActivityLogPage() {
  // ============================================================================
  // STATE
  // ============================================================================

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  // Filter state
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'days'),
    dayjs(),
  ]);
  const [userFilter, setUserFilter] = useState<string | undefined>(undefined);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>(undefined);
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);

  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
  });

  // Available users (for filter dropdown)
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email: string }>
  >([]);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    try {
      const filters: ActivityLogFilters = {
        date_from: dateRange[0].format('YYYY-MM-DD'),
        date_to: dateRange[1].format('YYYY-MM-DD'),
        user_id: userFilter,
        entity_type: entityTypeFilter,
        action: actionFilter,
        page: pagination.current,
        per_page: pagination.pageSize,
      };

      const response = await activityLogService.list(filters);

      if (response.success && response.data) {
        setLogs(response.data.items);
        setTotal(response.data.total);
      } else {
        message.error(response.error || 'Ошибка загрузки логов');
        setLogs([]);
        setTotal(0);
      }
    } catch {
      message.error('Ошибка загрузки логов');
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [dateRange, userFilter, entityTypeFilter, actionFilter, pagination]);

  const fetchUsers = async () => {
    const response = await activityLogService.getUsers();
    if (response.success && response.data) {
      // Backend returns {users: Array}, extract the array
      const usersData = (response.data as any).users || response.data;
      setAvailableUsers(Array.isArray(usersData) ? usersData : []);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Fetch users for filter dropdown
  useEffect(() => {
    fetchUsers();
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleApplyFilters = () => {
    setPagination({ ...pagination, current: 1 });
    fetchLogs();
  };

  const handleResetFilters = () => {
    setDateRange([dayjs().subtract(7, 'days'), dayjs()]);
    setUserFilter(undefined);
    setEntityTypeFilter(undefined);
    setActionFilter(undefined);
    setPagination({ current: 1, pageSize: 50 });
  };

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    setPagination({
      current: newPagination.current || 1,
      pageSize: newPagination.pageSize || 50,
    });
  };

  const handleViewMetadata = (log: ActivityLog) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      message.warning('Нет данных для экспорта');
      return;
    }

    // Generate CSV content
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Metadata'];
    const rows = logs.map((log) => [
      formatTimestamp(log.created_at),
      log.user_email || log.user_name || log.user_id,
      activityLogService.formatAction(log.action),
      activityLogService.formatEntityType(log.entity_type),
      log.entity_id || '',
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = `activity_log_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success('CSV файл загружен');
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatTimestamp = (isoString: string) => {
    return dayjs(isoString).format('DD.MM.YYYY HH:mm:ss');
  };

  // ============================================================================
  // TABLE COLUMNS
  // ============================================================================

  const columns: TableColumnsType<ActivityLog> = [
    {
      title: 'Время',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      sorter: true,
      defaultSortOrder: 'descend',
      render: (value: string) => formatTimestamp(value),
    },
    {
      title: 'Пользователь',
      dataIndex: 'user_name',
      key: 'user',
      width: 150,
      render: (_: unknown, record: ActivityLog) => (
        <Text>{record.user_name || record.user_email || record.user_id}</Text>
      ),
    },
    {
      title: 'Действие',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => (
        <Badge
          color={activityLogService.getActionColor(action)}
          text={activityLogService.formatAction(action)}
        />
      ),
    },
    {
      title: 'Тип сущности',
      dataIndex: 'entity_type',
      key: 'entity_type',
      width: 120,
      render: (type: string) => activityLogService.formatEntityType(type),
    },
    {
      title: 'Детали',
      dataIndex: 'entity_id',
      key: 'details',
      render: (_: unknown, record: ActivityLog) => {
        const link = activityLogService.getEntityLink(record);

        if (link && record.entity_id) {
          // Get display text from metadata or use entity_id
          const displayText = record.metadata?.quote_number || record.entity_id.slice(0, 8);

          return (
            <Link href={link} style={{ color: '#1890ff' }}>
              {displayText}
            </Link>
          );
        }

        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Метаданные',
      key: 'metadata',
      width: 100,
      align: 'center',
      render: (_: unknown, record: ActivityLog) => (
        <Button size="small" type="link" onClick={() => handleViewMetadata(record)}>
          Показать
        </Button>
      ),
    },
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <MainLayout>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            История действий
          </Title>
          <Text type="secondary">Журнал всех операций в системе</Text>
        </div>

        {/* Filters Card */}
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space wrap size="middle">
              <Space direction="vertical" size={4}>
                <Text strong>Период:</Text>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setDateRange([dates[0], dates[1]]);
                    }
                  }}
                  format="DD.MM.YYYY"
                  presets={[
                    { label: 'Сегодня', value: [dayjs(), dayjs()] },
                    { label: 'Последние 7 дней', value: [dayjs().subtract(7, 'days'), dayjs()] },
                    { label: 'Последние 30 дней', value: [dayjs().subtract(30, 'days'), dayjs()] },
                    { label: 'Этот месяц', value: [dayjs().startOf('month'), dayjs()] },
                  ]}
                  style={{ width: 300 }}
                />
              </Space>

              <Space direction="vertical" size={4}>
                <Text strong>Пользователь:</Text>
                <Select
                  placeholder="Все пользователи"
                  value={userFilter}
                  onChange={setUserFilter}
                  allowClear
                  style={{ width: 200 }}
                  showSearch
                  optionFilterProp="label"
                  options={[
                    ...availableUsers.map((user) => ({
                      label: user.name || user.email,
                      value: user.id,
                    })),
                  ]}
                />
              </Space>

              <Space direction="vertical" size={4}>
                <Text strong>Тип сущности:</Text>
                <Select
                  placeholder="Все"
                  value={entityTypeFilter}
                  onChange={setEntityTypeFilter}
                  allowClear
                  style={{ width: 150 }}
                  options={[
                    { label: 'Котировка', value: 'quote' },
                    { label: 'Клиент', value: 'customer' },
                    { label: 'Контакт', value: 'contact' },
                  ]}
                />
              </Space>

              <Space direction="vertical" size={4}>
                <Text strong>Действие:</Text>
                <Select
                  placeholder="Все"
                  value={actionFilter}
                  onChange={setActionFilter}
                  allowClear
                  style={{ width: 150 }}
                  options={[
                    { label: 'Создано', value: 'created' },
                    { label: 'Обновлено', value: 'updated' },
                    { label: 'Удалено', value: 'deleted' },
                    { label: 'Восстановлено', value: 'restored' },
                    { label: 'Экспортировано', value: 'exported' },
                  ]}
                />
              </Space>
            </Space>

            <Space>
              <Button type="primary" icon={<FilterOutlined />} onClick={handleApplyFilters}>
                Применить фильтры
              </Button>
              <Button onClick={handleResetFilters}>Сбросить</Button>
              <Button icon={<ReloadOutlined />} onClick={fetchLogs}>
                Обновить
              </Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
                Экспорт CSV
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Table Card */}
        <Card>
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: total,
              showSizeChanger: true,
              pageSizeOptions: ['50', '100', '200'],
              showTotal: (total) => `Всего записей: ${total}`,
              position: ['bottomRight'],
            }}
            onChange={handleTableChange}
            locale={{
              emptyText: (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                  <FileSearchOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                  <div style={{ marginTop: 16 }}>
                    <Text type="secondary">Нет записей за выбранный период</Text>
                  </div>
                </div>
              ),
            }}
          />
        </Card>
      </Space>

      {/* Metadata Drawer */}
      <Drawer
        title="Детали действия"
        placement="right"
        width={600}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        {selectedLog && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>Время:</Text>
              <div>{formatTimestamp(selectedLog.created_at)}</div>
            </div>

            <div>
              <Text strong>Пользователь:</Text>
              <div>
                {selectedLog.user_name && <div>{selectedLog.user_name}</div>}
                {selectedLog.user_email && <Text type="secondary">{selectedLog.user_email}</Text>}
              </div>
            </div>

            <div>
              <Text strong>Действие:</Text>
              <div>
                <Badge
                  color={activityLogService.getActionColor(selectedLog.action)}
                  text={activityLogService.formatAction(selectedLog.action)}
                />
              </div>
            </div>

            <div>
              <Text strong>Тип сущности:</Text>
              <div>{activityLogService.formatEntityType(selectedLog.entity_type)}</div>
            </div>

            {selectedLog.entity_id && (
              <div>
                <Text strong>ID сущности:</Text>
                <div>
                  <Text code>{selectedLog.entity_id}</Text>
                </div>
              </div>
            )}

            {selectedLog.metadata && (
              <div>
                <Text strong>Метаданные:</Text>
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    overflow: 'auto',
                    fontSize: 12,
                    marginTop: 8,
                  }}
                >
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </MainLayout>
  );
}
