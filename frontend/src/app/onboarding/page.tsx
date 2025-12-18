'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users, Rocket } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-16 w-16 rounded-full mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="w-full max-w-2xl">
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="pt-6 space-y-6">
            {/* Header */}
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Rocket className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Добро пожаловать!</h2>
              <p className="text-muted-foreground">
                Прежде чем начать работу, создайте организацию или присоединитесь к существующей
              </p>
            </div>

            <Separator />

            {/* Create Organization Option */}
            <Card
              className="border-2 border-amber-500 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => router.push('/organizations/create')}
            >
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Plus className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Создать организацию</h3>
                    <p className="text-sm text-muted-foreground">
                      Начните с нуля и пригласите команду
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Создайте свою организацию и получите полный контроль. Вы будете владельцем и
                  сможете:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                  <li>Приглашать сотрудников и назначать роли</li>
                  <li>Управлять настройками организации</li>
                  <li>Создавать и утверждать коммерческие предложения</li>
                </ul>
                <Button
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/organizations/create');
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Создать организацию
                </Button>
              </CardContent>
            </Card>

            {/* Join Organization Option */}
            <Card className="bg-card border-border opacity-70">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-muted-foreground">
                      Присоединиться к организации
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Получите приглашение от администратора
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Чтобы присоединиться к существующей организации, попросите администратора
                  отправить вам приглашение на email {user.email}
                </p>
                <Button variant="outline" className="w-full" disabled>
                  <Users className="mr-2 h-4 w-4" />
                  Ожидание приглашения
                </Button>
              </CardContent>
            </Card>

            <Separator />

            {/* Footer */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                У вас уже есть доступ к организациям?{' '}
                <button
                  onClick={() => router.push('/organizations')}
                  className="text-foreground hover:underline"
                >
                  Перейти к списку организаций
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
