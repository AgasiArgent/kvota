'use client';

import { useState, useEffect } from 'react';
import { Save, User, Mail, Phone, Info } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { userService, UserProfile } from '@/lib/api/user-service';

export default function ProfilePage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    manager_name: '',
    manager_phone: '',
    manager_email: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const response = await userService.getProfile();

      if (response.success && response.data) {
        setFormData({
          manager_name: response.data.manager_name || '',
          manager_phone: response.data.manager_phone || '',
          manager_email: response.data.manager_email || '',
        });
      } else {
        toast.error(response.error || 'Не удалось загрузить профиль');
      }
    } catch (error) {
      toast.error('Ошибка при загрузке профиля');
      console.error('Load profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.manager_name && formData.manager_name.length > 255) {
      errors.manager_name = 'Максимальная длина 255 символов';
    }

    if (formData.manager_phone) {
      if (!/^[\d\s\+\-\(\)]+$/.test(formData.manager_phone)) {
        errors.manager_phone = 'Некорректный формат телефона';
      }
      if (formData.manager_phone.length > 50) {
        errors.manager_phone = 'Максимальная длина 50 символов';
      }
    }

    if (formData.manager_email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.manager_email)) {
        errors.manager_email = 'Некорректный формат email';
      }
      if (formData.manager_email.length > 255) {
        errors.manager_email = 'Максимальная длина 255 символов';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const response = await userService.updateProfile(formData);

      if (response.success) {
        toast.success('Профиль обновлен');
      } else {
        toast.error(response.error || 'Не удалось сохранить профиль');
      }
    } catch (error) {
      toast.error('Ошибка при сохранении профиля');
      console.error('Save profile error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Профиль пользователя</h1>
          <p className="text-foreground/60">
            Информация о менеджере для использования в экспорте коммерческих предложений
          </p>
        </div>

        {/* Info Alert */}
        <div className="flex items-start gap-3 rounded-lg border border-blue-400/30 bg-blue-400/10 p-4">
          <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-400">Информация</p>
            <p className="text-sm text-foreground/70">
              Эти данные будут отображаться в экспортированных коммерческих предложениях (PDF, Excel) как контактная информация менеджера.
            </p>
          </div>
        </div>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Контактная информация</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              {/* Manager Name */}
              <div className="space-y-2">
                <Label htmlFor="manager_name" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-foreground/40" />
                  Имя менеджера
                </Label>
                <Input
                  id="manager_name"
                  value={formData.manager_name || ''}
                  onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                  className={validationErrors.manager_name ? 'border-destructive' : ''}
                  autoFocus
                />
                {validationErrors.manager_name && (
                  <p className="text-xs text-destructive">{validationErrors.manager_name}</p>
                )}
              </div>

              {/* Manager Phone */}
              <div className="space-y-2">
                <Label htmlFor="manager_phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-foreground/40" />
                  Телефон менеджера
                </Label>
                <Input
                  id="manager_phone"
                  value={formData.manager_phone || ''}
                  onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })}
                  placeholder="+7 (999) 123-45-67"
                  className={validationErrors.manager_phone ? 'border-destructive' : ''}
                />
                {validationErrors.manager_phone && (
                  <p className="text-xs text-destructive">{validationErrors.manager_phone}</p>
                )}
              </div>

              {/* Manager Email */}
              <div className="space-y-2">
                <Label htmlFor="manager_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-foreground/40" />
                  Email менеджера
                </Label>
                <Input
                  id="manager_email"
                  type="email"
                  value={formData.manager_email || ''}
                  onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })}
                  placeholder="manager@example.com"
                  className={validationErrors.manager_email ? 'border-destructive' : ''}
                />
                {validationErrors.manager_email && (
                  <p className="text-xs text-destructive">{validationErrors.manager_email}</p>
                )}
              </div>

              {/* Save Button */}
              <Button type="submit" className="w-full" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Сохранение...' : 'Сохранить профиль'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
