'use client';

import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import {
  Plus,
  Edit,
  Trash2,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

// Cron expression presets
const CRON_PRESETS = [
  { value: '0 9 * * *', label: 'Ежедневно в 9:00' },
  { value: '0 9 * * 1', label: 'Каждый понедельник в 9:00' },
  { value: '0 9 1 * *', label: '1-го числа каждого месяца в 9:00' },
  { value: '0 18 * * 5', label: 'Каждую пятницу в 18:00' },
  { value: '0 0 1 1 *', label: '1 января в 00:00' },
];

const TIMEZONE_OPTIONS = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
];

interface FormData {
  saved_report_id: string;
  name: string;
  schedule_cron: string;
  timezone: string;
  email_recipients: string[];
  include_file: boolean;
  email_subject: string;
  email_body: string;
}

const initialFormData: FormData = {
  saved_report_id: '',
  name: '',
  schedule_cron: '',
  timezone: 'Europe/Moscow',
  email_recipients: [],
  include_file: true,
  email_subject: '',
  email_body: '',
};

export default function ScheduledReportsPage() {
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [emailInput, setEmailInput] = useState('');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  // Load schedules
  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getScheduledReports();
      setSchedules(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки расписаний');
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
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки отчётов');
    }
  }, []);

  useEffect(() => {
    loadSchedules();
    loadSavedReports();
  }, [loadSchedules, loadSavedReports]);

  // Create new schedule
  const handleCreate = useCallback(() => {
    setEditingSchedule(null);
    setFormData(initialFormData);
    setEmailInput('');
    setModalOpen(true);
  }, []);

  // Edit schedule
  const handleEdit = useCallback((schedule: ScheduledReport) => {
    setEditingSchedule(schedule);
    setFormData({
      saved_report_id: schedule.saved_report_id,
      name: schedule.name,
      schedule_cron: schedule.schedule_cron,
      timezone: schedule.timezone,
      email_recipients: schedule.email_recipients,
      include_file: schedule.include_file,
      email_subject: schedule.email_subject || '',
      email_body: schedule.email_body || '',
    });
    setEmailInput('');
    setModalOpen(true);
  }, []);

  // Save (create or update)
  const handleSave = useCallback(async () => {
    if (!formData.saved_report_id || !formData.name || !formData.schedule_cron) {
      toast.error('Заполните обязательные поля');
      return;
    }
    if (formData.email_recipients.length === 0) {
      toast.error('Добавьте хотя бы один email');
      return;
    }

    try {
      if (editingSchedule) {
        await updateScheduledReport(editingSchedule.id, formData);
        toast.success('Расписание обновлено');
      } else {
        await createScheduledReport(formData);
        toast.success('Расписание создано');
      }

      setModalOpen(false);
      setEditingSchedule(null);
      loadSchedules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    }
  }, [formData, editingSchedule, loadSchedules]);

  // Delete schedule
  const handleDelete = useCallback(async () => {
    if (!scheduleToDelete) return;
    try {
      await deleteScheduledReport(scheduleToDelete);
      toast.success('Расписание удалено');
      loadSchedules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления');
    } finally {
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    }
  }, [scheduleToDelete, loadSchedules]);

  // Toggle active status
  const handleToggleActive = useCallback(
    async (schedule: ScheduledReport) => {
      try {
        await updateScheduledReport(schedule.id, {
          is_active: !schedule.is_active,
        });
        toast.success(schedule.is_active ? 'Расписание отключено' : 'Расписание включено');
        loadSchedules();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Ошибка обновления');
      }
    },
    [loadSchedules]
  );

  // Run now
  const handleRunNow = useCallback(async (id: string) => {
    try {
      const result = await runScheduledReport(id);
      toast.success(`Отчёт запущен. ID выполнения: ${result.execution_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка запуска');
    }
  }, []);

  // Email handling
  const addEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      if (!formData.email_recipients.includes(emailInput)) {
        setFormData((prev) => ({
          ...prev,
          email_recipients: [...prev.email_recipients, emailInput],
        }));
      }
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setFormData((prev) => ({
      ...prev,
      email_recipients: prev.email_recipients.filter((e) => e !== email),
    }));
  };

  if (pageLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            icon={<Clock className="h-6 w-6" />}
            title="Расписание отчётов"
            description="Автоматическая генерация отчётов по расписанию"
          />
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Создать расписание
          </Button>
        </div>

        <div className="flex items-center gap-2 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <AlertCircle className="h-5 w-5 text-blue-400" />
          <span className="text-sm">
            Отчёты будут автоматически отправлены на указанные email адреса
          </span>
        </div>

        {/* Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="mx-auto h-12 w-12 text-foreground/20 mb-4" />
                <p className="text-foreground/40">Нет расписаний</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary/30 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Название
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Расписание
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        След. запуск
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Посл. запуск
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Статус
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {schedules.map((schedule) => {
                      const preset = CRON_PRESETS.find((p) => p.value === schedule.schedule_cron);
                      const reportName = savedReports.find(
                        (r) => r.id === schedule.saved_report_id
                      )?.name;

                      return (
                        <tr key={schedule.id} className="hover:bg-foreground/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium">{schedule.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {reportName || 'Отчёт не найден'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm">{preset?.label || schedule.schedule_cron}</div>
                            <div className="text-xs text-muted-foreground">{schedule.timezone}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/70">
                            {schedule.next_run_at
                              ? dayjs(schedule.next_run_at).format('DD.MM.YYYY HH:mm')
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {schedule.last_run_at ? (
                              <>
                                <div className="text-sm">
                                  {dayjs(schedule.last_run_at).format('DD.MM.YYYY HH:mm')}
                                </div>
                                {schedule.last_run_status && (
                                  <Badge
                                    variant={
                                      schedule.last_run_status === 'success'
                                        ? 'default'
                                        : schedule.last_run_status === 'failure'
                                          ? 'destructive'
                                          : 'secondary'
                                    }
                                    className="mt-1"
                                  >
                                    {schedule.last_run_status === 'success' ? (
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                    ) : schedule.last_run_status === 'failure' ? (
                                      <XCircle className="h-3 w-3 mr-1" />
                                    ) : null}
                                    {schedule.last_run_status === 'success'
                                      ? 'Успешно'
                                      : schedule.last_run_status === 'failure'
                                        ? 'Ошибка'
                                        : 'Частично'}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Switch
                              checked={schedule.is_active}
                              onCheckedChange={() => handleToggleActive(schedule)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleRunNow(schedule.id)}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Запустить
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(schedule)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setScheduleToDelete(schedule.id);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingSchedule ? 'Редактировать расписание' : 'Создать расписание'}
            </DialogTitle>
            <DialogDescription>
              Настройте автоматическую отправку отчётов по расписанию
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Сохранённый отчёт *</Label>
              <Select
                value={formData.saved_report_id}
                onValueChange={(value: string) =>
                  setFormData((prev) => ({ ...prev, saved_report_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите отчёт" />
                </SelectTrigger>
                <SelectContent>
                  {savedReports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Название расписания *</Label>
              <Input
                placeholder="Например: Еженедельный отчёт по продажам"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Расписание *</Label>
              <Select
                value={formData.schedule_cron}
                onValueChange={(value: string) =>
                  setFormData((prev) => ({ ...prev, schedule_cron: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите расписание" />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Часовой пояс</Label>
              <Select
                value={formData.timezone}
                onValueChange={(value: string) =>
                  setFormData((prev) => ({ ...prev, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email получателей *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="email@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                />
                <Button type="button" variant="outline" onClick={addEmail}>
                  Добавить
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.email_recipients.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button onClick={() => removeEmail(email)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="include_file"
                checked={formData.include_file}
                onCheckedChange={(checked: boolean) =>
                  setFormData((prev) => ({ ...prev, include_file: checked }))
                }
              />
              <Label htmlFor="include_file">Прикрепить файл</Label>
            </div>

            <div className="space-y-2">
              <Label>Тема письма</Label>
              <Input
                placeholder="Автоматически сгенерированный отчёт"
                value={formData.email_subject}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email_subject: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Текст письма</Label>
              <Textarea
                rows={4}
                placeholder="Здравствуйте! Во вложении отчёт..."
                value={formData.email_body}
                onChange={(e) => setFormData((prev) => ({ ...prev, email_body: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить расписание?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Расписание будет удалено безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
