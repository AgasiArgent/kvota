'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Edit, Trash2, Plus, Phone, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  customerService,
  Customer,
  CustomerContact,
  ContactCreate,
  DeliveryAddress,
  DeliveryAddressCreate,
} from '@/lib/api/customer-service';
import { contractsService } from '@/lib/api/contracts-service';
import { validateINN, validateKPP, validateOGRN } from '@/lib/validation/russian-business';
import ContractsList from '@/components/customers/ContractsList';

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const customerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [isEditMode, setIsEditMode] = useState(searchParams.get('mode') === 'edit');
  const [companyType, setCompanyType] = useState<string>('organization');
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);

  // Delivery addresses state
  const [deliveryAddresses, setDeliveryAddresses] = useState<DeliveryAddress[]>([]);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<DeliveryAddress | null>(null);
  const [addressFormData, setAddressFormData] = useState<Partial<DeliveryAddressCreate>>({});

  // Contracts count state (for badge)
  const [contractsCount, setContractsCount] = useState(0);

  // Form state
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const [contactFormData, setContactFormData] = useState<Partial<ContactCreate>>({});

  // Loading states for modals
  const [contactSaving, setContactSaving] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCustomer();
    fetchCustomerQuotes();
    fetchContacts();
    fetchDeliveryAddresses();
    fetchContractsCount();
  }, [customerId]);

  const fetchContractsCount = async () => {
    try {
      const response = await contractsService.listContracts(customerId);
      if (response.success && response.data) {
        setContractsCount(Array.isArray(response.data) ? response.data.length : 0);
      }
    } catch (error) {
      console.error('Error fetching contracts count:', error);
    }
  };

  const fetchCustomer = async () => {
    setLoading(true);
    try {
      const response = await customerService.getCustomer(customerId);
      if (response.success && response.data) {
        setCustomer(response.data);
        setCompanyType(response.data.company_type);
        setFormData(response.data);
      } else {
        throw new Error(response.error || 'Failed to load customer');
      }
    } catch (error: any) {
      toast.error(`Ошибка загрузки клиента: ${error.message}`);
      router.push('/customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerQuotes = async () => {
    try {
      const response = await customerService.getCustomerQuotes(customerId, 1, 100);
      if (response.success && response.data) {
        setQuotes(response.data.quotes || []);
      }
    } catch (error: any) {
      console.error('Error fetching quotes:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await customerService.listContacts(customerId);
      if (response.success && response.data) {
        setContacts(response.data.contacts || []);
      }
    } catch (error: any) {
      console.error('Error fetching contacts:', error);
    }
  };

  const fetchDeliveryAddresses = async () => {
    try {
      const response = await customerService.listDeliveryAddresses(customerId);
      if (response.success && response.data) {
        setDeliveryAddresses(response.data.addresses || []);
      }
    } catch (error: any) {
      console.error('Error fetching delivery addresses:', error);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      errors.name = 'Введите название';
    }

    if (formData.inn) {
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

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await customerService.updateCustomer(customerId, formData);
      toast.success('Клиент успешно обновлен');
      setIsEditMode(false);
      fetchCustomer();
    } catch (error: any) {
      toast.error(`Ошибка обновления: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await customerService.deleteCustomer(customerId);
      toast.success('Клиент успешно удален');
      router.push('/customers');
    } catch (error: any) {
      toast.error(`Ошибка удаления: ${error.message}`);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSaving(true);

    try {
      if (editingContact) {
        await customerService.updateContact(
          customerId,
          editingContact.id,
          contactFormData as ContactCreate
        );
        toast.success('Контакт успешно обновлен');
      } else {
        await customerService.createContact(customerId, contactFormData as ContactCreate);
        toast.success('Контакт успешно создан');
      }
      setContactModalVisible(false);
      setEditingContact(null);
      setContactFormData({});
      fetchContacts();
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      setContactSaving(false);
    }
  };

  const handleContactDelete = async (contactId: string) => {
    try {
      await customerService.deleteContact(customerId, contactId);
      toast.success('Контакт успешно удален');
      fetchContacts();
    } catch (error: any) {
      toast.error(`Ошибка удаления: ${error.message}`);
    }
  };

  const openContactModal = (contact?: CustomerContact) => {
    if (contact) {
      setEditingContact(contact);
      setContactFormData(contact);
    } else {
      setEditingContact(null);
      setContactFormData({});
    }
    setContactModalVisible(true);
  };

  // Delivery Address handlers
  const openAddressModal = (address?: DeliveryAddress) => {
    if (address) {
      setEditingAddress(address);
      setAddressFormData(address);
    } else {
      setEditingAddress(null);
      setAddressFormData({});
    }
    setAddressModalVisible(true);
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addressFormData.address?.trim()) {
      toast.error('Адрес обязателен');
      return;
    }

    setAddressSaving(true);
    try {
      if (editingAddress) {
        await customerService.updateDeliveryAddress(
          customerId,
          editingAddress.id,
          addressFormData as DeliveryAddressCreate
        );
        toast.success('Адрес успешно обновлен');
      } else {
        await customerService.createDeliveryAddress(
          customerId,
          addressFormData as DeliveryAddressCreate
        );
        toast.success('Адрес успешно создан');
      }
      setAddressModalVisible(false);
      setEditingAddress(null);
      setAddressFormData({});
      fetchDeliveryAddresses();
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      setAddressSaving(false);
    }
  };

  const handleAddressDelete = async (addressId: string) => {
    try {
      await customerService.deleteDeliveryAddress(customerId, addressId);
      toast.success('Адрес успешно удален');
      fetchDeliveryAddresses();
    } catch (error: any) {
      toast.error(`Ошибка удаления: ${error.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { dotColor: string; text: string }> = {
      active: { dotColor: 'bg-emerald-400', text: 'Активный' },
      inactive: { dotColor: 'bg-zinc-400', text: 'Неактивный' },
      suspended: { dotColor: 'bg-rose-400', text: 'Приостановлен' },
    };
    const config = statusMap[status] || {
      dotColor: 'bg-zinc-400',
      text: status,
    };
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
        {config.text}
      </Badge>
    );
  };

  const getQuoteStatusBadge = (status: string) => {
    const statusMap: Record<string, { dotColor: string; text: string }> = {
      draft: { dotColor: 'bg-zinc-400', text: 'Черновик' },
      pending_approval: { dotColor: 'bg-amber-400', text: 'На утверждении' },
      approved: { dotColor: 'bg-emerald-400', text: 'Утверждено' },
      sent: { dotColor: 'bg-blue-400', text: 'Отправлено' },
      accepted: { dotColor: 'bg-emerald-400', text: 'Принято' },
      rejected: { dotColor: 'bg-rose-400', text: 'Отклонено' },
    };
    const config = statusMap[status] || { dotColor: 'bg-zinc-400', text: status };
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
        {config.text}
      </Badge>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!customer) return null;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.push('/customers')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
              {getStatusBadge(customer.status)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode && (
              <Button variant="outline" onClick={() => setIsEditMode(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Редактировать
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Это действие нельзя отменить. Все связанные КП останутся, но ссылка на клиента
                    будет удалена.
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
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="space-y-6">
          <TabsList>
            <TabsTrigger value="info">Информация</TabsTrigger>
            <TabsTrigger value="quotes">Коммерческие предложения ({quotes.length})</TabsTrigger>
            <TabsTrigger value="contacts">Контакты ({contacts.length})</TabsTrigger>
            <TabsTrigger value="contracts">Договоры ({contractsCount})</TabsTrigger>
            <TabsTrigger value="delivery">Адреса доставки ({deliveryAddresses.length})</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-6">
            <form onSubmit={handleUpdate}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Main Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Основная информация</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="name">Название *</Label>
                        <Input
                          id="name"
                          value={formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          disabled={!isEditMode}
                          className={validationErrors.name ? 'border-destructive' : ''}
                        />
                        {validationErrors.name && (
                          <p className="text-xs text-destructive mt-1">{validationErrors.name}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="company_type">Тип организации *</Label>
                          <Select
                            value={formData.company_type}
                            onValueChange={(value: string) => {
                              setFormData({ ...formData, company_type: value });
                              setCompanyType(value);
                            }}
                            disabled={!isEditMode}
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
                            disabled={!isEditMode}
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
                            disabled={!isEditMode}
                            className={validationErrors.email ? 'border-destructive' : ''}
                          />
                          {validationErrors.email && (
                            <p className="text-xs text-destructive mt-1">
                              {validationErrors.email}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="phone">Телефон</Label>
                          <Input
                            id="phone"
                            value={formData.phone || ''}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            disabled={!isEditMode}
                          />
                        </div>

                        <div>
                          <Label htmlFor="status">Статус *</Label>
                          <Select
                            value={formData.status}
                            onValueChange={(value: string) =>
                              setFormData({ ...formData, status: value })
                            }
                            disabled={!isEditMode}
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
                          disabled={!isEditMode}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="city">Город</Label>
                          <Input
                            id="city"
                            value={formData.city || ''}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            disabled={!isEditMode}
                          />
                        </div>

                        <div>
                          <Label htmlFor="region">Регион</Label>
                          <Input
                            id="region"
                            value={formData.region || ''}
                            onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                            disabled={!isEditMode}
                          />
                        </div>

                        <div>
                          <Label htmlFor="postal_code">Индекс</Label>
                          <Input
                            id="postal_code"
                            maxLength={6}
                            value={formData.postal_code || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, postal_code: e.target.value })
                            }
                            disabled={!isEditMode}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Business Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Реквизиты</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="inn">ИНН</Label>
                          <Input
                            id="inn"
                            maxLength={12}
                            value={formData.inn || ''}
                            onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                            disabled={!isEditMode}
                            className={validationErrors.inn ? 'border-destructive' : ''}
                          />
                          {validationErrors.inn && (
                            <p className="text-xs text-destructive mt-1">{validationErrors.inn}</p>
                          )}
                        </div>

                        {companyType === 'organization' && (
                          <div>
                            <Label htmlFor="kpp">КПП</Label>
                            <Input
                              id="kpp"
                              maxLength={9}
                              value={formData.kpp || ''}
                              onChange={(e) => setFormData({ ...formData, kpp: e.target.value })}
                              disabled={!isEditMode}
                              className={validationErrors.kpp ? 'border-destructive' : ''}
                            />
                            {validationErrors.kpp && (
                              <p className="text-xs text-destructive mt-1">
                                {validationErrors.kpp}
                              </p>
                            )}
                          </div>
                        )}

                        <div>
                          <Label htmlFor="ogrn">
                            {companyType === 'organization' ? 'ОГРН' : 'ОГРНИП'}
                          </Label>
                          <Input
                            id="ogrn"
                            maxLength={15}
                            value={formData.ogrn || ''}
                            onChange={(e) => setFormData({ ...formData, ogrn: e.target.value })}
                            disabled={!isEditMode}
                            className={validationErrors.ogrn ? 'border-destructive' : ''}
                          />
                          {validationErrors.ogrn && (
                            <p className="text-xs text-destructive mt-1">{validationErrors.ogrn}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
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
                          disabled={!isEditMode}
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
                          disabled={!isEditMode}
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
                        disabled={!isEditMode}
                      />
                    </CardContent>
                  </Card>

                  {/* Save/Cancel */}
                  {isEditMode && (
                    <Card>
                      <CardContent className="pt-6 space-y-3">
                        <Button type="submit" className="w-full" disabled={saving}>
                          <Save className="mr-2 h-4 w-4" />
                          {saving ? 'Сохранение...' : 'Сохранить изменения'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            setIsEditMode(false);
                            setFormData(customer);
                            setValidationErrors({});
                          }}
                        >
                          Отмена
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </form>
          </TabsContent>

          {/* Quotes Tab */}
          <TabsContent value="quotes">
            <Card>
              <CardContent className="pt-6">
                {quotes.length === 0 ? (
                  <div className="py-8 text-center text-foreground/40">
                    Коммерческие предложения не найдены
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-secondary/30 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Номер
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Название
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Сумма
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Статус
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Дата
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {quotes.map((quote) => (
                            <tr
                              key={quote.id}
                              onClick={() => router.push(`/quotes/${quote.id}`)}
                              className="hover:bg-foreground/5 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-3 text-sm text-primary hover:underline">
                                {quote.quote_number}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground/70">
                                {quote.title}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground/70">
                                {new Intl.NumberFormat('ru-RU', {
                                  style: 'currency',
                                  currency: quote.currency || 'RUB',
                                }).format(quote.total_amount)}
                              </td>
                              <td className="px-4 py-3">{getQuoteStatusBadge(quote.status)}</td>
                              <td className="px-4 py-3 text-sm text-foreground/70">
                                {new Date(quote.created_at).toLocaleDateString('ru-RU')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Контакты</CardTitle>
                <Button onClick={() => openContactModal()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить контакт
                </Button>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <div className="py-8 text-center text-foreground/40">Контакты не найдены</div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-secondary/30 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Имя
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Должность
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Телефон
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Примечания
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Действия
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {contacts.map((contact) => (
                            <tr
                              key={contact.id}
                              className="hover:bg-foreground/5 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-foreground/90">
                                    {/* Russian name order: Фамилия Имя Отчество */}
                                    {contact.last_name && `${contact.last_name} `}
                                    {contact.name}
                                    {contact.patronymic && ` ${contact.patronymic}`}
                                  </span>
                                  {contact.is_primary && (
                                    <Badge variant="secondary" className="text-xs">
                                      Основной
                                    </Badge>
                                  )}
                                  {contact.is_signatory && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-primary text-primary"
                                    >
                                      Подписант
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground/70">
                                {contact.position || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground/70">
                                {contact.phone || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground/70">
                                {contact.email || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground/70 max-w-xs truncate">
                                {contact.notes || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openContactModal(contact)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Это действие нельзя отменить.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleContactDelete(contact.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Удалить
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts">
            <ContractsList customerId={customerId} onContractsChange={fetchContractsCount} />
          </TabsContent>

          {/* Delivery Addresses Tab */}
          <TabsContent value="delivery">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Адреса доставки</CardTitle>
                <Button onClick={() => openAddressModal()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить адрес
                </Button>
              </CardHeader>
              <CardContent>
                {deliveryAddresses.length === 0 ? (
                  <div className="py-8 text-center text-foreground/40">
                    Адреса доставки не найдены
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-secondary/30 border-b border-border">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Название
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Адрес
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Примечания
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                              Действия
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {deliveryAddresses.map((address) => (
                            <tr
                              key={address.id}
                              className="hover:bg-foreground/5 transition-colors"
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-foreground/90">
                                    {address.name || 'Без названия'}
                                  </span>
                                  {address.is_default && (
                                    <Badge variant="secondary" className="text-xs">
                                      По умолчанию
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground/70 max-w-md">
                                {address.address}
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground/70 max-w-xs truncate">
                                {address.notes || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openAddressModal(address)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm">
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Удалить адрес?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Это действие нельзя отменить.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleAddressDelete(address.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Удалить
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Contact Modal */}
        <Dialog open={contactModalVisible} onOpenChange={setContactModalVisible}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingContact ? 'Редактировать контакт' : 'Добавить контакт'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              {/* Russian name order: Фамилия Имя Отчество */}
              <div>
                <Label htmlFor="contact_last_name">Фамилия</Label>
                <Input
                  id="contact_last_name"
                  value={contactFormData.last_name || ''}
                  onChange={(e) =>
                    setContactFormData({ ...contactFormData, last_name: e.target.value })
                  }
                  placeholder="Ермаков"
                />
              </div>

              <div>
                <Label htmlFor="contact_name">Имя *</Label>
                <Input
                  id="contact_name"
                  value={contactFormData.name || ''}
                  onChange={(e) => setContactFormData({ ...contactFormData, name: e.target.value })}
                  required
                  placeholder="Иван"
                />
              </div>

              <div>
                <Label htmlFor="contact_patronymic">Отчество</Label>
                <Input
                  id="contact_patronymic"
                  value={contactFormData.patronymic || ''}
                  onChange={(e) =>
                    setContactFormData({ ...contactFormData, patronymic: e.target.value })
                  }
                  placeholder="Иванович"
                />
              </div>

              <div>
                <Label htmlFor="contact_position">
                  Должность{' '}
                  {contactFormData.is_signatory && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="contact_position"
                  value={contactFormData.position || ''}
                  onChange={(e) =>
                    setContactFormData({ ...contactFormData, position: e.target.value })
                  }
                  placeholder="Генеральный директор"
                  required={contactFormData.is_signatory}
                />
                {contactFormData.is_signatory && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Должность обязательна для подписанта
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="contact_phone">Телефон</Label>
                <Input
                  id="contact_phone"
                  value={contactFormData.phone || ''}
                  onChange={(e) =>
                    setContactFormData({ ...contactFormData, phone: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={contactFormData.email || ''}
                  onChange={(e) =>
                    setContactFormData({ ...contactFormData, email: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="contact_is_primary"
                  checked={contactFormData.is_primary || false}
                  onCheckedChange={(checked: boolean) =>
                    setContactFormData({ ...contactFormData, is_primary: checked })
                  }
                />
                <Label htmlFor="contact_is_primary" className="cursor-pointer">
                  Основной контакт
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="contact_is_signatory"
                  checked={contactFormData.is_signatory || false}
                  onCheckedChange={(checked: boolean) =>
                    setContactFormData({ ...contactFormData, is_signatory: checked })
                  }
                />
                <Label htmlFor="contact_is_signatory" className="cursor-pointer">
                  Подписант (право подписи документов)
                </Label>
              </div>

              <div>
                <Label htmlFor="contact_notes">Примечания</Label>
                <Textarea
                  id="contact_notes"
                  rows={3}
                  value={contactFormData.notes || ''}
                  onChange={(e) =>
                    setContactFormData({ ...contactFormData, notes: e.target.value })
                  }
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setContactModalVisible(false);
                    setEditingContact(null);
                    setContactFormData({});
                  }}
                  disabled={contactSaving}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={contactSaving}>
                  {contactSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingContact ? 'Сохранить' : 'Добавить'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delivery Address Modal */}
        <Dialog open={addressModalVisible} onOpenChange={setAddressModalVisible}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? 'Редактировать адрес' : 'Добавить адрес доставки'}
              </DialogTitle>
              <DialogDescription>Укажите адрес доставки для клиента</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddressSubmit} className="space-y-4">
              <div>
                <Label htmlFor="address_name">Название</Label>
                <Input
                  id="address_name"
                  value={addressFormData.name || ''}
                  onChange={(e) => setAddressFormData({ ...addressFormData, name: e.target.value })}
                  placeholder="Например: Основной склад, Московский офис"
                />
              </div>

              <div>
                <Label htmlFor="address_address">Адрес *</Label>
                <Textarea
                  id="address_address"
                  rows={3}
                  value={addressFormData.address || ''}
                  onChange={(e) =>
                    setAddressFormData({ ...addressFormData, address: e.target.value })
                  }
                  placeholder="Полный адрес доставки"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="address_is_default"
                  checked={addressFormData.is_default || false}
                  onCheckedChange={(checked: boolean) =>
                    setAddressFormData({ ...addressFormData, is_default: checked })
                  }
                />
                <Label htmlFor="address_is_default" className="cursor-pointer">
                  Адрес по умолчанию
                </Label>
              </div>

              <div>
                <Label htmlFor="address_notes">Примечания</Label>
                <Textarea
                  id="address_notes"
                  rows={2}
                  value={addressFormData.notes || ''}
                  onChange={(e) =>
                    setAddressFormData({ ...addressFormData, notes: e.target.value })
                  }
                  placeholder="Дополнительные инструкции по доставке"
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddressModalVisible(false);
                    setEditingAddress(null);
                    setAddressFormData({});
                  }}
                  disabled={addressSaving}
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={addressSaving}>
                  {addressSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAddress ? 'Сохранить' : 'Добавить'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
