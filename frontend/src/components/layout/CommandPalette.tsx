'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Users, User, Settings, Calculator, DollarSign, Plus } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useAuth } from '@/lib/auth/AuthProvider';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { profile } = useAuth();

  const userRole = profile?.organizationRole || profile?.role || '';
  const isAdmin = userRole && ['admin', 'owner'].includes(userRole.toLowerCase());

  const runCommand = (command: () => void) => {
    onOpenChange(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Поиск по приложению..." />
      <CommandList>
        <CommandEmpty>Ничего не найдено.</CommandEmpty>

        <CommandGroup heading="Быстрые действия">
          <CommandItem onSelect={() => runCommand(() => router.push('/quotes/create'))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Создать КП</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Навигация">
          <CommandItem onSelect={() => runCommand(() => router.push('/quotes'))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Коммерческие предложения</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/customers'))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Клиенты</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/profile'))}>
            <User className="mr-2 h-4 w-4" />
            <span>Профиль</span>
          </CommandItem>
        </CommandGroup>

        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Настройки">
              <CommandItem onSelect={() => runCommand(() => router.push('/settings/team'))}>
                <Users className="mr-2 h-4 w-4" />
                <span>Команда</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push('/settings/calculation'))}>
                <Calculator className="mr-2 h-4 w-4" />
                <span>Настройки расчёта</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push('/settings/exchange-rates'))}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                <span>Курсы валют</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
