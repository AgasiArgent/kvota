'use client';

import React, { useState, useEffect } from 'react';
import { Bug } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FeedbackService } from '@/lib/api/feedback-service';

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Handle scroll to show/hide button
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          setIsScrollingDown(true);
        } else {
          setIsScrollingDown(false);
        }

        setLastScrollY(currentScrollY);
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [lastScrollY]);

  const handleCancel = () => {
    setOpen(false);
    setDescription('');
    setError(null);
  };

  const validateForm = () => {
    if (!description.trim()) {
      setError('Пожалуйста, опишите проблему');
      return false;
    }
    if (description.trim().length < 10) {
      setError('Описание должно содержать минимум 10 символов');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Auto-capture browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        timestamp: new Date().toISOString(),
      };

      // Auto-capture page URL
      const pageUrl = window.location.href;

      // Submit feedback
      await FeedbackService.submit({
        page_url: pageUrl,
        description: description.trim(),
        browser_info: browserInfo,
      });

      toast.success('Спасибо за обратную связь! Мы рассмотрим вашу заявку.');
      setOpen(false);
      setDescription('');
      setError(null);
    } catch (err) {
      if (err instanceof Error) {
        toast.error(`Ошибка: ${err.message}`);
      } else {
        toast.error('Не удалось отправить обратную связь');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              className={cn(
                'fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full p-0 shadow-lg transition-all duration-300 hover:scale-105',
                'bg-primary text-primary-foreground hover:bg-primary/90',
                isScrollingDown && 'translate-y-24 opacity-0'
              )}
              onClick={() => setOpen(true)}
            >
              <Bug className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Сообщить об ошибке</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Feedback Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Сообщить об ошибке</DialogTitle>
            <DialogDescription>
              Опишите подробно, что произошло и какое поведение вы ожидали
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Описание проблемы</Label>
              <Textarea
                id="description"
                placeholder="Например: При создании КП кнопка 'Сохранить' не реагирует на клик..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={validateForm}
                rows={6}
                maxLength={1000}
                className={cn(error && 'border-destructive focus-visible:ring-destructive')}
              />
              <div className="flex items-center justify-between">
                {error && <p className="text-sm text-destructive">{error}</p>}
                <p className="ml-auto text-sm text-muted-foreground">{description.length}/1000</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium">Автоматически будет записана следующая информация:</p>
              <ul className="ml-4 list-disc space-y-0.5">
                <li>URL текущей страницы</li>
                <li>Информация о браузере</li>
                <li>Разрешение экрана</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Отправка...' : 'Отправить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
