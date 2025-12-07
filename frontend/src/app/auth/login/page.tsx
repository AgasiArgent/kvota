'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Mail, Lock, AlertCircle, Loader2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/onboarding';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Пожалуйста, заполните все поля');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      window.location.href = redirectTo;
    } catch {
      setError('Произошла неожиданная ошибка');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <Card className="bg-card border-border shadow-2xl">
          <CardContent className="pt-6 space-y-6">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-primary mb-2">Коммерческие предложения</h2>
              <p className="text-muted-foreground">Система управления КП для российского B2B</p>
            </div>

            <Separator />

            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Ошибка входа</p>
                  <p className="text-sm text-destructive/80">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-destructive/60 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Ваш пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <div className="text-right">
                <Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
                  Забыли пароль?
                </Link>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 text-base">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Вход...
                  </>
                ) : (
                  'Войти в систему'
                )}
              </Button>
            </form>

            <Separator />

            {/* Registration Link */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Нет аккаунта? </span>
              <Link href="/auth/register" className="text-primary hover:underline">
                Зарегистрироваться
              </Link>
            </div>

            {/* Features */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h5 className="font-medium mb-3">Возможности системы:</h5>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Создание и управление коммерческими предложениями</li>
                <li>Многоуровневое утверждение (менеджер - финансы - директор)</li>
                <li>Валидация российских реквизитов (ИНН, КПП, ОГРН)</li>
                <li>Поддержка валют: RUB, CNY, USD, EUR</li>
                <li>Автоматический расчет НДС (20%, 10%, 0%)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
