'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, DragEndEvent, useDraggable, useDroppable, closestCenter } from '@dnd-kit/core';
import {
  Plus,
  User,
  Phone,
  Mail,
  Search,
  Clock,
  Calendar,
  Link as LinkIcon,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listLeads, changeLeadStage, type LeadWithDetails } from '@/lib/api/lead-service';
import { listLeadStages, type LeadStage } from '@/lib/api/lead-stage-service';
import { createCalendarMeeting } from '@/lib/api/calendar-service';
import { cn } from '@/lib/utils';

/**
 * Draggable Lead Card Component
 */
interface LeadCardProps {
  lead: LeadWithDetails;
  onLeadClick: (leadId: string) => void;
}

function DraggableLeadCard({ lead, onLeadClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const primaryContact = lead.contacts?.find((c) => c.is_primary) || lead.contacts?.[0];

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className={cn(
          'mb-3 rounded-lg hover:shadow-md transition-shadow',
          isDragging ? 'cursor-grabbing opacity-50' : 'cursor-grab'
        )}
        onClick={() => !isDragging && onLeadClick(lead.id)}
      >
        <CardContent className="p-3 space-y-2">
          {/* Company Name */}
          <div className="font-semibold text-sm break-words leading-tight">{lead.company_name}</div>

          {/* Segment */}
          {lead.segment && (
            <Badge variant="secondary" className="text-xs whitespace-normal h-auto">
              {lead.segment}
            </Badge>
          )}

          {/* Primary Contact */}
          {primaryContact && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3 shrink-0" />
              <span>
                {primaryContact.full_name}
                {primaryContact.position && ` • ${primaryContact.position}`}
              </span>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-1">
            {lead.email && (
              <div className="flex items-start gap-1 text-xs">
                <Mail className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                <span className="break-words text-muted-foreground">{lead.email}</span>
              </div>
            )}
            {lead.primary_phone && (
              <div className="flex items-start gap-1 text-xs">
                <Phone className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                <span className="break-words text-muted-foreground">{lead.primary_phone}</span>
              </div>
            )}
          </div>

          {/* Assigned To */}
          {lead.assigned_to_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-3 w-3" />
              </div>
              <span>{lead.assigned_to_name.split('@')[0]}</span>
            </div>
          )}

          {/* Meeting Date */}
          {(lead as any).meeting_scheduled_at && (
            <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-500 font-medium">
              <Clock className="h-3 w-3 shrink-0" />
              <span>
                {new Date((lead as any).meeting_scheduled_at).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}

          {/* Google Calendar Link */}
          {lead.google_calendar_link && (
            <div>
              <a
                href={lead.google_calendar_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <LinkIcon className="h-3 w-3" />
                <span>Google Meet</span>
              </a>
            </div>
          )}

          {/* Create Meeting Button */}
          {(lead as any).meeting_scheduled_at && !lead.google_event_id && (
            <Button
              variant="link"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const result = await createCalendarMeeting(lead.id, {
                    meeting_time: (lead as any).meeting_scheduled_at,
                    duration_minutes: 30,
                  });
                  if (result.success) {
                    toast.success('Встреча создается в Google Calendar...');
                  } else {
                    toast.error(result.error || 'Ошибка создания встречи');
                  }
                } catch (error: any) {
                  toast.error(error.message);
                }
              }}
              className="h-auto p-0 text-xs mt-2"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Создать встречу
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Droppable Pipeline Column Component
 */
interface PipelineColumnProps {
  stage: LeadStage;
  leads: LeadWithDetails[];
  onLeadClick: (leadId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function DroppableColumn({
  stage,
  leads,
  onLeadClick,
  collapsed,
  onToggleCollapse,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const count = leads.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-lg transition-all duration-300',
        collapsed ? 'flex-[0_0_60px] min-w-[60px] p-2' : 'flex-1 p-4',
        isOver
          ? 'bg-amber-50/50 dark:bg-amber-950/20 border-2 border-dashed border-amber-500'
          : 'bg-muted/50 border-0'
      )}
      style={{
        maxHeight: 'calc(100vh - 280px)',
      }}
    >
      {/* Column Header */}
      <div className={cn('cursor-pointer', !collapsed && 'mb-4')} onClick={onToggleCollapse}>
        {collapsed ? (
          <div className="flex flex-col items-center" style={{ writingMode: 'vertical-rl' }}>
            <Badge className="m-0 rounded font-medium" style={{ backgroundColor: stage.color }}>
              {stage.name.slice(0, 3)}
            </Badge>
            <div className="mt-2 text-xs">{count}</div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="m-0 rounded font-medium" style={{ backgroundColor: stage.color }}>
                {stage.name}
              </Badge>
              <Badge variant="secondary">{count}</Badge>
            </div>
          </div>
        )}
      </div>

      {/* Leads List */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center pt-10">
              <p className="text-sm text-muted-foreground">Нет лидов</p>
            </div>
          ) : (
            leads.map((lead) => (
              <DraggableLeadCard key={lead.id} lead={lead} onLeadClick={onLeadClick} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main Pipeline Page
 */
export default function LeadsPipelinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadWithDetails[]>([]);
  const [stages, setStages] = useState<LeadStage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Debounce search input handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value); // Update input immediately for UX

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout to trigger API call after 500ms
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(value);
    }, 500);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Fetch stages and initial leads in parallel on mount
    const init = async () => {
      setLoading(true);
      try {
        const [stagesData, leadsResponse] = await Promise.all([
          listLeadStages(),
          listLeads({
            page: 1,
            limit: 100,
          }),
        ]);

        setStages(stagesData);
        setLeads(leadsResponse.data || []);
      } catch (error: any) {
        toast.error(`Ошибка загрузки: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listLeads({
        page: 1,
        limit: 100, // Backend max limit
        search: debouncedSearchTerm || undefined, // Use debounced value
        assigned_to: assignedFilter && assignedFilter !== 'all' ? assignedFilter : undefined,
      });
      setLeads(response.data || []);
    } catch (error: any) {
      toast.error(`Ошибка загрузки лидов: ${error.message}`);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, assignedFilter]);

  useEffect(() => {
    // Re-fetch leads when filters change (stages already loaded)
    if (stages.length > 0) {
      fetchLeads();
    }
  }, [stages.length, fetchLeads]); // Include fetchLeads and stages.length

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const leadId = active.id as string;
    const newStageId = over.id as string;

    // Optimistic update
    setLeads((prevLeads) =>
      prevLeads.map((lead) => (lead.id === leadId ? { ...lead, stage_id: newStageId } : lead))
    );

    try {
      await changeLeadStage(leadId, newStageId);
      toast.success('Лид перемещен');
    } catch (error: any) {
      toast.error(`Ошибка перемещения: ${error.message}`);
      fetchLeads(); // Revert on error
    }
  };

  const handleLeadClick = (leadId: string) => {
    router.push(`/leads/${leadId}`);
  };

  const toggleColumnCollapse = (stageId: string) => {
    setCollapsedColumns((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(stageId)) {
        newSet.delete(stageId);
      } else {
        newSet.add(stageId);
      }
      return newSet;
    });
  };

  // Group leads by stage
  const leadsByStage = stages.reduce(
    (acc, stage) => {
      acc[stage.id] = leads.filter((lead) => lead.stage_id === stage.id);
      return acc;
    },
    {} as Record<string, LeadWithDetails[]>
  );

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <PageHeader
          title="Воронка продаж"
          actions={
            <>
              <Button variant="outline" onClick={() => router.push('/leads')}>
                Таблица
              </Button>
              <Button onClick={() => router.push('/leads/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Создать лид
              </Button>
            </>
          }
        />

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <Select value={assignedFilter} onValueChange={setAssignedFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Ответственный" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="me">Мои лиды</SelectItem>
                  <SelectItem value="unassigned">Не назначены</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">Загрузка воронки...</p>
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stages.map((stage) => (
                <DroppableColumn
                  key={stage.id}
                  stage={stage}
                  leads={leadsByStage[stage.id] || []}
                  onLeadClick={handleLeadClick}
                  collapsed={collapsedColumns.has(stage.id)}
                  onToggleCollapse={() => toggleColumnCollapse(stage.id)}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </MainLayout>
  );
}
