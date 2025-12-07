'use client';

import { useState, useEffect } from 'react';
import { config } from '@/lib/config';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, Pencil, Trash2, ArrowLeft, Loader2, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  is_primary: boolean;
  notes?: string;
}

interface FormData {
  name: string;
  phone: string;
  email: string;
  position: string;
  is_primary: boolean;
  notes: string;
}

const initialFormData: FormData = {
  name: '',
  phone: '',
  email: '',
  position: '',
  is_primary: false,
  notes: '',
};

export default function CustomerContactsPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/customers/${customerId}/contacts`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки контактов');
      }

      const data = await response.json();
      setContacts(data.contacts);
    } catch (error) {
      toast.error('Не удалось загрузить контакты');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [customerId]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Введите имя контакта');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Не авторизован');
        return;
      }

      const url = editingContact
        ? `${config.apiUrl}/api/customers/${customerId}/contacts/${editingContact.id}`
        : `${config.apiUrl}/api/customers/${customerId}/contacts`;

      const method = editingContact ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения');
      }

      toast.success(editingContact ? 'Контакт обновлен' : 'Контакт создан');
      setModalOpen(false);
      setFormData(initialFormData);
      setEditingContact(null);
      fetchContacts();
    } catch (error) {
      toast.error('Ошибка сохранения');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contactToDelete) return;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Не авторизован');
        return;
      }

      const response = await fetch(
        `${config.apiUrl}/api/customers/${customerId}/contacts/${contactToDelete}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Ошибка удаления');
      }

      toast.success('Контакт удален');
      fetchContacts();
    } catch (error) {
      toast.error('Ошибка удаления');
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    }
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      position: contact.position || '',
      is_primary: contact.is_primary,
      notes: contact.notes || '',
    });
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingContact(null);
    setFormData(initialFormData);
    setModalOpen(true);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
            </div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Контакты клиента</h2>
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить контакт
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Нет контактов</p>
                <Button onClick={openCreateModal} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить первый контакт
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Имя</th>
                      <th className="text-left py-3 px-4 font-medium">Телефон</th>
                      <th className="text-left py-3 px-4 font-medium">Email</th>
                      <th className="text-left py-3 px-4 font-medium">Должность</th>
                      <th className="text-left py-3 px-4 font-medium">Основной</th>
                      <th className="text-left py-3 px-4 font-medium">Примечания</th>
                      <th className="text-center py-3 px-4 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact) => (
                      <tr key={contact.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">{contact.name}</td>
                        <td className="py-3 px-4">{contact.phone || '—'}</td>
                        <td className="py-3 px-4">{contact.email || '—'}</td>
                        <td className="py-3 px-4">{contact.position || '—'}</td>
                        <td className="py-3 px-4">{contact.is_primary ? '✓' : ''}</td>
                        <td className="py-3 px-4 max-w-[200px] truncate">{contact.notes || '—'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(contact)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setContactToDelete(contact.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Редактировать контакт' : 'Новый контакт'}</DialogTitle>
            <DialogDescription>
              {editingContact
                ? 'Измените информацию о контакте'
                : 'Заполните информацию о новом контакте'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Имя *</Label>
              <Input
                id="name"
                placeholder="Иван Иванов"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                placeholder="+7 (999) 123-45-67"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ivan@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Должность</Label>
              <Input
                id="position"
                placeholder="Менеджер по закупкам"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked: boolean) =>
                  setFormData({ ...formData, is_primary: checked as boolean })
                }
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                Основной контакт
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Примечания</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Дополнительная информация"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setFormData(initialFormData);
                setEditingContact(null);
              }}
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить контакт?</AlertDialogTitle>
            <AlertDialogDescription>Это действие нельзя отменить</AlertDialogDescription>
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
