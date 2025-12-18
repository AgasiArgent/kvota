'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { organizationService } from '@/lib/api/organization-service';
import { OrganizationCreate } from '@/lib/types/organization';

export default function CreateOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<OrganizationCreate>({
    name: '',
    slug: '',
    description: '',
  });

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData({ ...formData, name });

    if (name) {
      const slug = organizationService.generateSlug(name);
      setFormData({ ...formData, name, slug });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'Введите название организации';
    } else if (formData.name.length < 3) {
      errors.name = 'Минимум 3 символа';
    } else if (formData.name.length > 100) {
      errors.name = 'Максимум 100 символов';
    }

    if (!formData.slug?.trim()) {
      errors.slug = 'Введите уникальный идентификатор';
    } else {
      // Check format: lowercase, alphanumeric + hyphens
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(formData.slug)) {
        errors.slug =
          'Идентификатор может содержать только строчные латинские буквы, цифры и дефисы';
      } else if (formData.slug.length < 3) {
        errors.slug = 'Минимум 3 символа';
      } else if (formData.slug.length > 50) {
        errors.slug = 'Максимум 50 символов';
      }
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Максимум 500 символов';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const result = await organizationService.createOrganization(formData);

      if (result.success && result.data) {
        toast.success('Организация успешно создана');
        router.push('/organizations');
      } else {
        toast.error(result.error || 'Ошибка создания организации');
      }
    } catch (error) {
      toast.error(`Ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/organizations')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Создать организацию</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              {/* Organization Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Информация об организации</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Название организации *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={handleNameChange}
                      placeholder='ООО "Название компании"'
                      className={validationErrors.name ? 'border-destructive' : ''}
                    />
                    {validationErrors.name && (
                      <p className="text-xs text-destructive mt-1">{validationErrors.name}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="slug">Уникальный идентификатор *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="moya-kompaniya"
                      className={validationErrors.slug ? 'border-destructive' : ''}
                    />
                    <p className="text-xs text-foreground/60 mt-1">
                      Строчные латинские буквы, цифры и дефисы. Например: moya-kompaniya
                    </p>
                    {validationErrors.slug && (
                      <p className="text-xs text-destructive mt-1">{validationErrors.slug}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description">Описание</Label>
                    <Textarea
                      id="description"
                      rows={4}
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Краткое описание организации (необязательно)"
                      maxLength={500}
                      className={validationErrors.description ? 'border-destructive' : ''}
                    />
                    <p className="text-xs text-foreground/60 mt-1">
                      {formData.description?.length || 0}/500 символов
                    </p>
                    {validationErrors.description && (
                      <p className="text-xs text-destructive mt-1">
                        {validationErrors.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Button type="submit" className="w-full" disabled={loading}>
                    <Save className="mr-2 h-4 w-4" />
                    {loading ? 'Создание...' : 'Создать организацию'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/organizations')}
                  >
                    Отмена
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - 1/3 width */}
            <div className="space-y-6">
              {/* Help Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Справка</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="font-medium text-sm">Название организации</p>
                    <p className="text-sm text-foreground/60">
                      Полное название вашей организации или компании
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-sm">Уникальный идентификатор</p>
                    <p className="text-sm text-foreground/60">
                      Используется для создания уникального URL организации. Автоматически
                      генерируется из названия.
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-sm">Описание</p>
                    <p className="text-sm text-foreground/60">
                      Необязательное поле. Краткое описание вашей организации.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* What's Next Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Что дальше?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-3">После создания организации вы сможете:</p>
                  <ul className="space-y-2 text-sm text-foreground/60">
                    <li>• Пригласить участников команды</li>
                    <li>• Настроить роли и права доступа</li>
                    <li>• Управлять настройками организации</li>
                    <li>• Создавать коммерческие предложения</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
