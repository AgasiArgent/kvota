'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, X, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { toast } from 'sonner';

interface Props {
  quoteId: string;
  quoteNumber: string;
  onApprove: () => void;
  onSendBack: () => void;
  onReject?: () => void;
}

export default function FinancialApprovalActions({
  quoteId,
  quoteNumber,
  onApprove,
  onSendBack,
  onReject,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [approveComment, setApproveComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [sendBackComment, setSendBackComment] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sendBackOpen, setSendBackOpen] = useState(false);

  const handleAction = async (action: 'approve' | 'sendback' | 'reject', comments?: string) => {
    // Validate comments for reject and send back
    if ((action === 'sendback' || action === 'reject') && !comments?.trim()) {
      toast.error(action === 'reject' ? 'Укажите причину отклонения' : 'Укажите причину возврата');
      return;
    }

    setLoading(true);
    try {
      const token = await getAuthToken();

      // Map action to endpoint
      let endpoint = '';
      if (action === 'approve') {
        endpoint = 'approve-financial';
      } else if (action === 'reject') {
        endpoint = 'reject-financial';
      } else {
        endpoint = 'send-back-for-revision';
      }

      const response = await fetch(`${config.apiUrl}/api/quotes/${quoteId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Authorization: `Bearer ${token}`,
        },
        body: comments?.trim() || '',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.detail || 'Действие не выполнено');
      }

      let successMessage = '';
      if (action === 'approve') {
        successMessage = 'КП финансово утверждено!';
        setApproveOpen(false);
      } else if (action === 'reject') {
        successMessage = 'КП отклонено';
        setRejectOpen(false);
      } else {
        successMessage = 'КП отправлено на доработку';
        setSendBackOpen(false);
      }

      toast.success(successMessage);

      // Clear comments
      setApproveComment('');
      setRejectComment('');
      setSendBackComment('');

      // Call appropriate callback
      if (action === 'approve') onApprove();
      else if (action === 'reject' && onReject) onReject();
      else if (action === 'sendback') onSendBack();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка выполнения действия');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    setDownloading(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`${config.apiUrl}/api/quotes/${quoteId}/financial-review`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Не удалось скачать файл');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Financial_Review_${quoteNumber}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Файл успешно скачан');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка скачивания файла');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Download Financial Review Button */}
      <Button variant="outline" onClick={handleDownloadExcel} disabled={downloading}>
        {downloading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        Скачать финансовый анализ
      </Button>

      {/* Approve Button */}
      <Popover open={approveOpen} onOpenChange={setApproveOpen}>
        <PopoverTrigger asChild>
          <Button>
            <Check className="h-4 w-4 mr-2" />
            Утвердить
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">Утверждение КП</p>
              <p className="text-sm text-muted-foreground">Утвердить КП {quoteNumber}?</p>
            </div>
            <Textarea
              placeholder="Комментарий (необязательно)"
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setApproveOpen(false);
                  setApproveComment('');
                }}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={() => handleAction('approve', approveComment)}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Утвердить
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Reject Button */}
      <Popover open={rejectOpen} onOpenChange={setRejectOpen}>
        <PopoverTrigger asChild>
          <Button variant="destructive">
            <X className="h-4 w-4 mr-2" />
            Отклонить
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">Отклонение КП</p>
              <p className="text-sm text-muted-foreground">
                Укажите причину отклонения КП {quoteNumber}:
              </p>
            </div>
            <Textarea
              placeholder="Причина отклонения (обязательно)"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectOpen(false);
                  setRejectComment('');
                }}
              >
                Отмена
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleAction('reject', rejectComment)}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Отклонить
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Send Back Button */}
      <Popover open={sendBackOpen} onOpenChange={setSendBackOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <X className="h-4 w-4 mr-2" />
            На доработку
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2">Возврат на доработку</p>
              <p className="text-sm text-muted-foreground">
                Укажите, что нужно исправить в КП {quoteNumber}:
              </p>
            </div>
            <Textarea
              placeholder="Что нужно исправить (обязательно)"
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSendBackOpen(false);
                  setSendBackComment('');
                }}
              >
                Отмена
              </Button>
              <Button
                size="sm"
                onClick={() => handleAction('sendback', sendBackComment)}
                disabled={loading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Вернуть
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
