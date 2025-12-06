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
  Switch,
  Tag,
  Popconfirm,
  Typography,
  Badge,
  Alert,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import {
  getScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  runScheduledReport,
  getSavedReports,
  type ScheduledReport,
  type SavedReport,
} from '@/lib/api/analytics-service';
import MainLayout from '@/components/layout/MainLayout';

const { Title, Text } = Typography;
const { TextArea } = Input;

// Cron expression presets
const CRON_PRESETS = [
  { value: '0 9 * * *', label: 'Ежедневно в 9:00' },
  { value: '0 9 * * 1', label: 'Каждый понедельник в 9:00' },
  { value: '0 9 1 * *', label: '1-го числа каждого месяца в 9:00' },
  { value: '0 18 * * 5', label: 'Каждую пятницу в 18:00' },
  { value: '0 0 1 1 *', label: '1 января в 00:00' },
];

export default function ScheduledReportsPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  // Create/Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);
  const [form] = Form.useForm();

  // Load schedules
  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getScheduledReports();
      setSchedules(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка загрузки расписаний');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  }, []);

  // Load saved reports
  const loadSavedReports = useCallback(async () => {
    try {
      const data = await getSavedReports();
      setSavedReports(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка загрузки отчётов');
    }
  }, []);

  useEffect(() => {
    loadSchedules();
    loadSavedReports();
  }, [loadSchedules, loadSavedReports]);

  // Create new schedule
  const handleCreate = useCallback(() => {
    setEditingSchedule(null);
    form.resetFields();
    form.setFieldsValue({
      timezone: 'Europe/Moscow',
      include_file: true,
    });
    setModalVisible(true);
  }, [form]);

  // Edit schedule
  const handleEdit = useCallback(
    (schedule: ScheduledReport) => {
      setEditingSchedule(schedule);
      form.setFieldsValue({
        saved_report_id: schedule.saved_report_id,
        name: schedule.name,
        schedule_cron: schedule.schedule_cron,
        timezone: schedule.timezone,
        email_recipients: schedule.email_recipients,
        include_file: schedule.include_file,
        email_subject: schedule.email_subject,
        email_body: schedule.email_body,
      });
      setModalVisible(true);
    },
    [form]
  );

  // Save (create or update)
  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();

      if (editingSchedule) {
        await updateScheduledReport(editingSchedule.id, values);
        message.success('Расписание обновлено');
      } else {
        await createScheduledReport(values);
        message.success('Расписание создано');
      }

      setModalVisible(false);
      setEditingSchedule(null);
      loadSchedules();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    }
  }, [form, editingSchedule, loadSchedules]);

  // Delete schedule
  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteScheduledReport(id);
        message.success('Расписание удалено');
        loadSchedules();
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Ошибка удаления');
      }
    },
    [loadSchedules]
  );

  // Toggle active status
  const handleToggleActive = useCallback(
    async (schedule: ScheduledReport) => {
      try {
        await updateScheduledReport(schedule.id, {
          is_active: !schedule.is_active,
        });
        message.success(schedule.is_active ? 'Расписание отключено' : 'Расписание включено');
        loadSchedules();
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Ошибка обновления');
      }
    },
    [loadSchedules]
  );

  // Run now
  const handleRunNow = useCallback(async (id: string) => {
    try {
      const result = await runScheduledReport(id);
      message.success(`Отчёт запущен. ID выполнения: ${result.execution_id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка запуска');
    }
  }, []);

  // Table columns
  const columns: ColumnsType<ScheduledReport> = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div>
            <strong>{text}</strong>
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {savedReports.find((r) => r.id === record.saved_report_id)?.name || 'Отчёт не найден'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Расписание',
      dataIndex: 'schedule_cron',
      key: 'schedule_cron',
      width: 200,
      render: (cron, record) => {
        const preset = CRON_PRESETS.find((p) => p.value === cron);
        return (
          <div>
            <div>{preset?.label || cron}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.timezone}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Следующий запуск',
      dataIndex: 'next_run_at',
      key: 'next_run_at',
      width: 160,
      render: (date) => (date ? dayjs(date).format('DD.MM.YYYY HH:mm') : '-'),
    },
    {
      title: 'Последний запуск',
      dataIndex: 'last_run_at',
      key: 'last_run_at',
      width: 180,
      render: (date, record) => (
        <div>
          {date ? (
            <>
              <div>{dayjs(date).format('DD.MM.YYYY HH:mm')}</div>
              {record.last_run_status && (
                <div>
                  {record.last_run_status === 'success' ? (
                    <Badge status="success" text="Успешно" />
                  ) : record.last_run_status === 'failure' ? (
                    <Badge status="error" text="Ошибка" />
                  ) : (
                    <Badge status="warning" text="Частично" />
                  )}
                </div>
              )}
            </>
          ) : (
            '-'
          )}
        </div>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive, record) => (
        <Switch checked={isActive} onChange={() => handleToggleActive(record)} />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            icon={<PlayCircleOutlined />}
            onClick={() => handleRunNow(record.id)}
          >
            Запустить
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="Удалить расписание?"
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
          <Spin size="large" tip="Загрузка расписаний..." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Title level={2}>
              <ClockCircleOutlined /> Расписание отчётов
            </Title>
            <Text type="secondary">Автоматическая генерация отчётов по расписанию</Text>
          </div>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            Создать расписание
          </Button>
        </div>

        <Alert
          message="Отчёты будут автоматически отправлены на указанные email адреса"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* Table */}
        <Table
          loading={loading}
          columns={columns}
          dataSource={schedules}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: (total) => `Всего: ${total}` }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingSchedule ? 'Редактировать расписание' : 'Создать расписание'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          setEditingSchedule(null);
        }}
        okText="Сохранить"
        cancelText="Отмена"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Сохранённый отчёт"
            name="saved_report_id"
            rules={[{ required: true, message: 'Выберите отчёт' }]}
          >
            <Select
              placeholder="Выберите отчёт"
              options={savedReports.map((r) => ({
                value: r.id,
                label: r.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Название расписания"
            name="name"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Например: Еженедельный отчёт по продажам" />
          </Form.Item>

          <Form.Item
            label="Расписание (cron)"
            name="schedule_cron"
            rules={[{ required: true, message: 'Выберите расписание' }]}
          >
            <Select placeholder="Выберите расписание" options={CRON_PRESETS} />
          </Form.Item>

          <Form.Item label="Часовой пояс" name="timezone">
            <Select
              options={[
                { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
                { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
                { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
                { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
                { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Email получателей"
            name="email_recipients"
            rules={[{ required: true, message: 'Введите хотя бы один email' }]}
          >
            <Select mode="tags" placeholder="Введите email адреса" tokenSeparators={[',']} />
          </Form.Item>

          <Form.Item label="Прикрепить файл" name="include_file" valuePropName="checked">
            <Switch checkedChildren="Да" unCheckedChildren="Нет" />
          </Form.Item>

          <Form.Item label="Тема письма" name="email_subject">
            <Input placeholder="Автоматически сгенерированный отчёт" />
          </Form.Item>

          <Form.Item label="Текст письма" name="email_body">
            <TextArea rows={4} placeholder="Здравствуйте! Во вложении отчёт..." />
          </Form.Item>
        </Form>
      </Modal>
    </MainLayout>
  );
}
