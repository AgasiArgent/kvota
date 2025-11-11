'use client';

import { useState } from 'react';
import {
  Upload,
  Button,
  Radio,
  InputNumber,
  Table,
  Modal,
  Card,
  Statistic,
  Row,
  Col,
  message,
  Space,
  Typography,
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import {
  ExcelValidationService,
  ValidationResponse,
  ValidationResult,
} from '@/lib/api/excel-validation-service';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function ExcelValidationPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<'summary' | 'detailed'>('summary');
  const [tolerance, setTolerance] = useState(2.0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ValidationResponse | null>(null);

  const handleUpload = async () => {
    if (files.length === 0) {
      message.warning('Загрузите хотя бы один файл Excel');
      return;
    }

    setLoading(true);

    try {
      const data = await ExcelValidationService.validateFiles(files, mode, tolerance);
      setResults(data);
      message.success('Валидация завершена');
    } catch (error: any) {
      message.error(`Ошибка валидации: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const showDetailsModal = (fileResult: ValidationResult) => {
    if (!fileResult.comparisons || fileResult.comparisons.length === 0) {
      message.info('Нет данных для отображения');
      return;
    }

    const firstProduct = fileResult.comparisons[0];

    Modal.info({
      title: `${fileResult.filename} - Детали валидации`,
      width: 800,
      content: (
        <div>
          <Table
            dataSource={firstProduct.fields}
            columns={[
              {
                title: 'Поле',
                dataIndex: 'field_name',
                width: 200,
              },
              {
                title: 'Excel',
                dataIndex: 'excel_value',
                render: (v: number) => v.toFixed(2),
                width: 100,
              },
              {
                title: 'Наш расчет',
                dataIndex: 'our_value',
                render: (v: number) => v.toFixed(2),
                width: 100,
              },
              {
                title: 'Разница',
                dataIndex: 'difference',
                render: (v: number) => v.toFixed(2),
                width: 80,
              },
              {
                title: 'Статус',
                dataIndex: 'passed',
                render: (p: boolean) => (p ? '✅' : '❌'),
                width: 80,
              },
            ]}
            pagination={false}
            size="small"
            rowKey="field"
          />
        </div>
      ),
    });
  };

  const uploadProps = {
    multiple: true,
    beforeUpload: (file: File) => {
      if (files.length >= 10) {
        message.warning('Максимум 10 файлов');
        return false;
      }
      setFiles([...files, file]);
      return false;
    },
    fileList: files.map((f, i) => ({
      uid: i.toString(),
      name: f.name,
      status: 'done' as const,
    })),
    onRemove: (file: any) => {
      const index = parseInt(file.uid);
      setFiles(files.filter((_, i) => i !== index));
    },
  };

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Title level={2}>Валидация расчетов Excel</Title>
        <Text type="secondary">Загрузите файлы Excel для проверки точности расчетов</Text>

        <Card style={{ marginTop: 24 }}>
          <Dragger {...uploadProps} style={{ marginBottom: 24 }} accept=".xlsx">
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Нажмите или перетащите файлы Excel сюда</p>
            <p className="ant-upload-hint">
              Поддерживаются файлы .xlsx. Максимум 10 файлов за раз.
            </p>
          </Dragger>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Text strong>Режим:</Text>
              <Radio.Group
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={{ marginLeft: 16 }}
              >
                <Radio value="summary">Краткий (3 поля)</Radio>
                <Radio value="detailed">Подробный (9+ полей)</Radio>
              </Radio.Group>
            </Col>
            <Col span={12}>
              <Text strong>Допуск:</Text>
              <InputNumber
                value={tolerance}
                onChange={(v) => setTolerance(v || 2.0)}
                min={0}
                step={0.5}
                addonAfter="₽"
                style={{ marginLeft: 16, width: 120 }}
              />
            </Col>
          </Row>

          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleUpload}
              loading={loading}
              disabled={files.length === 0}
            >
              Запустить валидацию
            </Button>
            <Button
              icon={<DeleteOutlined />}
              onClick={() => {
                setFiles([]);
                setResults(null);
              }}
              disabled={files.length === 0}
            >
              Очистить все
            </Button>
          </Space>
        </Card>

        {results && (
          <>
            <Card title="Сводная статистика" style={{ marginTop: 24 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="Всего файлов" value={results.summary.total} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Пройдено"
                    value={results.summary.passed}
                    valueStyle={{ color: '#3f8600' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Не пройдено"
                    value={results.summary.failed}
                    valueStyle={{ color: '#cf1322' }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Процент успеха"
                    value={results.summary.pass_rate}
                    precision={1}
                    suffix="%"
                  />
                </Col>
              </Row>
            </Card>

            <Card title="Детальные результаты" style={{ marginTop: 24 }}>
              <Table
                dataSource={results.results}
                rowKey="filename"
                columns={[
                  {
                    title: 'Имя файла',
                    dataIndex: 'filename',
                  },
                  {
                    title: 'Статус',
                    dataIndex: 'passed',
                    render: (passed: boolean, record: ValidationResult) =>
                      record.error ? (
                        <Text type="danger">❌ ОШИБКА</Text>
                      ) : passed ? (
                        <Text type="success">✅ ПРОЙДЕНО</Text>
                      ) : (
                        <Text type="danger">❌ НЕ ПРОЙДЕНО</Text>
                      ),
                  },
                  {
                    title: 'Макс. отклонение (₽)',
                    dataIndex: 'max_deviation',
                    render: (v?: number) => (v !== undefined ? v.toFixed(2) : '-'),
                  },
                  {
                    title: 'Проблемные поля',
                    dataIndex: 'failed_fields',
                    render: (fields?: string[]) =>
                      fields && fields.length > 0 ? fields.join(', ') : '-',
                  },
                  {
                    title: 'Действие',
                    render: (_: any, record: ValidationResult) =>
                      record.comparisons ? (
                        <Button size="small" onClick={() => showDetailsModal(record)}>
                          Детали
                        </Button>
                      ) : null,
                  },
                ]}
                pagination={false}
              />
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
