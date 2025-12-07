'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { config } from '@/lib/config';
import { toast } from 'sonner';

interface ApprovalModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  quoteId: string;
  quoteNumber: string;
}

export default function ApprovalModal({
  open,
  onCancel,
  onSuccess,
  quoteId,
  quoteNumber,
}: ApprovalModalProps) {
  const [action, setAction] = useState<'approve' | 'reject' | 'revision'>('approve');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validation for required comments
    if ((action === 'reject' || action === 'revision') && !comment.trim()) {
      toast.error('Комментарий обязателен при отклонении или отправке на доработку');
      return;
    }

    setLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Не авторизован');
        return;
      }

      // Determine endpoint based on action
      let endpoint = '';
      if (action === 'approve') {
        endpoint = `${config.apiUrl}/api/quotes/${quoteId}/approve-financial`;
      } else if (action === 'reject') {
        endpoint = `${config.apiUrl}/api/quotes/${quoteId}/reject-financial`;
      } else {
        endpoint = `${config.apiUrl}/api/quotes/${quoteId}/send-back-for-revision`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'text/plain',
        },
        body: comment || '',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка обработки решения');
      }

      // Show success message
      if (action === 'approve') {
        toast.success('КП успешно утверждено');
      } else if (action === 'reject') {
        toast.success('КП отклонено');
      } else {
        toast.success('КП отправлено на доработку');
      }

      // Reset and close
      setComment('');
      setAction('approve');
      onSuccess();
      onCancel();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при обработке решения';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Решение по КП {quoteNumber}</DialogTitle>
          <DialogDescription>
            Выберите действие и добавьте комментарий при необходимости
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="font-semibold">Выберите действие:</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value="approve"
                  checked={action === 'approve'}
                  onChange={() => setAction('approve')}
                  className="h-4 w-4 text-primary"
                />
                <span>Утвердить финансово</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value="reject"
                  checked={action === 'reject'}
                  onChange={() => setAction('reject')}
                  className="h-4 w-4 text-primary"
                />
                <span>Отклонить</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="action"
                  value="revision"
                  checked={action === 'revision'}
                  onChange={() => setAction('revision')}
                  className="h-4 w-4 text-primary"
                />
                <span>Отправить на доработку</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-semibold">
              Комментарий
              {(action === 'reject' || action === 'revision') && (
                <span className="text-destructive"> *</span>
              )}
              :
            </Label>
            <Textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                action === 'approve'
                  ? 'Необязательный комментарий при утверждении'
                  : action === 'reject'
                    ? 'Укажите причину отклонения (обязательно)'
                    : 'Укажите, что требует доработки (обязательно)'
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
