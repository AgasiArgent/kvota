'use client';

import { useState, useEffect } from 'react';
import { config } from '@/lib/config';
import { Table, Button, Modal, Form, Input, Checkbox, message, Space, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Contact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  position?: string;
  is_primary: boolean;
  notes?: string;
}

export default function CustomerContactsPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form] = Form.useForm();

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        message.error('Не авторизован');
        return;
      }

      const response = await fetch(`${config.apiUrl}/api/customers/${customerId}/contacts`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки контактов');
      }

      const data = await response.json();
      setContacts(data.contacts);
    } catch (error) {
      message.error('Не удалось загрузить контакты');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [customerId]);

  const handleSave = async (values: any) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        message.error('Не авторизован');
        return;
      }

      const url = editingContact
        ? `${config.apiUrl}/api/customers/${customerId}/contacts/${editingContact.id}`
        : `${config.apiUrl}/api/customers/${customerId}/contacts`;

      const method = editingContact ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Ошибка сохранения');
      }

      message.success(editingContact ? 'Контакт обновлен' : 'Контакт создан');
      setModalOpen(false);
      form.resetFields();
      setEditingContact(null);
      fetchContacts();
    } catch (error) {
      message.error('Ошибка сохранения');
      console.error(error);
    }
  };

  const handleDelete = async (contactId: string) => {
    Modal.confirm({
      title: 'Удалить контакт?',
      content: 'Это действие нельзя отменить',
      okText: 'Удалить',
      cancelText: 'Отмена',
      okType: 'danger',
      onOk: async () => {
        try {
          const supabase = createClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            message.error('Не авторизован');
            return;
          }

          const response = await fetch(
            `${config.apiUrl}/api/customers/${customerId}/contacts/${contactId}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            throw new Error('Ошибка удаления');
          }

          message.success('Контакт удален');
          fetchContacts();
        } catch (error) {
          message.error('Ошибка удаления');
          console.error(error);
        }
      },
    });
  };

  const columns = [
    {
      title: 'Имя',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: 'Должность',
      dataIndex: 'position',
      key: 'position',
      width: 150,
    },
    {
      title: 'Основной',
      dataIndex: 'is_primary',
      key: 'is_primary',
      width: 100,
      render: (isPrimary: boolean) => (isPrimary ? '✓' : ''),
    },
    {
      title: 'Примечания',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: Contact) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingContact(record);
              form.setFieldsValue(record);
              setModalOpen(true);
            }}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <div style={{ padding: 24 }}>
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.back()}
              style={{ marginBottom: 16 }}
            >
              Назад
            </Button>
          </div>

          <div
            style={{
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h2 style={{ margin: 0 }}>Контакты клиента</h2>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingContact(null);
                form.resetFields();
                setModalOpen(true);
              }}
            >
              Добавить контакт
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={contacts}
            loading={loading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
          />

          <Modal
            title={editingContact ? 'Редактировать контакт' : 'Новый контакт'}
            open={modalOpen}
            onCancel={() => {
              setModalOpen(false);
              form.resetFields();
              setEditingContact(null);
            }}
            onOk={() => form.submit()}
            okText="Сохранить"
            cancelText="Отмена"
            width={600}
          >
            <Form form={form} layout="vertical" onFinish={handleSave}>
              <Form.Item
                name="name"
                label="Имя"
                rules={[{ required: true, message: 'Введите имя' }]}
              >
                <Input placeholder="Иван Иванов" />
              </Form.Item>

              <Form.Item name="phone" label="Телефон">
                <Input placeholder="+7 (999) 123-45-67" />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Введите корректный email' }]}
              >
                <Input placeholder="ivan@example.com" />
              </Form.Item>

              <Form.Item name="position" label="Должность">
                <Input placeholder="Менеджер по закупкам" />
              </Form.Item>

              <Form.Item name="is_primary" valuePropName="checked">
                <Checkbox>Основной контакт</Checkbox>
              </Form.Item>

              <Form.Item name="notes" label="Примечания">
                <Input.TextArea rows={3} placeholder="Дополнительная информация" />
              </Form.Item>
            </Form>
          </Modal>
        </Card>
      </div>
    </MainLayout>
  );
}
