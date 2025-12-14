'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Edit, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { organizationService } from '@/lib/api/organization-service';
import { Organization, OrganizationUpdate } from '@/lib/types/organization';

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const organizationId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<OrganizationUpdate>>({});

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchOrganization();
  }, [organizationId]);

  const fetchOrganization = async () => {
    setLoading(true);
    try {
      const result = await organizationService.getOrganization(organizationId);

      if (result.success && result.data) {
        setOrganization(result.data);
        setFormData({
          name: result.data.name,
          description: result.data.description,
          supplier_code: result.data.supplier_code,
        });

        // Check user's role
        const orgsResult = await organizationService.listOrganizations();
        if (orgsResult.success && orgsResult.data) {
          const userOrg = orgsResult.data.find((org) => org.organization_id === organizationId);
          if (userOrg) {
            const canManage = userOrg.is_owner || userOrg.role_slug === 'admin';
            setCanEdit(canManage);
            setIsOwner(userOrg.is_owner);
          }
        }
      } else {
        throw new Error(result.error || 'Failed to load organization');
      }
    } catch (error: any) {
      toast.error(`Ошибка загрузки организации: ${error.message}`);
      router.push('/organizations');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'Введите название';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'Минимум 3 символа';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Максимум 100 символов';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Максимум 500 символов';
    }

    // Validate supplier_code: must be exactly 3 uppercase letters
    if (formData.supplier_code) {
      const supplierCodeRegex = /^[A-Z]{3}$/;
      if (!supplierCodeRegex.test(formData.supplier_code)) {
        errors.supplier_code =
          'Код поставщика должен содержать ровно 3 заглавные буквы (например, MBR, CMT)';
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
      const result = await organizationService.updateOrganization(organizationId, formData);

      if (result.success && result.data) {
        setOrganization(result.data);
        setEditMode(false);
        toast.success('Изменения успешно сохранены');
      } else {
        throw new Error(result.error || 'Failed to update organization');
      }
    } catch (error: any) {
      toast.error(`Ошибка сохранения: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const result = await organizationService.deleteOrganization(organizationId);

      if (result.success) {
        toast.success('Организация успешно удалена');
        router.push('/organizations');
      } else {
        throw new Error(result.error || 'Failed to delete organization');
      }
    } catch (error: any) {
      toast.error(`Ошибка удаления: ${error.message}`);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: organization?.name,
      description: organization?.description,
      supplier_code: organization?.supplier_code,
    });
    setValidationErrors({});
    setEditMode(false);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; dotColor: string }> = {
      active: { label: 'Активна', dotColor: 'bg-emerald-400' },
      trial: { label: 'Пробный период', dotColor: 'bg-amber-400' },
      suspended: { label: 'Приостановлена', dotColor: 'bg-rose-400' },
      deleted: { label: 'Удалена', dotColor: 'bg-muted-foreground' },
    };

    const s = statusMap[status] || { label: status, dotColor: 'bg-muted-foreground' };
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', s.dotColor)} />
        {s.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!organization) {
    return (
      <MainLayout>
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-destructive">Организация не найдена</h3>
              <p className="text-sm text-foreground/60">
                Запрошенная организация не существует или у вас нет прав доступа.
              </p>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/organizations')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
              {getStatusBadge(organization.status)}
            </div>
          </div>
          {canEdit && !editMode && (
            <Button variant="outline" onClick={() => setEditMode(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Редактировать
            </Button>
          )}
        </div>

        {/* View Mode */}
        {!editMode && (
          <Card>
            <CardHeader>
              <CardTitle>Информация об организации</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <Label className="text-foreground/60">Название</Label>
                  <p className="text-foreground/90 mt-1">{organization.name}</p>
                </div>

                <div>
                  <Label className="text-foreground/60">Идентификатор</Label>
                  <p className="text-foreground/90 mt-1 font-mono text-sm">@{organization.slug}</p>
                </div>

                <div>
                  <Label className="text-foreground/60">Код поставщика (IDN)</Label>
                  <p className="text-foreground/90 mt-1 font-mono text-sm">
                    {organization.supplier_code || <span className="text-amber-500">Не задан</span>}
                  </p>
                  {!organization.supplier_code && canEdit && (
                    <p className="text-xs text-amber-500/80 mt-1">
                      Для генерации IDN необходимо задать код поставщика
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label className="text-foreground/60">Описание</Label>
                  <p className="text-foreground/90 mt-1">
                    {organization.description || (
                      <span className="text-foreground/40">Нет описания</span>
                    )}
                  </p>
                </div>

                <div>
                  <Label className="text-foreground/60">Статус</Label>
                  <div className="mt-1">{getStatusBadge(organization.status)}</div>
                </div>

                <div>
                  <Label className="text-foreground/60">Дата создания</Label>
                  <p className="text-foreground/90 mt-1">
                    {new Date(organization.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>

                <div>
                  <Label className="text-foreground/60">Последнее обновление</Label>
                  <p className="text-foreground/90 mt-1">
                    {new Date(organization.updated_at).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Mode */}
        {editMode && (
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle>Редактировать организацию</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Название организации *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Название организации"
                    className={validationErrors.name ? 'border-destructive' : ''}
                  />
                  {validationErrors.name && (
                    <p className="text-xs text-destructive mt-1">{validationErrors.name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="slug">Идентификатор</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/60">@</span>
                    <Input id="slug" value={organization.slug} disabled />
                  </div>
                  <p className="text-xs text-foreground/40 mt-1">
                    Идентификатор нельзя изменить, чтобы не сломать существующие ссылки
                  </p>
                </div>

                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    rows={4}
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Описание организации"
                    maxLength={500}
                    className={validationErrors.description ? 'border-destructive' : ''}
                  />
                  <div className="flex justify-between items-center mt-1">
                    {validationErrors.description && (
                      <p className="text-xs text-destructive">{validationErrors.description}</p>
                    )}
                    <p className="text-xs text-foreground/40 ml-auto">
                      {formData.description?.length || 0}/500
                    </p>
                  </div>
                </div>

                {/* Supplier Code for IDN */}
                <div className="border-t pt-4">
                  <Label htmlFor="supplier_code">Код поставщика для IDN</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="supplier_code"
                      value={formData.supplier_code || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          supplier_code: e.target.value.toUpperCase().slice(0, 3),
                        })
                      }
                      placeholder="MBR"
                      maxLength={3}
                      className={cn(
                        'w-24 font-mono uppercase',
                        validationErrors.supplier_code ? 'border-destructive' : ''
                      )}
                    />
                    <span className="text-sm text-foreground/60">
                      3 заглавные буквы (например: MBR, CMT, RAR)
                    </span>
                  </div>
                  {validationErrors.supplier_code && (
                    <p className="text-xs text-destructive mt-1">
                      {validationErrors.supplier_code}
                    </p>
                  )}
                  <div className="flex items-start gap-2 mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                    <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-foreground/80 space-y-1">
                      <p>
                        <strong>Код поставщика</strong> используется для формирования уникального
                        идентификатора (IDN) КП в формате:
                      </p>
                      <p className="font-mono text-blue-400">
                        {formData.supplier_code || 'XXX'}-1234567890-2025-1
                      </p>
                      <p className="text-foreground/60">
                        После установки код лучше не менять, чтобы сохранить преемственность
                        номеров.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button type="submit" disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Сохранение...' : 'Сохранить изменения'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Отменить
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}

        {/* Danger Zone (Owner only) */}
        {isOwner && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-destructive">Опасная зона</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold">Удалить организацию</h3>
                <p className="text-sm text-foreground/60 mt-1">
                  После удаления организация будет помечена как удалённая и станет недоступна. Это
                  действие нельзя отменить.
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить организацию
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить организацию?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>Вы уверены, что хотите удалить эту организацию?</p>
                      <p className="text-destructive font-medium">Это действие нельзя отменить.</p>
                      <p>Организация будет помечена как удалённая и больше не будет доступна.</p>
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
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
