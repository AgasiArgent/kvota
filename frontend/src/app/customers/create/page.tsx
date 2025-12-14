'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { customerService } from '@/lib/api/customer-service';
import { organizationService } from '@/lib/api/organization-service';
import { validateINN, validateKPP, validateOGRN } from '@/lib/validation/russian-business';
import { createClient } from '@/lib/supabase/client';

// DaData company info response type
interface DaDataCompanyInfo {
  name: string;
  full_name?: string;
  inn: string;
  kpp?: string;
  ogrn?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  region?: string;
  director_name?: string;
  director_position?: string;
  company_type: string;
  opf?: string;
  status: string;
  okved?: string;
}

interface CustomerFormData {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  inn?: string;
  kpp?: string;
  ogrn?: string;
  company_type: string;
  industry?: string;
  credit_limit?: number;
  payment_terms?: number;
  status: string;
  notes?: string;
}

export default function CreateCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  // Form state
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    company_type: 'organization',
    status: 'active',
    payment_terms: 30,
    credit_limit: 0,
    country: 'Russia',
  });
  const [companyType, setCompanyType] = useState<string>('organization');

  // DaData auto-fill state
  const [lookupLoading, setLookupLoading] = useState(false);
  const [directorInfo, setDirectorInfo] = useState<{
    name?: string;
    position?: string;
  } | null>(null);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch user's organization on mount
  useEffect(() => {
    const fetchOrganization = async () => {
      setLoadingOrg(true);
      try {
        const result = await organizationService.listOrganizations();

        if (result.success && result.data && result.data.length > 0) {
          // Use the first organization (or active one if available)
          const orgId = result.data[0].organization_id;
          setOrganizationId(orgId);
          console.log('✅ Organization loaded:', orgId);
        } else {
          toast.error(
            'У вас нет доступа к организации. Создайте или присоединитесь к организации.'
          );
          router.push('/organizations');
        }
      } catch (error: any) {
        console.error('Failed to load organization:', error);
        toast.error(`Ошибка загрузки организации: ${error.message}`);
      } finally {
        setLoadingOrg(false);
      }
    };

    fetchOrganization();
  }, [router]);

  // Fetch company info from DaData by INN
  const fetchCompanyByINN = async (inn: string) => {
    // Clean INN and validate length
    const innClean = inn.replace(/\D/g, '');
    if (innClean.length !== 10 && innClean.length !== 12) {
      return; // Invalid INN length, skip lookup
    }

    setLookupLoading(true);
    setDirectorInfo(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.error('No session for DaData lookup');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/dadata/company/${innClean}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 404) {
        toast.info('Компания не найдена в ЕГРЮЛ/ЕГРИП');
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка поиска компании');
      }

      const company: DaDataCompanyInfo = await response.json();

      // Auto-fill form fields
      setFormData((prev) => ({
        ...prev,
        name: company.name || prev.name,
        address: company.address || prev.address,
        city: company.city || prev.city,
        region: company.region || prev.region,
        postal_code: company.postal_code || prev.postal_code,
        kpp: company.kpp || prev.kpp,
        ogrn: company.ogrn || prev.ogrn,
        // Set company type based on DaData response
        company_type:
          company.company_type === 'INDIVIDUAL' ? 'individual_entrepreneur' : prev.company_type,
      }));

      // Update company type state for UI
      if (company.company_type === 'INDIVIDUAL') {
        setCompanyType('individual_entrepreneur');
      }

      // Store director info for display
      if (company.director_name) {
        setDirectorInfo({
          name: company.director_name,
          position: company.director_position,
        });
      }

      toast.success('Реквизиты загружены из ЕГРЮЛ');
    } catch (error: any) {
      console.error('DaData lookup error:', error);
      // Don't show error toast for network issues - user can fill manually
    } finally {
      setLookupLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'Введите название';
    } else if (formData.name.length < 2) {
      errors.name = 'Минимум 2 символа';
    }

    // INN is required for all clients (needed for IDN generation)
    if (!formData.inn?.trim()) {
      errors.inn = 'ИНН обязателен для создания КП';
    } else {
      const innValidation = validateINN(formData.inn);
      if (!innValidation.isValid) {
        errors.inn = innValidation.error || 'Неверный ИНН';
      }
    }

    if (formData.kpp) {
      const kppValidation = validateKPP(formData.kpp);
      if (!kppValidation.isValid) {
        errors.kpp = kppValidation.error || 'Неверный КПП';
      }
    }

    if (formData.ogrn) {
      const ogrnValidation = validateOGRN(formData.ogrn);
      if (!ogrnValidation.isValid) {
        errors.ogrn = ogrnValidation.error || 'Неверный ОГРН';
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Неверный формат email';
    }

    if (formData.postal_code && !/^\d{6}$/.test(formData.postal_code)) {
      errors.postal_code = 'Индекс должен содержать 6 цифр';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!organizationId) {
      console.error('No organization ID');
      toast.error('Организация не выбрана');
      return;
    }

    setLoading(true);

    try {
      const customerData = {
        ...formData,
        organization_id: organizationId,
      };

      console.log('Sending customer data:', customerData);
      const response = await customerService.createCustomer(customerData);
      console.log('Response:', response);

      if (!response.success) {
        console.error('API error:', response.error);
        toast.error(`Ошибка создания клиента: ${response.error}`);
        return;
      }

      toast.success('Клиент успешно создан');
      router.push('/customers');
    } catch (error: any) {
      console.error('Exception caught:', error);
      toast.error(`Ошибка создания клиента: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Создать клиента</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Основная информация</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Название организации *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder='ООО "Название компании"'
                      className={validationErrors.name ? 'border-destructive' : ''}
                    />
                    {validationErrors.name && (
                      <p className="text-xs text-destructive mt-1">{validationErrors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company_type">Организационно-правовая форма *</Label>
                      <Select
                        value={formData.company_type}
                        onValueChange={(value: string) => {
                          setFormData({ ...formData, company_type: value });
                          setCompanyType(value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organization">ООО (Организация)</SelectItem>
                          <SelectItem value="individual_entrepreneur">ИП</SelectItem>
                          <SelectItem value="individual">Физическое лицо</SelectItem>
                          <SelectItem value="government">Государственный орган</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="industry">Отрасль</Label>
                      <Select
                        value={formData.industry}
                        onValueChange={(value: string) =>
                          setFormData({ ...formData, industry: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите отрасль" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manufacturing">Промышленность</SelectItem>
                          <SelectItem value="trade">Торговля</SelectItem>
                          <SelectItem value="it_tech">IT и технологии</SelectItem>
                          <SelectItem value="construction">Строительство</SelectItem>
                          <SelectItem value="transport">Транспорт</SelectItem>
                          <SelectItem value="finance">Финансы</SelectItem>
                          <SelectItem value="other">Другое</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="info@company.ru"
                        className={validationErrors.email ? 'border-destructive' : ''}
                      />
                      {validationErrors.email && (
                        <p className="text-xs text-destructive mt-1">{validationErrors.email}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="phone">Телефон</Label>
                      <Input
                        id="phone"
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+7 (495) 123-45-67"
                      />
                    </div>

                    <div>
                      <Label htmlFor="status">Статус *</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value: string) =>
                          setFormData({ ...formData, status: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Активный</SelectItem>
                          <SelectItem value="inactive">Неактивный</SelectItem>
                          <SelectItem value="suspended">Приостановлен</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              <Card>
                <CardHeader>
                  <CardTitle>Адрес</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="address">Адрес</Label>
                    <Textarea
                      id="address"
                      rows={2}
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="ул. Тверская, д. 1, оф. 101"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">Город</Label>
                      <Input
                        id="city"
                        value={formData.city || ''}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="Москва"
                      />
                    </div>

                    <div>
                      <Label htmlFor="region">Регион</Label>
                      <Select
                        value={formData.region}
                        onValueChange={(value: string) =>
                          setFormData({ ...formData, region: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите регион" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Москва">Москва</SelectItem>
                          <SelectItem value="Санкт-Петербург">Санкт-Петербург</SelectItem>
                          <SelectItem value="Московская область">Московская область</SelectItem>
                          <SelectItem value="Ленинградская область">
                            Ленинградская область
                          </SelectItem>
                          <SelectItem value="Свердловская область">Свердловская область</SelectItem>
                          <SelectItem value="Новосибирская область">
                            Новосибирская область
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="postal_code">Почтовый индекс</Label>
                      <Input
                        id="postal_code"
                        maxLength={6}
                        value={formData.postal_code || ''}
                        onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                        placeholder="123456"
                        className={validationErrors.postal_code ? 'border-destructive' : ''}
                      />
                      {validationErrors.postal_code && (
                        <p className="text-xs text-destructive mt-1">
                          {validationErrors.postal_code}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Реквизиты (ИНН, КПП, ОГРН)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-foreground/60">
                    {companyType === 'organization' && (
                      <>
                        <strong>ИНН организации:</strong> 10 цифр, <strong>КПП:</strong> 9 цифр,{' '}
                        <strong>ОГРН:</strong> 13 цифр
                      </>
                    )}
                    {companyType === 'individual_entrepreneur' && (
                      <>
                        <strong>ИНН ИП:</strong> 12 цифр (не 10!), <strong>ОГРНИП:</strong> 15 цифр
                      </>
                    )}
                    {companyType === 'individual' && (
                      <>
                        <strong>ИНН физ. лица:</strong> 12 цифр (необязательно)
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="inn">ИНН *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="inn"
                          maxLength={12}
                          value={formData.inn || ''}
                          onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                          onBlur={(e) => {
                            const inn = e.target.value.replace(/\D/g, '');
                            if (inn.length === 10 || inn.length === 12) {
                              fetchCompanyByINN(inn);
                            }
                          }}
                          placeholder={
                            companyType === 'organization' ? '7701234567' : '770123456789'
                          }
                          className={validationErrors.inn ? 'border-destructive' : ''}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={lookupLoading || !formData.inn}
                          onClick={() => formData.inn && fetchCompanyByINN(formData.inn)}
                          title="Найти по ИНН"
                        >
                          {lookupLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {validationErrors.inn && (
                        <p className="text-xs text-destructive mt-1">{validationErrors.inn}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Введите ИНН и нажмите поиск для автозаполнения
                      </p>
                    </div>

                    {companyType === 'organization' && (
                      <div>
                        <Label htmlFor="kpp">КПП</Label>
                        <Input
                          id="kpp"
                          maxLength={9}
                          value={formData.kpp || ''}
                          onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                          placeholder="770101001"
                          className={validationErrors.kpp ? 'border-destructive' : ''}
                        />
                        {validationErrors.kpp && (
                          <p className="text-xs text-destructive mt-1">{validationErrors.kpp}</p>
                        )}
                      </div>
                    )}

                    {(companyType === 'organization' ||
                      companyType === 'individual_entrepreneur') && (
                      <div>
                        <Label htmlFor="ogrn">
                          {companyType === 'organization' ? 'ОГРН' : 'ОГРНИП'}
                        </Label>
                        <Input
                          id="ogrn"
                          maxLength={15}
                          value={formData.ogrn || ''}
                          onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
                          placeholder={
                            companyType === 'organization' ? '1234567890123' : '123456789012345'
                          }
                          className={validationErrors.ogrn ? 'border-destructive' : ''}
                        />
                        {validationErrors.ogrn && (
                          <p className="text-xs text-destructive mt-1">{validationErrors.ogrn}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Director info from DaData */}
                  {directorInfo && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                      <p className="text-sm font-medium text-foreground/80">Руководитель</p>
                      <p className="text-sm text-foreground mt-1">{directorInfo.name}</p>
                      {directorInfo.position && (
                        <p className="text-xs text-muted-foreground">{directorInfo.position}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - 1/3 width */}
            <div className="space-y-6">
              {/* Financial Terms */}
              <Card>
                <CardHeader>
                  <CardTitle>Финансовые условия</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="credit_limit">Кредитный лимит (₽)</Label>
                    <Input
                      id="credit_limit"
                      type="number"
                      min={0}
                      value={formData.credit_limit || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          credit_limit: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="payment_terms">Условия оплаты (дней)</Label>
                    <Input
                      id="payment_terms"
                      type="number"
                      min={0}
                      max={365}
                      value={formData.payment_terms || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payment_terms: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Примечания</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    rows={6}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Дополнительная информация о клиенте..."
                  />
                </CardContent>
              </Card>

              {/* Actions */}
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || loadingOrg || !organizationId}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {loading ? 'Создание...' : 'Создать клиента'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/customers')}
                  >
                    Отмена
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
