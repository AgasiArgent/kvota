'use client';

import { Button, Modal, Input, message, Space, App } from 'antd';
import { CheckOutlined, CloseOutlined, DownloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { config } from '@/lib/config';

interface Props {
  quoteId: string;
  quoteNumber: string;
  onApprove?: () => void;
  onSendBack?: () => void;
}

export default function FinancialApprovalActions({
  quoteId,
  quoteNumber,
  onApprove,
  onSendBack,
}: Props) {
  const { modal } = App.useApp();
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState<'approve' | 'sendback'>('approve');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownloadExcel = async () => {
    try {
      const token = localStorage.getItem('supabase_token');
      if (!token) {
        message.error('Необходима авторизация');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/quotes/${quoteId}/financial-review`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла');
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Financial_Review_${quoteNumber}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      message.success('Файл загружен');
    } catch (error) {
      console.error('Download error:', error);
      message.error('Не удалось загрузить Excel файл');
    }
  };

  const handleAction = async () => {
    // Validate comments for send back
    if (action === 'sendback' && !comments.trim()) {
      message.error('Укажите причину возврата');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('supabase_token');
      if (!token) {
        message.error('Необходима авторизация');
        return;
      }

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Ошибка выполнения операции');
      }

      const result = await response.json();

      // Success
      if (action === 'approve') {
        message.success('КП одобрено финансовым менеджером');
        onApprove?.();
      } else {
        message.success('КП возвращено на доработку');
        onSendBack?.();
      }

      setShowModal(false);
      setComments('');
    } catch (error) {
      console.error('Action error:', error);
      message.error(error instanceof Error ? error.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const openApproveModal = () => {
    setAction('approve');
    setComments('');
    setShowModal(true);
  };

  const openSendBackModal = () => {
    setAction('sendback');
    setComments('');
    setShowModal(true);
  };

  return (
    <>
      <Space size="middle">
        <Button icon={<DownloadOutlined />} onClick={handleDownloadExcel} size="large">
          Скачать Финансовый Анализ
        </Button>

        <Button type="primary" icon={<CheckOutlined />} onClick={openApproveModal} size="large">
          Одобрить
        </Button>

        <Button danger icon={<CloseOutlined />} onClick={openSendBackModal} size="large">
          Вернуть на доработку
        </Button>
      </Space>

      <Modal
        title={action === 'approve' ? 'Одобрить КП' : 'Вернуть КП на доработку'}
        open={showModal}
        onOk={handleAction}
        onCancel={() => {
          setShowModal(false);
          setComments('');
        }}
        confirmLoading={loading}
        okText={action === 'approve' ? 'Одобрить' : 'Вернуть'}
        cancelText="Отмена"
        width={600}
      >
        <div style={{ marginTop: 16 }}>
          <Input.TextArea
            placeholder={
              action === 'approve'
                ? 'Комментарии (необязательно)'
                : 'Укажите что нужно исправить (обязательно)'
            }
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            maxLength={500}
            showCount
          />
          {action === 'approve' && (
            <p style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
              После одобрения КП перейдет в статус &ldquo;Одобрено&rdquo;
            </p>
          )}
          {action === 'sendback' && (
            <p style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>
              КП вернется в статус &ldquo;Черновик&rdquo; для исправления
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
