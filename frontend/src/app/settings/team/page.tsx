'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key, Copy, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  fetchTeamMembers,
  fetchRoles,
  addMember,
  updateMemberRole,
  removeMember,
  resetMemberPassword,
  TeamMember,
  Role,
  AddMemberResponse,
  getRoleDisplayName,
  canModifyMember,
} from '@/lib/api/team-service';
import { useAuth } from '@/lib/auth/AuthProvider';

dayjs.locale('ru');

export default function TeamManagementPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');

  // Add member modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addFormData, setAddFormData] = useState({
    email: '',
    full_name: '',
    role_id: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  // Password display modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordInfo, setPasswordInfo] = useState<{
    email: string;
    password: string;
    fullName: string;
    isReset: boolean;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && user && profile?.organization_id) {
      setCurrentUserId(user.id);
      setOrganizationId(profile.organization_id);
      loadData(profile.organization_id, user.id);
    } else if (!authLoading && user && !profile?.organization_id) {
      toast.error('Организация не найдена. Пожалуйста, обратитесь к администратору.');
    }
  }, [authLoading, user, profile?.organization_id]);

  const loadData = async (orgId: string, userId?: string) => {
    setLoading(true);
    try {
      const [membersData, rolesData] = await Promise.all([
        fetchTeamMembers(orgId),
        fetchRoles(orgId),
      ]);

      setMembers(membersData);
      setRoles(rolesData);

      const userIdToFind = userId || currentUserId;
      const currentMember = membersData.find((m) => m.user_id === userIdToFind);
      if (currentMember) {
        setCurrentUserRole(currentMember.role_slug);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addFormData.email || !addFormData.full_name || !addFormData.role_id) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    setAddLoading(true);
    try {
      const result: AddMemberResponse = await addMember(organizationId, {
        email: addFormData.email,
        full_name: addFormData.full_name,
        role_id: addFormData.role_id,
      });

      toast.success(result.message);
      setAddModalVisible(false);
      setAddFormData({ email: '', full_name: '', role_id: '' });

      if (result.is_new_user && result.generated_password) {
        setPasswordInfo({
          email: result.user_email,
          password: result.generated_password,
          fullName: result.user_full_name,
          isReset: false,
        });
        setPasswordModalVisible(true);
      }

      loadData(organizationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка добавления участника');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      await updateMemberRole(organizationId, userId, roleId);
      toast.success('Роль изменена');
      loadData(organizationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка изменения роли');
    }
  };

  const handleRemove = async (memberId: string, userName: string) => {
    try {
      await removeMember(organizationId, memberId);
      toast.success(`${userName} удален из команды`);
      loadData(organizationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления');
    }
  };

  const handleResetPassword = async (memberId: string, userEmail: string) => {
    try {
      const result = await resetMemberPassword(organizationId, memberId);
      setPasswordInfo({
        email: result.user_email,
        password: result.new_password,
        fullName: userEmail,
        isReset: true,
      });
      setPasswordModalVisible(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сброса пароля');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано в буфер обмена');
  };

  const canManageTeam = ['owner', 'admin', 'manager'].includes(currentUserRole);
  const isOwnerOrAdmin = ['owner', 'admin'].includes(currentUserRole);
  const assignableRoles = roles.filter((role) => role.slug !== 'owner');

  const getRoleBadge = (roleSlug: string, roleName: string, isOwner: boolean) => {
    const dotColorMap: Record<string, string> = {
      owner: 'bg-amber-400',
      admin: 'bg-purple-400',
      manager: 'bg-blue-400',
      member: 'bg-zinc-400',
    };
    const dotColor = dotColorMap[roleSlug] || 'bg-zinc-400';
    const displayName = getRoleDisplayName(roleSlug, roleName);

    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
        {displayName}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { dotColor: string; text: string }> = {
      active: { dotColor: 'bg-emerald-400', text: 'Активен' },
      left: { dotColor: 'bg-zinc-600', text: 'Покинул' },
    };
    const config = statusMap[status] || { dotColor: 'bg-zinc-600', text: status };
    return (
      <Badge variant="secondary" className="gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
        {config.text}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Команда</h1>
        </div>
        {canManageTeam && (
          <Button onClick={() => setAddModalVisible(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Добавить участника
          </Button>
        )}
      </div>

      {/* Info Alert for non-admins */}
      {!canManageTeam && (
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-200">
              Только администраторы могут управлять командой. Обратитесь к администратору
              организации для изменения ролей или добавления новых участников.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Members Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Участник
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Роль
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Дата присоединения
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                      Статус
                    </th>
                    {canManageTeam && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-foreground/60">
                        Действия
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => {
                    const canModify = canModifyMember(currentUserId, member, currentUserRole);

                    return (
                      <tr key={member.id} className="hover:bg-foreground/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-foreground/40" />
                              <span className="text-sm font-medium">
                                {member.user_full_name || 'Без имени'}
                              </span>
                              {member.is_owner && (
                                <Badge variant="secondary" className="gap-1.5 text-xs">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                  Владелец
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-foreground/60">
                              <Mail className="h-3 w-3" />
                              {member.user_email}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {!canManageTeam || !canModify ? (
                            getRoleBadge(member.role_slug, member.role_name, member.is_owner)
                          ) : (
                            <Select
                              value={member.role_id}
                              onValueChange={(value: string) =>
                                handleRoleChange(member.user_id, value)
                              }
                              disabled={member.is_owner || member.user_id === currentUserId}
                            >
                              <SelectTrigger className="w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {assignableRoles.map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {getRoleDisplayName(role.slug, role.name)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground/70">
                          {dayjs(member.joined_at).format('DD.MM.YYYY')}
                        </td>
                        <td className="px-4 py-3">{getStatusBadge(member.status)}</td>
                        {canManageTeam && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {/* Reset Password Button */}
                              {isOwnerOrAdmin && canModify && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" title="Сбросить пароль">
                                      <Key className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Сбросить пароль?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Сгенерировать новый пароль для {member.user_email}?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleResetPassword(member.id, member.user_email)
                                        }
                                      >
                                        Сбросить
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}

                              {/* Delete Button */}
                              {canModify && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" title="Удалить">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Удалить участника?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Вы уверены, что хотите удалить{' '}
                                        {member.user_full_name || member.user_email} из команды?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() =>
                                          handleRemove(
                                            member.user_id,
                                            member.user_full_name || member.user_email
                                          )
                                        }
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Удалить
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Info */}
          <div className="mt-4 text-sm text-foreground/60">Всего: {members.length} участников</div>
        </CardContent>
      </Card>

      {/* Add Member Modal */}
      <Dialog open={addModalVisible} onOpenChange={setAddModalVisible}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить участника</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <Label htmlFor="full_name">Имя *</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <Input
                  id="full_name"
                  className="pl-10"
                  placeholder="Иван Иванов"
                  value={addFormData.full_name}
                  onChange={(e) => setAddFormData({ ...addFormData, full_name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10"
                  placeholder="user@example.com"
                  value={addFormData.email}
                  onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="role_id">Роль *</Label>
              <Select
                value={addFormData.role_id}
                onValueChange={(value: string) =>
                  setAddFormData({ ...addFormData, role_id: value })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите роль" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        {getRoleBadge(role.slug, role.name, false)}
                        {role.description && (
                          <span className="text-xs text-foreground/60">{role.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="pt-4">
                <p className="text-xs text-blue-200">
                  Если пользователя с таким email нет в системе, он будет создан автоматически. Вы
                  получите пароль для передачи новому участнику.
                </p>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddModalVisible(false);
                  setAddFormData({ email: '', full_name: '', role_id: '' });
                }}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={addLoading}>
                {addLoading ? 'Добавление...' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Display Modal */}
      <Dialog
        open={passwordModalVisible}
        onOpenChange={(open: boolean) => {
          setPasswordModalVisible(open);
          if (!open) setPasswordInfo(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{passwordInfo?.isReset ? 'Новый пароль' : 'Данные для входа'}</DialogTitle>
          </DialogHeader>
          {passwordInfo && (
            <div className="space-y-4">
              <Card className="bg-amber-500/10 border-amber-500/20">
                <CardContent className="pt-4">
                  <p className="text-sm text-amber-200 font-medium">Сохраните эти данные!</p>
                  <p className="text-xs text-amber-200/80 mt-1">
                    Пароль показывается только один раз. Передайте его участнику безопасным
                    способом.
                  </p>
                </CardContent>
              </Card>

              <div>
                <Label className="text-foreground/60">Email:</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={passwordInfo.email} readOnly className="flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(passwordInfo.email)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-foreground/60">Пароль:</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={passwordInfo.password} readOnly className="flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(passwordInfo.password)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  copyToClipboard(`Email: ${passwordInfo.email}\nПароль: ${passwordInfo.password}`)
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                Скопировать всё
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setPasswordModalVisible(false);
                setPasswordInfo(null);
              }}
            >
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
