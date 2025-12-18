'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Settings, Users, Crown, User } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { organizationService } from '@/lib/api/organization-service';
import { UserOrganization } from '@/lib/types/organization';

export default function OrganizationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const result = await organizationService.listOrganizations();

      if (result.success && result.data) {
        setOrganizations(result.data);
      } else {
        toast.error(result.error || 'Ошибка загрузки организаций');
      }
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (roleName: string, isOwner: boolean) => {
    if (isOwner) {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <Crown className="h-3 w-3 text-amber-400" />
          Владелец
        </Badge>
      );
    }

    // Map role names to Russian labels
    const roleMap: Record<string, string> = {
      admin: 'Администратор',
      'financial-admin': 'Финансовый администратор',
      'sales-manager': 'Менеджер по продажам',
      'procurement-manager': 'Менеджер по закупкам',
      'logistics-manager': 'Менеджер по логистике',
    };

    const label = roleMap[roleName] || roleName;

    return (
      <Badge variant="secondary" className="gap-1.5">
        <User className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const canManageOrganization = (roleName: string, isOwner: boolean) => {
    // Only owners and admins can access settings
    return isOwner || roleName === 'admin';
  };

  // Stats calculation
  const ownerCount = organizations.filter((org) => org.is_owner).length;
  const memberCount = organizations.filter((org) => !org.is_owner).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Мои организации"
          actions={
            <Button onClick={() => router.push('/organizations/create')}>
              <Plus className="mr-2 h-4 w-4" />
              Создать организацию
            </Button>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Всего организаций" value={organizations.length} />
          <StatCard label="Владелец" value={ownerCount} />
          <StatCard label="Участник" value={memberCount} />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && organizations.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="mb-4 text-foreground/60">
                  У вас пока нет организаций. Создайте первую!
                </p>
                <Button onClick={() => router.push('/organizations/create')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Создать организацию
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Organizations Grid */}
        {!loading && organizations.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {organizations.map((org) => (
              <Card
                key={org.organization_id}
                className="flex flex-col hover:border-primary/50 transition-colors cursor-pointer"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base leading-tight mb-1">
                        {org.organization_name}
                      </CardTitle>
                      <p className="text-xs text-foreground/55">@{org.organization_slug}</p>
                    </div>
                    {getRoleBadge(org.role_slug, org.is_owner)}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 pb-3">
                  <div>
                    <p className="text-xs text-foreground/55 mb-1">Ваша роль:</p>
                    <p className="text-sm font-medium">{org.role_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-foreground/55 mb-1">Присоединились:</p>
                    <p className="text-sm">{new Date(org.joined_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-border/50 flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/organizations/${org.organization_id}/team`)}
                  >
                    <Users className="mr-1.5 h-4 w-4" />
                    Команда
                  </Button>
                  {canManageOrganization(org.role_slug, org.is_owner) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/organizations/${org.organization_id}/settings`)}
                    >
                      <Settings className="mr-1.5 h-4 w-4" />
                      Настройки
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
