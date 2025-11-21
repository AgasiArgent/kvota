'use client';

import { Button, message, Popconfirm, Input, Space } from 'antd';
import { CheckOutlined, CloseOutlined, DownloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';

const { TextArea } = Input;

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
  const [rejectComment, setRejectComment] = useState('');
  const [sendBackComment, setSendBackComment] = useState('');

  const handleAction = async (action: 'approve' | 'sendback' | 'reject', comments?: string) => {
    // Validate comments for reject and send back
    if ((action === 'sendback' || action === 'reject') && !comments?.trim()) {
      message.error(
        action === 'reject' ? 'Укажите причину отклонения' : 'Укажите причину возврата'
      );
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
          'Content-Type': action === 'sendback' ? 'text/plain' : 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body:
          action === 'sendback'
            ? comments?.trim() || ''
            : JSON.stringify({ comments: comments?.trim() || '' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.detail || 'Действие не выполнено');
      }

      const result = await response.json();

      let successMessage = '';
      if (action === 'approve') {
        successMessage = 'КП финансово утверждено!';
      } else if (action === 'reject') {
        successMessage = 'КП отклонено';
      } else {
        successMessage = 'КП отправлено на доработку';
      }

      message.success(successMessage);

      // Clear comments
      setRejectComment('');
      setSendBackComment('');

      // Call appropriate callback
      if (action === 'approve') onApprove();
      else if (action === 'reject' && onReject) onReject();
      else if (action === 'sendback') onSendBack();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка выполнения действия');
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

      message.success('Файл успешно скачан');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Ошибка скачивания файла');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Download Financial Review Button */}
      <Button icon={<DownloadOutlined />} onClick={handleDownloadExcel} loading={downloading}>
        Скачать финансовый анализ
      </Button>

      {/* Approve Button - Simple confirmation */}
      <Popconfirm
        title="Утверждение КП"
        description={`Утвердить КП ${quoteNumber}?`}
        onConfirm={() => handleAction('approve')}
        okText="Утвердить"
        cancelText="Отмена"
        okButtonProps={{ loading }}
      >
        <Button type="primary" icon={<CheckOutlined />}>
          Утвердить
        </Button>
      </Popconfirm>

      {/* Reject Button - With comment input */}
      <Popconfirm
        title="Отклонение КП"
        description={
          <Space direction="vertical" style={{ width: '100%' }}>
            <span>Укажите причину отклонения КП {quoteNumber}:</span>
            <TextArea
              placeholder="Причина отклонения (обязательно)"
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </Space>
        }
        onConfirm={() => handleAction('reject', rejectComment)}
        onCancel={() => setRejectComment('')}
        okText="Отклонить"
        cancelText="Отмена"
        okButtonProps={{ loading, danger: true }}
        icon={<CloseOutlined style={{ color: 'red' }} />}
      >
        <Button danger icon={<CloseOutlined />}>
          Отклонить
        </Button>
      </Popconfirm>

      {/* Send Back Button - With comment input */}
      <Popconfirm
        title="Возврат на доработку"
        description={
          <Space direction="vertical" style={{ width: '100%' }}>
            <span>Укажите, что нужно исправить в КП {quoteNumber}:</span>
            <TextArea
              placeholder="Что нужно исправить (обязательно)"
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </Space>
        }
        onConfirm={() => handleAction('sendback', sendBackComment)}
        onCancel={() => setSendBackComment('')}
        okText="Вернуть"
        cancelText="Отмена"
        okButtonProps={{ loading }}
        icon={<CloseOutlined style={{ color: 'orange' }} />}
      >
        <Button icon={<CloseOutlined />}>На доработку</Button>
      </Popconfirm>
    </div>
  );
}
