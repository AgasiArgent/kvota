"""
Russian B2B Quotation System - Pydantic Models
Models that exactly match the Russian database schema including multi-tenant organization system
"""
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, EmailStr, validator


# ============================================================================
# ENUMS - Russian Business Context
# ============================================================================

class CompanyType(str, Enum):
    """Russian company types"""
    INDIVIDUAL = "individual"  # Физическое лицо
    INDIVIDUAL_ENTREPRENEUR = "individual_entrepreneur"  # ИП
    ORGANIZATION = "organization"  # Организация
    GOVERNMENT = "government"  # Государственная организация


class CustomerStatus(str, Enum):
    """Customer status options"""
    ACTIVE = "active"
    INACTIVE = "inactive" 
    SUSPENDED = "suspended"


class QuoteStatus(str, Enum):
    """Quote status workflow - Russian B2B context"""
    DRAFT = "draft"  # Черновик
    PENDING_APPROVAL = "pending_approval"  # На согласовании
    PARTIALLY_APPROVED = "partially_approved"  # Частично согласовано
    APPROVED = "approved"  # Согласовано
    REVISION_NEEDED = "revision_needed"  # Нужны правки
    REJECTED_INTERNAL = "rejected_internal"  # Отклонено внутренне
    READY_TO_SEND = "ready_to_send"  # Готово к отправке
    SENT = "sent"  # Отправлено клиенту
    VIEWED = "viewed"  # Просмотрено клиентом
    ACCEPTED = "accepted"  # Принято клиентом
    REJECTED = "rejected"  # Отклонено клиентом
    EXPIRED = "expired"  # Просрочено
    CANCELLED = "cancelled"  # Отменено


class Currency(str, Enum):
    """Supported currencies - Russian/Chinese trade"""
    RUB = "RUB"  # Russian Ruble
    CNY = "CNY"  # Chinese Yuan
    USD = "USD"  # US Dollar
    EUR = "EUR"  # Euro


class DiscountType(str, Enum):
    """Discount calculation methods"""
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class ApprovalType(str, Enum):
    """Approval workflow types"""
    SEQUENTIAL = "sequential"  # Последовательное согласование
    PARALLEL = "parallel"  # Параллельное согласование


class ApprovalStatus(str, Enum):
    """Individual approval statuses"""
    PENDING = "pending"  # Ожидает решения
    APPROVED = "approved"  # Одобрено
    REJECTED = "rejected"  # Отклонено
    SKIPPED = "skipped"  # Пропущено


class OrganizationStatus(str, Enum):
    """Organization status options"""
    ACTIVE = "active"
    TRIAL = "trial"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class MemberStatus(str, Enum):
    """Organization member status"""
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"
    LEFT = "left"


class InvitationStatus(str, Enum):
    """Invitation status options"""
    PENDING = "pending"
    ACCEPTED = "accepted"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


# ============================================================================
# ORGANIZATION MODELS - Multi-Tenant System
# ============================================================================

class OrganizationBase(BaseModel):
    """Base organization fields"""
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly identifier")
    description: Optional[str] = Field(None, description="Organization description")
    logo_url: Optional[str] = Field(None, description="Organization logo URL")
    settings: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Organization settings")

    @validator('slug')
    def validate_slug(cls, v):
        """Validate slug format (lowercase, alphanumeric, hyphens)"""
        if not v:
            return v
        import re
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError('Slug must contain only lowercase letters, numbers, and hyphens')
        return v


class OrganizationCreate(OrganizationBase):
    """Organization creation model"""
    pass


class OrganizationUpdate(BaseModel):
    """Organization update model - all fields optional"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class Organization(OrganizationBase):
    """Complete organization model with database fields"""
    id: UUID
    status: OrganizationStatus
    subscription_tier: str = "free"
    subscription_expires_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# ROLE MODELS - RBAC System
# ============================================================================

class RoleBase(BaseModel):
    """Base role fields"""
    name: str = Field(..., min_length=1, max_length=100, description="Role name")
    slug: str = Field(..., min_length=1, max_length=50, description="Role identifier")
    description: Optional[str] = Field(None, description="Role description")
    permissions: List[str] = Field(default_factory=list, description="Array of permission strings")


class RoleCreate(RoleBase):
    """Role creation model (for custom org roles)"""
    organization_id: UUID


class RoleUpdate(BaseModel):
    """Role update model"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class Role(RoleBase):
    """Complete role model with database fields"""
    id: UUID
    organization_id: Optional[UUID]  # NULL for system roles
    is_system_role: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# ORGANIZATION MEMBER MODELS
# ============================================================================

class OrganizationMemberBase(BaseModel):
    """Base organization member fields"""
    organization_id: UUID
    user_id: UUID
    role_id: UUID


class OrganizationMemberCreate(BaseModel):
    """Create organization member (internal use)"""
    organization_id: UUID
    user_id: UUID
    role_id: UUID
    is_owner: bool = False
    invited_by: Optional[UUID] = None


class OrganizationMemberUpdate(BaseModel):
    """Update organization member"""
    role_id: Optional[UUID] = None
    status: Optional[MemberStatus] = None


class OrganizationMember(OrganizationMemberBase):
    """Complete organization member model"""
    id: UUID
    status: MemberStatus
    is_owner: bool
    invited_by: Optional[UUID]
    invited_at: datetime
    joined_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrganizationMemberWithDetails(OrganizationMember):
    """Organization member with user and role details"""
    user_email: Optional[str] = None
    user_full_name: Optional[str] = None
    role_name: Optional[str] = None
    role_slug: Optional[str] = None


# ============================================================================
# INVITATION MODELS
# ============================================================================

class InvitationCreate(BaseModel):
    """Create invitation"""
    email: EmailStr = Field(..., description="Email address to invite")
    role_id: UUID = Field(..., description="Role to assign")
    message: Optional[str] = Field(None, description="Optional message to include")


class InvitationUpdate(BaseModel):
    """Update invitation (mainly for accepting/cancelling)"""
    status: InvitationStatus


class Invitation(BaseModel):
    """Complete invitation model"""
    id: UUID
    organization_id: UUID
    role_id: UUID
    email: str
    token: str
    message: Optional[str]
    status: InvitationStatus
    invited_by: Optional[UUID]
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime]

    class Config:
        from_attributes = True


class InvitationWithDetails(Invitation):
    """Invitation with additional details"""
    organization_name: Optional[str] = None
    role_name: Optional[str] = None
    inviter_name: Optional[str] = None


class InvitationAccept(BaseModel):
    """Accept invitation (optionally with new user registration)"""
    token: str = Field(..., description="Invitation token")
    # If user doesn't exist, these fields are required
    password: Optional[str] = Field(None, min_length=8, description="Password for new account")
    full_name: Optional[str] = Field(None, description="Full name for new account")


# ============================================================================
# USER PROFILE MODELS
# ============================================================================

class UserProfileBase(BaseModel):
    """Base user profile fields"""
    full_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    avatar_url: Optional[str] = None
    title: Optional[str] = Field(None, max_length=100, description="Job title")
    bio: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict)


class UserProfileCreate(UserProfileBase):
    """Create user profile"""
    user_id: UUID


class UserProfileUpdate(UserProfileBase):
    """Update user profile - all fields optional"""
    last_active_organization_id: Optional[UUID] = None


class UserProfile(UserProfileBase):
    """Complete user profile model"""
    user_id: UUID
    last_active_organization_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# ORGANIZATION CONTEXT MODELS
# ============================================================================

class UserOrganization(BaseModel):
    """User's organization membership summary"""
    organization_id: UUID
    organization_name: str
    organization_slug: str
    role_id: UUID
    role_name: str
    role_slug: str
    is_owner: bool
    joined_at: datetime


class OrganizationContext(BaseModel):
    """Full context of user within an organization"""
    organization: Organization
    member: OrganizationMember
    role: Role
    permissions: List[str]
    is_owner: bool


# ============================================================================
# CUSTOMER MODELS - Russian Business Context
# ============================================================================

class CustomerBase(BaseModel):
    """Base customer fields"""
    organization_id: UUID = Field(..., description="Organization ID (tenant isolation)")
    name: str = Field(..., min_length=1, max_length=255, description="Company name")
    email: Optional[EmailStr] = Field(None, description="Primary email")
    phone: Optional[str] = Field(None, max_length=100, description="Phone number")
    
    # Russian Address Information
    address: Optional[str] = Field(None, description="Full address")
    city: Optional[str] = Field(None, max_length=100, description="City")
    region: Optional[str] = Field(None, max_length=100, description="Oblast/Krai/Republic")
    country: str = Field(default="Russia", max_length=100, description="Country")
    postal_code: Optional[str] = Field(None, max_length=10, description="6-digit Russian postal code")
    
    # Russian Business Information
    inn: Optional[str] = Field(None, max_length=12, description="ИНН - Tax identification number")
    kpp: Optional[str] = Field(None, max_length=9, description="КПП - Tax registration reason code")
    ogrn: Optional[str] = Field(None, max_length=15, description="ОГРН - Primary state registration number")
    company_type: CompanyType = Field(default=CompanyType.ORGANIZATION, description="Company type")
    industry: Optional[str] = Field(None, max_length=100, description="Industry sector")
    
    # Financial Information
    credit_limit: Decimal = Field(default=Decimal("0"), ge=0, description="Credit limit in RUB")
    payment_terms: int = Field(default=30, ge=0, le=365, description="Payment terms in days")
    
    # Status and Notes
    status: CustomerStatus = Field(default=CustomerStatus.ACTIVE)
    notes: Optional[str] = Field(None, description="Internal notes")

    @validator('inn')
    def validate_inn(cls, v):
        """Validate Russian INN format"""
        if v is None:
            return v
        # Remove spaces and hyphens
        inn_clean = ''.join(filter(str.isdigit, v))
        # INN should be 10 digits for organizations, 12 for individuals
        if len(inn_clean) not in [10, 12]:
            raise ValueError('INN must be 10 digits for organizations or 12 for individuals')
        return inn_clean

    @validator('kpp')
    def validate_kpp(cls, v):
        """Validate Russian KPP format"""
        if v is None:
            return v
        kpp_clean = ''.join(filter(str.isdigit, v))
        if len(kpp_clean) != 9:
            raise ValueError('KPP must be exactly 9 digits')
        return kpp_clean

    @validator('postal_code')
    def validate_postal_code(cls, v):
        """Validate Russian postal code format"""
        if v is None:
            return v
        postal_clean = ''.join(filter(str.isdigit, v))
        if len(postal_clean) != 6:
            raise ValueError('Russian postal code must be exactly 6 digits')
        return postal_clean


class CustomerCreate(CustomerBase):
    """Customer creation model"""
    pass


class CustomerUpdate(BaseModel):
    """Customer update model - all fields optional"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = None
    city: Optional[str] = Field(None, max_length=100)
    region: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=10)
    inn: Optional[str] = Field(None, max_length=12)
    kpp: Optional[str] = Field(None, max_length=9)
    ogrn: Optional[str] = Field(None, max_length=15)
    company_type: Optional[CompanyType] = None
    industry: Optional[str] = Field(None, max_length=100)
    credit_limit: Optional[Decimal] = Field(None, ge=0)
    payment_terms: Optional[int] = Field(None, ge=0, le=365)
    status: Optional[CustomerStatus] = None
    notes: Optional[str] = None


class Customer(CustomerBase):
    """Complete customer model with database fields"""
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# QUOTE MODELS - Multi-Manager Approval Workflow
# ============================================================================

class QuoteBase(BaseModel):
    """Base quote fields"""
    organization_id: UUID = Field(..., description="Organization ID (tenant isolation)")

    # Quote Information
    title: str = Field(..., min_length=1, max_length=255, description="Quote title")
    description: Optional[str] = Field(None, description="Quote description")

    # Customer Information (cached for quote integrity)
    customer_id: Optional[UUID] = Field(None, description="Reference to customer")
    customer_name: str = Field(..., min_length=1, max_length=255, description="Customer name")
    customer_email: Optional[str] = Field(None, max_length=255, description="Customer email")
    customer_address: Optional[str] = Field(None, description="Customer address")
    
    # Financial Configuration - Russian Context
    currency: Currency = Field(default=Currency.RUB, description="Quote currency")
    exchange_rate: Decimal = Field(default=Decimal("1.0"), gt=0, description="Exchange rate to RUB")
    
    # Discount Settings
    discount_type: DiscountType = Field(default=DiscountType.PERCENTAGE)
    discount_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, description="Discount percentage")
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0, description="Fixed discount amount")
    
    # Russian VAT (НДС)
    vat_rate: Decimal = Field(default=Decimal("20"), ge=0, le=30, description="VAT rate (20% standard in Russia)")
    vat_included: bool = Field(default=False, description="Whether VAT is included in item prices")
    
    # Import duties (for Chinese imports)
    import_duty_rate: Decimal = Field(default=Decimal("0"), ge=0, le=50, description="Import duty rate")
    
    # Credit/financing
    credit_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, description="Cost of money rate")
    
    # Dates
    quote_date: date = Field(default_factory=date.today, description="Quote creation date")
    valid_until: Optional[date] = Field(None, description="Quote validity date")
    delivery_date: Optional[date] = Field(None, description="Expected delivery date")
    
    # Terms and Conditions
    payment_terms: int = Field(default=30, ge=0, le=365, description="Payment terms in days")
    delivery_terms: Optional[str] = Field(None, description="Delivery terms")
    warranty_terms: Optional[str] = Field(None, description="Warranty terms")
    notes: Optional[str] = Field(None, description="Public notes for customer")
    internal_notes: Optional[str] = Field(None, description="Internal notes for sales team")
    
    # Approval Configuration
    requires_approval: bool = Field(default=True, description="Whether quote requires approval")
    required_approvers: int = Field(default=1, ge=0, le=10, description="Number of required approvals")
    approval_type: ApprovalType = Field(default=ApprovalType.PARALLEL, description="Approval workflow type")


class QuoteCreate(QuoteBase):
    """Quote creation model"""
    pass


class QuoteUpdate(BaseModel):
    """Quote update model - all fields optional"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = Field(None, min_length=1, max_length=255)
    customer_email: Optional[str] = Field(None, max_length=255)
    customer_address: Optional[str] = None
    currency: Optional[Currency] = None
    exchange_rate: Optional[Decimal] = Field(None, gt=0)
    discount_type: Optional[DiscountType] = None
    discount_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    vat_rate: Optional[Decimal] = Field(None, ge=0, le=30)
    vat_included: Optional[bool] = None
    import_duty_rate: Optional[Decimal] = Field(None, ge=0, le=50)
    credit_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    quote_date: Optional[date] = None
    valid_until: Optional[date] = None
    delivery_date: Optional[date] = None
    payment_terms: Optional[int] = Field(None, ge=0, le=365)
    delivery_terms: Optional[str] = None
    warranty_terms: Optional[str] = None
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    requires_approval: Optional[bool] = None
    required_approvers: Optional[int] = Field(None, ge=0, le=10)
    approval_type: Optional[ApprovalType] = None


class Quote(QuoteBase):
    """Complete quote model with database fields"""
    id: UUID
    quote_number: str
    user_id: UUID  # Sales person who created the quote
    status: QuoteStatus
    
    # Calculated totals (computed by database triggers)
    subtotal: Decimal
    discount_amount: Decimal  # Calculated discount
    vat_amount: Decimal  # Calculated VAT
    import_duty_amount: Decimal  # Calculated import duty
    credit_amount: Decimal  # Calculated credit cost
    total_amount: Decimal  # Final total
    
    # Workflow timestamps
    submitted_for_approval_at: Optional[datetime]
    final_approval_at: Optional[datetime]
    sent_at: Optional[datetime]
    
    # Standard timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# QUOTE ITEM MODELS
# ============================================================================

class QuoteItemBase(BaseModel):
    """Base quote item fields"""
    # Product Information
    description: str = Field(..., min_length=1, description="Product description")
    product_code: Optional[str] = Field(None, max_length=100, description="Product/SKU code")
    category: Optional[str] = Field(None, max_length=100, description="Product category")
    brand: Optional[str] = Field(None, max_length=100, description="Brand name")
    model: Optional[str] = Field(None, max_length=100, description="Model number")
    
    # Origin Information (important for Russian-Chinese trade)
    country_of_origin: Optional[str] = Field(None, max_length=100, description="Country of origin")
    manufacturer: Optional[str] = Field(None, max_length=255, description="Manufacturer name")
    
    # Quantities and Pricing
    quantity: Decimal = Field(..., gt=0, description="Quantity")
    unit: str = Field(default="шт", max_length=20, description="Unit of measure (шт = pieces)")
    unit_cost: Optional[Decimal] = Field(None, ge=0, description="Internal cost for margin calculation")
    unit_price: Decimal = Field(..., gt=0, description="Unit selling price")
    
    # Item-level discounts
    discount_type: DiscountType = Field(default=DiscountType.PERCENTAGE)
    discount_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0)
    
    # Tax rates (can override quote-level rates)
    vat_rate: Decimal = Field(default=Decimal("20"), ge=0, le=30)
    import_duty_rate: Decimal = Field(default=Decimal("0"), ge=0, le=50)
    
    # Delivery Information
    lead_time_days: Optional[int] = Field(None, ge=0, description="Lead time in days")
    delivery_notes: Optional[str] = Field(None, description="Item-specific delivery notes")
    
    # Organization
    sort_order: int = Field(default=0, description="Display order in quote")
    notes: Optional[str] = Field(None, description="Item notes")


class QuoteItemCreate(QuoteItemBase):
    """Quote item creation model"""
    quote_id: UUID


class QuoteItemUpdate(BaseModel):
    """Quote item update model"""
    description: Optional[str] = Field(None, min_length=1)
    product_code: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    country_of_origin: Optional[str] = Field(None, max_length=100)
    manufacturer: Optional[str] = Field(None, max_length=255)
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=20)
    unit_cost: Optional[Decimal] = Field(None, ge=0)
    unit_price: Optional[Decimal] = Field(None, gt=0)
    discount_type: Optional[DiscountType] = None
    discount_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    vat_rate: Optional[Decimal] = Field(None, ge=0, le=30)
    import_duty_rate: Optional[Decimal] = Field(None, ge=0, le=50)
    lead_time_days: Optional[int] = Field(None, ge=0)
    delivery_notes: Optional[str] = None
    sort_order: Optional[int] = None
    notes: Optional[str] = None


class QuoteItem(QuoteItemBase):
    """Complete quote item with calculated fields"""
    id: UUID
    quote_id: UUID
    
    # Calculated totals (computed by database triggers)
    line_subtotal: Decimal
    line_discount: Decimal
    vat_amount: Decimal
    import_duty_amount: Decimal
    line_total: Decimal
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# QUOTE APPROVAL MODELS - Multi-Manager Workflow
# ============================================================================

class QuoteApprovalBase(BaseModel):
    """Base approval fields"""
    approval_order: int = Field(default=1, ge=1, description="Order for sequential approval")
    decision_notes: Optional[str] = Field(None, description="Approval/rejection reasoning")
    revision_notes: Optional[str] = Field(None, description="What needs to be changed")


class QuoteApprovalCreate(QuoteApprovalBase):
    """Create approval assignment"""
    quote_id: UUID
    approver_id: UUID


class QuoteApprovalUpdate(BaseModel):
    """Update approval decision"""
    approval_status: ApprovalStatus
    decision_notes: Optional[str] = None
    revision_notes: Optional[str] = None


class QuoteApproval(QuoteApprovalBase):
    """Complete approval record"""
    id: UUID
    quote_id: UUID
    approver_id: UUID
    approval_status: ApprovalStatus
    
    assigned_at: datetime
    decided_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================================
# REQUEST/RESPONSE SCHEMAS
# ============================================================================

class PaginationParams(BaseModel):
    """Standard pagination parameters"""
    page: int = Field(default=1, ge=1, description="Page number")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page")


class CustomerListResponse(BaseModel):
    """Customer list response"""
    customers: List[Customer]
    total: int
    page: int
    limit: int
    has_more: bool


class QuoteListResponse(BaseModel):
    """Quote list response"""
    quotes: List[Quote]
    total: int
    page: int
    limit: int
    has_more: bool


class QuoteWithItems(Quote):
    """Quote with all associated items"""
    items: List[QuoteItem] = []
    approvals: List[QuoteApproval] = []


class ApprovalWorkflowRequest(BaseModel):
    """Request to set up approval workflow"""
    approver_ids: List[UUID] = Field(..., min_items=1, max_items=10)
    approval_type: ApprovalType = ApprovalType.PARALLEL
    notes: Optional[str] = None


# ============================================================================
# ERROR RESPONSE SCHEMAS
# ============================================================================

class ErrorResponse(BaseModel):
    """Standard error response"""
    error: bool = True
    message: str
    details: Optional[dict] = None


class ValidationErrorResponse(BaseModel):
    """Validation error response"""
    error: bool = True
    message: str = "Validation error"
    validation_errors: List[dict]


# ============================================================================
# SUCCESS RESPONSE SCHEMAS
# ============================================================================

class SuccessResponse(BaseModel):
    """Standard success response"""
    success: bool = True
    message: str
    data: Optional[dict] = None