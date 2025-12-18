# Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Ant Design with shadcn/ui, implement warm dark theme, redesign /quotes page.

**Architecture:** shadcn/ui components with Tailwind CSS, custom dark theme via CSS variables, ag-Grid with custom dark styling, new sidebar-first layout.

**Tech Stack:** Next.js 15, React 19, shadcn/ui, Radix UI, Tailwind CSS, ag-Grid, Lucide icons

---

## Phase A: Foundation

### Task 1: Initialize shadcn/ui

**Files:**
- Create: `components.json`
- Create: `lib/utils.ts`
- Modify: `tailwind.config.ts`

**Step 1: Run shadcn init**

```bash
cd /home/novi/workspace/tech/projects/kvota/user-feedback/frontend
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Neutral
- CSS variables: Yes
- Tailwind config: tailwind.config.ts
- Components: src/components/ui
- Utils: src/lib/utils

**Step 2: Verify files created**

```bash
ls -la src/components/ui/
ls -la src/lib/utils.ts
cat components.json
```

Expected: components.json exists, lib/utils.ts has cn() function

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: initialize shadcn/ui"
```

---

### Task 2: Update CSS Variables for Dark Theme

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Replace globals.css content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light mode - keeping for reference, but app will force dark */
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;
    --primary: 239 84% 67%;
    --primary-foreground: 0 0% 98%;
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 239 84% 67%;
    --radius: 0.5rem;
  }

  .dark {
    /* Warm Linear Dark Theme */
    --background: 0 0% 8%;           /* #141414 */
    --foreground: 0 0% 96%;          /* #f5f5f5 */
    --card: 0 0% 12%;                /* #1f1f1f */
    --card-foreground: 0 0% 96%;     /* #f5f5f5 */
    --popover: 0 0% 12%;             /* #1f1f1f */
    --popover-foreground: 0 0% 96%;  /* #f5f5f5 */
    --primary: 239 84% 67%;          /* #6366f1 indigo */
    --primary-foreground: 0 0% 98%;  /* white */
    --secondary: 0 0% 16%;           /* #292929 */
    --secondary-foreground: 0 0% 96%;
    --muted: 0 0% 16%;               /* #292929 */
    --muted-foreground: 0 0% 64%;    /* #a3a3a3 */
    --accent: 0 0% 16%;              /* #292929 */
    --accent-foreground: 0 0% 96%;
    --destructive: 0 84% 60%;        /* #ef4444 */
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 18%;              /* #2e2e2e */
    --input: 0 0% 18%;               /* #2e2e2e */
    --ring: 239 84% 67%;             /* #6366f1 */
    --radius: 0.5rem;

    /* Custom semantic colors */
    --success: 142 71% 45%;          /* #22c55e */
    --success-foreground: 0 0% 98%;
    --warning: 38 92% 50%;           /* #f59e0b */
    --warning-foreground: 0 0% 9%;
    --info: 217 91% 60%;             /* #3b82f6 */
    --info-foreground: 0 0% 98%;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Force dark mode */
  :root {
    color-scheme: dark;
  }
}

/* Scrollbar styling for dark theme */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: hsl(var(--background));
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground));
}

/* Number formatting - tabular figures */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Monospace numbers */
.font-mono-numbers {
  font-family: var(--font-geist-mono), ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
```

**Step 2: Verify CSS loads**

```bash
cd /home/novi/workspace/tech/projects/kvota/user-feedback/frontend
npm run dev
```

Open browser, check dark background appears.

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add warm dark theme CSS variables"
```

---

### Task 3: Update Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Update layout.tsx**

```tsx
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kvota - B2B Quotation Platform',
  description: 'Professional quotation management for Russian B2B operations',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Step 2: Install geist font package (if not using next/font)**

```bash
npm install geist
```

**Step 3: Install sonner for toasts**

```bash
npx shadcn@latest add sonner
```

**Step 4: Verify app loads**

```bash
npm run dev
```

Check app loads without errors (will look broken until we update more).

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: update root layout for shadcn/dark theme"
```

---

### Task 4: Install Core shadcn Components

**Files:**
- Create: Multiple files in `src/components/ui/`

**Step 1: Install button**

```bash
npx shadcn@latest add button
```

**Step 2: Install card**

```bash
npx shadcn@latest add card
```

**Step 3: Install input**

```bash
npx shadcn@latest add input
```

**Step 4: Install select**

```bash
npx shadcn@latest add select
```

**Step 5: Install badge**

```bash
npx shadcn@latest add badge
```

**Step 6: Install dialog**

```bash
npx shadcn@latest add dialog
```

**Step 7: Install dropdown-menu**

```bash
npx shadcn@latest add dropdown-menu
```

**Step 8: Install command (for Cmd+K)**

```bash
npx shadcn@latest add command
```

**Step 9: Install separator**

```bash
npx shadcn@latest add separator
```

**Step 10: Install avatar**

```bash
npx shadcn@latest add avatar
```

**Step 11: Install skeleton (for loading states)**

```bash
npx shadcn@latest add skeleton
```

**Step 12: Install tooltip**

```bash
npx shadcn@latest add tooltip
```

**Step 13: Verify components installed**

```bash
ls src/components/ui/
```

Expected: button.tsx, card.tsx, input.tsx, select.tsx, badge.tsx, dialog.tsx, dropdown-menu.tsx, command.tsx, separator.tsx, avatar.tsx, skeleton.tsx, tooltip.tsx, sonner.tsx

**Step 14: Commit**

```bash
git add -A
git commit -m "chore: install core shadcn/ui components"
```

---

## Phase B: Layout Components

### Task 5: Create Sidebar Component

**Files:**
- Create: `src/components/layout/Sidebar.tsx`

**Step 1: Create Sidebar.tsx**

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Users,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Building2,
  UserCircle,
  History,
  Calculator,
  DollarSign,
  UsersRound,
  MessageSquare,
  FileSpreadsheet,
  Kanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth/AuthProvider';
import OrganizationSwitcher from '@/components/organizations/OrganizationSwitcher';
import ExchangeRates from './ExchangeRates';

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

export default function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const { profile } = useAuth();

  const userRole = profile?.organizationRole || profile?.role || '';
  const isAdmin = userRole && ['admin', 'owner'].includes(userRole.toLowerCase());

  const mainNavItems: NavItem[] = [
    { href: '/quotes', label: 'Коммерческие предложения', icon: FileText },
    { href: '/customers', label: 'Клиенты', icon: Users },
    { href: '/profile', label: 'Профиль', icon: User },
  ];

  const adminNavGroups: NavGroup[] = isAdmin
    ? [
        {
          label: 'CRM',
          items: [
            { href: '/leads', label: 'Лиды', icon: UserCircle },
            { href: '/leads/pipeline', label: 'Воронка', icon: Kanban },
          ],
        },
        {
          label: 'Аналитика',
          items: [
            { href: '/analytics', label: 'Запросы', icon: BarChart3 },
            { href: '/analytics/saved', label: 'Сохранённые', icon: FileText },
            { href: '/analytics/history', label: 'История', icon: History },
          ],
        },
        {
          label: 'Настройки',
          items: [
            { href: '/settings/team', label: 'Команда', icon: UsersRound },
            { href: '/settings/calculation', label: 'Расчёт', icon: Calculator },
            { href: '/settings/exchange-rates', label: 'Курсы валют', icon: DollarSign },
          ],
        },
        {
          label: 'Администрирование',
          items: [
            { href: '/organizations', label: 'Организации', icon: Building2 },
            { href: '/activity', label: 'История действий', icon: History },
            { href: '/admin/feedback', label: 'Обратная связь', icon: MessageSquare },
            { href: '/admin/excel-validation', label: 'Валидация Excel', icon: FileSpreadsheet },
          ],
        },
      ]
    : [];

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;

    const linkContent = (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-normal">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo / Org Switcher */}
        <div className="flex h-14 items-center border-b border-border px-3">
          {collapsed ? (
            <span className="mx-auto text-lg font-bold text-primary">К</span>
          ) : (
            <OrganizationSwitcher darkMode />
          )}
        </div>

        {/* Exchange Rates */}
        {!collapsed && (
          <div className="border-b border-border">
            <ExchangeRates />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3">
          {/* Main nav */}
          <div className="space-y-1">
            {mainNavItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>

          {/* Admin sections */}
          {adminNavGroups.length > 0 && (
            <>
              <Separator className="my-4" />
              {adminNavGroups.map((group, idx) => (
                <div key={idx} className="mb-4">
                  {!collapsed && group.label && (
                    <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </h4>
                  )}
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <NavLink key={item.href} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span>Свернуть</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
```

**Step 2: Verify file created**

```bash
cat src/components/layout/Sidebar.tsx | head -50
```

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add new dark Sidebar component"
```

---

### Task 6: Create TopBar Component

**Files:**
- Create: `src/components/layout/TopBar.tsx`

**Step 1: Create TopBar.tsx**

```tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth/AuthProvider';

interface TopBarProps {
  onCommandPaletteOpen?: () => void;
}

export default function TopBar({ onCommandPaletteOpen }: TopBarProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || '??';

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-6">
      {/* Left side - Search trigger */}
      <Button
        variant="outline"
        className="w-64 justify-start text-muted-foreground"
        onClick={onCommandPaletteOpen}
      >
        <Search className="mr-2 h-4 w-4" />
        <span>Поиск...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Right side - User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={profile?.avatar_url} alt={profile?.full_name || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <div className="flex items-center justify-start gap-2 p-2">
            <div className="flex flex-col space-y-1 leading-none">
              {profile?.full_name && (
                <p className="font-medium">{profile.full_name}</p>
              )}
              {user?.email && (
                <p className="w-[200px] truncate text-sm text-muted-foreground">
                  {user.email}
                </p>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/profile')}>
            <User className="mr-2 h-4 w-4" />
            <span>Профиль</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Выйти</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "feat: add TopBar component with user menu"
```

---

### Task 7: Update ExchangeRates for Dark Theme

**Files:**
- Modify: `src/components/layout/ExchangeRates.tsx`

**Step 1: Update ExchangeRates.tsx**

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExchangeRatesData {
  rates: Record<string, number>;
  last_updated: string;
  currencies_count: number;
}

const DISPLAY_CURRENCIES = ['USD', 'EUR', 'CNY', 'TRY'];

export default function ExchangeRates() {
  const [data, setData] = useState<ExchangeRatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/exchange-rates/all');
      if (!response.ok) throw new Error('Failed to fetch rates');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    // Refresh every 30 minutes
    const interval = setInterval(fetchRates, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatRate = (rate: number) => {
    return rate.toFixed(4);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Курсы ЦБ РФ
        </span>
        <button
          onClick={fetchRates}
          disabled={loading}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
        </button>
      </div>

      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <div className="space-y-1">
          {DISPLAY_CURRENCIES.map((currency) => (
            <div
              key={currency}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">{currency}</span>
              <span className="font-mono-numbers text-foreground">
                {data?.rates[currency] ? formatRate(data.rates[currency]) : '—'}
              </span>
            </div>
          ))}
          {data?.last_updated && (
            <p className="text-[10px] text-muted-foreground mt-2">
              {formatDate(data.last_updated)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/layout/ExchangeRates.tsx
git commit -m "style: update ExchangeRates for dark theme"
```

---

### Task 8: Create New MainLayout

**Files:**
- Modify: `src/components/layout/MainLayout.tsx`

**Step 1: Replace MainLayout.tsx**

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CommandPalette from './CommandPalette';
import FeedbackButton from '@/components/FeedbackButton';
import { useAuth } from '@/lib/auth/AuthProvider';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { user } = useAuth();

  // Handle Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div
        className={cn(
          'transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        )}
      >
        <TopBar onCommandPaletteOpen={() => setCommandPaletteOpen(true)} />

        <main className="p-6">{children}</main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      {user && <FeedbackButton />}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/layout/MainLayout.tsx
git commit -m "feat: rebuild MainLayout with new sidebar/topbar"
```

---

### Task 9: Create CommandPalette Component

**Files:**
- Create: `src/components/layout/CommandPalette.tsx`

**Step 1: Create CommandPalette.tsx**

```tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Users,
  User,
  Settings,
  Calculator,
  DollarSign,
  Plus,
} from 'lucide-react';
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
              <CommandItem
                onSelect={() => runCommand(() => router.push('/settings/team'))}
              >
                <Users className="mr-2 h-4 w-4" />
                <span>Команда</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => router.push('/settings/calculation'))}
              >
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
```

**Step 2: Commit**

```bash
git add src/components/layout/CommandPalette.tsx
git commit -m "feat: add CommandPalette (Cmd+K) navigation"
```

---

## Phase C: Quotes Page Components

### Task 10: Create StatCard Component

**Files:**
- Create: `src/components/shared/StatCard.tsx`

**Step 1: Create StatCard.tsx**

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    positive: boolean;
  };
  className?: string;
  valueClassName?: string;
}

export default function StatCard({
  label,
  value,
  trend,
  className,
  valueClassName,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          valueClassName
        )}
      >
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            'mt-1 text-xs',
            trend.positive ? 'text-green-500' : 'text-red-500'
          )}
        >
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
mkdir -p src/components/shared
git add src/components/shared/StatCard.tsx
git commit -m "feat: add StatCard component"
```

---

### Task 11: Create StatusBadge Component

**Files:**
- Create: `src/components/shared/StatusBadge.tsx`

**Step 1: Create StatusBadge.tsx**

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

type StatusType =
  | 'draft'
  | 'awaiting_financial_approval'
  | 'financially_approved'
  | 'rejected_by_finance'
  | 'sent_back_for_revision'
  | 'ready_to_send'
  | 'sent_to_customer'
  | 'accepted_by_customer'
  | 'rejected_by_customer'
  | 'expired'
  | 'cancelled';

interface StatusConfig {
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
}

const STATUS_CONFIG: Record<StatusType, StatusConfig> = {
  draft: {
    label: 'Черновик',
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-400/10',
    textColor: 'text-gray-400',
  },
  awaiting_financial_approval: {
    label: 'На утверждении',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-500',
  },
  financially_approved: {
    label: 'Утверждено',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500',
  },
  rejected_by_finance: {
    label: 'Отклонено',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-500',
  },
  sent_back_for_revision: {
    label: 'На доработке',
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-500',
  },
  ready_to_send: {
    label: 'Готово к отправке',
    dotColor: 'bg-cyan-500',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-500',
  },
  sent_to_customer: {
    label: 'Отправлено',
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-500',
  },
  accepted_by_customer: {
    label: 'Принято',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-500/10',
    textColor: 'text-green-500',
  },
  rejected_by_customer: {
    label: 'Отклонено клиентом',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-500',
  },
  expired: {
    label: 'Истекло',
    dotColor: 'bg-gray-500',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-500',
  },
  cancelled: {
    label: 'Отменено',
    dotColor: 'bg-gray-500',
    bgColor: 'bg-gray-500/10',
    textColor: 'text-gray-500',
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as StatusType] || {
    label: status,
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-400/10',
    textColor: 'text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/shared/StatusBadge.tsx
git commit -m "feat: add StatusBadge component with workflow states"
```

---

### Task 12: Create PageHeader Component

**Files:**
- Create: `src/components/shared/PageHeader.tsx`

**Step 1: Create PageHeader.tsx**

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/shared/PageHeader.tsx
git commit -m "feat: add PageHeader component"
```

---

### Task 13: Create ag-Grid Dark Theme

**Files:**
- Create: `src/styles/ag-grid-dark.css`

**Step 1: Create ag-grid-dark.css**

```css
/* Custom Dark Theme for ag-Grid */
.ag-theme-custom-dark {
  /* Core colors */
  --ag-background-color: hsl(0 0% 12%);
  --ag-foreground-color: hsl(0 0% 96%);
  --ag-border-color: hsl(0 0% 18%);

  /* Header */
  --ag-header-background-color: hsl(0 0% 8%);
  --ag-header-foreground-color: hsl(0 0% 64%);
  --ag-header-cell-hover-background-color: hsl(0 0% 16%);

  /* Rows */
  --ag-odd-row-background-color: hsl(0 0% 12%);
  --ag-row-hover-color: hsl(0 0% 16%);
  --ag-selected-row-background-color: hsl(239 84% 67% / 0.15);

  /* Cells */
  --ag-cell-horizontal-border: solid hsl(0 0% 18%);
  --ag-range-selection-border-color: hsl(239 84% 67%);
  --ag-range-selection-background-color: hsl(239 84% 67% / 0.1);

  /* Input */
  --ag-input-focus-border-color: hsl(239 84% 67%);
  --ag-input-focus-box-shadow: 0 0 0 1px hsl(239 84% 67%);

  /* Sizing */
  --ag-grid-size: 6px;
  --ag-list-item-height: 32px;
  --ag-row-height: 48px;
  --ag-header-height: 44px;

  /* Typography */
  --ag-font-family: inherit;
  --ag-font-size: 14px;

  /* Borders */
  --ag-row-border-width: 1px;
  --ag-row-border-color: hsl(0 0% 18%);
  --ag-cell-horizontal-padding: 16px;

  /* Misc */
  --ag-border-radius: 0;
  --ag-wrapper-border-radius: 8px;
}

/* Header styling */
.ag-theme-custom-dark .ag-header {
  border-bottom: 1px solid hsl(0 0% 18%);
}

.ag-theme-custom-dark .ag-header-cell {
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Row hover effect */
.ag-theme-custom-dark .ag-row:hover {
  background-color: hsl(0 0% 16%);
}

/* Selected row */
.ag-theme-custom-dark .ag-row-selected {
  background-color: hsl(239 84% 67% / 0.1) !important;
}

/* Cell focus */
.ag-theme-custom-dark .ag-cell-focus {
  border-color: hsl(239 84% 67%) !important;
}

/* Pagination */
.ag-theme-custom-dark .ag-paging-panel {
  border-top: 1px solid hsl(0 0% 18%);
  color: hsl(0 0% 64%);
}

/* Loading overlay */
.ag-theme-custom-dark .ag-overlay-loading-center {
  background-color: hsl(0 0% 12%);
  color: hsl(0 0% 96%);
}

/* No rows overlay */
.ag-theme-custom-dark .ag-overlay-no-rows-center {
  background-color: hsl(0 0% 12%);
  color: hsl(0 0% 64%);
}

/* Scrollbar */
.ag-theme-custom-dark ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.ag-theme-custom-dark ::-webkit-scrollbar-track {
  background: hsl(0 0% 8%);
}

.ag-theme-custom-dark ::-webkit-scrollbar-thumb {
  background: hsl(0 0% 24%);
  border-radius: 4px;
}

.ag-theme-custom-dark ::-webkit-scrollbar-thumb:hover {
  background: hsl(0 0% 32%);
}

/* Pinned columns */
.ag-theme-custom-dark .ag-pinned-left-header,
.ag-theme-custom-dark .ag-pinned-left-cols-container {
  border-right: 1px solid hsl(0 0% 24%);
}

.ag-theme-custom-dark .ag-pinned-right-header,
.ag-theme-custom-dark .ag-pinned-right-cols-container {
  border-left: 1px solid hsl(0 0% 24%);
}
```

**Step 2: Import in globals.css**

Add to the top of `src/app/globals.css`:

```css
@import '../styles/ag-grid-dark.css';
```

**Step 3: Create styles directory and commit**

```bash
mkdir -p src/styles
git add src/styles/ag-grid-dark.css src/app/globals.css
git commit -m "style: add ag-Grid custom dark theme"
```

---

### Task 14: Create QuoteFilters Component

**Files:**
- Create: `src/components/quotes/QuoteFilters.tsx`

**Step 1: Create QuoteFilters.tsx**

```tsx
'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  name: string;
}

interface QuoteFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  authorFilter: string | undefined;
  onAuthorChange: (value: string | undefined) => void;
  teamMembers: TeamMember[];
  loadingMembers: boolean;
  className?: string;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Черновик' },
  { value: 'awaiting_financial_approval', label: 'На утверждении' },
  { value: 'financially_approved', label: 'Утверждено' },
  { value: 'rejected_by_finance', label: 'Отклонено' },
  { value: 'sent_back_for_revision', label: 'На доработке' },
  { value: 'ready_to_send', label: 'Готово к отправке' },
  { value: 'sent_to_customer', label: 'Отправлено' },
  { value: 'accepted_by_customer', label: 'Принято' },
  { value: 'rejected_by_customer', label: 'Отклонено клиентом' },
  { value: 'expired', label: 'Истекло' },
  { value: 'cancelled', label: 'Отменено' },
];

export default function QuoteFilters({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusChange,
  authorFilter,
  onAuthorChange,
  teamMembers,
  loadingMembers,
  className,
}: QuoteFiltersProps) {
  const hasActiveFilters = searchTerm || statusFilter || authorFilter;

  const clearFilters = () => {
    onSearchChange('');
    onStatusChange('');
    onAuthorChange(undefined);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по номеру, клиенту..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Status filter */}
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Author filter */}
      <Select
        value={authorFilter || ''}
        onValueChange={(v) => onAuthorChange(v || undefined)}
        disabled={loadingMembers}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Автор" />
        </SelectTrigger>
        <SelectContent>
          {teamMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 px-2 text-muted-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Сбросить
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/quotes/QuoteFilters.tsx
git commit -m "feat: add QuoteFilters component with shadcn selects"
```

---

### Task 15: Create QuoteStats Component

**Files:**
- Create: `src/components/quotes/QuoteStats.tsx`

**Step 1: Create QuoteStats.tsx**

```tsx
import React from 'react';
import StatCard from '@/components/shared/StatCard';
import { cn } from '@/lib/utils';

interface QuoteStatsProps {
  totalQuotes: number;
  approvedQuotes: number;
  pendingQuotes: number;
  totalProfitUsd: number;
  className?: string;
}

export default function QuoteStats({
  totalQuotes,
  approvedQuotes,
  pendingQuotes,
  totalProfitUsd,
  className,
}: QuoteStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={cn('grid grid-cols-2 gap-4 lg:grid-cols-4', className)}>
      <StatCard label="Всего КП" value={totalQuotes} />
      <StatCard
        label="Утверждено"
        value={approvedQuotes}
        valueClassName="text-green-500"
      />
      <StatCard
        label="На утверждении"
        value={pendingQuotes}
        valueClassName="text-amber-500"
      />
      <StatCard
        label="Прибыль"
        value={formatCurrency(totalProfitUsd)}
        valueClassName={totalProfitUsd >= 0 ? 'text-green-500' : 'text-red-500'}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/quotes/QuoteStats.tsx
git commit -m "feat: add QuoteStats component"
```

---

### Task 16: Rebuild Quotes Page

**Files:**
- Modify: `src/app/quotes/page.tsx`

**Step 1: Create new quotes page**

This is the main rebuild. Replace entire file with new implementation using shadcn components and ag-Grid with dark theme. Due to size, this will be a full replacement.

```tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, ICellRendererParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import {
  Download,
  Upload,
  MoreHorizontal,
  Send,
  FileDown,
  FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import QuoteStats from '@/components/quotes/QuoteStats';
import QuoteFilters from '@/components/quotes/QuoteFilters';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { QuoteService } from '@/lib/api/quote-service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';
import { cn } from '@/lib/utils';

interface QuoteListItem {
  id: string;
  quote_number: string;
  customer_name?: string;
  created_by_name?: string;
  workflow_state?: string;
  total_with_vat_quote?: number;
  total_with_vat_usd?: number;
  total_profit_usd?: number;
  currency?: string;
  quote_date?: string;
  valid_until?: string;
}

export default function QuotesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const gridRef = useRef<AgGridReact>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState<string | undefined>(undefined);
  const [authorFilterInitialized, setAuthorFilterInitialized] = useState(false);

  // Team members
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Submit modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitQuoteId, setSubmitQuoteId] = useState<string | null>(null);
  const [submitQuoteNumber, setSubmitQuoteNumber] = useState('');
  const [submitComment, setSubmitComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const quoteService = new QuoteService();

  // Fetch team members
  useEffect(() => {
    if (profile?.organization_id && teamMembers.length === 0) {
      fetchTeamMembers();
    }
  }, [profile?.organization_id]);

  // Pre-select current user
  useEffect(() => {
    if (teamMembers.length > 0 && profile?.id && !authorFilterInitialized) {
      setAuthorFilter(profile.id);
      setAuthorFilterInitialized(true);
    }
  }, [teamMembers, profile?.id, authorFilterInitialized]);

  // Fetch quotes when filters change
  useEffect(() => {
    if (profile?.organization_id && authorFilterInitialized) {
      fetchQuotes();
    }
  }, [currentPage, pageSize, searchTerm, statusFilter, authorFilter, profile, authorFilterInitialized]);

  const fetchTeamMembers = async () => {
    if (!profile?.organization_id) return;
    setLoadingMembers(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch(
        `${config.apiUrl}/api/organizations/${profile.organization_id}/members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setTeamMembers(
          data.map((m: any) => ({
            id: m.user_id,
            name: m.user_full_name || m.user_email,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const filters: Record<string, any> = {};
      if (searchTerm) filters.search = searchTerm;
      if (statusFilter) filters.workflow_state = statusFilter;
      if (authorFilter) filters.created_by = authorFilter;

      const response = await quoteService.getQuotes(
        profile?.organization_id || '',
        filters,
        { page: currentPage, limit: pageSize }
      );

      if (response.success && response.data) {
        setQuotes(response.data.quotes || []);
        setTotalCount(response.data.pagination?.total_items || 0);
      } else {
        toast.error(response.error || 'Ошибка загрузки КП');
      }
    } catch (error: any) {
      toast.error(`Ошибка загрузки: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const approvedQuotes = quotes.filter(
    (q) => q.workflow_state === 'financially_approved' || q.workflow_state === 'accepted_by_customer'
  ).length;
  const pendingQuotes = quotes.filter(
    (q) => q.workflow_state === 'awaiting_financial_approval'
  ).length;
  const totalProfitUsd = quotes.reduce((sum, q) => sum + (q.total_profit_usd || 0), 0);

  // Handlers
  const handleDownloadTemplate = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/quotes/upload/download-template`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Ошибка скачивания');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quote_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Шаблон скачан');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // TODO: Open create quote modal with file
      toast.info('Создание КП из файла...');
    }
    e.target.value = '';
  };

  const handleSubmitForApproval = async () => {
    if (!submitQuoteId) return;
    setSubmitting(true);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Не авторизован');

      const response = await fetch(
        `${config.apiUrl}/api/quotes/${submitQuoteId}/submit-for-financial-approval`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain',
          },
          body: submitComment || '',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка отправки');
      }

      setSubmitModalOpen(false);
      setSubmitComment('');
      toast.success('КП отправлено на утверждение');
      fetchQuotes();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async (quoteId: string, type: 'validation' | 'invoice') => {
    const loadingToast = toast.loading(
      type === 'validation'
        ? 'Создание файла... (10-15 сек)'
        : 'Экспорт...'
    );

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Не авторизован');

      const url =
        type === 'validation'
          ? `${config.apiUrl}/api/quotes/upload/export-as-template/${quoteId}`
          : `${config.apiUrl}/api/quotes/${quoteId}/export/pdf?format=invoice`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Ошибка экспорта');

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = type === 'validation' ? `validation_${quoteId}.xlsm` : `invoice_${quoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);

      toast.success('Файл скачан', { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message, { id: loadingToast });
    }
  };

  // Format helpers
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU');
  };

  // ag-Grid column definitions
  const columnDefs: ColDef[] = [
    {
      field: 'quote_number',
      headerName: '№ КП',
      width: 130,
      cellRenderer: (params: ICellRendererParams) => (
        <span className="font-medium text-primary cursor-pointer hover:underline">
          {params.value}
        </span>
      ),
    },
    {
      field: 'customer_name',
      headerName: 'Клиент',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'created_by_name',
      headerName: 'Автор',
      width: 150,
      valueFormatter: (params) => params.value || '—',
    },
    {
      field: 'total_with_vat_quote',
      headerName: 'Сумма',
      width: 140,
      type: 'rightAligned',
      cellClass: 'font-mono-numbers',
      valueFormatter: (params) =>
        params.value ? formatCurrency(params.value, params.data.currency) : '—',
    },
    {
      field: 'total_profit_usd',
      headerName: 'Прибыль',
      width: 130,
      type: 'rightAligned',
      cellClass: 'font-mono-numbers',
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return '—';
        const isPositive = params.value >= 0;
        return (
          <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
            ${params.value.toLocaleString('ru-RU', { minimumFractionDigits: 0 })}
          </span>
        );
      },
    },
    {
      field: 'workflow_state',
      headerName: 'Статус',
      width: 160,
      cellRenderer: (params: ICellRendererParams) => (
        <StatusBadge status={params.value || 'draft'} />
      ),
    },
    {
      field: 'quote_date',
      headerName: 'Дата',
      width: 110,
      valueFormatter: (params) => (params.value ? formatDate(params.value) : '—'),
    },
    {
      headerName: '',
      width: 60,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {params.data.workflow_state === 'draft' && (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    setSubmitQuoteId(params.data.id);
                    setSubmitQuoteNumber(params.data.quote_number);
                    setSubmitModalOpen(true);
                  }}
                >
                  <Send className="mr-2 h-4 w-4" />
                  На утверждение
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => handleExport(params.data.id, 'validation')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Экспорт для проверки
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport(params.data.id, 'invoice')}>
              <FileDown className="mr-2 h-4 w-4" />
              Счёт (Invoice)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Коммерческие предложения"
          actions={
            <>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Шаблон
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Создать КП
              </Button>
            </>
          }
        />

        {/* Stats */}
        <QuoteStats
          totalQuotes={totalCount}
          approvedQuotes={approvedQuotes}
          pendingQuotes={pendingQuotes}
          totalProfitUsd={totalProfitUsd}
        />

        {/* Filters */}
        <QuoteFilters
          searchTerm={searchTerm}
          onSearchChange={(v) => {
            setSearchTerm(v);
            setCurrentPage(1);
          }}
          statusFilter={statusFilter}
          onStatusChange={(v) => {
            setStatusFilter(v);
            setCurrentPage(1);
          }}
          authorFilter={authorFilter}
          onAuthorChange={(v) => {
            setAuthorFilter(v);
            setCurrentPage(1);
          }}
          teamMembers={teamMembers}
          loadingMembers={loadingMembers}
        />

        {/* Table */}
        <div className="ag-theme-custom-dark rounded-lg border border-border overflow-hidden" style={{ height: 600 }}>
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <AgGridReact
              ref={gridRef}
              rowData={quotes}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection="multiple"
              suppressRowClickSelection
              pagination
              paginationPageSize={pageSize}
              domLayout="normal"
              getRowId={(params) => params.data.id}
              onRowClicked={(e) => {
                if (e.data?.id) {
                  router.push(`/quotes/${e.data.id}`);
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Submit for Approval Dialog */}
      <Dialog open={submitModalOpen} onOpenChange={setSubmitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отправить на утверждение</DialogTitle>
            <DialogDescription>
              КП {submitQuoteNumber} будет отправлено на финансовое утверждение.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Комментарий (необязательно)"
              value={submitComment}
              onChange={(e) => setSubmitComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmitForApproval} disabled={submitting}>
              {submitting ? 'Отправка...' : 'Отправить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
```

**Step 2: Verify file compiles**

```bash
npm run build
```

Fix any TypeScript errors.

**Step 3: Commit**

```bash
git add src/app/quotes/page.tsx
git commit -m "feat: rebuild quotes page with shadcn/ui and dark theme"
```

---

## Phase D: Polish and Verification

### Task 17: Update FeedbackButton for Dark Theme

**Files:**
- Modify: `src/components/FeedbackButton.tsx`

**Step 1: Update styling to match dark theme**

Update colors and styling to use CSS variables and match the dark theme aesthetic.

**Step 2: Commit after update**

```bash
git add src/components/FeedbackButton.tsx
git commit -m "style: update FeedbackButton for dark theme"
```

---

### Task 18: Test Full Application

**Step 1: Start dev server**

```bash
cd /home/novi/workspace/tech/projects/kvota/user-feedback/frontend
npm run dev
```

**Step 2: Test checklist**

- [ ] App loads without errors
- [ ] Dark theme applied to all elements
- [ ] Sidebar navigation works
- [ ] Sidebar collapse/expand works
- [ ] Cmd+K opens command palette
- [ ] /quotes page loads data
- [ ] Stats cards display correctly
- [ ] Filters work (search, status, author)
- [ ] ag-Grid has dark theme
- [ ] Row click navigates to detail
- [ ] Actions dropdown works
- [ ] Submit for approval modal works
- [ ] Export functions work
- [ ] User menu in top bar works
- [ ] Logout works

**Step 3: Fix any issues found**

Address bugs discovered during testing.

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: address issues found during testing"
```

---

### Task 19: Remove Ant Design (Optional - Can Do Later)

**Files:**
- Modify: `package.json`
- Modify: Various files still using Ant

**Step 1: Search for remaining Ant imports**

```bash
grep -r "from 'antd'" src/
grep -r "@ant-design" src/
```

**Step 2: Plan migration of remaining files**

Create list of files still using Ant Design for future migration.

**Step 3: Optionally remove Ant from package.json**

Only after all pages migrated:

```bash
npm uninstall antd @ant-design/icons @ant-design/nextjs-registry
```

---

## Summary

**Total tasks:** 19
**Estimated time:** 8-12 hours

**Key deliverables:**
1. shadcn/ui foundation with dark theme
2. New Sidebar, TopBar, MainLayout components
3. CommandPalette (Cmd+K) navigation
4. Rebuilt /quotes page with all functionality
5. ag-Grid custom dark theme
6. Reusable components (StatCard, StatusBadge, PageHeader)

**Files created/modified:**
- ~15 new component files
- ~5 modified configuration files
- 1 new CSS theme file

---

Plan complete and saved to `docs/plans/2025-12-06-frontend-redesign-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Manual Execution** - You follow the plan step by step, I assist as needed

Which approach?
