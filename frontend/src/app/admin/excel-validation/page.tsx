'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Upload,
  CheckCircle,
  XCircle,
  Trash2,
  Play,
  Download,
  FileSpreadsheet,
  Loader2,
  X,
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import {
  ExcelValidationService,
  ValidationResponse,
  ValidationResult,
  FieldComparison,
} from '@/lib/api/excel-validation-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function ExcelValidationPage() {
  const { profile } = useAuth();
  const router = useRouter();

  const [files, setFiles] = useState<File[]>([]);
  const [tolerance, setTolerance] = useState(0.011);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ValidationResponse | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<ValidationResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.warning('Загрузите хотя бы один файл Excel');
      return;
    }

    setLoading(true);

    try {
      const data = await ExcelValidationService.validateFiles(files, 'summary', tolerance);
      setResults(data);
      toast.success('Валидация завершена');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Ошибка валидации: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

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

  const showDetailsModal = (fileResult: ValidationResult) => {
    if (!fileResult.comparisons || fileResult.comparisons.length === 0) {
      toast.info('Нет данных для отображения');
      return;
    }
    setSelectedResult(fileResult);
    setDetailsModalOpen(true);
  };

  const exportToExcel = async (fileResult: ValidationResult) => {
    try {
      const XLSX = await import('xlsx-js-style');

      const originalFile = files.find((f) => f.name === fileResult.filename);
      if (!originalFile) {
        toast.error('Исходный файл не найден');
        return;
      }

      const arrayBuffer = await originalFile.arrayBuffer();
      const originalWb = XLSX.read(arrayBuffer, { type: 'array' });

      const sheetName =
        originalWb.SheetNames.find((n) => n.toLowerCase().includes('расчет')) ||
        originalWb.SheetNames[0];
      const originalWs = originalWb.Sheets[sheetName];

      const newData: (string | number)[][] = [];

      const header = ['Row'];
      for (let col = 0; col < 52; col++) {
        const colName = XLSX.utils.encode_col(col);
        header.push(colName, `${colName}_Our`, `${colName}_Dev%`);
      }
      newData.push(header);

      const getCellValue = (row: number, col: string) => {
        const addr = `${col}${row}`;
        return originalWs[addr]?.v;
      };

      const getOurValue = (fieldCode: string, comparisonIdx: number) => {
        const comp = fileResult.comparisons?.[comparisonIdx];
        const field = comp?.fields?.find((f) => f.field === fieldCode);
        return field ? field.our_value : null;
      };

      const row13Data: (string | number)[] = [13];
      for (let col = 0; col < 52; col++) {
        const colName = XLSX.utils.encode_col(col);
        const excelVal = getCellValue(13, colName);
        const ourVal = getOurValue(`${colName}13`, 0);

        row13Data.push(excelVal || '');
        row13Data.push(ourVal !== null ? ourVal : '');

        if (typeof excelVal === 'number' && typeof ourVal === 'number' && excelVal !== 0) {
          const devPct = ((ourVal - excelVal) / Math.abs(excelVal)) * 100;
          row13Data.push(`${devPct.toFixed(3)}%`);
        } else {
          row13Data.push('');
        }
      }
      newData.push(row13Data);

      for (let prodIdx = 0; prodIdx < (fileResult.comparisons?.length ?? 0) - 1; prodIdx++) {
        const rowNum = 16 + prodIdx;
        const rowData: (string | number)[] = [rowNum];

        for (let col = 0; col < 52; col++) {
          const colName = XLSX.utils.encode_col(col);
          const excelVal = getCellValue(rowNum, colName);
          const ourVal = getOurValue(`${colName}16`, prodIdx + 1);

          rowData.push(excelVal || '');
          rowData.push(ourVal !== null ? ourVal : '');

          if (typeof excelVal === 'number' && typeof ourVal === 'number' && excelVal !== 0) {
            const devPct = ((ourVal - excelVal) / Math.abs(excelVal)) * 100;
            rowData.push(`${devPct.toFixed(3)}%`);
          } else {
            rowData.push('');
          }
        }
        newData.push(rowData);
      }

      const ws = XLSX.utils.aoa_to_sheet(newData);

      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = 1; R <= range.e.r; ++R) {
        for (let C = 3; C <= range.e.c; C += 3) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellAddress];

          if (cell && cell.v) {
            const devValue = String(cell.v).replace('%', '');
            const devNum = parseFloat(devValue);

            if (!isNaN(devNum) && Math.abs(devNum) > tolerance) {
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

      const filename = `${fileResult.filename.replace('.xlsm', '').replace('.xlsx', '')}_validation.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success('Excel файл скачан');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Ошибка при экспорте');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file) => file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm')
      );

      if (droppedFiles.length === 0) {
        toast.warning('Только файлы .xlsx и .xlsm поддерживаются');
        return;
      }

      if (files.length + droppedFiles.length > 10) {
        toast.warning('Максимум 10 файлов');
        return;
      }

      setFiles((prev) => [...prev, ...droppedFiles]);
    },
    [files.length]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (files.length + selectedFiles.length > 10) {
      toast.warning('Максимум 10 файлов');
      return;
    }

    setFiles((prev) => [...prev, ...selectedFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const quoteLevelFields = selectedResult?.comparisons?.[0]?.fields || [];
  const failedFields = quoteLevelFields.filter((f) => !f.passed);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Валидация расчетов Excel</h1>
          <p className="text-muted-foreground">
            Загрузите файлы Excel для проверки точности расчетов
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* File Dropzone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg mb-2">Нажмите или перетащите файлы Excel сюда</p>
              <p className="text-sm text-muted-foreground mb-4">
                Поддерживаются файлы .xlsx и .xlsm. Максимум 10 файлов за раз.
              </p>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xlsm"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button variant="outline" asChild>
                  <span className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Выбрать файлы
                  </span>
                </Button>
              </label>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      <span className="text-sm">{file.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Tolerance Setting */}
            <div className="flex items-center gap-4">
              <Label htmlFor="tolerance" className="font-medium whitespace-nowrap">
                Допуск отклонения:
              </Label>
              <Input
                id="tolerance"
                type="number"
                value={tolerance}
                onChange={(e) => setTolerance(parseFloat(e.target.value) || 0.011)}
                min={0}
                max={100}
                step={0.01}
                className="w-24"
              />
              <span className="text-muted-foreground">%</span>
              <span className="text-sm text-muted-foreground">
                (проверяются все ячейки: quote-level итоги + каждый продукт отдельно)
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <Button
                onClick={handleUpload}
                disabled={loading || files.length === 0}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Запустить валидацию
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFiles([]);
                  setResults(null);
                }}
                disabled={files.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Очистить все
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <>
            {/* Summary Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Сводная статистика</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Всего файлов</p>
                    <p className="text-3xl font-bold">{results.summary.total}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Пройдено</p>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <p className="text-3xl font-bold text-green-600">{results.summary.passed}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Не пройдено</p>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-6 w-6 text-destructive" />
                      <p className="text-3xl font-bold text-destructive">
                        {results.summary.failed}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Процент успеха</p>
                    <p className="text-3xl font-bold">{results.summary.pass_rate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Results */}
            <Card>
              <CardHeader>
                <CardTitle>Детальные результаты</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Имя файла</th>
                        <th className="text-left py-3 px-4 font-medium">Статус</th>
                        <th className="text-left py-3 px-4 font-medium">Макс. отклонение (₽)</th>
                        <th className="text-left py-3 px-4 font-medium">Макс. отклонение (%)</th>
                        <th className="text-left py-3 px-4 font-medium">Проблемные поля</th>
                        <th className="text-center py-3 px-4 font-medium">Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.results.map((result) => {
                        let maxDeviationPercent = '-';
                        if (
                          result.max_deviation &&
                          result.comparisons &&
                          result.comparisons.length > 0
                        ) {
                          const quoteLevelFields = result.comparisons[0].fields || [];
                          if (quoteLevelFields.length > 0) {
                            const maxField = quoteLevelFields.reduce((max, f) =>
                              Math.abs(f.difference) > Math.abs(max.difference) ? f : max
                            );
                            if (maxField.excel_value !== 0) {
                              const pct =
                                (Math.abs(maxField.difference) / Math.abs(maxField.excel_value)) *
                                100;
                              maxDeviationPercent = `${pct.toFixed(3)}%`;
                            }
                          }
                        }

                        return (
                          <tr key={result.filename} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{result.filename}</td>
                            <td className="py-3 px-4">
                              {result.error ? (
                                <span className="text-destructive font-medium">ОШИБКА</span>
                              ) : result.passed ? (
                                <span className="text-green-600 font-medium">ПРОЙДЕНО</span>
                              ) : (
                                <span className="text-destructive font-medium">НЕ ПРОЙДЕНО</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {result.max_deviation !== undefined
                                ? result.max_deviation.toFixed(2)
                                : '-'}
                            </td>
                            <td className="py-3 px-4">{maxDeviationPercent}</td>
                            <td className="py-3 px-4">
                              {result.failed_fields && result.failed_fields.length > 0
                                ? result.failed_fields.join(', ')
                                : '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {result.comparisons && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => showDetailsModal(result)}
                                >
                                  Детали
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedResult?.filename} - Детали валидации</DialogTitle>
          </DialogHeader>

          {selectedResult && (
            <div className="space-y-6">
              {/* Key Fields Section */}
              <Card
                className={
                  quoteLevelFields.every((f) => f.passed) ? 'border-green-500' : 'border-amber-500'
                }
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Ключевые поля</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Поле</th>
                          <th className="text-right py-2 px-3 font-medium">Excel</th>
                          <th className="text-right py-2 px-3 font-medium">Наш расчет</th>
                          <th className="text-right py-2 px-3 font-medium">Отклонение</th>
                          <th className="text-center py-2 px-3 font-medium">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quoteLevelFields.map((field, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2 px-3">{field.field_name}</td>
                            <td className="py-2 px-3 text-right">
                              {formatNumber(field.excel_value)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {formatNumber(field.our_value)}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {formatPercent(field.our_value, field.excel_value)}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={field.passed ? 'text-green-600' : 'text-destructive'}
                              >
                                {field.passed ? '✅' : '❌'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Failed Fields Section */}
              {failedFields.length > 0 && (
                <Card className="border-destructive">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg text-destructive">
                      Проблемные поля ({failedFields.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-medium">Поле</th>
                            <th className="text-right py-2 px-3 font-medium">Excel</th>
                            <th className="text-right py-2 px-3 font-medium">Наш расчет</th>
                            <th className="text-right py-2 px-3 font-medium">Отклонение</th>
                            <th className="text-center py-2 px-3 font-medium">Статус</th>
                          </tr>
                        </thead>
                        <tbody>
                          {failedFields.map((field, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2 px-3">{field.field_name}</td>
                              <td className="py-2 px-3 text-right">
                                {formatNumber(field.excel_value)}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {formatNumber(field.our_value)}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-destructive">
                                {formatPercent(field.our_value, field.excel_value)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="text-destructive">❌</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary Info */}
              <p className="text-muted-foreground">
                {selectedResult.total_products}{' '}
                {selectedResult.total_products === 1 ? 'продукт' : 'продукта'} проверено
              </p>

              {/* Export Button */}
              <Button onClick={() => exportToExcel(selectedResult)}>
                <Download className="h-4 w-4 mr-2" />
                Экспорт в Excel (все продукты)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
