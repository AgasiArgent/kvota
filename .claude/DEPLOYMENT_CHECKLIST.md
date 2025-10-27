# Deployment Checklist - Quick Reference

Use this checklist while following the detailed [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

---

## Pre-Deployment Setup

- [ ] GitHub repository is accessible
- [ ] Supabase project is running ✅ (already done)
- [ ] All database migrations applied ✅ (already done)
- [ ] Test locally: frontend on :3000, backend on :8000

---

## Part 1: Vercel (Frontend) - 10 minutes

- [ ] Sign up at https://vercel.com with GitHub
- [ ] Import `AgasiArgent/kvota` repository
- [ ] Set Root Directory: `frontend`
- [ ] Add environment variables:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `NEXT_PUBLIC_API_URL` (leave blank for now)
  - [ ] `NEXT_PUBLIC_ENVIRONMENT=production`
- [ ] **DON'T DEPLOY YET** - need Railway URL first
- [ ] Save your Vercel URL (will be like `https://kvota-xyz.vercel.app`)

---

## Part 2: Railway (Backend) - 15 minutes

- [ ] Sign up at https://railway.app with GitHub
- [ ] Create new project from `AgasiArgent/kvota` repo
- [ ] Set Root Directory: `backend`
- [ ] Set Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] Add environment variables:
  - [ ] `SUPABASE_URL`
  - [ ] `SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` 🔒
  - [ ] `DATABASE_URL`
  - [ ] `POSTGRES_DIRECT_URL`
  - [ ] `ENVIRONMENT=production`
  - [ ] `SECRET_KEY` (generate with `openssl rand -hex 32`)
  - [ ] `FRONTEND_URL` (your Vercel URL)
  - [ ] `REDIS_URL` (leave empty)
- [ ] Deploy and wait 3-5 minutes
- [ ] Generate domain in Settings → Networking
- [ ] Save your Railway URL (will be like `https://kvota-backend.up.railway.app`)

---

## Part 3: Connect Frontend to Backend - 5 minutes

- [ ] Go back to Vercel
- [ ] Update `NEXT_PUBLIC_API_URL` to your Railway URL
- [ ] Redeploy frontend
- [ ] Wait 2 minutes

---

## Part 4: Verify Deployment - 10 minutes

### Backend Health Check
- [ ] Visit `https://your-backend.up.railway.app/health`
- [ ] Should see `{"status": "healthy", "database": "connected"}`

### Frontend Login
- [ ] Visit `https://your-app.vercel.app`
- [ ] Login with: `andrey@masterbearingsales.ru` / `password`
- [ ] Should redirect to dashboard

### Test Quote Creation
- [ ] Navigate to "Котировки" → "Создать КП"
- [ ] Add a product
- [ ] Click "Рассчитать"
- [ ] Should see calculation results
- [ ] Save quote
- [ ] Export PDF/Excel

---

## Security Checklist

Before sharing with users:

- [ ] `SECRET_KEY` is random (not `dev-secret-key-change-in-production`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only in Railway (not Vercel!)
- [ ] CORS configured with `FRONTEND_URL` environment variable
- [ ] All Supabase RLS policies enabled ✅
- [ ] No sensitive keys in frontend code ✅

---

## Share with Users

Once all checks pass:

- [ ] Share Vercel URL with testers
- [ ] Provide login credentials
- [ ] Monitor Railway logs for errors
- [ ] Monitor Vercel analytics for traffic
- [ ] Check Railway usage (you have $5/month free credit)

---

## Troubleshooting Quick Links

**If frontend shows blank page:**
- Check Vercel logs for build errors
- Verify all environment variables are set
- Check browser console (F12) for errors

**If backend returns 502:**
- Check Railway logs for startup errors
- Verify all environment variables are set
- Check database connection

**If CORS errors in browser:**
- Verify `FRONTEND_URL` is set in Railway
- Redeploy backend after setting variable
- Check CORS configuration in `backend/main.py`

**If "Not authenticated" errors:**
- Verify Supabase environment variables match on both platforms
- Try logging out and back in
- Check browser cookies are enabled

---

## Cost Monitoring

- **Vercel:** Free tier (unlimited for testing) ✅
- **Railway:** $5/month free credit
  - Check usage: Railway dashboard → Service → Metrics
  - Estimate: $5 should last 2-4 weeks of testing
  - If exceeded, upgrade to $5-10/month plan
- **Supabase:** Free tier (500 MB database) ✅

---

## Rollback Plan

**If something breaks:**

1. Vercel: Deployments → Find previous version → Promote to Production
2. Railway: Deployments → Find previous version → Redeploy

---

**Total Time:** 30-45 minutes
**Platforms:** Vercel + Railway + Supabase
**Status:** Ready to deploy! 🚀
