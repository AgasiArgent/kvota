'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Building2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface SellerCompany {
  id: string;
  organization_id: string;
  name: string;
  supplier_code: string;
  country: string | null;
  is_active: boolean;
  // Director fields (for specification export)
  general_director_last_name: string | null;
  general_director_first_name: string | null;
  general_director_patronymic: string | null;
  general_director_position: string | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  supplier_code: string;
  country: string;
  is_active: boolean;
  // Director fields
  general_director_last_name: string;
  general_director_first_name: string;
  general_director_patronymic: string;
  general_director_position: string;
}

const initialFormData: FormData = {
  name: '',
  supplier_code: '',
  country: '',
  is_active: true,
  general_director_last_name: '',
  general_director_first_name: '',
  general_director_patronymic: '',
  general_director_position: 'Генеральный директор',
};

export default function SellerCompaniesPage() {
  const [companies, setCompanies] = useState<SellerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<SellerCompany | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<SellerCompany | null>(null);

  // Form state
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Fetch companies
  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Необходима авторизация');
        return;
      }

      const url = `${apiUrl}/api/seller-companies/?include_inactive=${showInactive}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch seller companies');
      }

      const data = await response.json();
      setCompanies(data);
    } catch (error) {
      console.error('Failed to fetch companies:', error);
      toast.error('Не удалось загрузить компании-продавцы');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, showInactive]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // Open create dialog
  const handleCreate = () => {
    setEditingCompany(null);
    setFormData(initialFormData);
    setFormError(null);
    setDialogOpen(true);
  };

  // Open edit dialog
  const handleEdit = (company: SellerCompany) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      supplier_code: company.supplier_code,
      country: company.country || '',
      is_active: company.is_active,
      general_director_last_name: company.general_director_last_name || '',
      general_director_first_name: company.general_director_first_name || '',
      general_director_patronymic: company.general_director_patronymic || '',
      general_director_position: company.general_director_position || 'Генеральный директор',
    });
    setFormError(null);
    setDialogOpen(true);
  };

  // Open delete dialog
  const handleDeleteClick = (company: SellerCompany) => {
    setDeletingCompany(company);
    setDeleteDialogOpen(true);
  };

  // Save company (create or update)
  const handleSave = async () => {
    // Validate
    if (!formData.name.trim()) {
      setFormError('Введите название компании');
      return;
    }
    if (!formData.supplier_code.trim()) {
      setFormError('Введите код поставщика');
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(formData.supplier_code)) {
      setFormError('Код поставщика должен состоять из 3 букв (A-Z)');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Необходима авторизация');
        return;
      }

      const payload = {
        name: formData.name.trim(),
        supplier_code: formData.supplier_code.toUpperCase(),
        country: formData.country.trim() || null,
        is_active: formData.is_active,
        general_director_last_name: formData.general_director_last_name.trim() || null,
        general_director_first_name: formData.general_director_first_name.trim() || null,
        general_director_patronymic: formData.general_director_patronymic.trim() || null,
        general_director_position: formData.general_director_position.trim() || null,
      };

      const url = editingCompany
        ? `${apiUrl}/api/seller-companies/${editingCompany.id}`
        : `${apiUrl}/api/seller-companies/`;

      const response = await fetch(url, {
        method: editingCompany ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save');
      }

      toast.success(editingCompany ? 'Компания обновлена' : 'Компания создана');
      setDialogOpen(false);
      fetchCompanies();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка сохранения';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  // Delete company
  const handleDelete = async () => {
    if (!deletingCompany) return;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Необходима авторизация');
        return;
      }

      const response = await fetch(`${apiUrl}/api/seller-companies/${deletingCompany.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      toast.success('Компания удалена');
      setDeleteDialogOpen(false);
      setDeletingCompany(null);
      fetchCompanies();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Не удалось удалить компанию');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Компании-продавцы"
          description="Управление компаниями для коммерческих предложений"
        />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} id="show-inactive" />
            <Label htmlFor="show-inactive" className="text-sm text-foreground/60">
              Показать неактивные
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchCompanies}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Обновить
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить компанию
            </Button>
          </div>
        </div>

        {/* Companies List */}
        <div className="grid gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/4" />
                </CardContent>
              </Card>
            ))
          ) : companies.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <Building2 className="mx-auto h-12 w-12 text-foreground/20 mb-4" />
                <p className="text-foreground/40">Нет компаний-продавцов</p>
                <Button className="mt-4" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить первую компанию
                </Button>
              </CardContent>
            </Card>
          ) : (
            companies.map((company) => (
              <Card
                key={company.id}
                className={cn(
                  'bg-card border-border transition-all',
                  !company.is_active && 'opacity-50'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-medium text-foreground">{company.name}</h3>
                        <Badge variant="secondary" className="font-mono">
                          {company.supplier_code}
                        </Badge>
                        {!company.is_active && (
                          <Badge variant="secondary" className="gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                            Неактивна
                          </Badge>
                        )}
                      </div>
                      {company.country && (
                        <p className="text-sm text-foreground/50 mt-1">{company.country}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(company)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(company)}
                        className="text-rose-400 hover:text-rose-500 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? 'Редактировать компанию' : 'Новая компания-продавец'}
            </DialogTitle>
            <DialogDescription>
              Код поставщика используется в номерах КП (например: MBR-1234567890-001)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Название компании *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ООО Компания"
              />
            </div>

            <div className="space-y-2">
              <Label>Код поставщика (3 буквы) *</Label>
              <Input
                value={formData.supplier_code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    supplier_code: e.target.value.toUpperCase().slice(0, 3),
                  })
                }
                placeholder="ABC"
                maxLength={3}
                className="font-mono uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label>Страна</Label>
              <Input
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Россия"
              />
            </div>

            {/* Director Name Section */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">Подписант (директор)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-foreground/60">Фамилия</Label>
                  <Input
                    value={formData.general_director_last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, general_director_last_name: e.target.value })
                    }
                    placeholder="Ермаков"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-foreground/60">Имя</Label>
                  <Input
                    value={formData.general_director_first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, general_director_first_name: e.target.value })
                    }
                    placeholder="Иван"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-foreground/60">Отчество</Label>
                  <Input
                    value={formData.general_director_patronymic}
                    onChange={(e) =>
                      setFormData({ ...formData, general_director_patronymic: e.target.value })
                    }
                    placeholder="Иванович"
                  />
                </div>
              </div>
              <div className="space-y-1 mt-3">
                <Label className="text-xs text-foreground/60">Должность</Label>
                <Input
                  value={formData.general_director_position}
                  onChange={(e) =>
                    setFormData({ ...formData, general_director_position: e.target.value })
                  }
                  placeholder="Генеральный директор"
                />
              </div>
              {/* Live Preview */}
              {(formData.general_director_last_name ||
                formData.general_director_first_name ||
                formData.general_director_patronymic) && (
                <p className="text-xs text-foreground/50 mt-2">
                  В документах:{' '}
                  <span className="text-foreground/80">
                    {formData.general_director_last_name}
                    {formData.general_director_first_name &&
                      ` ${formData.general_director_first_name.charAt(0)}.`}
                    {formData.general_director_patronymic &&
                      ` ${formData.general_director_patronymic.charAt(0)}.`}
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked: boolean) =>
                  setFormData({ ...formData, is_active: checked })
                }
                id="is-active"
              />
              <Label htmlFor="is-active">Активна</Label>
            </div>

            {formError && <p className="text-sm text-rose-400">{formError}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить компанию?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить компанию &quot;{deletingCompany?.name}&quot;? Это
              действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
