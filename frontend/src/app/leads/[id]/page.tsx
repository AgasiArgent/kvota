'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, CheckCircle, User, Phone, Mail, Plus, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

import { getLead, qualifyLead, type LeadWithDetails } from '@/lib/api/lead-service';
import {
  listActivities,
  createActivity,
  completeActivity,
  type ActivityWithDetails,
  type ActivityCreate,
} from '@/lib/api/activity-service';
import {
  listLeadContacts,
  createLeadContact,
  type LeadContact,
  type LeadContactCreate,
} from '@/lib/api/lead-contact-service';
import { cn } from '@/lib/utils';

export default function LeadDetailPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<LeadWithDetails | null>(null);
  const [activities, setActivities] = useState<ActivityWithDetails[]>([]);
  const [activeTab, setActiveTab] = useState('details');

  // Modals
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  // Contact form state
  const [contactForm, setContactForm] = useState({
    full_name: '',
    position: '',
    phone: '',
    email: '',
  });

  // Activity form state
  const [activityForm, setActivityForm] = useState({
    type: 'meeting',
    title: '',
    notes: '',
    duration_minutes: 15,
  });

  useEffect(() => {
    if (leadId) {
      fetchLead();
      fetchActivities();
    }
  }, [leadId]);

  const fetchLead = async () => {
    setLoading(true);
    try {
      const data = await getLead(leadId);
      setLead(data);
    } catch (error: any) {
      toast.error(`Ошибка загрузки лида: ${error.message}`);
      router.push('/leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await listActivities({ lead_id: leadId, limit: 100 });
      setActivities(response.data || []);
    } catch (error: any) {
      toast.error(`Ошибка загрузки активностей: ${error.message}`);
    }
  };

  const handleQualify = async () => {
    if (!lead) return;
    try {
      const response = await qualifyLead(leadId);
      toast.success(`Лид квалифицирован. Создан клиент "${response.customer_name}"`);
      router.push(`/customers/${response.customer_id}`);
    } catch (error: any) {
      toast.error(`Ошибка квалификации: ${error.message}`);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLeadContact(leadId, contactForm);
      toast.success('Контакт добавлен');
      setContactForm({ full_name: '', position: '', phone: '', email: '' });
      setContactModalOpen(false);
      fetchLead(); // Refresh to get updated contacts
    } catch (error: any) {
      toast.error(`Ошибка добавления контакта: ${error.message}`);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const activityData: ActivityCreate = {
        lead_id: leadId,
        type: activityForm.type,
        title: activityForm.title,
        notes: activityForm.notes,
        duration_minutes: activityForm.duration_minutes || 15,
      };
      await createActivity(activityData);
      toast.success('Активность добавлена');
      setActivityForm({ type: 'meeting', title: '', notes: '', duration_minutes: 15 });
      setActivityModalOpen(false);
      fetchActivities(); // Refresh
    } catch (error: any) {
      toast.error(`Ошибка добавления активности: ${error.message}`);
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    try {
      await completeActivity(activityId);
      toast.success('Активность завершена');
      fetchActivities(); // Refresh
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
    }
  };

  if (loading || !lead) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </MainLayout>
    );
  }

  const isQualified = lead.stage_name === 'Квалифицирован';
  const isFailed = lead.stage_name === 'Отказ';

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/leads')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{lead.company_name}</h1>
                  <LeadStageBadge stage={lead.stage_name} color={lead.stage_color} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/leads/${leadId}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Редактировать
              </Button>
              {!isQualified && !isFailed && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Квалифицировать
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Квалифицировать лид?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Создать клиента из лида "{lead.company_name}"?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Нет</AlertDialogCancel>
                      <AlertDialogAction onClick={handleQualify}>Да</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="details">Детали</TabsTrigger>
            <TabsTrigger value="activities">
              Активности ({activities.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* Company Info */}
            <Card>
              <CardHeader>
                <CardTitle>Информация о компании</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Название</Label>
                    <div className="text-sm">{lead.company_name}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>ИНН</Label>
                    <div className="text-sm">{lead.inn || '—'}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <div className="text-sm">
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-primary hover:underline">
                          <Mail className="h-4 w-4" />
                          {lead.email}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Телефон</Label>
                    <div className="text-sm">
                      {lead.primary_phone ? (
                        <a href={`tel:${lead.primary_phone}`} className="flex items-center gap-2 text-primary hover:underline">
                          <Phone className="h-4 w-4" />
                          {lead.primary_phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Сегмент</Label>
                    <div className="text-sm">{lead.segment || '—'}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Этап</Label>
                    <div className="text-sm">
                      <LeadStageBadge stage={lead.stage_name} color={lead.stage_color} />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Ответственный</Label>
                    <div className="text-sm">
                      {lead.assigned_to_name || (
                        <Badge variant="outline" className="bg-amber-400/15 text-amber-400 border-amber-400/30">
                          Не назначен
                        </Badge>
                      )}
                    </div>
                  </div>
                  {lead.notes && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Заметки</Label>
                      <div className="text-sm text-muted-foreground">{lead.notes}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contacts (ЛПР) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Контактные лица (ЛПР)</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setContactModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить контакт
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {lead.contacts && lead.contacts.length > 0 ? (
                  <div className="space-y-4">
                    {lead.contacts.map((contact, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border bg-card">
                        <Avatar>
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{contact.full_name}</div>
                            {contact.is_primary && (
                              <Badge variant="secondary" className="text-xs">
                                Основной
                              </Badge>
                            )}
                          </div>
                          {contact.position && (
                            <div className="text-sm text-muted-foreground">{contact.position}</div>
                          )}
                          <div className="flex flex-col gap-1">
                            {contact.phone && (
                              <a
                                href={`tel:${contact.phone}`}
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <Phone className="h-3 w-3" />
                                {contact.phone}
                              </a>
                            )}
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}`}
                                className="flex items-center gap-2 text-sm text-primary hover:underline"
                              >
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Нет контактов
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Активности</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setActivityModalOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Добавить активность
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-6">
                    {activities.map((activity, idx) => (
                      <div key={activity.id} className="flex gap-4">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'h-3 w-3 rounded-full border-2',
                              activity.completed
                                ? 'bg-emerald-400 border-emerald-400'
                                : 'bg-zinc-400 border-zinc-400'
                            )}
                          />
                          {idx < activities.length - 1 && (
                            <div className="w-px h-full min-h-[40px] bg-border" />
                          )}
                        </div>

                        {/* Activity content */}
                        <div className="flex-1 pb-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline">
                                {getActivityTypeLabel(activity.type)}
                              </Badge>
                              {activity.completed && (
                                <Badge variant="outline" className="bg-emerald-400/15 text-emerald-400 border-emerald-400/30">
                                  Завершено
                                </Badge>
                              )}
                            </div>
                            <div className="font-medium">
                              {activity.title || getActivityTypeLabel(activity.type)}
                            </div>
                            {activity.scheduled_at && (
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(activity.scheduled_at).toLocaleString('ru-RU')}
                                </div>
                                {activity.duration_minutes && (
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    {activity.duration_minutes} мин
                                  </div>
                                )}
                              </div>
                            )}
                            {activity.notes && (
                              <div className="text-sm text-muted-foreground">{activity.notes}</div>
                            )}
                            {activity.result && (
                              <div className="text-sm text-muted-foreground">
                                Результат: {activity.result}
                              </div>
                            )}
                            {activity.assigned_to_name && (
                              <div className="text-xs text-muted-foreground">
                                Ответственный: {activity.assigned_to_name}
                              </div>
                            )}
                            {!activity.completed && (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto"
                                onClick={() => handleCompleteActivity(activity.id)}
                              >
                                Завершить
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Нет активностей
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Contact Modal */}
        <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить контакт</DialogTitle>
              <DialogDescription>
                Добавление нового контактного лица для лида
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddContact}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Ф.И.О. *</Label>
                  <Input
                    id="full_name"
                    value={contactForm.full_name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, full_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Должность</Label>
                  <Input
                    id="position"
                    value={contactForm.position}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, position: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContactModalOpen(false)}
                >
                  Отмена
                </Button>
                <Button type="submit">Добавить</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Activity Modal */}
        <Dialog open={activityModalOpen} onOpenChange={setActivityModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Добавить активность</DialogTitle>
              <DialogDescription>
                Создание новой активности для лида
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddActivity}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Тип *</Label>
                  <Select
                    value={activityForm.type}
                    onValueChange={(value) =>
                      setActivityForm({ ...activityForm, type: value })
                    }
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Звонок</SelectItem>
                      <SelectItem value="meeting">Встреча</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="task">Задача</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Название</Label>
                  <Input
                    id="title"
                    value={activityForm.title}
                    onChange={(e) =>
                      setActivityForm({ ...activityForm, title: e.target.value })
                    }
                    placeholder="Например: Обсуждение коммерческого предложения"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Заметки</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    value={activityForm.notes}
                    onChange={(e) =>
                      setActivityForm({ ...activityForm, notes: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Длительность (минуты)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={activityForm.duration_minutes}
                    onChange={(e) =>
                      setActivityForm({
                        ...activityForm,
                        duration_minutes: parseInt(e.target.value) || 15,
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActivityModalOpen(false)}
                >
                  Отмена
                </Button>
                <Button type="submit">Добавить</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

function LeadStageBadge({ stage, color }: { stage: string; color?: string }) {
  // Map Ant Design colors to Tailwind colors
  const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
    green: {
      bg: 'bg-emerald-400/15',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
    },
    blue: {
      bg: 'bg-blue-400/15',
      text: 'text-blue-400',
      dot: 'bg-blue-400',
    },
    orange: {
      bg: 'bg-amber-400/15',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
    },
    red: {
      bg: 'bg-red-400/15',
      text: 'text-red-400',
      dot: 'bg-red-400',
    },
    default: {
      bg: 'bg-zinc-400/15',
      text: 'text-zinc-400',
      dot: 'bg-zinc-400',
    },
  };

  const colors = colorMap[color || 'default'] || colorMap.default;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        colors.bg,
        colors.text
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
      {stage}
    </span>
  );
}

function getActivityTypeLabel(type: string): string {
  const labels = {
    call: 'Звонок',
    meeting: 'Встреча',
    email: 'Email',
    task: 'Задача',
  };
  return labels[type as keyof typeof labels] || type;
}
