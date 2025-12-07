'use client';

/**
 * Exchange Rate Settings Page
 *
 * Admin page for managing organization exchange rates.
 * - Toggle between automatic CBR rates and manual rates
 * - View/edit individual currency rates
 * - Sync rates from CBR
 */

import { useState, useEffect } from 'react';
import { RefreshCw, Edit2, Info, Clock } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  getOrgExchangeRates,
  updateExchangeRateSettings,
  updateOrgRate,
  syncRatesFromCBR,
  OrgExchangeRate,
  OrgExchangeRateSettings,
} from '@/lib/api/org-exchange-rates-service';

// Currency display info
const CURRENCY_INFO: Record<string, { symbol: string; name: string }> = {
  EUR: { symbol: '€', name: 'Евро' },
  RUB: { symbol: '₽', name: 'Российский рубль' },
  TRY: { symbol: '₺', name: 'Турецкая лира' },
  CNY: { symbol: '¥', name: 'Китайский юань' },
};

export default function ExchangeRateSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState<OrgExchangeRateSettings | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRate, setEditingRate] = useState<OrgExchangeRate | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getOrgExchangeRates();
      setSettings(data);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Не удалось загрузить настройки курсов валют');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleManualRates = async (checked: boolean) => {
    setSaving(true);
    try {
      await updateExchangeRateSettings({ use_manual_exchange_rates: checked });
      setSettings((prev) => (prev ? { ...prev, use_manual_exchange_rates: checked } : null));
      toast.success(
        checked ? 'Включены ручные курсы валют' : 'Включены автоматические курсы ЦБ РФ'
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('403') || error.message.includes('Forbidden')) {
          toast.error('У вас нет прав для изменения настроек. Требуются права администратора.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Не удалось изменить настройки');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromCBR = async () => {
    setSyncing(true);
    try {
      const result = await syncRatesFromCBR();
      toast.success(result.message);
      await loadSettings();
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Не удалось синхронизировать курсы с ЦБ РФ');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleEditRate = (rate: OrgExchangeRate) => {
    setEditingRate(rate);
    setEditValue(rate.rate);
    setEditModalVisible(true);
  };

  const handleSaveRate = async () => {
    if (!editingRate) return;

    if (editValue <= 0) {
      toast.error('Курс должен быть положительным числом');
      return;
    }

    try {
      setSaving(true);

      await updateOrgRate(editingRate.from_currency, editValue);
      toast.success(`Курс ${editingRate.from_currency}/USD обновлен`);

      // Reload settings to get fresh data
      await loadSettings();
      setEditModalVisible(false);
      setEditingRate(null);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const getSourceBadge = (source: string) => {
    if (source === 'manual') {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          Ручной
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        ЦБ РФ
      </Badge>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Курсы валют</h1>
          <p className="mt-1 text-base text-foreground/60">
            Управление курсами валют для расчета котировок. Все валюты конвертируются в USD для
            хранения и аналитики.
          </p>
        </div>

        {/* Mode Toggle Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Режим курсов валют</Label>
                  <p className="text-sm text-foreground/60">
                    {settings?.use_manual_exchange_rates
                      ? 'Используются ручные курсы из таблицы ниже'
                      : 'Используются автоматические курсы ЦБ РФ'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-foreground/60">Автоматические (ЦБ)</span>
                  <button
                    onClick={() => handleToggleManualRates(!settings?.use_manual_exchange_rates)}
                    disabled={saving}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      settings?.use_manual_exchange_rates ? 'bg-amber-500' : 'bg-zinc-300'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        settings?.use_manual_exchange_rates ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                  <span className="text-sm text-foreground/60">Ручные</span>
                </div>
              </div>

              {settings?.use_manual_exchange_rates && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground/90">Ручные курсы активны</p>
                      <p className="mt-1 text-sm text-foreground/70">
                        Курсы из таблицы ниже будут использоваться для всех новых котировок. Не
                        забывайте периодически обновлять курсы.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!settings?.use_manual_exchange_rates && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground/90">Автоматические курсы ЦБ РФ</p>
                      <p className="mt-1 text-sm text-foreground/70">
                        Курсы автоматически обновляются ежедневно из данных Центрального Банка
                        России.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rates Table Card */}
        <Card>
          <CardHeader>
            <CardTitle>Текущие курсы</CardTitle>
            <Button
              onClick={handleSyncFromCBR}
              disabled={!settings?.use_manual_exchange_rates || syncing}
              variant="default"
              size="sm"
              className="absolute right-6 top-6"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', syncing && 'animate-spin')} />
              Синхронизировать с ЦБ РФ
            </Button>
          </CardHeader>
          <CardContent>
            {!settings?.use_manual_exchange_rates && (
              <div className="mb-4 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground/90">Редактирование недоступно</p>
                    <p className="mt-1 text-sm text-foreground/70">
                      Включите ручные курсы для редактирования. Кнопка синхронизации скопирует
                      текущие курсы ЦБ в вашу таблицу.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-secondary/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Валюта
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Курс к USD
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Источник
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Обновлено
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {settings?.rates && settings.rates.length > 0 ? (
                    settings.rates.map((rate) => {
                      const info = CURRENCY_INFO[rate.from_currency];
                      return (
                        <tr
                          key={`${rate.from_currency}-${rate.to_currency}`}
                          className="hover:bg-foreground/5"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground/90">
                                {info?.symbol} {rate.from_currency}
                              </span>
                              <span className="text-sm text-foreground/60">{info?.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm text-foreground/90">
                                {rate.rate.toFixed(6)}
                              </span>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-foreground/40 cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    1 {rate.from_currency} = {rate.rate.toFixed(6)} USD
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getSourceBadge(rate.source)}</td>
                          <td className="px-4 py-3">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <Clock className="h-4 w-4 text-foreground/40" />
                                    <span className="text-sm text-foreground/60">
                                      {new Date(rate.updated_at).toLocaleDateString('ru-RU')}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {new Date(rate.updated_at).toLocaleString('ru-RU')}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRate(rate)}
                              disabled={!settings?.use_manual_exchange_rates}
                            >
                              <Edit2 className="mr-1.5 h-4 w-4" />
                              Изменить
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-foreground/40">
                        Нет сохраненных курсов
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {settings?.rates &&
              settings.rates.length === 0 &&
              settings.use_manual_exchange_rates && (
                <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground/90">Нет сохраненных курсов</p>
                      <p className="mt-1 text-sm text-foreground/70">
                        Нажмите &quot;Синхронизировать с ЦБ РФ&quot; чтобы загрузить актуальные
                        курсы.
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Информация о курсах</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/70">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-foreground/40" />
              <p>
                Курсы хранятся как количество USD за 1 единицу валюты (например: 1 EUR = 1.08 USD)
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-foreground/40" />
              <p>
                При создании котировки курс фиксируется и сохраняется вместе с каждым денежным
                значением
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-foreground/40" />
              <p>Пересчет котировки по новым курсам создает новую версию с сохранением истории</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Rate Modal */}
      <Dialog open={editModalVisible} onOpenChange={setEditModalVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить курс {editingRate?.from_currency}/USD</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="rate">Курс к USD</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-foreground/40 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Сколько USD за 1 {editingRate?.from_currency}. Например: 1 EUR = 1.08 USD
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground/60 whitespace-nowrap">
                  1 {editingRate?.from_currency} =
                </span>
                <Input
                  id="rate"
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(parseFloat(e.target.value))}
                  step={0.0001}
                  min={0.000001}
                  className="flex-1"
                />
                <span className="text-sm text-foreground/60">USD</span>
              </div>
            </div>

            {editingRate && (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground/90">
                      Текущий курс: {editingRate.rate.toFixed(6)} USD
                    </p>
                    <p className="text-foreground/70">
                      Источник: {editingRate.source === 'manual' ? 'Ручной' : 'ЦБ РФ'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditModalVisible(false);
                setEditingRate(null);
              }}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveRate} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
