"""
FastAPI Authentication Integration with Supabase
Handles JWT validation, user context, and role-based access control
"""
import os
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import asyncpg
from supabase import create_client, Client
from dotenv import load_dotenv
from uuid import UUID

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
environment = os.getenv("ENVIRONMENT", "development")

# In test environment, allow module import without Supabase credentials
if not all([supabase_url, supabase_service_key, supabase_anon_key]):
    if environment == "test":
        # Allow imports in test environment without real credentials
        supabase_admin = None  # type: ignore
        supabase_anon = None  # type: ignore
    else:
        raise ValueError("Missing required Supabase environment variables")
else:
    # Create Supabase clients with real credentials
    supabase_admin: Client = create_client(supabase_url, supabase_service_key)  # Admin operations
    supabase_anon: Client = create_client(supabase_url, supabase_anon_key)      # Public operations

# Security scheme for FastAPI
security = HTTPBearer()

# ============================================================================
# USER MODELS
# ============================================================================

class UserRole(str):
    """User roles for Russian B2B quotation system"""
    SALES_MANAGER = "sales_manager"
    FINANCE_MANAGER = "finance_manager" 
    DEPARTMENT_MANAGER = "department_manager"
    DIRECTOR = "director"
    ADMIN = "admin"

class User(BaseModel):
    """Authenticated user information with multi-organization support"""
    id: UUID
    email: str
    full_name: Optional[str] = None

    # Multi-organization support
    current_organization_id: Optional[UUID] = None
    current_role: Optional[str] = None
    current_role_slug: Optional[str] = None
    is_owner: bool = False
    organizations: List[Dict[str, Any]] = []  # List of organization memberships

    # Legacy fields (for backward compatibility)
    role: str = UserRole.SALES_MANAGER
    department: Optional[str] = None
    is_active: bool = True

    # Current permissions (based on current org + role)
    permissions: List[str] = []
    created_at: datetime

    class Config:
        from_attributes = True

class AuthContext(BaseModel):
    """Authentication context for requests"""
    user: User
    token: str
    expires_at: datetime

class OrganizationContext(BaseModel):
    """Organization-specific context for user"""
    user: User
    organization_id: UUID
    organization_name: str
    role_id: UUID
    role_name: str
    role_slug: str
    is_owner: bool
    permissions: List[str]

# ============================================================================
# JWT TOKEN VALIDATION
# ============================================================================

def decode_jwt_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate Supabase JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        # Get JWT secret from Supabase (this would normally be configured)
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
        if not jwt_secret:
            # For development, we'll use a simpler validation
            # In production, you'd validate against the proper Supabase JWT secret
            payload = jwt.decode(token, options={"verify_signature": False})
        else:
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        
        # Check expiration
        exp = payload.get("exp")
        if exp and datetime.utcnow().timestamp() > exp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ============================================================================
# USER MANAGEMENT
# ============================================================================

async def get_user_from_database(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user details from database with organization memberships

    Args:
        user_id: User UUID from JWT token

    Returns:
        User data from database or None
    """
    try:
        # Get user from Supabase auth.users via Admin API
        try:
            user_response = supabase_admin.auth.admin.get_user_by_id(user_id)
            auth_user = user_response.user

            if not auth_user:
                return None

            # Extract user metadata
            user_metadata = auth_user.user_metadata or {}

            user_data = {
                'id': auth_user.id,
                'email': auth_user.email,
                'full_name': user_metadata.get('full_name'),
                'role': user_metadata.get('role', 'sales_manager'),
                'department': user_metadata.get('department'),
                'is_active': getattr(auth_user, 'banned_until', None) is None,  # User is active if not banned
                'created_at': auth_user.created_at
            }
        except Exception as e:
            print(f"Error fetching user from Supabase auth: {e}")
            return None

        # Get user's organizations and roles using Supabase client
        try:
            # Query organization_members with joins
            org_members_response = supabase_admin.table("organization_members").select(
                "organization_id, role_id, is_owner, joined_at, status, "
                "organizations(id, name, slug), "
                "roles(id, name, slug, permissions)"
            ).eq("user_id", user_id).eq("status", "active").execute()

            print(f"[get_user_from_database] org_members_response for user {user_id}: {org_members_response.data}")

            # Transform the response to match expected format
            organizations = []
            for member in org_members_response.data:
                org = member.get('organizations', {})
                role = member.get('roles', {})
                organizations.append({
                    'organization_id': member['organization_id'],
                    'organization_name': org.get('name'),
                    'organization_slug': org.get('slug'),
                    'role_id': member['role_id'],
                    'role_name': role.get('name'),
                    'role_slug': role.get('slug'),
                    'permissions': role.get('permissions'),
                    'is_owner': member['is_owner'],
                    'joined_at': member['joined_at']
                })

            # Sort by owner first, then by joined date
            organizations.sort(key=lambda x: (not x['is_owner'], x['joined_at']), reverse=True)

        except Exception as e:
            print(f"Error fetching user organizations: {e}")
            organizations = []

        # Get user's last active organization
        last_active_organization_id = None
        try:
            profile_response = supabase_admin.table("user_profiles").select(
                "last_active_organization_id"
            ).eq("user_id", user_id).execute()

            if profile_response.data and len(profile_response.data) > 0:
                last_active_organization_id = profile_response.data[0].get('last_active_organization_id')
        except Exception as e:
            print(f"Error fetching user profile: {e}")

        user_data['organizations'] = organizations
        user_data['last_active_organization_id'] = last_active_organization_id

        return user_data

    except Exception as e:
        print(f"Error in get_user_from_database: {e}")
        return None


async def get_user_organizations(user_id: str) -> List[Dict[str, Any]]:
    """
    Get list of organizations user belongs to

    Args:
        user_id: User UUID

    Returns:
        List of organization memberships
    """
    try:
        # Query organization_members with joins using Supabase client
        org_members_response = supabase_admin.table("organization_members").select(
            "organization_id, role_id, is_owner, joined_at, status, "
            "organizations(id, name, slug), "
            "roles(id, name, slug, permissions)"
        ).eq("user_id", user_id).eq("status", "active").execute()

        # Transform the response to match expected format
        organizations = []
        for member in org_members_response.data:
            org = member.get('organizations', {})
            role = member.get('roles', {})
            organizations.append({
                'organization_id': member['organization_id'],
                'organization_name': org.get('name'),
                'organization_slug': org.get('slug'),
                'role_id': member['role_id'],
                'role_name': role.get('name'),
                'role_slug': role.get('slug'),
                'permissions': role.get('permissions'),
                'is_owner': member['is_owner'],
                'joined_at': member['joined_at']
            })

        # Sort by owner first, then by joined date
        organizations.sort(key=lambda x: (not x['is_owner'], x['joined_at']), reverse=True)

        return organizations

    except Exception as e:
        print(f"Error fetching user organizations: {e}")
        return []

def get_permissions_from_jsonb(permissions_jsonb: Any) -> List[str]:
    """
    Extract permissions list from JSONB field

    Args:
        permissions_jsonb: JSONB permissions field from roles table

    Returns:
        List of permission strings
    """
    import json

    if permissions_jsonb is None:
        return []

    # If it's already a list
    if isinstance(permissions_jsonb, list):
        return permissions_jsonb

    # If it's a string (JSON string)
    if isinstance(permissions_jsonb, str):
        try:
            perms = json.loads(permissions_jsonb)
            return perms if isinstance(perms, list) else []
        except:
            return []

    # If it's a dict (shouldn't happen but handle it)
    if isinstance(permissions_jsonb, dict):
        return permissions_jsonb.get('permissions', [])

    return []


def get_user_permissions(role: str) -> List[str]:
    """
    Get permissions based on user role (legacy function for backward compatibility)

    Args:
        role: User role string

    Returns:
        List of permission strings
    """
    permissions_map = {
        UserRole.SALES_MANAGER: [
            "quotes:create",
            "quotes:read_own",
            "quotes:update_own",
            "quotes:delete_own",
            "customers:read",
            "customers:create",
            "customers:update"
        ],
        UserRole.FINANCE_MANAGER: [
            "quotes:read_all",
            "quotes:approve",
            "quotes:financial_edit",
            "customers:read",
            "customers:update",
            "reports:financial"
        ],
        UserRole.DEPARTMENT_MANAGER: [
            "quotes:read_department",
            "quotes:approve",
            "quotes:manage_team",
            "customers:read",
            "customers:update",
            "users:manage_department"
        ],
        UserRole.DIRECTOR: [
            "quotes:read_all",
            "quotes:approve",
            "quotes:final_approve",
            "customers:read",
            "customers:update",
            "customers:delete",
            "users:manage",
            "reports:all"
        ],
        UserRole.ADMIN: [
            "*"  # All permissions
        ]
    }

    return permissions_map.get(role, [])

# ============================================================================
# AUTHENTICATION DEPENDENCIES
# ============================================================================

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """
    FastAPI dependency to get current authenticated user
    
    Args:
        credentials: HTTP Bearer credentials from request
        
    Returns:
        Authenticated user object
        
    Raises:
        HTTPException: If authentication fails
    """
    token = credentials.credentials
    
    # Decode JWT token
    payload = decode_jwt_token(token)
    
    # Get user ID from token
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    user_data = await get_user_from_database(user_id)
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user_data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user's organizations
    organizations = user_data.get("organizations", [])

    # Determine current organization (last active or first available)
    current_org = None
    last_active_org_id = user_data.get("last_active_organization_id")

    print(f"[get_current_user] user {user_data.get('email')} - last_active_org_id: {last_active_org_id}, organizations count: {len(organizations)}")

    if last_active_org_id and organizations:
        # Find last active organization
        current_org = next((org for org in organizations if org['organization_id'] == last_active_org_id), None)
        print(f"[get_current_user] Found last active org: {current_org}")

    # If not found, use first organization
    if not current_org and organizations:
        current_org = organizations[0]
        print(f"[get_current_user] Using first org: {current_org}")

    # Extract current organization details
    current_organization_id = current_org['organization_id'] if current_org else None
    print(f"[get_current_user] Final current_organization_id: {current_organization_id}")
    current_role = current_org['role_name'] if current_org else user_data.get("role", UserRole.SALES_MANAGER)
    current_role_slug = current_org['role_slug'] if current_org else 'sales_manager'
    is_owner = current_org['is_owner'] if current_org else False

    # Get permissions from current role
    if current_org and 'permissions' in current_org:
        permissions = get_permissions_from_jsonb(current_org['permissions'])
    else:
        permissions = get_user_permissions(current_role)

    return User(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data.get("full_name"),
        current_organization_id=current_organization_id,
        current_role=current_role,
        current_role_slug=current_role_slug,
        is_owner=is_owner,
        organizations=organizations,
        role=current_role,  # Legacy
        department=user_data.get("department"),
        is_active=user_data["is_active"],
        permissions=permissions,
        created_at=user_data["created_at"]
    )

async def get_auth_context(credentials: HTTPAuthorizationCredentials = Depends(security)) -> AuthContext:
    """
    Get full authentication context including user and token info

    Args:
        credentials: HTTP Bearer credentials from request

    Returns:
        Authentication context with user and token details
    """
    token = credentials.credentials
    payload = decode_jwt_token(token)
    user = await get_current_user(credentials)

    # Get token expiration
    exp = payload.get("exp")
    expires_at = datetime.utcfromtimestamp(exp) if exp else datetime.utcnow() + timedelta(hours=1)

    return AuthContext(
        user=user,
        token=token,
        expires_at=expires_at
    )


async def get_organization_context(
    organization_id: str,
    user: User = Depends(get_current_user)
) -> OrganizationContext:
    """
    Get user's context within a specific organization

    Args:
        organization_id: Organization UUID as string
        user: Authenticated user

    Returns:
        Organization context with user's role and permissions

    Raises:
        HTTPException: If user is not member of organization
    """
    from uuid import UUID as UUIDType

    try:
        org_id = UUIDType(organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID format"
        )

    # Query database fresh to get current membership (don't rely on cached user.organizations)
    try:
        org_members_response = supabase_admin.table("organization_members").select(
            "organization_id, role_id, is_owner, joined_at, status, "
            "organizations(id, name, slug), "
            "roles(id, name, slug, permissions)"
        ).eq("user_id", str(user.id)).eq("organization_id", str(org_id)).eq("status", "active").execute()

        if not org_members_response.data or len(org_members_response.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not a member of this organization"
            )

        membership = org_members_response.data[0]
        org_data = membership.get('organizations', {})
        role_data = membership.get('roles', {})

        # Extract permissions
        permissions = get_permissions_from_jsonb(role_data.get('permissions', []))

        return OrganizationContext(
            user=user,
            organization_id=org_id,
            organization_name=org_data.get('name'),
            role_id=membership['role_id'],
            role_name=role_data.get('name'),
            role_slug=role_data.get('slug'),
            is_owner=membership['is_owner'],
            permissions=permissions
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get organization context: {str(e)}"
        )

# ============================================================================
# ROLE-BASED ACCESS CONTROL
# ============================================================================

def require_permission(permission: str):
    """
    Decorator factory for requiring specific permissions
    
    Args:
        permission: Required permission string
        
    Returns:
        FastAPI dependency function
    """
    def permission_dependency(user: User = Depends(get_current_user)) -> User:
        if "*" in user.permissions or permission in user.permissions:
            return user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required: {permission}"
        )
    
    return permission_dependency

def require_role(required_role: str):
    """
    Decorator factory for requiring specific role
    
    Args:
        required_role: Required user role
        
    Returns:
        FastAPI dependency function
    """
    def role_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role == required_role or user.role == UserRole.ADMIN:
            return user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient role. Required: {required_role}, current: {user.role}"
        )
    
    return role_dependency

def require_manager_or_above():
    """
    Require manager-level access or above

    Returns:
        FastAPI dependency function
    """
    manager_roles = [
        UserRole.FINANCE_MANAGER,
        UserRole.DEPARTMENT_MANAGER,
        UserRole.DIRECTOR,
        UserRole.ADMIN
    ]

    def manager_dependency(user: User = Depends(get_current_user)) -> User:
        if user.role in manager_roles:
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )

    return manager_dependency


def require_org_permission(permission: str):
    """
    Decorator factory for requiring organization-specific permissions

    Args:
        permission: Required permission string (e.g., "quotes:create")

    Returns:
        FastAPI dependency function
    """
    async def permission_dependency(
        organization_id: str,
        user: User = Depends(get_current_user)
    ) -> OrganizationContext:
        # Get organization context
        context = await get_organization_context(organization_id, user)

        # Check if user has permission
        if "*" in context.permissions or permission in context.permissions:
            return context

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required: {permission}"
        )

    return permission_dependency


def require_org_owner():
    """
    Require organization owner status

    Returns:
        FastAPI dependency function
    """
    async def owner_dependency(
        organization_id: str,
        user: User = Depends(get_current_user)
    ) -> OrganizationContext:
        context = await get_organization_context(organization_id, user)

        if not context.is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization owner access required"
            )

        return context

    return owner_dependency


def require_org_admin():
    """
    Require organization admin role (owner or admin)

    Returns:
        FastAPI dependency function
    """
    async def admin_dependency(
        organization_id: str,
        user: User = Depends(get_current_user)
    ) -> OrganizationContext:
        context = await get_organization_context(organization_id, user)

        if not (context.is_owner or context.role_slug == 'admin'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization admin access required"
            )

        return context

    return admin_dependency

# ============================================================================
# AUTHENTICATION UTILITIES
# ============================================================================

async def get_user_database_connection(user: User) -> asyncpg.Connection:
    """
    Get database connection with RLS context set for user
    
    Args:
        user: Authenticated user
        
    Returns:
        Database connection with user context
    """
    conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
    
    # Set RLS context for this connection
    await conn.execute("SELECT set_config('request.jwt.claims', $1, true)", 
                      f'{{"sub": "{user.id}", "role": "authenticated"}}')
    
    return conn

class AuthenticationService:
    """Service class for authentication operations"""
    
    @staticmethod
    async def create_user(email: str, password: str, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new user account
        
        Args:
            email: User email
            password: User password  
            user_data: Additional user metadata
            
        Returns:
            Created user information
        """
        try:
            response = supabase_admin.auth.admin.create_user({
                "email": email,
                "password": password,
                "user_metadata": user_data
            })
            
            return response.user.__dict__ if hasattr(response, 'user') else response
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create user: {str(e)}"
            )
    
    @staticmethod
    async def update_user_role(user_id: str, new_role: str) -> bool:
        """
        Update user role
        
        Args:
            user_id: User UUID
            new_role: New role to assign
            
        Returns:
            Success status
        """
        try:
            supabase_admin.auth.admin.update_user_by_id(
                user_id,
                {"user_metadata": {"role": new_role}}
            )
            return True
            
        except Exception as e:
            print(f"Error updating user role: {e}")
            return False
    
    @staticmethod
    async def get_user_quotes_access(user: User) -> str:
        """
        Get SQL condition for quote access based on user role
        
        Args:
            user: Authenticated user
            
        Returns:
            SQL WHERE condition for quote access
        """
        if user.role in [UserRole.DIRECTOR, UserRole.ADMIN]:
            return "1=1"  # Access to all quotes
        elif user.role == UserRole.FINANCE_MANAGER:
            return "1=1"  # Finance managers see all quotes
        elif user.role == UserRole.DEPARTMENT_MANAGER:
            return f"user_id IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'department' = '{user.department}')"
        else:  # Sales manager
            return f"user_id = '{user.id}'"


# ============================================================================
# ADMIN PERMISSION CHECKS
# ============================================================================

async def check_admin_permissions(user: User) -> None:
    """
    Check if user has admin/owner permissions.

    Raises HTTPException if user is not admin or owner.

    Args:
        user: Authenticated user

    Raises:
        HTTPException: 403 Forbidden if user is not admin/owner
    """
    if not user.current_organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not associated with an organization"
        )

    # Check if user is owner
    if user.is_owner:
        return

    # Check if user has admin role (case-insensitive)
    if user.current_role_slug and user.current_role_slug.lower() in ('admin', 'owner'):
        return

    # Not admin/owner - reject
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Admin or owner permissions required. Current role: {user.current_role_slug}"
    )


# ============================================================================
# TESTING UTILITIES
# ============================================================================

async def create_test_user(email: str = "test@example.com", role: str = UserRole.SALES_MANAGER) -> str:
    """
    Create test user for development
    
    Args:
        email: Test user email
        role: Test user role
        
    Returns:
        Created user ID
    """
    try:
        user_data = {
            "full_name": "Test User",
            "role": role,
            "department": "Test Department"
        }
        
        response = await AuthenticationService.create_user(
            email=email,
            password="testpassword123",
            user_data=user_data
        )
        
        return response.get("id")
        
    except Exception as e:
        print(f"Error creating test user: {e}")
        return None