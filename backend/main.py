"""
B2B Quotation Platform - FastAPI Application
Main application with Supabase authentication and Russian business context
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
import asyncpg
from dotenv import load_dotenv

# ============================================================================
# SUPABASE CLIENT (Singleton via Dependency Injection)
# ============================================================================
# Client initialized once in lifespan, accessed via Depends(get_supabase)
# This avoids creating new HTTP connections on every request (~200-500ms saved)
from supabase import create_client, Client
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from routes import customers, quotes, organizations, quotes_calc, calculation_settings, users, activity_logs, exchange_rates, feedback, dashboard, team, analytics, workflow, supplier_countries, excel_validation, leads_webhook, leads, lead_contacts, lead_stages, activities, monitoring_test, webhooks, financial_approval, org_exchange_rates, quote_versions, quotes_upload

# Sentry for error tracking
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.asyncpg import AsyncPGIntegration

# Telegram notifications
from services.telegram_notifier import send_alert, ENABLED as TELEGRAM_ENABLED


# Import our authentication system
from auth import (
    get_current_user, 
    get_auth_context,
    require_permission,
    require_role,
    require_manager_or_above,
    User,
    AuthContext,
    UserRole,
    AuthenticationService,
    create_test_user
)

# Load environment variables
load_dotenv()

# ============================================================================
# SENTRY INITIALIZATION
# ============================================================================

# Initialize Sentry for error tracking
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=os.getenv("ENVIRONMENT", "development"),
        traces_sample_rate=0.1,  # 10% of requests for performance monitoring
        profiles_sample_rate=0.1,  # 10% for profiling
        integrations=[
            FastApiIntegration(),
            AsyncPGIntegration()
        ],
        # Send user context with errors
        send_default_pii=False,  # Don't send PII automatically
    )
    print("✅ Sentry error tracking initialized")
else:
    print("⚠️  Sentry DSN not configured - error tracking disabled")

# ============================================================================
# APPLICATION LIFECYCLE
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager
    Handles startup and shutdown events
    """
    # Startup
    print("🚀 Starting B2B Quotation Platform API")

    # Initialize database connection pool
    from db_pool import init_db_pool, close_db_pool
    await init_db_pool()
    print("✅ Database connection pool initialized (10-20 connections)")

    # Initialize singleton Supabase client (stored in app.state)
    # This client is reused across all requests via Depends(get_supabase)
    app.state.supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )
    print("✅ Supabase client singleton initialized")

    # Start exchange rate scheduler
    from services.exchange_rate_service import get_exchange_rate_service
    exchange_service = get_exchange_rate_service()
    exchange_service.setup_cron_job()
    print("✅ Exchange rate scheduler started")

    # Test database connection using singleton Supabase client
    try:
        # Test query using the singleton client
        result = app.state.supabase.table("roles").select("count", count="exact").limit(1).execute()
        print("✅ Database connection verified (Supabase REST API)")
    except Exception as e:
        print(f"⚠️  Database connection failed: {e}")
        print("⚠️  Server will start anyway - database will be checked per request")

    # Verify required environment variables
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "DATABASE_URL"
    ]

    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        print(f"❌ Missing environment variables: {missing_vars}")
        raise ValueError(f"Missing required environment variables: {missing_vars}")

    print("✅ Environment variables verified")

    # Start activity log worker
    from services.activity_log_service import setup_log_worker
    await setup_log_worker()

    print("🎯 API is ready to serve requests")

    # Send startup notification to Telegram
    if TELEGRAM_ENABLED:
        from services.telegram_notifier import send_startup_notification
        send_startup_notification()
        print("✅ Telegram startup notification sent")

    yield

    # Shutdown
    print("🔄 Shutting down B2B Quotation Platform API")

    # Close database connection pool
    await close_db_pool()
    print("✅ Database connection pool closed")

    # Stop exchange rate scheduler
    from services.exchange_rate_service import get_exchange_rate_service
    exchange_service = get_exchange_rate_service()
    exchange_service.shutdown_scheduler()
    print("✅ Exchange rate scheduler stopped")

    # Stop activity log worker
    from services.activity_log_service import shutdown_log_worker
    await shutdown_log_worker()

# ============================================================================
# RATE LIMITING SETUP
# ============================================================================

# Initialize rate limiter with Redis storage (or in-memory if Redis not available)
redis_url = os.getenv("REDIS_URL", "")
if redis_url:
    # Use Redis for distributed rate limiting (production)
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["50/minute"],
        storage_uri=redis_url
    )
    print("✅ Rate limiting enabled with Redis storage")
else:
    # Use in-memory storage (single instance deployments)
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["50/minute"],
        storage_uri="memory://"
    )
    print("⚠️  Rate limiting enabled with in-memory storage (single instance only)")

# ============================================================================
# FASTAPI APPLICATION SETUP
# ============================================================================

app = FastAPI(
    title="B2B Quotation Platform API",
    description="Russian B2B quotation system with multi-manager approval workflow",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Attach rate limiter to app state
app.state.limiter = limiter

# Add rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ============================================================================
# MIDDLEWARE CONFIGURATION
# ============================================================================

# CORS middleware for frontend integration
# Get frontend URL from environment variable for production
frontend_url = os.getenv("FRONTEND_URL", "")
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "https://kvotaflow.ru",  # Production domain (no www)
    "https://www.kvotaflow.ru",  # Production domain (with www)
]

# Add production frontend URL if set (for Vercel preview deployments)
if frontend_url:
    allowed_origins.append(frontend_url)
    print(f"✅ CORS configured for production: {frontend_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # Allow JavaScript to read filename from export responses
)

# Trusted host middleware for security
# Allow Railway and Vercel domains
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.railway.app", "*.vercel.app", "*.render.com", "api.kvotaflow.ru", "kvotaflow.ru", "www.kvotaflow.ru"]  # Railway, Vercel, Render, and custom domains
)

# Proxy headers middleware - trust X-Forwarded-Proto and X-Forwarded-For headers
# This is essential for Railway deployment where HTTPS terminates at the proxy
# Without this, redirects (like trailing slash redirects) will use http:// instead of https://
# causing Mixed Content errors when the frontend is served over HTTPS
app.add_middleware(
    ProxyHeadersMiddleware,
    trusted_hosts=["*"]  # Trust proxy headers from Railway/Vercel
)

# ============================================================================
# CUSTOM MIDDLEWARE
# ============================================================================

@app.middleware("http")
async def security_headers_middleware(request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

@app.middleware("http")
async def request_logging_middleware(request, call_next):
    """Log requests for debugging"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # Only log API requests (not static files)
    if request.url.path.startswith("/api/"):
        print(f"🌐 {request.method} {request.url.path} - {response.status_code} ({process_time:.3f}s)")
    
    return response

import time  # Add this import at the top

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Custom HTTP exception handler"""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "message": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path)
        }
    )

@app.exception_handler(500)
async def internal_server_error_handler(request, exc):
    """Handle internal server errors"""
    # Send Telegram notification for 500 errors
    if TELEGRAM_ENABLED:
        try:
            send_alert(
                title="500 Internal Server Error",
                message=f"Error: {str(exc)}\nTraceback: Check Sentry for details",
                severity="ERROR",
                endpoint=str(request.url.path)
            )
        except:
            pass  # Don't crash if Telegram fails

    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "Internal server error",
            "status_code": 500,
            "path": str(request.url.path)
        }
    )

# ============================================================================
# PUBLIC ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "B2B Quotation Platform API",
        "version": "1.0.0",
        "description": "Russian B2B quotation system with multi-manager approval",
        "docs": "/api/docs"
    }

@app.get("/api/health")
async def health_check(request: Request):
    """Health check endpoint"""
    try:
        # Test database connection using singleton Supabase client
        result = request.app.state.supabase.table("roles").select("count", count="exact").limit(1).execute()

        return {
            "status": "healthy",
            "database": "connected",
            "connection_type": "Supabase REST API (singleton)",
            "timestamp": time.time()
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "timestamp": time.time()
            }
        )

@app.get("/api/health/detailed")
async def health_check_detailed(request: Request):
    """
    Enhanced health check with system metrics

    Returns:
    - Database status
    - Memory usage
    - Cache sizes
    - Worker queue status
    - Last background job execution times
    """
    try:
        import psutil
        from services.activity_log_service import log_queue
        from routes.dashboard import dashboard_cache

        # Test database connection using singleton client
        result = request.app.state.supabase.table("roles").select("count", count="exact").limit(1).execute()

        # Get memory usage
        process = psutil.Process()
        memory_mb = process.memory_info().rss / 1024 / 1024

        # Get queue size
        queue_size = log_queue.qsize()

        # Get cache size
        cache_size = len(dashboard_cache)

        return {
            "status": "healthy",
            "database": "connected",
            "metrics": {
                "memory_mb": round(memory_mb, 2),
                "cache_sizes": {
                    "dashboard": cache_size,
                    "max_dashboard": 100
                },
                "worker_queue_size": queue_size,
                "max_queue_size": 10000
            },
            "timestamp": time.time()
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": time.time()
            }
        )

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

@app.get("/api/auth/me")
async def get_current_user_info(user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return {
        "user": user.dict(),
        "message": "User authenticated successfully"
    }

@app.get("/api/auth/context")
async def get_authentication_context(auth_context: AuthContext = Depends(get_auth_context)):
    """Get full authentication context"""
    return {
        "user": auth_context.user.dict(),
        "token_expires_at": auth_context.expires_at.isoformat(),
        "message": "Authentication context retrieved"
    }

# ============================================================================
# USER MANAGEMENT ENDPOINTS (Admin only)
# ============================================================================

@app.post("/api/users/create")
async def create_user_endpoint(
    user_data: dict,
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    """Create new user account (Admin only)"""
    try:
        created_user = await AuthenticationService.create_user(
            email=user_data["email"],
            password=user_data["password"],
            user_data={
                "full_name": user_data.get("full_name"),
                "role": user_data.get("role", UserRole.SALES_MANAGER),
                "department": user_data.get("department")
            }
        )
        
        return {
            "message": "User created successfully",
            "user_id": created_user.get("id")
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@app.post("/api/users/test")
async def create_test_user_endpoint():
    """Create test user for development (should be disabled in production)"""
    if os.getenv("ENVIRONMENT") == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test user creation disabled in production"
        )
    
    user_id = await create_test_user()
    if user_id:
        return {
            "message": "Test user created successfully",
            "user_id": user_id,
            "email": "test@example.com",
            "password": "testpassword123"
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create test user"
        )

# ============================================================================
# ROLE-BASED ACCESS EXAMPLES
# ============================================================================

@app.get("/api/quotes/my")
async def get_my_quotes(user: User = Depends(get_current_user)):
    """Get quotes for current user (all authenticated users)"""
    return {
        "message": f"Quotes for {user.email}",
        "user_role": user.role,
        "access_level": "own_quotes"
    }

@app.get("/api/quotes/all")
async def get_all_quotes(user: User = Depends(require_permission("quotes:read_all"))):
    """Get all quotes (managers only)"""
    return {
        "message": "All quotes access granted",
        "user_role": user.role,
        "access_level": "all_quotes"
    }

@app.post("/api/quotes/approve")
async def approve_quote(
    quote_id: str,
    user: User = Depends(require_manager_or_above())
):
    """Approve quote (manager access required)"""
    return {
        "message": f"Quote {quote_id} approved by {user.email}",
        "approver_role": user.role,
        "quote_id": quote_id
    }

@app.get("/api/admin/dashboard")
async def admin_dashboard(user: User = Depends(require_role(UserRole.ADMIN))):
    """Admin dashboard (admin only)"""
    return {
        "message": "Admin dashboard access granted",
        "user": user.email,
        "role": user.role
    }

# ============================================================================
# DATABASE ACCESS EXAMPLES (REMOVED - conflicted with routes/customers.py)
# ============================================================================
# NOTE: The customers endpoint is now in routes/customers.py

# ============================================================================
# TESTING ENDPOINTS
# ============================================================================

@app.get("/api/test/permissions")
async def test_permissions(user: User = Depends(get_current_user)):
    """Test endpoint to check user permissions"""
    return {
        "user": {
            "email": user.email,
            "role": user.role,
            "department": user.department,
            "permissions": user.permissions
        },
        "role_hierarchy": {
            "sales_manager": "Basic access to own quotes and customers",
            "finance_manager": "Financial oversight and approval rights",
            "department_manager": "Team management and approval rights", 
            "director": "Company-wide access and final approval",
            "admin": "System administration and full access"
        }
    }

@app.get("/api/test/database")
async def test_database(user: User = Depends(get_current_user)):
    """Test database connection with user context"""
    try:
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        
        # Set user context for RLS
        await conn.execute(
            "SELECT set_config('request.jwt.claims', $1, true)", 
            f'{{"sub": "{user.id}", "role": "authenticated"}}'
        )
        
        # Test basic queries
        quote_count = await conn.fetchval("SELECT COUNT(*) FROM quotes")
        customer_count = await conn.fetchval("SELECT COUNT(*) FROM customers") 
        
        await conn.close()
        
        return {
            "database_connection": "success",
            "user_context": user.id,
            "rls_enabled": True,
            "accessible_quotes": quote_count,
            "accessible_customers": customer_count
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database test failed: {str(e)}"
        )
app.include_router(customers.router)
app.include_router(quotes_upload.router)  # Excel template upload (BEFORE quotes.router for specific route matching)
app.include_router(quotes_calc.router)
app.include_router(quotes.router)
app.include_router(quote_versions.router)  # Quote versioning for multi-currency support
app.include_router(organizations.router)
app.include_router(calculation_settings.router)
app.include_router(supplier_countries.router)
app.include_router(users.router)
app.include_router(activity_logs.router)
app.include_router(exchange_rates.router)
app.include_router(org_exchange_rates.router)  # Org-specific exchange rate management
app.include_router(feedback.router)
app.include_router(dashboard.router)
app.include_router(team.router)
app.include_router(analytics.router)
app.include_router(workflow.router)
app.include_router(excel_validation.router)
app.include_router(leads_webhook.router)
app.include_router(leads.router)
app.include_router(lead_contacts.router)
app.include_router(lead_stages.router)
app.include_router(activities.router)
app.include_router(financial_approval.router)  # Financial approval workflow
app.include_router(monitoring_test.router)  # Test endpoints for Sentry + Telegram
app.include_router(webhooks.router)  # Sentry webhooks for frontend error → Telegram

@app.post("/api/admin/fix-database-function")
async def fix_database_function():
    """Fix the recalculate_quote_totals function"""
    try:
        conn = await asyncpg.connect(os.getenv("DATABASE_URL"))
        
        # Fix the database function
        await conn.execute("""
            CREATE OR REPLACE FUNCTION recalculate_quote_totals()
            RETURNS TRIGGER AS $$
            DECLARE
                quote_id_to_update UUID;
                quote_record RECORD;
                items_subtotal DECIMAL(15,2);
                quote_discount DECIMAL(15,2);
                quote_vat DECIMAL(15,2);
                quote_duties DECIMAL(15,2);
                quote_credit DECIMAL(15,2);
                final_total DECIMAL(15,2);
            BEGIN
                -- Get the quote ID (handle both INSERT/UPDATE and DELETE)
                IF TG_OP = 'DELETE' THEN
                    quote_id_to_update := OLD.quote_id;
                ELSE
                    quote_id_to_update := NEW.quote_id;
                END IF;
                
                -- Calculate subtotal from all quote items
                SELECT COALESCE(SUM(line_total), 0)
                INTO items_subtotal
                FROM quote_items 
                WHERE quote_id = quote_id_to_update;
                
                -- Get quote-level information for additional calculations
                SELECT
                    discount_type, discount_rate,
                    vat_rate, import_duty_rate, credit_rate
                INTO quote_record
                FROM quotes
                WHERE id = quote_id_to_update;

                -- Calculate quote-level discount (percentage only, fixed amount removed in migration 036)
                quote_discount := items_subtotal * COALESCE(quote_record.discount_rate, 0) / 100;
                
                -- Calculate quote-level VAT
                quote_vat := (items_subtotal - quote_discount) * (quote_record.vat_rate / 100);
                
                -- Calculate quote-level import duties
                quote_duties := (items_subtotal - quote_discount) * (quote_record.import_duty_rate / 100);
                
                -- Calculate credit cost (cost of money)
                quote_credit := (items_subtotal - quote_discount + quote_vat + quote_duties) * (quote_record.credit_rate / 100);
                
                -- Final total
                final_total := items_subtotal - quote_discount + quote_vat + quote_duties + quote_credit;
                
                -- Update the quote totals
                UPDATE quotes
                SET
                    subtotal = items_subtotal,
                    vat_amount = quote_vat,
                    import_duty_amount = quote_duties,
                    credit_amount = quote_credit,
                    total_amount = final_total,
                    updated_at = TIMEZONE('utc', NOW())
                WHERE id = quote_id_to_update;
                
                IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                ELSE
                    RETURN NEW;
                END IF;
            END;
            $$ language 'plpgsql';
        """)
        
        await conn.close()
        
        return {"message": "Database function fixed successfully"}
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )