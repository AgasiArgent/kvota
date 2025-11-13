'use client';

import { useState, useEffect } from 'react';
import {
  Upload,
  Button,
  InputNumber,
  Table,
  Card,
  Statistic,
  Row,
  Col,
  Space,
  Typography,
  App,
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import MainLayout from '@/components/layout/MainLayout';
import {
  ExcelValidationService,
  ValidationResponse,
  ValidationResult,
} from '@/lib/api/excel-validation-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function ExcelValidationPage() {
  const { modal, message: messageApi } = App.useApp();
  const { profile } = useAuth();
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [tolerance, setTolerance] = useState(0.01); // Tolerance in percent
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ValidationResponse | null>(null);

  // Admin/Owner role check (middleware already checks, this is just extra validation)
  useEffect(() => {
    // No need for client-side check - middleware handles it
  }, [profile, router]);

  const handleUpload = async () => {
    if (files.length === 0) {
      messageApi.warning('Загрузите хотя бы один файл Excel');
      return;
    }

    setLoading(true);

    try {
      // Always use 'summary' mode - we show 5 key fields
      const data = await ExcelValidationService.validateFiles(files, 'summary', tolerance);
      setResults(data);
      messageApi.success('Валидация завершена');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      messageApi.error(`Ошибка валидации: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const showDetailsModal = (fileResult: ValidationResult) => {
    if (!fileResult.comparisons || fileResult.comparisons.length === 0) {
      messageApi.info('Нет данных для отображения');
      return;
    }

    // First comparison is quote-level (row 13), rest are products (rows 16+)
    const quoteLevelComparison = fileResult.comparisons[0];
    const keyFields = quoteLevelComparison.fields || [];

    // Failed fields from quote-level only
    const failedFields = keyFields.filter((f) => !f.passed);

    const formatPercent = (our: number, excel: number) => {
      if (excel === 0) return '0%';
      const deviation = ((our - excel) / Math.abs(excel)) * 100;
      const sign = deviation > 0 ? '+' : '';
      return `${sign}${deviation.toFixed(3)}%`;
    };

    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    };

    const exportToExcel = () => {
      // TODO: Implement Excel export with product-level data
      messageApi.info('Excel экспорт будет добавлен');
    };

    modal.info({
      title: `${fileResult.filename} - Детали валидации`,
      width: 900,
      okText: 'Закрыть',
      content: (
        <div>
          {/* Key Fields Section */}
          <Card
            title="Ключевые поля"
            size="small"
            style={{
              marginBottom: 16,
              borderColor: keyFields.every((f) => f.passed) ? '#52c41a' : '#faad14',
            }}
          >
            <Table
              dataSource={keyFields}
              columns={[
                { title: 'Поле', dataIndex: 'field_name', width: 200 },
                { title: 'Excel', dataIndex: 'excel_value', render: formatNumber, width: 120 },
                { title: 'Наш расчет', dataIndex: 'our_value', render: formatNumber, width: 120 },
                {
                  title: 'Отклонение',
                  width: 100,
                  render: (_: unknown, record: FieldComparison) =>
                    formatPercent(record.our_value, record.excel_value),
                },
                {
                  title: 'Статус',
                  dataIndex: 'passed',
                  render: (p: boolean) => (
                    <span style={{ color: p ? '#52c41a' : '#ff4d4f' }}>{p ? '✅' : '❌'}</span>
                  ),
                  width: 80,
                },
              ]}
              pagination={false}
              size="small"
              rowKey="field"
            />
          </Card>

          {/* Failed Fields Section */}
          {failedFields.length > 0 && (
            <Card
              title={`Проблемные поля (${failedFields.length})`}
              size="small"
              style={{ marginBottom: 16, borderColor: '#ff4d4f' }}
            >
              <Table
                dataSource={failedFields}
                columns={[
                  { title: 'Поле', dataIndex: 'field_name', width: 200 },
                  { title: 'Excel', dataIndex: 'excel_value', render: formatNumber, width: 120 },
                  { title: 'Наш расчет', dataIndex: 'our_value', render: formatNumber, width: 120 },
                  {
                    title: 'Отклонение',
                    width: 100,
                    render: (_: unknown, record: FieldComparison) => (
                      <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                        {formatPercent(record.our_value, record.excel_value)}
                      </span>
                    ),
                  },
                  {
                    title: 'Статус',
                    dataIndex: 'passed',
                    render: () => <span style={{ color: '#ff4d4f' }}>❌</span>,
                    width: 80,
                  },
                ]}
                pagination={false}
                size="small"
                rowKey={(record, index) => `${record.field}_${index}`}
              />
            </Card>
          )}

          {/* Summary Info */}
          <div style={{ marginBottom: 16, color: '#8c8c8c' }}>
            📊 {fileResult.total_products}{' '}
            {fileResult.total_products === 1 ? 'продукт' : 'продукта'} проверено
          </div>

          {/* Export Button */}
          <Button icon={<DownloadOutlined />} onClick={exportToExcel} style={{ marginTop: 8 }}>
            📥 Экспорт в Excel (все продукты)
          </Button>
        </div>
      ),
    });
  };

  const uploadProps = {
    multiple: true,
    showUploadList: {
      showRemoveIcon: true,
    },
    beforeUpload: (file: File) => {
      if (files.length >= 10) {
        messageApi.warning('Максимум 10 файлов');
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
    <App>
      <MainLayout>
        <div style={{ padding: 24 }}>
          <Title level={2}>Валидация расчетов Excel</Title>
          <Text type="secondary">Загрузите файлы Excel для проверки точности расчетов</Text>

          <Card style={{ marginTop: 24 }}>
            <Dragger {...uploadProps} style={{ marginBottom: 24 }} accept=".xlsx,.xlsm">
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">Нажмите или перетащите файлы Excel сюда</p>
              <p className="ant-upload-hint">
                Поддерживаются файлы .xlsx и .xlsm. Максимум 10 файлов за раз.
              </p>
            </Dragger>

            {/* Quick test buttons - load real files from validation_data/ */}
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Быстрый выбор (для WSL): </Text>
              <Space style={{ marginTop: 8 }}>
                <Button
                  size="small"
                  onClick={async () => {
                    try {
                      const response = await fetch('/validation_data/test_raschet.xlsm');
                      const blob = await response.blob();
                      const file = new File([blob], 'test_raschet.xlsm', {
                        type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
                      });
                      setFiles([...files, file]);
                    } catch {
                      messageApi.error('Не удалось загрузить тестовый файл');
                    }
                  }}
                >
                  test_raschet.xlsm
                </Button>
                <Button
                  size="small"
                  onClick={async () => {
                    try {
                      const response = await fetch('/validation_data/test_raschet_30pct.xlsm');
                      const blob = await response.blob();
                      const file = new File([blob], 'test_raschet_30pct.xlsm', {
                        type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
                      });
                      setFiles([...files, file]);
                    } catch {
                      messageApi.error('Не удалось загрузить тестовый файл');
                    }
                  }}
                >
                  test_raschet_30pct.xlsm
                </Button>
              </Space>
            </div>

            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Text strong>Допуск отклонения:</Text>
                <InputNumber
                  value={tolerance}
                  onChange={(v) => setTolerance(v || 0.01)}
                  min={0}
                  max={100}
                  step={0.01}
                  addonAfter="%"
                  style={{ marginLeft: 16, width: 140 }}
                />
                <Text type="secondary" style={{ marginLeft: 16 }}>
                  (проверяются 5 ключевых полей: цена, цена+НДС, себестоимость, логистика, пошлина)
                </Text>
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
    </App>
  );
}
