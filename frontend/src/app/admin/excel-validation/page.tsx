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
  FieldComparison,
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
  const [tolerance, setTolerance] = useState(0.011); // Tolerance in percent (0.011% default)
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
    const quoteLevelComparison = fileResult.comparisons?.[0];
    const keyFields = quoteLevelComparison?.fields || [];

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

    const exportToExcel = async () => {
      try {
        // Lazy load xlsx-js-style library (supports cell styling)
        const XLSX = await import('xlsx-js-style');

        // Find original file from files array
        const originalFile = files.find((f) => f.name === fileResult.filename);
        if (!originalFile) {
          messageApi.error('Исходный файл не найден');
          return;
        }

        // Read original Excel file
        const arrayBuffer = await originalFile.arrayBuffer();
        const originalWb = XLSX.read(arrayBuffer, { type: 'array' });

        // Find calculation sheet (расчет)
        const sheetName =
          originalWb.SheetNames.find((n) => n.toLowerCase().includes('расчет')) ||
          originalWb.SheetNames[0];
        const originalWs = originalWb.Sheets[sheetName];

        // Copy row 13 and rows 16+ with our calculations appended
        const newData: any[][] = [];

        // Header row
        const header = ['Row'];
        // Get all columns from A to AZ (or more)
        for (let col = 0; col < 52; col++) {
          // A-AZ
          const colName = XLSX.utils.encode_col(col);
          header.push(colName, `${colName}_Our`, `${colName}_Dev%`);
        }
        newData.push(header);

        // Helper: get cell value from original sheet
        const getCellValue = (row: number, col: string) => {
          const addr = `${col}${row}`;
          return originalWs[addr]?.v;
        };

        // Helper: find our value for a field
        const getOurValue = (fieldCode: string, comparisonIdx: number) => {
          const comp = fileResult.comparisons?.[comparisonIdx];
          const field = comp?.fields?.find((f) => f.field === fieldCode);
          return field ? field.our_value : null;
        };

        // Add row 13 (quote-level)
        const row13Data: Array<string | number> = [13];
        for (let col = 0; col < 52; col++) {
          const colName = XLSX.utils.encode_col(col);
          const excelVal = getCellValue(13, colName);
          const ourVal = getOurValue(`${colName}13`, 0); // comparisonIdx 0 = quote-level

          row13Data.push(excelVal || '');
          row13Data.push(ourVal !== null ? ourVal : '');

          // Calculate deviation %
          if (typeof excelVal === 'number' && typeof ourVal === 'number' && excelVal !== 0) {
            const devPct = ((ourVal - excelVal) / Math.abs(excelVal)) * 100;
            row13Data.push(`${devPct.toFixed(3)}%`);
          } else {
            row13Data.push('');
          }
        }
        newData.push(row13Data);

        // Add products (rows 16+)
        for (let prodIdx = 0; prodIdx < (fileResult.comparisons?.length ?? 0) - 1; prodIdx++) {
          const rowNum = 16 + prodIdx;
          const rowData: Array<string | number> = [rowNum];

          for (let col = 0; col < 52; col++) {
            const colName = XLSX.utils.encode_col(col);
            const excelVal = getCellValue(rowNum, colName);
            const ourVal = getOurValue(`${colName}16`, prodIdx + 1); // comparisonIdx 1+ = products

            rowData.push(excelVal || '');
            rowData.push(ourVal !== null ? ourVal : '');

            // Calculate deviation %
            if (typeof excelVal === 'number' && typeof ourVal === 'number' && excelVal !== 0) {
              const devPct = ((ourVal - excelVal) / Math.abs(excelVal)) * 100;
              rowData.push(`${devPct.toFixed(3)}%`);
            } else {
              rowData.push('');
            }
          }
          newData.push(rowData);
        }

        // Create worksheet from array
        const ws = XLSX.utils.aoa_to_sheet(newData);

        // Apply red background to Dev% cells where |deviation| > tolerance
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        for (let R = 1; R <= range.e.r; ++R) {
          // Skip header row
          for (let C = 3; C <= range.e.c; C += 3) {
            // Every 3rd column is Dev%
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[cellAddress];

            if (cell && cell.v) {
              const devValue = String(cell.v).replace('%', '');
              const devNum = parseFloat(devValue);

              if (!isNaN(devNum) && Math.abs(devNum) > tolerance) {
                // Red background for Excel, Our, and Dev% cells
                for (let offset = -2; offset <= 0; offset++) {
                  const addr = XLSX.utils.encode_cell({ r: R, c: C + offset });
                  if (ws[addr]) {
                    if (!ws[addr].s) ws[addr].s = {};
                    ws[addr].s.fill = { fgColor: { rgb: 'FFCCCC' } };
                  }
                }
              }
            }
          }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Validation');

        // Download
        const filename = `${fileResult.filename.replace('.xlsm', '').replace('.xlsx', '')}_validation.xlsx`;
        XLSX.writeFile(wb, filename);

        messageApi.success('Excel файл скачан');
      } catch (error) {
        console.error('Export error:', error);
        messageApi.error('Ошибка при экспорте');
      }
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
                  render: (_: unknown, record: any) =>
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
                    render: (_: unknown, record: any) => (
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

            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Text strong>Допуск отклонения:</Text>
                <InputNumber
                  value={tolerance}
                  onChange={(v) => setTolerance(v || 0.011)}
                  min={0}
                  max={100}
                  step={0.01}
                  addonAfter="%"
                  style={{ marginLeft: 16, width: 140 }}
                />
                <Text type="secondary" style={{ marginLeft: 16 }}>
                  (проверяются все ячейки: quote-level итоги + каждый продукт отдельно)
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
                      title: 'Макс. отклонение (%)',
                      key: 'max_deviation_percent',
                      render: (_: unknown, record: ValidationResult) => {
                        if (
                          !record.max_deviation ||
                          !record.comparisons ||
                          record.comparisons.length === 0
                        ) {
                          return '-';
                        }
                        // Find the field with max deviation to calculate %
                        const quoteLevelFields = record.comparisons[0].fields || [];
                        if (quoteLevelFields.length === 0) return '-';

                        // Get max deviation field
                        const maxField = quoteLevelFields.reduce((max, f) =>
                          Math.abs(f.difference) > Math.abs(max.difference) ? f : max
                        );

                        if (maxField.excel_value === 0) return '0%';
                        const pct =
                          (Math.abs(maxField.difference) / Math.abs(maxField.excel_value)) * 100;
                        return `${pct.toFixed(3)}%`;
                      },
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
