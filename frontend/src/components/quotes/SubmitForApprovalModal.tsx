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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SubmitForApprovalModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (comment?: string) => Promise<void>;
  quoteNumber: string;
}

export default function SubmitForApprovalModal({
  open,
  onCancel,
  onSubmit,
  quoteNumber,
}: SubmitForApprovalModalProps) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await onSubmit(comment);
      setComment('');
      toast.success(`КП ${quoteNumber} отправлено на финансовое утверждение`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
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
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Отправить на финансовое утверждение
          </DialogTitle>
          <DialogDescription>
            КП будет направлено финансовому менеджеру для утверждения
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>КП для утверждения</Label>
            <Input value={quoteNumber} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Комментарий (необязательно)</Label>
            <Textarea
              id="comment"
              rows={4}
              placeholder="Например: Срочный заказ, требует быстрого утверждения"
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
          </div>

          <div className="p-3 bg-muted rounded-md">
            <p className="font-medium mb-2">После отправки:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>КП будет направлено финансовому менеджеру</li>
              <li>Статус изменится на &quot;На финансовом утверждении&quot;</li>
              <li>Вы не сможете редактировать КП до принятия решения</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Отправить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
