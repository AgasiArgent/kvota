'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Typography,
  message,
  Tooltip,
  Avatar,
  Empty,
  Select,
  Input,
  Spin,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  TeamOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core';
import MainLayout from '@/components/layout/MainLayout';
import { listLeads, changeLeadStage, type LeadWithDetails } from '@/lib/api/lead-service';
import { listLeadStages, type LeadStage } from '@/lib/api/lead-stage-service';
import { createCalendarMeeting } from '@/lib/api/calendar-service';

const { Title, Text } = Typography;

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
        hoverable
        size="small"
        style={{
          marginBottom: 12,
          borderRadius: 8,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onClick={() => !isDragging && onLeadClick(lead.id)}
        bodyStyle={{ padding: '12px' }}
      >
        {/* Company Name */}
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ fontSize: '14px', wordBreak: 'break-word', lineHeight: '1.3' }}>
            {lead.company_name}
          </Text>
        </div>

        {/* Segment */}
        {lead.segment && (
          <Tag
            style={{
              marginBottom: 8,
              fontSize: '11px',
              whiteSpace: 'normal',
              height: 'auto',
              lineHeight: '1.4',
              padding: '2px 8px',
            }}
          >
            {lead.segment}
          </Tag>
        )}

        {/* Primary Contact */}
        {primaryContact && (
          <div style={{ marginBottom: 8, fontSize: '12px', color: '#666' }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {primaryContact.full_name}
            {primaryContact.position && ` • ${primaryContact.position}`}
          </div>
        )}

        {/* Contact Info */}
        <Space direction="vertical" size={2} style={{ width: '100%', fontSize: '11px' }}>
          {lead.email && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <MailOutlined style={{ color: '#888', marginTop: '2px', flexShrink: 0 }} />
              <Text style={{ fontSize: '11px', wordBreak: 'break-word', lineHeight: '1.4' }}>
                {lead.email}
              </Text>
            </div>
          )}
          {lead.primary_phone && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
              <PhoneOutlined style={{ color: '#888', marginTop: '2px', flexShrink: 0 }} />
              <Text style={{ fontSize: '11px', wordBreak: 'break-word', lineHeight: '1.4' }}>
                {lead.primary_phone}
              </Text>
            </div>
          )}
        </Space>

        {/* Assigned To */}
        {lead.assigned_to_name && (
          <div style={{ marginTop: 8, fontSize: '11px', color: '#888' }}>
            <Avatar size={16} icon={<UserOutlined />} style={{ marginRight: 4 }} />
            {lead.assigned_to_name.split('@')[0]}
          </div>
        )}

        {/* Meeting Date */}
        {(lead as any).meeting_scheduled_at && (
          <div style={{ marginTop: 8, fontSize: '11px', color: '#ff7a00', fontWeight: 500 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {new Date((lead as any).meeting_scheduled_at).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}

        {/* Google Calendar Link */}
        {lead.google_calendar_link && (
          <div style={{ marginTop: 8 }}>
            <a
              href={lead.google_calendar_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-muted-foreground"
            >
              <LinkOutlined style={{ marginRight: 4 }} />
              Google Meet
            </a>
          </div>
        )}

        {/* Create Meeting Button */}
        {(lead as any).meeting_scheduled_at && !lead.google_event_id && (
          <Button
            type="link"
            size="small"
            icon={<CalendarOutlined />}
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const result = await createCalendarMeeting(lead.id, {
                  meeting_time: (lead as any).meeting_scheduled_at,
                  duration_minutes: 30,
                });
                if (result.success) {
                  message.success('Встреча создается в Google Calendar...');
                } else {
                  message.error(result.error || 'Ошибка создания встречи');
                }
              } catch (error: any) {
                message.error(error.message);
              }
            }}
            style={{ padding: 0, marginTop: 8, fontSize: '11px', height: 'auto' }}
          >
            Создать встречу
          </Button>
        )}
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
      style={{
        flex: collapsed ? '0 0 60px' : 1,
        minWidth: collapsed ? 60 : 0,
        backgroundColor: isOver ? 'hsl(38 92% 50% / 0.12)' : '#f5f5f5',
        borderRadius: 8,
        padding: collapsed ? 8 : 16,
        maxHeight: 'calc(100vh - 280px)',
        display: 'flex',
        flexDirection: 'column',
        border: isOver ? '2px dashed #f59e0b' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Column Header */}
      <div
        style={{ marginBottom: collapsed ? 0 : 16, cursor: 'pointer' }}
        onClick={onToggleCollapse}
      >
        {collapsed ? (
          <div style={{ writingMode: 'vertical-rl', textAlign: 'center' }}>
            <Tag color={stage.color} style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>
              {stage.name.slice(0, 3)}
            </Tag>
            <div style={{ marginTop: 8, fontSize: '12px' }}>{count}</div>
          </div>
        ) : (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              <Tag color={stage.color} style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>
                {stage.name}
              </Tag>
              <Tag>{count}</Tag>
            </Space>
          </Space>
        )}
      </div>

      {/* Leads List */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {leads.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Нет лидов"
              style={{ marginTop: 40 }}
            />
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
  const [assignedFilter, setAssignedFilter] = useState<string>('');
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
        message.error(`Ошибка загрузки: ${error.message}`);
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
        assigned_to: assignedFilter || undefined,
      });
      setLeads(response.data || []);
    } catch (error: any) {
      message.error(`Ошибка загрузки лидов: ${error.message}`);
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
      message.success('Лид перемещен');
    } catch (error: any) {
      message.error(`Ошибка перемещения: ${error.message}`);
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
      <div style={{ padding: '24px' }}>
        {/* Header */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={2}>Воронка продаж</Title>
          </Col>
          <Col>
            <Space>
              <Button type="default" onClick={() => router.push('/leads')}>
                Таблица
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => router.push('/leads/create')}
              >
                Создать лид
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Filters */}
        <Card style={{ marginBottom: 16 }}>
          <Space size="middle">
            <Input
              placeholder="Поиск..."
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 250 }}
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <Select
              placeholder="Ответственный"
              allowClear
              style={{ width: 200 }}
              value={assignedFilter || undefined}
              onChange={(value) => setAssignedFilter(value || '')}
            >
              <Select.Option value="me">Мои лиды</Select.Option>
              <Select.Option value="unassigned">Не назначены</Select.Option>
            </Select>
          </Space>
        </Card>

        {/* Kanban Board */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" tip="Загрузка воронки..." />
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div
              style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                paddingBottom: 16,
              }}
            >
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
