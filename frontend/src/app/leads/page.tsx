'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search as SearchIcon,
  X,
  Eye,
  Trash2,
  CheckCircle,
  Phone,
  Mail,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  listLeads,
  deleteLead,
  qualifyLead,
  type LeadWithDetails,
  type LeadListParams,
} from '@/lib/api/lead-service';
import { listLeadStages, type LeadStage } from '@/lib/api/lead-stage-service';

export default function LeadsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');
  const [segmentFilter, setSegmentFilter] = useState('');

  // Delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; lead: LeadWithDetails | null }>(
    {
      open: false,
      lead: null,
    }
  );

  // Qualify confirmation dialog
  const [qualifyDialog, setQualifyDialog] = useState<{
    open: boolean;
    lead: LeadWithDetails | null;
  }>({
    open: false,
    lead: null,
  });

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
      } catch (error) {
        toast.error(
          `Ошибка загрузки: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
        );
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch leads when filters change (stages already loaded)
  useEffect(() => {
    if (stages.length > 0) {
      fetchLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (error) {
      toast.error(
        `Ошибка загрузки лидов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      );
      setLeads([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.lead) return;

    try {
      await deleteLead(deleteDialog.lead.id);
      toast.success(`Лид "${deleteDialog.lead.company_name}" успешно удален`);
      setDeleteDialog({ open: false, lead: null });
      fetchLeads();
    } catch (error) {
      toast.error(
        `Ошибка удаления: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      );
    }
  };

  const handleQualify = async () => {
    if (!qualifyDialog.lead) return;

    try {
      const response = await qualifyLead(qualifyDialog.lead.id);
      toast.success(
        `Лид "${qualifyDialog.lead.company_name}" квалифицирован. Создан клиент "${response.customer_name}"`
      );
      setQualifyDialog({ open: false, lead: null });
      fetchLeads();
    } catch (error) {
      toast.error(
        `Ошибка квалификации: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
      );
    }
  };

  const getStageBadge = (stageName?: string, stageColor?: string) => {
    if (!stageName) {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />—
        </Badge>
      );
    }

    // Convert hex color to Tailwind class approximation
    const dotColorClass = stageColor ? `bg-[${stageColor}]` : 'bg-zinc-400';

    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColorClass)} />
        {stageName}
      </Badge>
    );
  };

  // Calculate statistics
  const statsData = {
    total: totalCount,
    newLeads: leads.filter((l) => l.stage_name === 'Новый').length,
    qualified: leads.filter((l) => l.stage_name === 'Квалифицирован').length,
    unassigned: leads.filter((l) => !l.assigned_to).length,
  };

  const hasActiveFilters = searchTerm || stageFilter || assignedFilter || segmentFilter;

  const clearFilters = () => {
    setSearchTerm('');
    setStageFilter('');
    setAssignedFilter('');
    setSegmentFilter('');
    setCurrentPage(1);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Лиды"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/leads/pipeline')}>
                Воронка
              </Button>
              <Button onClick={() => router.push('/leads/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Создать лид
              </Button>
            </div>
          }
        />

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard label="Всего лидов" value={statsData.total} />
          <StatCard label="Новые" value={statsData.newLeads} />
          <StatCard label="Квалифицированы" value={statsData.qualified} />
          <StatCard label="Не назначены" value={statsData.unassigned} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/30 p-4">
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
            <Input
              placeholder="Поиск по названию, email, ИНН"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background/50 border-border/50 placeholder:text-foreground/30"
            />
          </div>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
              <SelectValue placeholder="Этап" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={assignedFilter} onValueChange={setAssignedFilter}>
            <SelectTrigger className="w-[160px] bg-background/50 border-border/50">
              <SelectValue placeholder="Ответственный" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Мои лиды</SelectItem>
              <SelectItem value="unassigned">Не назначены</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Сегмент"
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="w-[160px] bg-background/50 border-border/50 placeholder:text-foreground/30"
          />

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-3 text-foreground/50 hover:text-foreground hover:bg-background/50"
            >
              <X className="mr-1.5 h-4 w-4" />
              Сбросить
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-foreground/40">Лиды не найдены</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Компания
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      ИНН
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Контакты
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Этап
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Ответственный
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Создан
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leads.map((lead) => {
                    const isQualified = lead.stage_name === 'Квалифицирован';
                    const isFailed = lead.stage_name === 'Отказ';

                    return (
                      <tr key={lead.id} className="hover:bg-foreground/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <button
                              onClick={() => router.push(`/leads/${lead.id}`)}
                              className="font-medium text-foreground/90 hover:text-amber-400 text-left transition-colors"
                            >
                              {lead.company_name}
                            </button>
                            {lead.segment && (
                              <span className="text-xs text-foreground/55">{lead.segment}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">{lead.inn || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 text-xs">
                            {lead.email && (
                              <div className="flex items-center gap-1.5 text-foreground/60">
                                <Mail className="h-3 w-3" />
                                <span>{lead.email}</span>
                              </div>
                            )}
                            {lead.primary_phone && (
                              <div className="flex items-center gap-1.5 text-foreground/60">
                                <Phone className="h-3 w-3" />
                                <span>{lead.primary_phone}</span>
                              </div>
                            )}
                            {lead.contacts && lead.contacts.length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-foreground/60 cursor-help">
                                      <User className="h-3 w-3" />
                                      <span>ЛПР: {lead.contacts.length}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="text-xs">
                                      {lead.contacts.map((c) => c.full_name).join(', ')}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {getStageBadge(lead.stage_name, lead.stage_color)}
                        </td>
                        <td className="px-4 py-3">
                          {lead.assigned_to_name ? (
                            <div className="flex items-center gap-1.5 text-sm text-foreground/70">
                              <User className="h-3 w-3" />
                              <span>{lead.assigned_to_name}</span>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Не назначен
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {new Date(lead.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/leads/${lead.id}`)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Открыть</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {!isQualified && !isFailed && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setQualifyDialog({ open: true, lead })}
                                      className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-400 hover:bg-emerald-400/10"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Квалифицировать</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteDialog({ open: true, lead })}
                                    className="h-8 w-8 p-0 text-red-400 hover:text-red-400 hover:bg-red-400/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Удалить</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalCount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/20">
              <div className="text-sm text-foreground/60">
                Показано {(currentPage - 1) * pageSize + 1}–
                {Math.min(currentPage * pageSize, totalCount)} из {totalCount} лидов
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Назад
                </Button>
                <span className="text-sm text-foreground/60">
                  Страница {currentPage} из {Math.ceil(totalCount / pageSize)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  Далее
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open: boolean) => setDeleteDialog({ open, lead: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить лид?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить &quot;{deleteDialog.lead?.company_name}&quot;?
              <br />
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Да, удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Qualify Confirmation Dialog */}
      <AlertDialog
        open={qualifyDialog.open}
        onOpenChange={(open: boolean) => setQualifyDialog({ open, lead: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Квалифицировать лид?</AlertDialogTitle>
            <AlertDialogDescription>
              Создать клиента из лида &quot;{qualifyDialog.lead?.company_name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет</AlertDialogCancel>
            <AlertDialogAction onClick={handleQualify}>Да</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
