# Kvota - B2B Quotation Platform

Russian B2B quotation platform for cross-border trade (import/export).

## Tech Stack

**Frontend:**
- Next.js 15.5 (App Router with Turbopack)
- React 19
- TypeScript
- Ant Design 5.27 (UI components)
- ag-Grid 34.2 (Excel-like tables)
- Supabase client for auth

**Backend:**
- FastAPI (Python)
- Supabase PostgreSQL (with RLS)
- Pydantic (validation)
- asyncpg (database driver)

## Quick Start

### Prerequisites
- Node.js 18+ (recommended: use nvm)
- Python 3.12+
- Supabase account

### 1. Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/kvota.git
cd kvota
```

### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# Get from: https://supabase.com/dashboard > Your Project > Settings > API

# Start development server
npm run dev
```

Frontend runs at: http://localhost:3000

### 3. Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn supabase pydantic asyncpg pandas openpyxl python-multipart numpy-financial psycopg2-binary

# Copy environment template
cp .env.example .env

# Edit .env with your Supabase credentials
# Get DATABASE_URL from: Supabase Dashboard > Settings > Database > Connection string

# Start development server
python -m uvicorn main:app --reload
```

Backend runs at: http://localhost:8000
API docs at: http://localhost:8000/api/docs

### 4. Database Setup

Database migrations are in `backend/migrations/`

Run migrations via Supabase SQL Editor:
1. Go to: https://supabase.com/dashboard > Your Project > SQL Editor
2. Copy content from migration files (in order: 001, 002, 003...)
3. Execute each migration

## Project Structure

```
kvota/
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   └── lib/          # API clients, utilities
│   └── CLAUDE.md         # Frontend patterns
├── backend/              # FastAPI backend
│   ├── routes/           # API routes
│   ├── migrations/       # Database migrations
│   └── CLAUDE.md         # Backend patterns
├── .claude/              # Project documentation
│   ├── SESSION_PROGRESS.md  # Current progress
│   ├── VARIABLES.md      # 42 variables reference
│   └── reference/        # Background docs
└── CLAUDE.md             # Main project instructions
```

## Documentation

**For Developers:**
- Read `CLAUDE.md` - Main project instructions
- Read `frontend/CLAUDE.md` - Frontend patterns
- Read `backend/CLAUDE.md` - Backend patterns
- Read `.claude/VARIABLES.md` - Complete variables reference

**Current Status:**
- Check `.claude/SESSION_PROGRESS.md` for latest progress

## Development Workflow

1. **Feature development** - Work in feature branches
2. **Testing** - Test locally before committing
3. **Commit** - Descriptive commit messages
4. **Push** - Push to GitHub
5. **Review** - Code review (when team grows)

## Key Features

- 42-variable quotation system
- Two-tier variables (quote-level defaults + product overrides)
- Excel/CSV file upload for bulk products
- ag-Grid for Excel-like editing
- Multi-currency support
- Complex calculation engine (13 phases)
- Role-based access control (Admin/Manager/Member)
- Row-Level Security (RLS) for multi-tenant data

## Environment Variables

**Frontend (.env.local):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_API_URL` - Backend API URL (http://localhost:8000)

**Backend (.env):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (admin)
- `DATABASE_URL` - PostgreSQL connection string (pooler)
- `POSTGRES_DIRECT_URL` - Direct PostgreSQL connection (migrations)
- `SECRET_KEY` - Secret key for security

## Contributing

This is a private repository. Development by invitation only.

## License

Proprietary - All rights reserved
