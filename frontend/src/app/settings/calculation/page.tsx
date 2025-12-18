'use client';

import { useState, useEffect } from 'react';
import { Save, RotateCcw, Info } from 'lucide-react';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  calculationSettingsService,
  CalculationSettings,
  CalculationSettingsUpdate,
} from '@/lib/api/calculation-settings-service';

export default function CalculationSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CalculationSettings | null>(null);
  const [annualRate, setAnnualRate] = useState<number>(25.0);

  // Form state
  const [formData, setFormData] = useState({
    rate_forex_risk: 3.0,
    rate_fin_comm: 2.0,
    annual_interest_rate: 25.0,
    customs_logistics_pmt_due: 10,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await calculationSettingsService.getSettings();

      if (response.success && response.data) {
        setSettings(response.data);

        // Use annual rate directly if available, otherwise calculate from daily
        const annualRatePercent = response.data.rate_loan_interest_annual
          ? response.data.rate_loan_interest_annual * 100
          : calculationSettingsService.dailyToAnnualRate(response.data.rate_loan_interest_daily) *
            100;

        setAnnualRate(annualRatePercent);

        // Set form values
        setFormData({
          rate_forex_risk: response.data.rate_forex_risk,
          rate_fin_comm: response.data.rate_fin_comm,
          annual_interest_rate: annualRatePercent,
          customs_logistics_pmt_due: response.data.customs_logistics_pmt_due || 10,
        });
      } else {
        toast.error(response.error || 'Не удалось загрузить настройки');
      }
    } catch (error) {
      toast.error('Ошибка при загрузке настроек');
      console.error('Load settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const settingsData: CalculationSettingsUpdate = {
      rate_forex_risk: formData.rate_forex_risk,
      rate_fin_comm: formData.rate_fin_comm,
      rate_loan_interest_annual: formData.annual_interest_rate / 100, // Convert % to decimal
      customs_logistics_pmt_due: formData.customs_logistics_pmt_due,
    };

    // Validate
    const validation = calculationSettingsService.validateSettings(settingsData);
    if (!validation.valid) {
      validation.errors.forEach((error) => toast.error(error));
      return;
    }

    setSaving(true);
    try {
      const response = await calculationSettingsService.saveSettings(settingsData);

      if (response.success && response.data) {
        setSettings(response.data);
        toast.success('Настройки успешно сохранены');
      } else {
        if (response.error?.includes('403') || response.error?.includes('Forbidden')) {
          toast.error(
            'У вас нет прав для изменения настроек. Требуются права администратора или владельца организации.'
          );
        } else {
          toast.error(response.error || 'Не удалось сохранить настройки');
        }
      }
    } catch (error) {
      toast.error('Ошибка при сохранении настроек');
      console.error('Save settings error:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaultAnnual = 25.0; // 25% annual rate
    const defaultCustomsPmt = 10; // 10 days

    setFormData({
      rate_forex_risk: 3.0,
      rate_fin_comm: 2.0,
      annual_interest_rate: defaultAnnual,
      customs_logistics_pmt_due: defaultCustomsPmt,
    });
    setAnnualRate(defaultAnnual);

    // Save the default values to backend
    setSaving(true);
    try {
      const defaultSettings: CalculationSettingsUpdate = {
        rate_forex_risk: 3.0,
        rate_fin_comm: 2.0,
        rate_loan_interest_annual: 0.25, // 25% as decimal
        customs_logistics_pmt_due: 10,
      };

      const response = await calculationSettingsService.saveSettings(defaultSettings);

      if (response.success && response.data) {
        setSettings(response.data);
        toast.success('Настройки сброшены до значений по умолчанию и сохранены');
      } else {
        if (response.error?.includes('403') || response.error?.includes('Forbidden')) {
          toast.error(
            'У вас нет прав для изменения настроек. Требуются права администратора или владельца организации.'
          );
        } else {
          toast.error(response.error || 'Не удалось сохранить настройки');
        }
      }
    } catch (error) {
      toast.error('Ошибка при сохранении настроек');
      console.error('Reset settings error:', error);
    } finally {
      setSaving(false);
    }
  };

  // Calculate daily rate from annual rate for display
  const dailyRate = calculationSettingsService.annualToDailyRate(annualRate / 100);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Настройки расчетов</h1>
          <p className="text-sm text-foreground/60 mt-1">
            Общие параметры расчета для всей организации. Эти настройки могут изменять только
            администраторы.
          </p>
        </div>

        {/* Info Alert */}
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90">
                Изменение этих настроек повлияет на все новые расчеты котировок. Существующие
                котировки останутся без изменений.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Main Form Card */}
        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="h-10 bg-foreground/10 rounded animate-pulse" />
                <div className="h-10 bg-foreground/10 rounded animate-pulse" />
                <div className="h-10 bg-foreground/10 rounded animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSave}>
            <Card>
              <CardContent className="pt-6 space-y-6">
                {/* Currency Exchange Risk */}
                <div className="space-y-2">
                  <Label htmlFor="rate_forex_risk">
                    <span className="font-semibold">Резерв на потери на курсовой разнице</span>
                    <span className="text-foreground/60 ml-2">(rate_forex_risk)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="rate_forex_risk"
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={formData.rate_forex_risk}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rate_forex_risk: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-48"
                      placeholder="3.0"
                      required
                    />
                    <span className="text-sm text-foreground/60">%</span>
                  </div>
                  <p className="text-xs text-foreground/60">
                    Процент резерва для покрытия возможных потерь при колебаниях курса валют
                  </p>
                </div>

                <div className="border-t border-border" />

                {/* Financial Agent Commission */}
                <div className="space-y-2">
                  <Label htmlFor="rate_fin_comm">
                    <span className="font-semibold">Комиссия финансового агента</span>
                    <span className="text-foreground/60 ml-2">(rate_fin_comm)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="rate_fin_comm"
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={formData.rate_fin_comm}
                      onChange={(e) =>
                        setFormData({ ...formData, rate_fin_comm: parseFloat(e.target.value) || 0 })
                      }
                      className="w-48"
                      placeholder="2.0"
                      required
                    />
                    <span className="text-sm text-foreground/60">%</span>
                  </div>
                  <p className="text-xs text-foreground/60">
                    Процент комиссии финансового агента за услуги финансирования
                  </p>
                </div>

                <div className="border-t border-border" />

                {/* Annual Interest Rate */}
                <div className="space-y-2">
                  <Label htmlFor="annual_interest_rate">
                    <span className="font-semibold">Годовая процентная ставка</span>
                    <span className="text-foreground/60 ml-2">(annual interest rate)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="annual_interest_rate"
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.01}
                      value={formData.annual_interest_rate}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        setFormData({ ...formData, annual_interest_rate: value });
                        setAnnualRate(value);
                      }}
                      className="w-48"
                      placeholder="25.0"
                      required
                    />
                    <span className="text-sm text-foreground/60">%</span>
                  </div>
                  <p className="text-xs text-foreground/60">
                    Годовая процентная ставка кредита (автоматически конвертируется в дневную
                    ставку)
                  </p>
                </div>

                {/* Daily Rate Display */}
                <Card className="bg-secondary/30">
                  <CardContent className="pt-4 space-y-2">
                    <div>
                      <p className="text-xs text-foreground/60 mb-1">
                        Дневная ставка (rate_loan_interest_daily)
                      </p>
                      <p className="text-lg font-mono">{dailyRate.toFixed(8)}</p>
                    </div>
                    <p className="text-xs text-foreground/60">
                      Рассчитано как: годовая ставка ÷ 365 = {annualRate.toFixed(2)}% ÷ 365 ={' '}
                      {dailyRate.toFixed(8)}
                    </p>
                    <p className="text-xs text-foreground/60 italic">
                      Это значение будет сохранено в базе данных и использовано в расчетах
                    </p>
                  </CardContent>
                </Card>

                <div className="border-t border-border" />

                {/* Customs/Logistics Payment Term */}
                <div className="space-y-2">
                  <Label htmlFor="customs_logistics_pmt_due">
                    <span className="font-semibold">Срок оплаты таможни и логистики</span>
                    <span className="text-foreground/60 ml-2">(customs_logistics_pmt_due)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="customs_logistics_pmt_due"
                      type="number"
                      min={0}
                      max={365}
                      step={1}
                      value={formData.customs_logistics_pmt_due}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customs_logistics_pmt_due: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-48"
                      placeholder="10"
                      required
                    />
                    <span className="text-sm text-foreground/60">дней</span>
                  </div>
                  <p className="text-xs text-foreground/60">
                    Количество дней на оплату таможенных и логистических расходов. Используется в
                    формуле BI10
                  </p>
                </div>

                <div className="border-t border-border" />

                {/* Buttons */}
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Сохранение...' : 'Сохранить настройки'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleReset}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Сбросить до значений по умолчанию
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}

        {/* Metadata Card */}
        {settings && settings.id && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Информация о настройках</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-foreground/60">Последнее обновление: </span>
                <span>{new Date(settings.updated_at).toLocaleString('ru-RU')}</span>
              </div>
              {settings.updated_by_name && (
                <div>
                  <span className="text-foreground/60">Обновил: </span>
                  <span className="font-semibold">{settings.updated_by_name}</span>
                  {settings.updated_by_role && (
                    <span className="text-foreground/60"> ({settings.updated_by_role})</span>
                  )}
                </div>
              )}
              {settings.organization_name && (
                <div>
                  <span className="text-foreground/60">Организация: </span>
                  <span className="font-semibold">{settings.organization_name}</span>
                  {settings.organization_inn && (
                    <span className="text-foreground/60"> (ИНН: {settings.organization_inn})</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
