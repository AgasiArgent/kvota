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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150',
          'hover:bg-foreground/5 hover:text-foreground',
          isActive ? 'bg-foreground/5 text-foreground font-medium' : 'text-foreground/60'
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-foreground')} />
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
            <span className="mx-auto text-lg font-bold text-foreground">К</span>
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
              <Separator className="my-4 bg-border/50" />
              {adminNavGroups.map((group, idx) => (
                <div key={idx} className="mb-5">
                  {!collapsed && group.label && (
                    <h4 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/40">
                      {group.label}
                    </h4>
                  )}
                  <div className="space-y-0.5">
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
