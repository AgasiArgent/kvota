# Deployment Guide - Vercel + Railway

Complete guide for deploying the B2B Quotation Platform to production.

**Stack:**
- **Frontend:** Vercel (Next.js 15 hosting)
- **Backend:** Railway (FastAPI + Python)
- **Database:** Supabase (already deployed ✅)

---

## Prerequisites

Before starting, ensure you have:
- [x] GitHub account with repository access
- [ ] Vercel account (sign up at vercel.com with GitHub)
- [ ] Railway account (sign up at railway.app with GitHub)
- [x] Supabase project (already set up ✅)

---

## Part 1: Deploy Frontend to Vercel

### Step 1: Sign Up for Vercel

1. Go to https://vercel.com
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your repositories

### Step 2: Import Project

1. From Vercel dashboard, click "Add New" → "Project"
2. Find `AgasiArgent/kvota` repository
3. Click "Import"

### Step 3: Configure Build Settings

Vercel should auto-detect Next.js, but verify:

- **Framework Preset:** Next.js
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `.next` (auto-detected)
- **Install Command:** `npm install`

### Step 4: Set Environment Variables

Click "Environment Variables" and add these (from `frontend/.env.local`):

| Name | Value | Notes |
|------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wstwwmiihkzlgvlymlfd.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdHd3bWlpaGt6bGd2bHltbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NjY4MzQsImV4cCI6MjA2NzE0MjgzNH0.wM4Ipk_rDwiuXbJR0olP0MCFjzZv3a46lOrBX4eTow0` | Public anon key (safe to expose) |
| `NEXT_PUBLIC_API_URL` | `https://your-backend-url.railway.app` | ⚠️ Leave blank for now, add after Railway deployment |
| `NEXT_PUBLIC_ENVIRONMENT` | `production` | Production environment flag |

**Important:** Don't deploy yet! We need the Railway backend URL first.

### Step 5: Deploy (After Railway Setup)

1. Click "Deploy" (or click "Save" and wait)
2. Wait 2-3 minutes for build
3. You'll get a URL like `https://kvota-xyz123.vercel.app`

**Save this URL** - you'll need it for Railway CORS configuration.

---

## Part 2: Deploy Backend to Railway

### Step 1: Sign Up for Railway

1. Go to https://railway.app
2. Click "Login" → "Login with GitHub"
3. Authorize Railway to access your repositories

### Step 2: Create New Project

1. Click "New Project"
2. Choose "Deploy from GitHub repo"
3. Select `AgasiArgent/kvota` repository
4. Railway will detect your backend automatically

### Step 3: Configure Service

1. Click on the service that was created
2. Go to "Settings" tab
3. Set **Root Directory:** `backend`
4. Set **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 4: Set Environment Variables

Click "Variables" tab and add these (from `backend/.env`):

| Name | Value | Notes |
|------|-------|-------|
| `SUPABASE_URL` | `https://wstwwmiihkzlgvlymlfd.supabase.co` | Same as frontend |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdHd3bWlpaGt6bGd2bHltbGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NjY4MzQsImV4cCI6MjA2NzE0MjgzNH0.wM4Ipk_rDwiuXbJR0olP0MCFjzZv3a46lOrBX4eTow0` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdHd3bWlpaGt6bGd2bHltbGZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTU2NjgzNCwiZXhwIjoyMDY3MTQyODM0fQ.9ricgGpcud76PWbxCgKuT1-fkN-ky_LOclRUJ2TuL3g` | 🔒 SENSITIVE - Admin key |
| `DATABASE_URL` | `postgresql://postgres.wstwwmiihkzlgvlymlfd:qycHLqetWDeVW9iq@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` | Database connection |
| `ENVIRONMENT` | `production` | Production environment flag |
| `SECRET_KEY` | (generate new) | ⚠️ Generate a secure random key |
| `POSTGRES_DIRECT_URL` | `postgresql://postgres:Y7pX9fL3QrD6zW@db.wstwwmiihkzlgvlymlfd.supabase.co:5432/postgres` | Direct DB connection |
| `REDIS_URL` | (leave empty) | Not needed for MVP, add later if needed |
| `FRONTEND_URL` | `https://kvota-xyz123.vercel.app` | Your Vercel URL from Part 1 (for CORS) |

**Generate SECRET_KEY:**
```bash
# Run this in your terminal to generate a secure key
openssl rand -hex 32
```

Copy the output and paste it as the `SECRET_KEY` value.

### Step 5: Deploy Backend

1. Railway should auto-deploy after adding environment variables
2. Wait 3-5 minutes for build
3. Go to "Settings" → "Networking" → "Generate Domain"
4. You'll get a URL like `https://kvota-backend-production.up.railway.app`

**Save this URL** - you need to add it to Vercel!

---

## Part 3: Connect Frontend to Backend

### Step 1: Update Vercel Environment Variable

1. Go back to Vercel dashboard
2. Select your project
3. Go to "Settings" → "Environment Variables"
4. Find `NEXT_PUBLIC_API_URL`
5. Set value to your Railway URL: `https://kvota-backend-production.up.railway.app`
6. Click "Save"

### Step 2: Redeploy Frontend

1. Go to "Deployments" tab
2. Click "..." on latest deployment
3. Click "Redeploy"
4. Wait 2 minutes

---

## Part 4: Update Backend CORS Configuration

Your backend needs to allow requests from your Vercel domain.

### Step 1: Update CORS in Backend Code

The backend CORS is already configured dynamically in `backend/main.py`, but we need to verify the `FRONTEND_URL` environment variable is set correctly.

1. Go to Railway dashboard
2. Select your backend service
3. Go to "Variables"
4. Verify `FRONTEND_URL` is set to your Vercel URL (e.g., `https://kvota-xyz123.vercel.app`)
5. If it's not set, add it now
6. Railway will auto-redeploy

### Step 2: Verify CORS Configuration

The `backend/main.py` file should have this (already configured):

```python
# CORS origins from environment
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    frontend_url
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)
```

✅ This is already in your code, so you're good!

---

## Part 5: Verify Deployment

### Health Checks

**Backend Health Check:**
1. Open `https://your-backend-url.railway.app/health`
2. You should see:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "timestamp": "2025-10-27T..."
   }
   ```

**Frontend:**
1. Open `https://your-app.vercel.app`
2. You should see the login page
3. Try logging in with test credentials:
   - Email: `andrey@masterbearingsales.ru`
   - Password: `password`

### Test User Flow

1. ✅ Login works
2. ✅ Dashboard loads
3. ✅ Navigate to Quotes page
4. ✅ Create new quote
5. ✅ Add products
6. ✅ Calculate and save
7. ✅ Export PDF/Excel

If any step fails, check browser console (F12) for errors.

---

## Part 6: Custom Domain (Optional)

### For Vercel (Frontend):

1. Go to Vercel project settings
2. Click "Domains"
3. Add your domain (e.g., `app.yourdomain.com`)
4. Update DNS records as instructed by Vercel
5. Wait for DNS propagation (5-60 minutes)

### For Railway (Backend):

Railway provides `*.up.railway.app` domains for free. Custom domains require Railway Pro ($20/month).

**For testing:** Use the Railway subdomain (`*.up.railway.app`) - it's perfectly fine.

---

## Deployment Costs

### Free Tier Limits

**Vercel:**
- ✅ Unlimited bandwidth
- ✅ 100 GB-hours/month compute (plenty for testing)
- ✅ Automatic SSL
- ✅ Global CDN

**Railway:**
- ✅ $5/month free credit
- Usage-based pricing after credit exhausted:
  - ~$0.000231/GB RAM/minute
  - ~$0.000463/vCPU/minute
  - Estimate: $5-10/month for light testing usage

**Supabase:**
- ✅ Free tier: 500 MB database, 2 GB bandwidth
- Already using this ✅

**Total Estimated Cost:** $0-5/month for testing (Railway free credit should cover 2-4 weeks)

---

## Monitoring & Logs

### Vercel Logs

1. Go to Vercel dashboard → Your project
2. Click "Logs" tab
3. See real-time frontend logs and errors

### Railway Logs

1. Go to Railway dashboard → Your backend service
2. Click "Logs" tab
3. See real-time backend logs (uvicorn, API requests, errors)

### Supabase Logs

1. Go to Supabase dashboard
2. Click "Logs" → "Postgres Logs"
3. See database queries and errors

---

## Troubleshooting

### Issue: Vercel build fails with "Module not found"

**Solution:** Check that `frontend/package.json` has all dependencies listed. Run locally:
```bash
cd frontend
npm install
npm run build
```
If it works locally, it should work on Vercel.

---

### Issue: Railway backend returns 502 Bad Gateway

**Solution:** Check Railway logs. Common causes:
- Missing environment variables (especially `SUPABASE_SERVICE_ROLE_KEY`)
- Database connection failed (check `DATABASE_URL`)
- Python dependencies failed to install (check `requirements.txt`)

---

### Issue: CORS errors in browser console

**Error:** `Access to fetch at 'https://backend.railway.app' from origin 'https://app.vercel.app' has been blocked by CORS policy`

**Solution:**
1. Verify `FRONTEND_URL` environment variable is set in Railway to your Vercel URL
2. Redeploy backend after setting the variable
3. Check `backend/main.py` has the CORS middleware configured

---

### Issue: "Not authenticated" errors

**Solution:**
1. Check that Supabase environment variables are correct on both Vercel and Railway
2. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Vercel
3. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on Railway
4. Try logging out and logging in again

---

## Security Checklist

Before sharing with users:

- [ ] `SECRET_KEY` is a strong random value (not `dev-secret-key-change-in-production`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only in Railway environment variables (not in frontend!)
- [ ] CORS is configured to only allow your Vercel domain
- [ ] Supabase RLS policies are enabled on all tables
- [ ] Database password is not exposed in frontend code
- [ ] All sensitive environment variables are set correctly

---

## Rollback Plan

If deployment has critical issues:

### Rollback Frontend (Vercel):
1. Go to Vercel → Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

### Rollback Backend (Railway):
1. Go to Railway → Deployments
2. Find previous working deployment
3. Click "..." → "Redeploy"

---

## Next Steps After Deployment

1. **Share URL with testers:**
   - Frontend: `https://your-app.vercel.app`
   - Test user: `andrey@masterbearingsales.ru` / `password`

2. **Monitor usage:**
   - Check Vercel analytics for traffic
   - Check Railway metrics for $5 credit usage
   - Watch for errors in logs

3. **Gather feedback:**
   - Use the in-app feedback button (bug icon)
   - Monitor activity logs for user actions
   - Check for errors in Vercel/Railway logs

4. **Plan for scaling:**
   - If Railway credit runs out, upgrade to $5-10/month plan
   - If Supabase database exceeds 500 MB, upgrade to $25/month Pro plan
   - If traffic is heavy, consider caching strategies

---

## Support

**Vercel Docs:** https://vercel.com/docs
**Railway Docs:** https://docs.railway.app
**Supabase Docs:** https://supabase.com/docs

**Common Commands:**

```bash
# Redeploy Vercel from CLI (optional)
cd frontend
npx vercel --prod

# Check Railway CLI status (optional)
railway status

# View Railway logs in real-time
railway logs
```

---

**Deployment Date:** 2025-10-27
**Platform:** Vercel (Frontend) + Railway (Backend) + Supabase (Database)
**Estimated Setup Time:** 30-45 minutes
