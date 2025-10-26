'use client';

import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, message, Tooltip } from 'antd';
import { BugOutlined } from '@ant-design/icons';
import { FeedbackService } from '@/lib/api/feedback-service';

const { TextArea } = Input;

export default function FeedbackButton() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Handle scroll to show/hide button
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleScroll = () => {
      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Debounce scroll event
      timeoutId = setTimeout(() => {
        const currentScrollY = window.scrollY;

        if (currentScrollY > lastScrollY && currentScrollY > 100) {
          // Scrolling down - hide button
          setIsScrollingDown(true);
        } else {
          // Scrolling up or near top - show button
          setIsScrollingDown(false);
        }

        setLastScrollY(currentScrollY);
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [lastScrollY]);

  const handleOpenModal = () => {
    setVisible(true);
  };

  const handleCancel = () => {
    setVisible(false);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Auto-capture browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        timestamp: new Date().toISOString(),
      };

      // Auto-capture page URL
      const pageUrl = window.location.href;

      // Submit feedback
      await FeedbackService.submit({
        page_url: pageUrl,
        description: values.description,
        browser_info: browserInfo,
      });

      message.success('Спасибо за обратную связь! Мы рассмотрим вашу заявку.');
      setVisible(false);
      form.resetFields();
    } catch (error) {
      if (error instanceof Error) {
        message.error(`Ошибка: ${error.message}`);
      } else {
        message.error('Не удалось отправить обратную связь');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Tooltip title="Сообщить об ошибке" placement="left">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<BugOutlined />}
          onClick={handleOpenModal}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            width: 56,
            height: 56,
            fontSize: 24,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s ease',
            transform: isScrollingDown ? 'translateY(100px)' : 'translateY(0)',
            opacity: isScrollingDown ? 0 : 1,
          }}
        />
      </Tooltip>

      {/* Feedback Modal */}
      <Modal
        title="Сообщить об ошибке"
        open={visible}
        onCancel={handleCancel}
        onOk={handleSubmit}
        confirmLoading={loading}
        okText="Отправить"
        cancelText="Отмена"
        width={600}
      >
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item
            label="Описание проблемы"
            name="description"
            rules={[
              { required: true, message: 'Пожалуйста, опишите проблему' },
              { min: 10, message: 'Описание должно содержать минимум 10 символов' },
            ]}
            extra="Опишите подробно, что произошло и какое поведение вы ожидали"
          >
            <TextArea
              rows={6}
              placeholder="Например: При создании КП кнопка 'Сохранить' не реагирует на клик..."
              showCount
              maxLength={1000}
            />
          </Form.Item>

          <div style={{ fontSize: 12, color: '#999', marginTop: -8 }}>
            <p style={{ margin: 0 }}>Автоматически будет записана следующая информация:</p>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li>URL текущей страницы</li>
              <li>Информация о браузере</li>
              <li>Разрешение экрана</li>
            </ul>
          </div>
        </Form>
      </Modal>
    </>
  );
}
