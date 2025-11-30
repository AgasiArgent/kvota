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
    AED = "AED"  # UAE Dirham
    TRY = "TRY"  # Turkish Lira


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
    
    # Discount Settings (only discount_type and rate; fixed amount removed in migration 036)
    discount_type: DiscountType = Field(default=DiscountType.PERCENTAGE)
    discount_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, description="Discount percentage")
    
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


class Quote(BaseModel):
    """Complete quote model matching actual database schema"""
    # Core fields that exist in database
    id: UUID
    quote_number: str
    organization_id: UUID
    customer_id: Optional[UUID]
    created_by: UUID  # Maps to user_id in forms, but stored as created_by in DB

    # Quote information
    title: Optional[str]
    description: Optional[str]
    status: QuoteStatus

    # Workflow state (for financial approval workflow)
    workflow_state: Optional[str] = None
    submission_comment: Optional[str] = None  # Comment from manager when submitting for approval
    last_sendback_reason: Optional[str] = None  # Comment when sent back for revision
    last_financial_comment: Optional[str] = None  # Comment when rejected by finance
    last_approval_comment: Optional[str] = None  # Comment when approved by finance

    # Dates (Session 21 fields)
    quote_date: date
    valid_until: Optional[date]

    # Financial fields (matching actual DB columns)
    currency: Optional[str] = "USD"  # Quote currency (USD, EUR, RUB, TRY, CNY)
    subtotal: Decimal
    tax_rate: Optional[Decimal]
    tax_amount: Optional[Decimal]
    total_amount: Decimal

    # Terms
    notes: Optional[str]
    terms_conditions: Optional[str]

    # Timestamps
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]  # Session 21: soft delete support

    class Config:
        from_attributes = True


# ============================================================================
# QUOTE ITEM MODELS
# ============================================================================

class QuoteItemBase(BaseModel):
    """Base quote item fields"""
    # Product Information
    description: Optional[str] = Field(None, description="Product description")
    product_code: Optional[str] = Field(None, max_length=100, description="Product/SKU code")
    category: Optional[str] = Field(None, max_length=100, description="Product category")
    brand: Optional[str] = Field(None, max_length=100, description="Brand name")
    model: Optional[str] = Field(None, max_length=100, description="Model number")
    
    # Origin Information (important for Russian-Chinese trade)
    country_of_origin: Optional[str] = Field(None, max_length=100, description="Country of origin")
    manufacturer: Optional[str] = Field(None, max_length=255, description="Manufacturer name")
    
    # Quantities and Pricing
    quantity: Optional[Decimal] = Field(None, gt=0, description="Quantity")
    unit: Optional[str] = Field(None, max_length=20, description="Unit of measure (шт = pieces)")
    unit_cost: Optional[Decimal] = Field(None, ge=0, description="Internal cost for margin calculation")
    unit_price: Optional[Decimal] = Field(None, gt=0, description="Unit selling price")
    
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
    position: int = Field(default=0, description="Display order in quote")
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
    position: Optional[int] = None
    notes: Optional[str] = None


class QuoteItem(QuoteItemBase):
    """Complete quote item with calculated fields"""
    id: UUID
    quote_id: UUID

    # Frontend compatibility fields (mapped from DB fields)
    name: Optional[str] = None  # Maps from description
    final_price: Optional[Decimal] = None  # Maps from unit_price

    # Calculated totals (these don't exist in database yet - stub feature)
    line_subtotal: Optional[Decimal] = None
    line_discount: Optional[Decimal] = None
    vat_amount: Optional[Decimal] = None
    import_duty_amount: Optional[Decimal] = None
    line_total: Optional[Decimal] = None

    # Calculation engine results (from quote_item_calculation_results table)
    calculation_results: Optional[dict] = None
    calculated_at: Optional[datetime] = None

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


class QuoteListItem(BaseModel):
    """Simplified quote model for list view"""
    id: UUID
    quote_number: str
    customer_name: str
    title: Optional[str]
    status: QuoteStatus
    total_amount: Decimal
    quote_date: Optional[date]
    valid_until: Optional[date]
    created_at: datetime

    class Config:
        from_attributes = True


class QuoteListResponse(BaseModel):
    """Quote list response"""
    quotes: List[QuoteListItem]
    total: int
    page: int
    limit: int
    has_more: bool


class QuoteWithItems(Quote):
    """Quote with all associated items"""
    items: List[QuoteItem] = []
    customer: Optional[dict] = None  # Customer information from customers table
    approvals: List[QuoteApproval] = []
    calculation_variables: Optional[dict] = None  # Input variables used for calculation


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


# ============================================================================
# ANALYTICS MODELS
# ============================================================================

class SavedReportCreate(BaseModel):
    """Create saved report template"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    filters: Dict[str, Any] = Field(default_factory=dict)
    selected_fields: List[str] = Field(..., min_length=1, max_items=50)
    aggregations: Optional[Dict[str, Any]] = None
    visibility: str = Field(default='personal', pattern='^(personal|shared)$')


class SavedReportUpdate(BaseModel):
    """Update saved report template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    filters: Optional[Dict[str, Any]] = None
    selected_fields: Optional[List[str]] = Field(None, min_length=1)
    aggregations: Optional[Dict[str, Any]] = None
    visibility: Optional[str] = Field(None, pattern='^(personal|shared)$')


class SavedReport(BaseModel):
    """Complete saved report with database fields"""
    id: UUID
    organization_id: UUID
    created_by: UUID
    name: str
    description: Optional[str]
    filters: Dict[str, Any]
    selected_fields: List[str]
    aggregations: Optional[Dict[str, Any]]
    visibility: str
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime]

    class Config:
        from_attributes = True


class AnalyticsQueryRequest(BaseModel):
    """Analytics query request"""
    filters: Dict[str, Any] = Field(..., description="Filter conditions")
    selected_fields: List[str] = Field(default=[], description="Fields to return (empty for aggregation-only)")
    aggregations: Optional[Dict[str, Any]] = Field(None, description="Aggregation functions")
    limit: int = Field(default=1000, ge=1, le=10000)
    offset: int = Field(default=0, ge=0)


class AnalyticsQueryResponse(BaseModel):
    """Analytics query response"""
    rows: List[Dict[str, Any]]
    count: int
    total_count: Optional[int] = None
    has_more: Optional[bool] = None
    task_id: Optional[str] = None  # For background processing
    status: Optional[str] = None  # 'completed', 'processing'
    message: Optional[str] = None


class AnalyticsAggregateResponse(BaseModel):
    """Analytics aggregation response (lightweight mode)"""
    aggregations: Dict[str, Any]
    execution_time_ms: int


class ReportExecution(BaseModel):
    """Report execution audit record"""
    id: UUID
    organization_id: UUID
    saved_report_id: Optional[UUID]
    report_name: Optional[str]
    executed_by: UUID
    execution_type: str
    filters: Dict[str, Any]
    selected_fields: List[str]
    aggregations: Optional[Dict[str, Any]]
    result_summary: Dict[str, Any]
    quote_count: int
    date_range: Optional[Dict[str, Any]]
    export_file_url: Optional[str]
    export_format: Optional[str]
    file_size_bytes: Optional[int]
    file_expires_at: Optional[datetime]
    ip_address: Optional[str]
    user_agent: Optional[str]
    execution_time_ms: Optional[int]
    executed_at: datetime

    class Config:
        from_attributes = True


class ScheduledReportCreate(BaseModel):
    """Create scheduled report"""
    saved_report_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    schedule_cron: str = Field(..., description="Cron expression", max_length=50)
    timezone: str = Field(default='Europe/Moscow', max_length=50)
    email_recipients: List[EmailStr] = Field(..., min_length=1, max_items=20)
    include_file: bool = Field(default=True)
    email_subject: Optional[str] = Field(None, max_length=255)
    email_body: Optional[str] = Field(None, max_length=10000)


class ScheduledReportUpdate(BaseModel):
    """Update scheduled report"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    schedule_cron: Optional[str] = None
    timezone: Optional[str] = None
    email_recipients: Optional[List[str]] = Field(None, min_length=1)
    include_file: Optional[bool] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduledReport(BaseModel):
    """Complete scheduled report"""
    id: UUID
    organization_id: UUID
    saved_report_id: UUID
    name: str
    schedule_cron: str
    timezone: str
    email_recipients: List[str]
    include_file: bool
    email_subject: Optional[str]
    email_body: Optional[str]
    is_active: bool
    last_run_at: Optional[datetime]
    next_run_at: Optional[datetime]
    last_run_status: Optional[str]
    last_error: Optional[str]
    consecutive_failures: int
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedResponse(BaseModel):
    """Generic paginated response"""
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int