'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { createLead, type LeadCreate } from '@/lib/api/lead-service';
import { listLeadStages, type LeadStage } from '@/lib/api/lead-stage-service';

interface Contact {
  full_name: string;
  position: string;
  phone: string;
  email: string;
  is_primary: boolean;
}

interface FormData {
  company_name: string;
  inn: string;
  email: string;
  primary_phone: string;
  phones_input: string;
  segment: string;
  notes: string;
  stage_id: string;
}

interface FormErrors {
  company_name?: string;
  email?: string;
}

export default function CreateLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [formData, setFormData] = useState<FormData>({
    company_name: '',
    inn: '',
    email: '',
    primary_phone: '',
    phones_input: '',
    segment: '',
    notes: '',
    stage_id: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [contacts, setContacts] = useState<Contact[]>([
    { full_name: '', position: '', phone: '', email: '', is_primary: true },
  ]);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      const stagesData = await listLeadStages();
      setStages(stagesData);
      // Set default stage to "Новый"
      const defaultStage = stagesData.find((s) => s.name === 'Новый');
      if (defaultStage) {
        setFormData((prev) => ({ ...prev, stage_id: defaultStage.id }));
      }
    } catch (error: any) {
      toast.error(`Ошибка загрузки этапов: ${error.message}`);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Введите название компании';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Введите корректный email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Parse phones array from comma-separated string
      const phones = formData.phones_input
        ? formData.phones_input
            .split(',')
            .map((p: string) => p.trim())
            .filter(Boolean)
        : [];

      const leadData: LeadCreate = {
        company_name: formData.company_name,
        inn: formData.inn || undefined,
        email: formData.email || undefined,
        phones: phones.length > 0 ? phones : undefined,
        primary_phone: formData.primary_phone || undefined,
        segment: formData.segment || undefined,
        notes: formData.notes || undefined,
        stage_id: formData.stage_id,
        contacts: contacts
          .filter((c) => c.full_name.trim()) // Only include contacts with names
          .map((c) => ({
            full_name: c.full_name,
            position: c.position || undefined,
            phone: c.phone || undefined,
            email: c.email || undefined,
            is_primary: c.is_primary,
          })),
      };

      const lead = await createLead(leadData);
      toast.success(`Лид "${lead.company_name}" успешно создан`);
      router.push(`/leads/${lead.id}`);
    } catch (error: any) {
      toast.error(`Ошибка создания лида: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addContact = () => {
    setContacts([
      ...contacts,
      { full_name: '', position: '', phone: '', email: '', is_primary: false },
    ]);
  };

  const removeContact = (index: number) => {
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const updateContact = (index: number, field: keyof Contact, value: string | boolean) => {
    const newContacts = [...contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setContacts(newContacts);
  };

  return (
    <MainLayout>
      <div className="container mx-auto max-w-5xl py-6 space-y-6">
        <PageHeader
          title="Создать лид"
          actions={
            <Button variant="outline" onClick={() => router.push('/leads')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
          }
        />

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Информация о компании</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">
                    Название компании <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company_name"
                    placeholder="ООО Компания"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                  {errors.company_name && (
                    <p className="text-sm text-destructive">{errors.company_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inn">ИНН</Label>
                  <Input
                    id="inn"
                    placeholder="1234567890"
                    maxLength={12}
                    value={formData.inn}
                    onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="info@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primary_phone">Основной телефон</Label>
                  <Input
                    id="primary_phone"
                    placeholder="89991234567"
                    value={formData.primary_phone}
                    onChange={(e) => setFormData({ ...formData, primary_phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="phones_input">Дополнительные телефоны</Label>
                  <Input
                    id="phones_input"
                    placeholder="89991234567, 88123456789"
                    value={formData.phones_input}
                    onChange={(e) => setFormData({ ...formData, phones_input: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">Введите через запятую</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="segment">Сегмент</Label>
                  <Input
                    id="segment"
                    placeholder="Производство, IT, Торговля"
                    value={formData.segment}
                    onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stage_id">Этап</Label>
                  <Select
                    value={formData.stage_id}
                    onValueChange={(value: string) => setFormData({ ...formData, stage_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите этап" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <Badge style={{ backgroundColor: stage.color }} className="text-white">
                              {stage.name}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">Заметки</Label>
                  <Textarea
                    id="notes"
                    placeholder="Дополнительная информация о лиде"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Контактные лица (ЛПР)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contacts.map((contact, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Контакт {index + 1}</CardTitle>
                      {contacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeContact(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`contact_name_${index}`}>Ф.И.О.</Label>
                        <Input
                          id={`contact_name_${index}`}
                          placeholder="Иван Иванов (необязательно)"
                          value={contact.full_name}
                          onChange={(e) => updateContact(index, 'full_name', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`contact_position_${index}`}>Должность</Label>
                        <Input
                          id={`contact_position_${index}`}
                          placeholder="Директор"
                          value={contact.position}
                          onChange={(e) => updateContact(index, 'position', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`contact_phone_${index}`}>Телефон</Label>
                        <Input
                          id={`contact_phone_${index}`}
                          placeholder="89991234567"
                          value={contact.phone}
                          onChange={(e) => updateContact(index, 'phone', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`contact_email_${index}`}>Email</Label>
                        <Input
                          id={`contact_email_${index}`}
                          placeholder="ivanov@company.com"
                          value={contact.email}
                          onChange={(e) => updateContact(index, 'email', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button type="button" variant="outline" onClick={addContact} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Добавить контакт
              </Button>
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.push('/leads')}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Создание...' : 'Создать лид'}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
