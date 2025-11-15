'use client';

import React, { useState, useEffect } from 'react';
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
          <Text strong style={{ fontSize: '14px' }}>
            {lead.company_name}
          </Text>
        </div>

        {/* Segment */}
        {lead.segment && <Tag style={{ marginBottom: 8, fontSize: '11px' }}>{lead.segment}</Tag>}

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
            <Space size={4}>
              <MailOutlined style={{ color: '#888' }} />
              <Text style={{ fontSize: '11px' }} ellipsis>
                {lead.email}
              </Text>
            </Space>
          )}
          {lead.primary_phone && (
            <Space size={4}>
              <PhoneOutlined style={{ color: '#888' }} />
              <Text style={{ fontSize: '11px' }}>{lead.primary_phone}</Text>
            </Space>
          )}
        </Space>

        {/* Assigned To */}
        {lead.assigned_to_name && (
          <div style={{ marginTop: 8, fontSize: '11px', color: '#888' }}>
            <Avatar size={16} icon={<UserOutlined />} style={{ marginRight: 4 }} />
            {lead.assigned_to_name.split('@')[0]}
          </div>
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
}

function DroppableColumn({ stage, leads, onLeadClick }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const count = leads.length;

  return (
    <div
      ref={setNodeRef}
      style={{
        minWidth: 300,
        maxWidth: 320,
        backgroundColor: isOver ? '#e6f7ff' : '#f5f5f5',
        borderRadius: 8,
        padding: 16,
        maxHeight: 'calc(100vh - 280px)',
        display: 'flex',
        flexDirection: 'column',
        border: isOver ? '2px dashed #1890ff' : 'none',
      }}
    >
      {/* Column Header */}
      <div style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Space>
            <Tag color={stage.color} style={{ margin: 0, borderRadius: 4, fontWeight: 500 }}>
              {stage.name}
            </Tag>
            <Tag>{count}</Tag>
          </Space>
        </Space>
      </div>

      {/* Leads List */}
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
  const [assignedFilter, setAssignedFilter] = useState<string>('');

  useEffect(() => {
    fetchStages();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [searchTerm, assignedFilter]);

  const fetchStages = async () => {
    try {
      const stagesData = await listLeadStages();
      setStages(stagesData);
    } catch (error: any) {
      message.error(`Ошибка загрузки этапов: ${error.message}`);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await listLeads({
        page: 1,
        limit: 100, // Backend max limit
        search: searchTerm || undefined,
        assigned_to: assignedFilter || undefined,
      });
      setLeads(response.data || []);
    } catch (error: any) {
      message.error(`Ошибка загрузки лидов: ${error.message}`);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

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
              onChange={(e) => setSearchTerm(e.target.value)}
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
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </MainLayout>
  );
}
