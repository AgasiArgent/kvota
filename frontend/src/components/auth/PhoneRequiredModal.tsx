'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PhoneRequiredModalProps {
  open: boolean;
  onSubmit: (phone: string) => Promise<void>;
}

/**
 * Modal that appears on first login if user has no phone number.
 * Phone is required for commercial proposal (КП) generation.
 * Cannot be dismissed - user must provide phone to continue.
 */
export function PhoneRequiredModal({ open, onSubmit }: PhoneRequiredModalProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePhone = (value: string): boolean => {
    if (!value.trim()) {
      setError('Введите номер телефона');
      return false;
    }
    if (!/^[\d\s\-+()]{7,20}$/.test(value)) {
      setError('Некорректный формат номера');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePhone(phone)) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(phone);
      toast.success('Номер телефона сохранен');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[450px]"
        onPointerDownOutside={(e: Event) => e.preventDefault()}
        onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Укажите номер телефона
          </DialogTitle>
          <DialogDescription>
            Номер телефона необходим для генерации коммерческих предложений. Он будет указан в
            контактной информации КП.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Номер телефона</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="+7 (999) 123-45-67"
                className="pl-10"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) validatePhone(e.target.value);
                }}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? 'Сохранение...' : 'Сохранить и продолжить'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
