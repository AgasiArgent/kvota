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
}

export default function FinancialApprovalActions({
  quoteId,
  quoteNumber,
  onApprove,
  onSendBack,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState<'approve' | 'sendback'>('approve');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleAction = async () => {
    // Validate comments required for send back
    if (action === 'sendback' && !comments.trim()) {
      message.error('Укажите причину возврата');
      return;
    }

    setLoading(true);
    try {
      const token = await getAuthToken();
      const endpoint = action === 'approve' ? 'approve' : 'send-back';
      const response = await fetch(`${config.apiUrl}/api/quotes/${quoteId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comments: comments.trim() || undefined }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Действие не выполнено');
      }

      const result = await response.json();

      message.success(action === 'approve' ? 'КП утверждено!' : 'КП возвращено на доработку');
      setShowModal(false);
      setComments('');

      if (action === 'approve') onApprove();
      else onSendBack();
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

      {/* Send Back Button */}
      <Button
        danger
        icon={<CloseOutlined />}
        onClick={() => {
          setAction('sendback');
          setShowModal(true);
        }}
      >
        Вернуть на доработку
      </Button>

      {/* Action Modal */}
      <Modal
        title={action === 'approve' ? 'Утверждение КП' : 'Возврат на доработку'}
        open={showModal}
        onOk={handleAction}
        onCancel={() => {
          setShowModal(false);
          setComments('');
        }}
        confirmLoading={loading}
        okText={action === 'approve' ? 'Утвердить' : 'Вернуть'}
        cancelText="Отмена"
      >
        <div style={{ marginTop: '16px' }}>
          <Input.TextArea
            placeholder={
              action === 'approve'
                ? 'Комментарий (необязательно)'
                : 'Укажите, что нужно исправить *'
            }
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            required={action === 'sendback'}
            maxLength={500}
            showCount
          />
        </div>
      </Modal>
    </div>
  );
}
