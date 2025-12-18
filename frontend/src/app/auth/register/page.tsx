'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Mail, Lock, User, AlertCircle, Loader2, X, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate fields
    if (!fullName || fullName.length < 2) {
      setError('Имя должно содержать минимум 2 символа');
      setLoading(false);
      return;
    }

    if (!email) {
      setError('Пожалуйста, введите email');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      setLoading(false);
      return;
    }

    try {
      const { error } = await signUp(email, password, {
        full_name: fullName,
        role: 'member',
      });

      if (error) {
        let errorMessage = error.message;

        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('User already registered')
        ) {
          errorMessage =
            'Этот email уже зарегистрирован. Попробуйте войти в систему или используйте другой email.';
        } else if (errorMessage.includes('Invalid email')) {
          errorMessage = 'Некорректный формат email';
        } else if (errorMessage.includes('Password')) {
          errorMessage = 'Пароль должен содержать минимум 6 символов';
        }

        setError(errorMessage);
        setLoading(false);
        return;
      }

      setRegisteredEmail(email);
      setSuccess(true);
    } catch {
      setError('Произошла неожиданная ошибка');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-5">
        <div className="w-full max-w-lg">
          <Card className="bg-card border-border shadow-2xl">
            <CardContent className="pt-6 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>

              <h2 className="text-2xl font-semibold text-emerald-500">Регистрация успешна!</h2>

              <p className="text-base">
                Мы отправили письмо с подтверждением на ваш email:
                <br />
                <strong className="text-foreground">{registeredEmail}</strong>
              </p>

              <p className="text-muted-foreground">
                Пожалуйста, перейдите по ссылке в письме для подтверждения email. После
                подтверждения вы сможете войти в систему и создать свою первую организацию!
              </p>

              <Separator />

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Подтвердили email?</p>
                <Button size="lg" onClick={() => router.push('/auth/login')}>
                  Войти в систему
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <Card className="bg-card border-border shadow-2xl">
          <CardContent className="pt-6 space-y-6">
            {/* Header */}
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-primary mb-2">Регистрация</h2>
              <p className="text-muted-foreground">
                Создайте аккаунт для работы с коммерческими предложениями
              </p>
            </div>

            <Separator />

            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Ошибка регистрации</p>
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

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Полное имя</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Иван Иванов"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

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
                    placeholder="Минимум 6 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Подтверждение пароля</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 text-base">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Регистрация...
                  </>
                ) : (
                  'Зарегистрироваться'
                )}
              </Button>
            </form>

            <Separator />

            {/* Login Link */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Уже есть аккаунт? </span>
              <Link href="/auth/login" className="text-primary hover:underline">
                Войти в систему
              </Link>
            </div>

            {/* Next Steps */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h5 className="font-medium mb-3">Что дальше?</h5>
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Создайте свою организацию или присоединитесь к существующей</li>
                <li>Получите роль в организации (владелец, менеджер, финансист и т.д.)</li>
                <li>Начните работать с коммерческими предложениями</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
