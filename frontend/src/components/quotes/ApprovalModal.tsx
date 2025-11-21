'use client';

import React, { useState } from 'react';
import { Modal, Radio, Input, Space, message } from 'antd';
import { getAuthToken } from '@/lib/auth-utils';
import { config } from '@/lib/config';

const { TextArea } = Input;

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
      message.error('Комментарий обязателен при отклонении или отправке на доработку');
      return;
    }

    setLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        message.error('Не авторизован');
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

      const result = await response.json();

      // Show success message
      if (action === 'approve') {
        message.success('КП успешно утверждено');
      } else if (action === 'reject') {
        message.success('КП отклонено');
      } else {
        message.success('КП отправлено на доработку');
      }

      // Reset and close
      setComment('');
      setAction('approve');
      onSuccess();
      onCancel();
    } catch (error: any) {
      message.error(error.message || 'Ошибка при обработке решения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={`Решение по КП ${quoteNumber}`}
      open={open}
      onOk={handleSubmit}
      onCancel={onCancel}
      okText="Подтвердить"
      cancelText="Отмена"
      confirmLoading={loading}
      width={600}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <div style={{ marginBottom: 8 }}>
            <strong>Выберите действие:</strong>
          </div>
          <Radio.Group value={action} onChange={(e) => setAction(e.target.value)}>
            <Space direction="vertical">
              <Radio value="approve">Утвердить финансово</Radio>
              <Radio value="reject">Отклонить</Radio>
              <Radio value="revision">Отправить на доработку</Radio>
            </Space>
          </Radio.Group>
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>
            <strong>
              Комментарий
              {(action === 'reject' || action === 'revision') && (
                <span style={{ color: 'red' }}> *</span>
              )}
              :
            </strong>
          </div>
          <TextArea
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
            required={action !== 'approve'}
          />
        </div>
      </Space>
    </Modal>
  );
}
