"""
Email Service for Russian B2B Quotation System
Handles transactional emails using Resend with Russian business context
"""
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

import resend
from jinja2 import Environment, DictLoader


class QuoteEmailService:
    """
    Professional email service for Russian B2B quote notifications
    Uses Resend for reliable transactional email delivery
    """

    def __init__(self):
        """Initialize email service with Resend API key"""
        self.api_key = os.getenv("RESEND_API_KEY")
        self.from_email = os.getenv("FROM_EMAIL", "quotes@yourcompany.ru")
        self.company_name = os.getenv("COMPANY_NAME", "Ваша Компания")

        if self.api_key:
            resend.api_key = self.api_key

        # Setup Jinja2 for email templates
        self.jinja_env = Environment(loader=DictLoader(self._get_email_templates()))
        self._register_filters()

    def _register_filters(self):
        """Register custom filters for email templates"""

        def ru_date(date_obj):
            """Format date in Russian"""
            if not date_obj:
                return ""

            months = [
                "января", "февраля", "марта", "апреля", "мая", "июня",
                "июля", "августа", "сентября", "октября", "ноября", "декабря"
            ]

            return f"{date_obj.day} {months[date_obj.month - 1]} {date_obj.year} г."

        def ru_currency(amount):
            """Format amount in Russian Rubles"""
            if amount is None:
                return "0,00 ₽"

            formatted = f"{amount:,.2f}".replace(",", " ")
            return f"{formatted} ₽"

        # Register filters
        self.jinja_env.filters['ru_date'] = ru_date
        self.jinja_env.filters['ru_currency'] = ru_currency

    def _get_email_templates(self) -> Dict[str, str]:
        """Get email template definitions"""
        return {
            # Quote approval request template
            'approval_request': '''
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Запрос на согласование коммерческого предложения</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: #2c5aa0; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; }
        .quote-details { background-color: white; padding: 20px; border-left: 4px solid #2c5aa0; margin: 20px 0; }
        .button { display: inline-block; background-color: #2c5aa0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
        .button.approve { background-color: #28a745; }
        .button.reject { background-color: #dc3545; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .urgent { background-color: #fff3cd; border-color: #ffc107; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ company_name }}</h1>
            <h2>Запрос на согласование</h2>
        </div>

        <div class="content">
            <p>Уважаемый {{ approver_name }},</p>

            <p>Поступил запрос на согласование коммерческого предложения от менеджера <strong>{{ manager_name }}</strong>.</p>

            <div class="quote-details{% if quote.priority == 'urgent' %} urgent{% endif %}">
                <h3>Детали коммерческого предложения</h3>
                <p><strong>Номер КП:</strong> {{ quote.idn_quote }}</p>
                <p><strong>Клиент:</strong> {{ quote.customer_name }}</p>
                {% if quote.customer_inn %}<p><strong>ИНН клиента:</strong> {{ quote.customer_inn }}</p>{% endif %}
                <p><strong>Общая сумма:</strong> {{ quote.total_amount | ru_currency }}</p>
                <p><strong>Валюта:</strong> {{ quote.currency }}</p>
                <p><strong>Дата создания:</strong> {{ quote.created_at | ru_date }}</p>
                {% if quote.valid_until %}<p><strong>Действительно до:</strong> {{ quote.valid_until | ru_date }}</p>{% endif %}
                {% if quote.description %}<p><strong>Описание:</strong> {{ quote.description }}</p>{% endif %}
            </div>

            {% if quote.items_count %}
            <p><strong>Количество позиций:</strong> {{ quote.items_count }}</p>
            {% endif %}

            {% if approval_deadline %}
            <div class="urgent">
                <p><strong>⚠️ Требуется согласование до:</strong> {{ approval_deadline | ru_date }}</p>
            </div>
            {% endif %}

            <div style="text-align: center; margin: 30px 0;">
                {% if approval_url %}
                <a href="{{ approval_url }}?action=approve" class="button approve">✅ Согласовать</a>
                <a href="{{ approval_url }}?action=reject" class="button reject">❌ Отклонить</a>
                <a href="{{ quote_url }}" class="button">👁️ Просмотреть детали</a>
                {% else %}
                <a href="{{ quote_url }}" class="button">Просмотреть и согласовать</a>
                {% endif %}
            </div>

            <p>Если у вас есть вопросы, обратитесь к менеджеру {{ manager_name }} по email: {{ manager_email }}.</p>

            <p>С уважением,<br>Система управления коммерческими предложениями</p>
        </div>

        <div class="footer">
            <p>{{ company_name }} | Автоматическое уведомление</p>
            <p>Не отвечайте на это письмо. Для вопросов обращайтесь к менеджеру.</p>
        </div>
    </div>
</body>
</html>
            ''',

            # Quote approved notification
            'quote_approved': '''
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Коммерческое предложение согласовано</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; }
        .quote-details { background-color: white; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0; }
        .button { display: inline-block; background-color: #2c5aa0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .success { background-color: #d4edda; border-color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Коммерческое предложение согласовано</h1>
        </div>

        <div class="content">
            <p>Уважаемый {{ manager_name }},</p>

            <div class="success quote-details">
                <p>Ваше коммерческое предложение <strong>{{ quote.idn_quote }}</strong> успешно согласовано!</p>

                <p><strong>Согласовал:</strong> {{ approver_name }}</p>
                <p><strong>Дата согласования:</strong> {{ approval_date | ru_date }}</p>
                {% if approval_comment %}
                <p><strong>Комментарий:</strong> {{ approval_comment }}</p>
                {% endif %}
            </div>

            <div class="quote-details">
                <h3>Детали КП</h3>
                <p><strong>Клиент:</strong> {{ quote.customer_name }}</p>
                <p><strong>Сумма:</strong> {{ quote.total_amount | ru_currency }}</p>
                <p><strong>Статус:</strong> Готово к отправке клиенту</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ quote_url }}" class="button">Просмотреть КП</a>
                {% if send_to_customer_url %}
                <a href="{{ send_to_customer_url }}" class="button" style="background-color: #28a745;">Отправить клиенту</a>
                {% endif %}
            </div>

            <p>Теперь вы можете отправить коммерческое предложение клиенту.</p>

            <p>С уважением,<br>Система управления коммерческими предложениями</p>
        </div>

        <div class="footer">
            <p>{{ company_name }} | Автоматическое уведомление</p>
        </div>
    </div>
</body>
</html>
            ''',

            # Quote rejected notification
            'quote_rejected': '''
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Коммерческое предложение отклонено</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; }
        .quote-details { background-color: white; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0; }
        .button { display: inline-block; background-color: #2c5aa0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background-color: #f8d7da; border-color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ Коммерческое предложение отклонено</h1>
        </div>

        <div class="content">
            <p>Уважаемый {{ manager_name }},</p>

            <div class="warning quote-details">
                <p>Ваше коммерческое предложение <strong>{{ quote.idn_quote }}</strong> отклонено.</p>

                <p><strong>Отклонил:</strong> {{ approver_name }}</p>
                <p><strong>Дата отклонения:</strong> {{ rejection_date | ru_date }}</p>
                {% if rejection_reason %}
                <p><strong>Причина отклонения:</strong></p>
                <p>{{ rejection_reason }}</p>
                {% endif %}
            </div>

            <div class="quote-details">
                <h3>Детали КП</h3>
                <p><strong>Клиент:</strong> {{ quote.customer_name }}</p>
                <p><strong>Сумма:</strong> {{ quote.total_amount | ru_currency }}</p>
                <p><strong>Статус:</strong> Требует доработки</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ quote_url }}" class="button">Просмотреть и исправить КП</a>
            </div>

            <p>Внесите необходимые изменения и отправьте коммерческое предложение на повторное согласование.</p>

            <p>С уважением,<br>Система управления коммерческими предложениями</p>
        </div>

        <div class="footer">
            <p>{{ company_name }} | Автоматическое уведомление</p>
        </div>
    </div>
</body>
</html>
            ''',

            # Quote sent to customer
            'quote_sent_to_customer': '''
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Коммерческое предложение {{ quote.idn_quote }}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: #2c5aa0; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; }
        .quote-details { background-color: white; padding: 20px; border-left: 4px solid #2c5aa0; margin: 20px 0; }
        .button { display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ company_name }}</h1>
            <h2>Коммерческое предложение № {{ quote.idn_quote }}</h2>
        </div>

        <div class="content">
            <p>Уважаемые коллеги,</p>

            <p>Направляем Вам коммерческое предложение по запрошенным товарам/услугам.</p>

            <div class="quote-details">
                <h3>Детали предложения</h3>
                <p><strong>Номер КП:</strong> {{ quote.idn_quote }}</p>
                <p><strong>Дата:</strong> {{ quote.created_at | ru_date }}</p>
                {% if quote.valid_until %}<p><strong>Действительно до:</strong> {{ quote.valid_until | ru_date }}</p>{% endif %}
                <p><strong>Общая сумма:</strong> {{ quote.total_amount | ru_currency }}</p>
                <p><strong>Валюта:</strong> {{ quote.currency }}</p>
                {% if quote.payment_terms %}<p><strong>Условия оплаты:</strong> {{ quote.payment_terms }} дней</p>{% endif %}
                {% if quote.delivery_terms %}<p><strong>Условия поставки:</strong> {{ quote.delivery_terms }}</p>{% endif %}
            </div>

            {% if quote.description %}
            <div class="quote-details">
                <h3>Описание</h3>
                <p>{{ quote.description }}</p>
            </div>
            {% endif %}

            {% if quote_pdf_url %}
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ quote_pdf_url }}" class="button">📄 Скачать PDF</a>
                {% if quote_review_url %}
                <a href="{{ quote_review_url }}" class="button">👁️ Просмотреть онлайн</a>
                {% endif %}
            </div>
            {% endif %}

            <p>Для принятия решения по данному коммерческому предложению, пожалуйста, свяжитесь с нашим менеджером:</p>

            <div class="quote-details">
                <h3>Контактная информация</h3>
                <p><strong>Менеджер:</strong> {{ manager_name }}</p>
                <p><strong>Email:</strong> {{ manager_email }}</p>
                {% if manager_phone %}<p><strong>Телефон:</strong> {{ manager_phone }}</p>{% endif %}
            </div>

            <p>Благодарим за интерес к нашей компании и будем рады сотрудничеству!</p>

            <p>С уважением,<br>{{ company_name }}</p>
        </div>

        <div class="footer">
            <p>{{ company_name }}</p>
            {% if company_address %}<p>{{ company_address }}</p>{% endif %}
            {% if company_phone %}<p>Тел: {{ company_phone }}</p>{% endif %}
            {% if company_email %}<p>Email: {{ company_email }}</p>{% endif %}
        </div>
    </div>
</body>
</html>
            '''
        }

    async def send_approval_request(
        self,
        approver_email: str,
        approver_name: str,
        manager_name: str,
        manager_email: str,
        quote_data: Dict[str, Any],
        quote_url: str,
        approval_url: Optional[str] = None,
        approval_deadline: Optional[datetime] = None
    ) -> bool:
        """
        Send approval request email to manager

        Args:
            approver_email: Email of person who needs to approve
            approver_name: Name of approver
            manager_name: Name of quote creator
            manager_email: Email of quote creator
            quote_data: Quote information
            quote_url: URL to view quote
            approval_url: Direct approval URL (optional)
            approval_deadline: Deadline for approval

        Returns:
            bool: True if email sent successfully
        """
        try:
            if not self.api_key:
                print("Warning: RESEND_API_KEY not configured. Email not sent.")
                return False

            template = self.jinja_env.get_template('approval_request')

            html_content = template.render(
                company_name=self.company_name,
                approver_name=approver_name,
                manager_name=manager_name,
                manager_email=manager_email,
                quote=quote_data,
                quote_url=quote_url,
                approval_url=approval_url,
                approval_deadline=approval_deadline
            )

            params = {
                "from": self.from_email,
                "to": [approver_email],
                "subject": f"Согласование КП {quote_data.get('idn_quote')} от {quote_data.get('customer_name')}",
                "html": html_content
            }

            email = resend.Emails.send(params)
            print(f"Approval request email sent to {approver_email}: {email}")
            return True

        except Exception as e:
            print(f"Failed to send approval request email: {str(e)}")
            return False

    async def send_approval_notification(
        self,
        manager_email: str,
        manager_name: str,
        approver_name: str,
        quote_data: Dict[str, Any],
        quote_url: str,
        approval_comment: Optional[str] = None,
        send_to_customer_url: Optional[str] = None
    ) -> bool:
        """Send notification when quote is approved"""
        try:
            if not self.api_key:
                print("Warning: RESEND_API_KEY not configured. Email not sent.")
                return False

            template = self.jinja_env.get_template('quote_approved')

            html_content = template.render(
                company_name=self.company_name,
                manager_name=manager_name,
                approver_name=approver_name,
                quote=quote_data,
                quote_url=quote_url,
                approval_date=datetime.now(),
                approval_comment=approval_comment,
                send_to_customer_url=send_to_customer_url
            )

            params = {
                "from": self.from_email,
                "to": [manager_email],
                "subject": f"✅ КП {quote_data.get('idn_quote')} согласовано",
                "html": html_content
            }

            email = resend.Emails.send(params)
            print(f"Approval notification sent to {manager_email}: {email}")
            return True

        except Exception as e:
            print(f"Failed to send approval notification: {str(e)}")
            return False

    async def send_rejection_notification(
        self,
        manager_email: str,
        manager_name: str,
        approver_name: str,
        quote_data: Dict[str, Any],
        quote_url: str,
        rejection_reason: Optional[str] = None
    ) -> bool:
        """Send notification when quote is rejected"""
        try:
            if not self.api_key:
                print("Warning: RESEND_API_KEY not configured. Email not sent.")
                return False

            template = self.jinja_env.get_template('quote_rejected')

            html_content = template.render(
                company_name=self.company_name,
                manager_name=manager_name,
                approver_name=approver_name,
                quote=quote_data,
                quote_url=quote_url,
                rejection_date=datetime.now(),
                rejection_reason=rejection_reason
            )

            params = {
                "from": self.from_email,
                "to": [manager_email],
                "subject": f"❌ КП {quote_data.get('idn_quote')} отклонено",
                "html": html_content
            }

            email = resend.Emails.send(params)
            print(f"Rejection notification sent to {manager_email}: {email}")
            return True

        except Exception as e:
            print(f"Failed to send rejection notification: {str(e)}")
            return False

    async def send_quote_to_customer(
        self,
        customer_email: str,
        manager_name: str,
        manager_email: str,
        quote_data: Dict[str, Any],
        quote_pdf_attachment: Optional[bytes] = None,
        quote_pdf_url: Optional[str] = None,
        quote_review_url: Optional[str] = None,
        manager_phone: Optional[str] = None
    ) -> bool:
        """Send quote to customer"""
        try:
            if not self.api_key:
                print("Warning: RESEND_API_KEY not configured. Email not sent.")
                return False

            template = self.jinja_env.get_template('quote_sent_to_customer')

            html_content = template.render(
                company_name=self.company_name,
                quote=quote_data,
                manager_name=manager_name,
                manager_email=manager_email,
                manager_phone=manager_phone,
                quote_pdf_url=quote_pdf_url,
                quote_review_url=quote_review_url,
                company_address=os.getenv("COMPANY_ADDRESS"),
                company_phone=os.getenv("COMPANY_PHONE"),
                company_email=os.getenv("COMPANY_EMAIL")
            )

            params = {
                "from": self.from_email,
                "to": [customer_email],
                "subject": f"Коммерческое предложение {quote_data.get('idn_quote')} от {self.company_name}",
                "html": html_content
            }

            # Add PDF attachment if provided
            if quote_pdf_attachment:
                import base64
                params["attachments"] = [
                    {
                        "filename": f"quote_{quote_data.get('idn_quote')}.pdf",
                        "content": base64.b64encode(quote_pdf_attachment).decode(),
                        "content_type": "application/pdf"
                    }
                ]

            email = resend.Emails.send(params)
            print(f"Quote sent to customer {customer_email}: {email}")
            return True

        except Exception as e:
            print(f"Failed to send quote to customer: {str(e)}")
            return False


# Global email service instance
email_service = QuoteEmailService()