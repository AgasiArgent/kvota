'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  RefreshCw,
  Trash2,
  Upload,
  BarChart3,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchCampaignData,
  fetchSmartLeadCampaigns,
  syncCampaigns,
  createCampaignData,
  deleteCampaignData,
} from '@/lib/api/campaign-service';
import type { CampaignData, SmartLeadCampaign, CampaignDataSource } from '@/types/dashboard';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<CampaignDataSource | 'all'>('all');
  const [groupByCompany, setGroupByCompany] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Sync dialog state
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [smartLeadCampaigns, setSmartLeadCampaigns] = useState<SmartLeadCampaign[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);

  // Add dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      const source = sourceFilter === 'all' ? undefined : sourceFilter;
      const response = await fetchCampaignData(1, 100, source, searchQuery || undefined);
      setCampaigns(response.campaigns);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      toast.error('Не удалось загрузить данные кампаний');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, sourceFilter]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleOpenSyncDialog = async () => {
    setSyncDialogOpen(true);
    try {
      const campaigns = await fetchSmartLeadCampaigns();
      setSmartLeadCampaigns(campaigns);
    } catch (error) {
      console.error('Failed to fetch SmartLead campaigns:', error);
      toast.error('Не удалось загрузить кампании из SmartLead');
    }
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const result = await syncCampaigns({
        campaign_ids: selectedCampaignIds.length > 0 ? selectedCampaignIds : undefined,
        force_refresh: true,
      });

      toast.success(`Синхронизировано ${result.synced_count} кампаний`);
      if (result.failed_count > 0) {
        toast.error(`Не удалось синхронизировать ${result.failed_count} кампаний`);
      }

      setSyncDialogOpen(false);
      setSelectedCampaignIds([]);
      loadCampaigns();
    } catch (error) {
      console.error('Failed to sync:', error);
      toast.error('Ошибка синхронизации');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddCampaign = async () => {
    if (!newCampaignName.trim()) {
      toast.error('Введите название кампании');
      return;
    }

    try {
      await createCampaignData({
        campaign_name: newCampaignName.trim(),
        source: 'manual',
      });
      toast.success('Кампания добавлена');
      setAddDialogOpen(false);
      setNewCampaignName('');
      loadCampaigns();
    } catch (error) {
      console.error('Failed to add campaign:', error);
      toast.error('Не удалось добавить кампанию');
    }
  };

  const handleDeleteClick = (campaign: CampaignData) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!campaignToDelete) return;

    try {
      setIsDeleting(true);
      await deleteCampaignData(campaignToDelete.id);
      toast.success('Кампания удалена');
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignToDelete.id));
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      toast.error('Не удалось удалить кампанию');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('ru-RU');
  };

  const formatPercent = (value: number | string | undefined | null) => {
    if (value === undefined || value === null) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return `${num.toFixed(2)}%`;
  };

  const toggleGroupExpanded = (company: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(company)) {
        next.delete(company);
      } else {
        next.add(company);
      }
      return next;
    });
  };

  // Extract company prefix from campaign name (e.g., "phmb-main" -> "phmb")
  const extractCompanyPrefix = (name: string): string => {
    // Try common separators: dash, space, underscore
    const separators = ['-', ' ', '_'];
    for (const sep of separators) {
      const parts = name.split(sep);
      if (parts.length > 1 && parts[0].length >= 2) {
        return parts[0].toLowerCase();
      }
    }
    return name.toLowerCase();
  };

  // Group campaigns by company and aggregate metrics
  interface AggregatedCampaign {
    company: string;
    campaignCount: number;
    metrics: {
      total_leads: number;
      reply_count: number;
      reply_rate: number;
      positive_count: number;
      positive_rate: number;
      meeting_request_count: number;
      meeting_to_positive_rate: number;
    };
    campaigns: CampaignData[];
  }

  const groupedCampaigns = React.useMemo((): AggregatedCampaign[] => {
    if (!groupByCompany) return [];

    const groups: Record<string, CampaignData[]> = {};

    for (const campaign of campaigns) {
      const prefix = extractCompanyPrefix(campaign.campaign_name);
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      groups[prefix].push(campaign);
    }

    return Object.entries(groups)
      .map(([company, groupCampaigns]) => {
        // Aggregate metrics
        const totalLeads = groupCampaigns.reduce((sum, c) => sum + (c.metrics.total_leads || 0), 0);
        const replyCount = groupCampaigns.reduce((sum, c) => sum + (c.metrics.reply_count || 0), 0);
        const positiveCount = groupCampaigns.reduce(
          (sum, c) => sum + (c.metrics.positive_count || 0),
          0
        );
        const meetingCount = groupCampaigns.reduce(
          (sum, c) => sum + (c.metrics.meeting_request_count || 0),
          0
        );

        // Calculate rates from aggregated values
        // CR = replies / total_leads
        // Тепл. CR = теплые / ответов (positive / replies)
        // Заяв. CR = заявки / теплые (meetings / positive)
        const replyRate = totalLeads > 0 ? (replyCount / totalLeads) * 100 : 0;
        const positiveRate = replyCount > 0 ? (positiveCount / replyCount) * 100 : 0;
        const meetingToPositiveRate = positiveCount > 0 ? (meetingCount / positiveCount) * 100 : 0;

        return {
          company,
          campaignCount: groupCampaigns.length,
          metrics: {
            total_leads: totalLeads,
            reply_count: replyCount,
            reply_rate: replyRate,
            positive_count: positiveCount,
            positive_rate: positiveRate,
            meeting_request_count: meetingCount,
            meeting_to_positive_rate: meetingToPositiveRate,
          },
          campaigns: groupCampaigns,
        };
      })
      .sort((a, b) => b.metrics.total_leads - a.metrics.total_leads);
  }, [campaigns, groupByCompany]);

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Данные кампаний</h1>
            <p className="text-muted-foreground">Управление данными email-кампаний</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleOpenSyncDialog}>
              <Upload className="mr-2 h-4 w-4" />
              Синхронизировать SmartLead
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить вручную
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск кампаний..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={sourceFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceFilter('all')}
            >
              Все
            </Button>
            <Button
              variant={sourceFilter === 'smartlead' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceFilter('smartlead')}
            >
              SmartLead
            </Button>
            <Button
              variant={sourceFilter === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceFilter('manual')}
            >
              Ручные
            </Button>
          </div>
          <div className="border-l pl-4 ml-2">
            <Button
              variant={groupByCompany ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGroupByCompany(!groupByCompany)}
            >
              {groupByCompany ? 'По компаниям' : 'Группировать'}
            </Button>
          </div>
        </div>

        {/* Campaigns Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {groupByCompany
                ? `Компании (${groupedCampaigns.length} групп, ${campaigns.length} кампаний)`
                : `Кампании (${campaigns.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Нет данных кампаний</p>
                <p className="text-sm">
                  {searchQuery
                    ? 'По вашему запросу ничего не найдено'
                    : 'Синхронизируйте данные из SmartLead или добавьте вручную'}
                </p>
              </div>
            ) : groupByCompany ? (
              /* Grouped View with Expandable Rows */
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Компания</TableHead>
                      <TableHead className="text-right">Кампаний</TableHead>
                      <TableHead className="text-right">Лидов</TableHead>
                      <TableHead className="text-right">Ответов</TableHead>
                      <TableHead className="text-right">CR</TableHead>
                      <TableHead className="text-right">Теплые</TableHead>
                      <TableHead className="text-right">Тепл. CR</TableHead>
                      <TableHead className="text-right">Заявки</TableHead>
                      <TableHead className="text-right">Заяв. CR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedCampaigns.map((group) => {
                      const isExpanded = expandedGroups.has(group.company);
                      return (
                        <React.Fragment key={group.company}>
                          {/* Group Header Row */}
                          <TableRow
                            className="font-medium bg-muted/50 cursor-pointer hover:bg-muted/70"
                            onClick={() => toggleGroupExpanded(group.company)}
                          >
                            <TableCell className="py-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell className="font-bold uppercase">{group.company}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{group.campaignCount}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatNumber(group.metrics.total_leads)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(group.metrics.reply_count)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercent(group.metrics.reply_rate)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(group.metrics.positive_count)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercent(group.metrics.positive_rate)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatNumber(group.metrics.meeting_request_count)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPercent(group.metrics.meeting_to_positive_rate)}
                            </TableCell>
                          </TableRow>
                          {/* Expanded Campaign Rows */}
                          {isExpanded &&
                            group.campaigns.map((campaign) => (
                              <TableRow key={campaign.id} className="bg-background/50 text-sm">
                                <TableCell></TableCell>
                                <TableCell className="pl-6 text-muted-foreground">
                                  {campaign.campaign_name}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="secondary" className="text-xs">
                                    {campaign.source === 'smartlead' ? 'SL' : 'M'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(campaign.metrics.total_leads)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(campaign.metrics.reply_count)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatPercent(campaign.metrics.reply_rate)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(campaign.metrics.positive_count || 0)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatPercent(campaign.metrics.positive_rate)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatNumber(campaign.metrics.meeting_request_count || 0)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatPercent(campaign.metrics.meeting_to_positive_rate)}
                                </TableCell>
                              </TableRow>
                            ))}
                        </React.Fragment>
                      );
                    })}
                    {/* Total row */}
                    <TableRow className="bg-primary/10 font-bold">
                      <TableCell></TableCell>
                      <TableCell>ИТОГО</TableCell>
                      <TableCell className="text-right">
                        <Badge>{campaigns.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(
                          groupedCampaigns.reduce((sum, g) => sum + g.metrics.total_leads, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(
                          groupedCampaigns.reduce((sum, g) => sum + g.metrics.reply_count, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const totalLeads = groupedCampaigns.reduce(
                            (sum, g) => sum + g.metrics.total_leads,
                            0
                          );
                          const totalReplies = groupedCampaigns.reduce(
                            (sum, g) => sum + g.metrics.reply_count,
                            0
                          );
                          return formatPercent(
                            totalLeads > 0 ? (totalReplies / totalLeads) * 100 : 0
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(
                          groupedCampaigns.reduce((sum, g) => sum + g.metrics.positive_count, 0)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const totalReplies = groupedCampaigns.reduce(
                            (sum, g) => sum + g.metrics.reply_count,
                            0
                          );
                          const totalPositive = groupedCampaigns.reduce(
                            (sum, g) => sum + g.metrics.positive_count,
                            0
                          );
                          return formatPercent(
                            totalReplies > 0 ? (totalPositive / totalReplies) * 100 : 0
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(
                          groupedCampaigns.reduce(
                            (sum, g) => sum + g.metrics.meeting_request_count,
                            0
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {(() => {
                          const totalPositive = groupedCampaigns.reduce(
                            (sum, g) => sum + g.metrics.positive_count,
                            0
                          );
                          const totalMeetings = groupedCampaigns.reduce(
                            (sum, g) => sum + g.metrics.meeting_request_count,
                            0
                          );
                          return formatPercent(
                            totalPositive > 0 ? (totalMeetings / totalPositive) * 100 : 0
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* Individual Campaigns View */
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Кампания</TableHead>
                      <TableHead>Источник</TableHead>
                      <TableHead className="text-right">Лидов</TableHead>
                      <TableHead className="text-right">Ответов</TableHead>
                      <TableHead className="text-right">CR</TableHead>
                      <TableHead className="text-right">Теплые</TableHead>
                      <TableHead className="text-right">Тепл. CR</TableHead>
                      <TableHead className="text-right">Заявки</TableHead>
                      <TableHead className="text-right">Заяв. CR</TableHead>
                      <TableHead>Обновлено</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">{campaign.campaign_name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={campaign.source === 'smartlead' ? 'default' : 'secondary'}
                          >
                            {campaign.source === 'smartlead' ? 'SmartLead' : 'Ручной'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(campaign.metrics.total_leads)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(campaign.metrics.reply_count)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(campaign.metrics.reply_rate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(campaign.metrics.positive_count || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(campaign.metrics.positive_rate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(campaign.metrics.meeting_request_count || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatPercent(campaign.metrics.meeting_to_positive_rate)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(campaign.updated_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteClick(campaign)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync Dialog */}
        <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Синхронизация SmartLead</DialogTitle>
              <DialogDescription>
                Выберите кампании для синхронизации или синхронизируйте все
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {smartLeadCampaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="mx-auto h-8 w-8 mb-2 animate-spin" />
                  <p>Загрузка кампаний...</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-auto">
                  {smartLeadCampaigns.map((campaign) => (
                    <label
                      key={campaign.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCampaignIds.includes(campaign.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCampaignIds([...selectedCampaignIds, campaign.id]);
                          } else {
                            setSelectedCampaignIds(
                              selectedCampaignIds.filter((id) => id !== campaign.id)
                            );
                          }
                        }}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{campaign.name}</p>
                        {campaign.status && (
                          <p className="text-sm text-muted-foreground">Статус: {campaign.status}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleSync} disabled={isSyncing}>
                {isSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Синхронизация...
                  </>
                ) : selectedCampaignIds.length > 0 ? (
                  `Синхронизировать (${selectedCampaignIds.length})`
                ) : (
                  'Синхронизировать все'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Campaign Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить кампанию вручную</DialogTitle>
              <DialogDescription>
                Создайте запись кампании для ручного ввода данных
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Название кампании</Label>
                <Input
                  id="campaign-name"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Введите название"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleAddCampaign}>Добавить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить кампанию?</AlertDialogTitle>
              <AlertDialogDescription>
                Данные кампании &quot;{campaignToDelete?.campaign_name}&quot; будут удалены
                безвозвратно.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Удаление...' : 'Удалить'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
