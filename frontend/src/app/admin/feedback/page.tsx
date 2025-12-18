'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FeedbackService, type Feedback } from '@/lib/api/feedback-service';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function FeedbackPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      toast.error('Доступ запрещён');
      router.push('/dashboard');
    }
  }, [profile, router]);

  // Fetch feedback
  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchFeedback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, profile]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const statusFilter = activeTab === 'all' ? undefined : activeTab;
      const response = await FeedbackService.list(statusFilter, currentPage, 20);
      setFeedback(response.feedback);
      setTotal(response.total);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Ошибка загрузки: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (feedbackId: string) => {
    try {
      setResolvingId(feedbackId);
      await FeedbackService.resolve(feedbackId);
      toast.success('Обратная связь отмечена как решённая');
      fetchFeedback(); // Refresh list
    } catch (error) {
      if (error instanceof Error) {
        toast.error(`Ошибка: ${error.message}`);
      }
    } finally {
      setResolvingId(null);
    }
  };

  const showDetail = (record: Feedback) => {
    setSelectedFeedback(record);
    setDetailModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'open') {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <Clock className="h-3 w-3" />
          Открыто
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1.5 bg-emerald-500/20 text-emerald-400">
        <CheckCircle className="h-3 w-3" />
        Решено
      </Badge>
    );
  };

  const pageSize = 20;
  const openCount = feedback.filter((f) => f.status === 'open').length;

  if (profile?.role !== 'admin') {
    return null; // Will redirect
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Обратная связь пользователей"
          description="Просмотр и управление отчётами об ошибках и предложениями пользователей"
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">Все</TabsTrigger>
            <TabsTrigger value="open">
              Открытые
              {openCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-400">
                  {openCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="resolved">Решённые</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {/* Table */}
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : feedback.length === 0 ? (
                <div className="p-8 text-center text-foreground/40">Нет данных</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/30 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                          Дата
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                          Пользователь
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                          Страница
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                          Описание
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
                      {feedback.map((record) => (
                        <tr key={record.id} className="hover:bg-foreground/5 transition-colors">
                          <td className="px-4 py-3 text-sm text-foreground/70">
                            {dayjs(record.created_at).format('DD.MM.YYYY HH:mm')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground/90">
                                {record.user_full_name || 'Неизвестно'}
                              </span>
                              <span className="text-xs text-foreground/55">
                                {record.user_email}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/70 max-w-[250px] truncate">
                            <a
                              href={record.page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-amber-400 transition-colors"
                              title={record.page_url}
                            >
                              {record.page_url}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground/70 max-w-[300px] truncate">
                            {record.description}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(record.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => showDetail(record)}>
                                <Info className="mr-1.5 h-4 w-4" />
                                Детали
                              </Button>
                              {record.status === 'open' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  disabled={resolvingId === record.id}
                                  onClick={() => handleResolve(record.id)}
                                >
                                  <CheckCircle className="mr-1.5 h-4 w-4" />
                                  {resolvingId === record.id ? 'Обработка...' : 'Решено'}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {!loading && total > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/20">
                  <div className="text-sm text-foreground/60">Всего: {total}</div>
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
                      Страница {currentPage} из {Math.ceil(total / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= Math.ceil(total / pageSize)}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Далее
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали обратной связи</DialogTitle>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                    Статус
                  </div>
                  <div>{getStatusBadge(selectedFeedback.status)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                    Дата создания
                  </div>
                  <div className="text-sm text-foreground/90">
                    {dayjs(selectedFeedback.created_at).format('DD.MM.YYYY HH:mm:ss')}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                  Пользователь
                </div>
                <div className="text-sm">
                  <div className="font-medium text-foreground/90">
                    {selectedFeedback.user_full_name || 'Неизвестно'}
                  </div>
                  <div className="text-foreground/60">{selectedFeedback.user_email}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                  Страница
                </div>
                <a
                  href={selectedFeedback.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-amber-400 hover:text-amber-500 transition-colors"
                >
                  {selectedFeedback.page_url}
                </a>
              </div>

              <div>
                <div className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                  Описание
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-wrap rounded-md bg-secondary/30 p-3">
                  {selectedFeedback.description}
                </div>
              </div>

              {selectedFeedback.browser_info && (
                <div>
                  <div className="text-xs text-foreground/60 uppercase tracking-wider mb-1">
                    Информация о браузере
                  </div>
                  <div className="text-xs text-foreground/70 space-y-1 rounded-md bg-secondary/30 p-3">
                    <div>
                      <strong>User Agent:</strong> {selectedFeedback.browser_info.userAgent}
                    </div>
                    <div>
                      <strong>Экран:</strong> {selectedFeedback.browser_info.screenWidth} x{' '}
                      {selectedFeedback.browser_info.screenHeight}
                    </div>
                    <div>
                      <strong>Окно:</strong> {selectedFeedback.browser_info.windowWidth} x{' '}
                      {selectedFeedback.browser_info.windowHeight}
                    </div>
                    <div>
                      <strong>Время:</strong>{' '}
                      {dayjs(selectedFeedback.browser_info.timestamp).format('DD.MM.YYYY HH:mm:ss')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailModalOpen(false)}>
              Закрыть
            </Button>
            {selectedFeedback?.status === 'open' && (
              <Button
                disabled={resolvingId === selectedFeedback?.id}
                onClick={() => {
                  if (selectedFeedback) {
                    handleResolve(selectedFeedback.id);
                    setDetailModalOpen(false);
                  }
                }}
              >
                <CheckCircle className="mr-1.5 h-4 w-4" />
                Отметить как решённое
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
