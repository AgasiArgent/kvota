'use client';

import { Button, Input, Modal, message } from 'antd';
import { CheckOutlined, CloseOutlined, DownloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { config } from '@/lib/config';
import { getAuthToken } from '@/lib/auth/auth-helper';

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
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState<'approve' | 'sendback' | 'reject'>('approve');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleAction = async () => {
    // Validate comments required for send back and reject
    if ((action === 'sendback' || action === 'reject') && !comments.trim()) {
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
          'Content-Type': 'text/plain',
          Authorization: `Bearer ${token}`,
        },
        body: comments.trim() || '',
      });

      console.log('[FinancialApproval] Response status:', response.status, response.ok);

      if (!response.ok) {
        const error = await response.json();
        console.error('[FinancialApproval] Error response:', error);
        throw new Error(error.message || error.detail || 'Действие не выполнено');
      }

      const result = await response.json();
      console.log('[FinancialApproval] Success response:', result);

      let successMessage = '';
      if (action === 'approve') {
        successMessage = 'КП финансово утверждено!';
      } else if (action === 'reject') {
        successMessage = 'КП отклонено';
      } else {
        successMessage = 'КП отправлено на доработку';
      }

      message.success(successMessage);
      setShowModal(false);
      setComments('');

      if (action === 'approve') onApprove();
      else if (action === 'reject' && onReject) onReject();
      else onSendBack();
    } catch (error) {
      console.error('[FinancialApproval] Caught error:', error);
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
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {/* Download Financial Review Button */}
      <Button icon={<DownloadOutlined />} onClick={handleDownloadExcel} loading={downloading}>
        Скачать финансовый анализ
      </Button>

      {/* Approve Button */}
      <Button
        type="primary"
        icon={<CheckOutlined />}
        onClick={() => {
          setAction('approve');
          setShowModal(true);
        }}
      >
        Утвердить
      </Button>

      {/* Reject Button */}
      <Button
        danger
        icon={<CloseOutlined />}
        onClick={() => {
          setAction('reject');
          setShowModal(true);
        }}
      >
        Отклонить
      </Button>

      {/* Send Back Button */}
      <Button
        icon={<CloseOutlined />}
        onClick={() => {
          setAction('sendback');
          setShowModal(true);
        }}
      >
        На доработку
      </Button>

      {/* Action Modal */}
      <Modal
        title={
          action === 'approve'
            ? 'Утверждение КП'
            : action === 'reject'
              ? 'Отклонение КП'
              : 'Возврат на доработку'
        }
        open={showModal}
        onOk={handleAction}
        onCancel={() => {
          setShowModal(false);
          setComments('');
        }}
        confirmLoading={loading}
        okText={action === 'approve' ? 'Утвердить' : action === 'reject' ? 'Отклонить' : 'Вернуть'}
        cancelText="Отмена"
      >
        <div style={{ marginTop: '16px' }}>
          <Input.TextArea
            placeholder={
              action === 'approve'
                ? 'Комментарий (необязательно)'
                : action === 'reject'
                  ? 'Укажите причину отклонения *'
                  : 'Укажите, что нужно исправить *'
            }
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            required={action === 'sendback' || action === 'reject'}
            maxLength={500}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
}
