# Railway Backend Deployment Fix

**Issue:** Pipeline page doesn't load cards/leads when using Railway backend
**Root Cause:** Frontend uses HTTP instead of HTTPS, browser blocks mixed content
**Date:** 2025-11-17

---

## Problem Summary

When accessing the Vercel frontend (HTTPS) with Railway backend, the browser blocks API requests with error:

```
Mixed Content: The page at 'https://...' was loaded over HTTPS,
but requested an insecure resource 'http://kvota-production.up.railway.app/...'
This request has been blocked; the content must be served over HTTPS.
```

**Why this happens:**
- Modern browsers block HTTP requests from HTTPS pages (mixed content security policy)
- Railway provides HTTPS by default, but frontend was configured with HTTP URL
- Backend works fine (Railway logs show successful auth and 200 OK responses)
- Frontend can't receive responses because browser blocks the HTTP connection

---

## Root Cause Analysis

### Backend Status: ✅ WORKING

Railway logs confirm backend is functional:
```
[get_current_user] Final current_organization_id: 77144c58-b396-4ec7-b51a-2a822ec6d889
🌐 GET /api/leads/ - 200 OK (2.743s)
🌐 GET /api/organizations/ - 200 OK (1.320s)
```

### Frontend Issues: ❌ 2 PROBLEMS

1. **Environment Variable Uses HTTP (Vercel Deployment)**
   - `NEXT_PUBLIC_API_URL=http://kvota-production.up.railway.app` ❌
   - Should be: `NEXT_PUBLIC_API_URL=https://kvota-production.up.railway.app` ✅

2. **Hardcoded localhost URLs (6 files fixed)**
   - feedback-service.ts (4 URLs)
   - excel-validation-service.ts (1 URL)
   - customers/[id]/contacts/page.tsx (3 URLs)
   - quotes/create/page.tsx (1 URL)

3. **Missing Trailing Slashes (2 endpoints)**
   - `/api/lead-stages` → `/api/lead-stages/` (caused 307 redirects)

---

## Fixes Applied

### 1. ✅ Fixed Hardcoded URLs (6 files)

**Files modified:**
- `/frontend/src/lib/api/feedback-service.ts` (4 URLs)
- `/frontend/src/lib/api/excel-validation-service.ts` (1 URL)
- `/frontend/src/app/customers/[id]/contacts/page.tsx` (3 URLs)
- `/frontend/src/app/quotes/create/page.tsx` (1 URL)

**Before:**
```typescript
const response = await fetch('http://localhost:8000/api/feedback/', {
```

**After:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const response = await fetch(`${API_URL}/api/feedback/`, {
```

**Benefit:** All API calls now respect `NEXT_PUBLIC_API_URL` environment variable

### 2. ✅ Fixed Trailing Slashes (lead-stage-service.ts)

**Files modified:**
- `/frontend/src/lib/api/lead-stage-service.ts` (2 endpoints)

**Before:**
```typescript
fetch(`${API_URL}/api/lead-stages`, {  // ❌ Causes 307 redirect
```

**After:**
```typescript
fetch(`${API_URL}/api/lead-stages/`, {  // ✅ Direct 200 OK
```

**Benefit:** Eliminates unnecessary 307 redirects, faster response times

### 3. ⚠️ REQUIRED: Update Vercel Environment Variable

**You MUST update the Vercel environment variable:**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find `NEXT_PUBLIC_API_URL`
3. Change value from:
   ```
   http://kvota-production.up.railway.app
   ```
   to:
   ```
   https://kvota-production.up.railway.app
   ```
4. Redeploy frontend (Vercel will auto-redeploy on env var change)

**Why HTTPS:**
- Railway provides HTTPS by default for all services
- Browsers require HTTPS for requests from HTTPS pages
- No configuration needed on Railway side - HTTPS works out of the box

---

## Backend CORS Configuration

**Status:** ✅ ALREADY CORRECT

The backend (`backend/main.py:162-183`) already supports all Vercel deployments:

```python
# Line 178: Regex matches ALL Vercel subdomains
allow_origin_regex=r"https://.*\.vercel\.app"
```

This regex correctly matches:
- ✅ `https://kvota-frontend.vercel.app` (production)
- ✅ `https://kvota-frontend-git-feature-q1-c-239331-andrey-novikovs-projects.vercel.app` (preview)
- ✅ Any other Vercel deployment

**No backend changes needed.**

---

## Verification Steps

After updating Vercel environment variable to HTTPS:

1. **Test Pipeline Page:**
   ```
   Navigate to: https://your-vercel-app.vercel.app/leads/pipeline
   ```
   - ✅ Cards should load
   - ✅ Leads should appear
   - ✅ No mixed content errors in console

2. **Check Browser Console:**
   ```
   Open DevTools → Console
   Should NOT see: "Mixed Content" error
   Should see: Successful API requests (200 OK)
   ```

3. **Verify Railway Logs:**
   ```
   Railway Dashboard → Deployments → Logs
   Look for: "🌐 GET /api/lead-stages/ - 200" (not 307)
   ```

---

## Testing Locally vs Production

### Local Development (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```
- ✅ Use HTTP for localhost
- No mixed content issues (both frontend and backend on HTTP)

### Vercel Production (Environment Variables)
```bash
NEXT_PUBLIC_API_URL=https://kvota-production.up.railway.app
```
- ✅ Use HTTPS for Railway
- Matches browser security requirements

---

## Additional Improvements

### 1. Prevented Future Issues
- All API services now use `API_URL` constant (no hardcoded URLs)
- Centralized configuration via environment variable
- Easy to switch between localhost/Railway/other backends

### 2. Performance Optimization
- Eliminated 307 redirects on lead-stages endpoints
- Faster API response times (no extra round-trip)

---

## Troubleshooting

### If Pipeline Still Doesn't Load After Fix:

1. **Clear Browser Cache:**
   ```
   DevTools → Network tab → Disable cache checkbox
   Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   ```

2. **Verify Environment Variable:**
   ```
   Check Vercel Dashboard → Settings → Environment Variables
   Confirm: NEXT_PUBLIC_API_URL = https://kvota-production.up.railway.app
   ```

3. **Check Vercel Deployment:**
   ```
   Vercel Dashboard → Deployments
   Verify: Latest deployment has the updated environment variable
   If not: Trigger manual redeploy
   ```

4. **Test Railway Backend Directly:**
   ```bash
   curl -I https://kvota-production.up.railway.app/api/lead-stages/
   # Should return: 200 OK (not 404 or SSL errors)
   ```

5. **Check Browser Console for Other Errors:**
   - Open DevTools → Console
   - Look for: CORS errors, 401 Unauthorized, 403 Forbidden
   - If CORS errors: Backend CORS is already configured correctly, may need Railway restart

---

## Files Changed in This Session

**Frontend (6 files):**
1. `frontend/src/lib/api/feedback-service.ts` - Added API_URL constant, replaced 4 hardcoded URLs
2. `frontend/src/lib/api/excel-validation-service.ts` - Added API_URL constant, replaced 1 URL
3. `frontend/src/app/customers/[id]/contacts/page.tsx` - Added API_URL constant, replaced 3 URLs
4. `frontend/src/app/quotes/create/page.tsx` - Added API_URL constant, replaced 1 URL
5. `frontend/src/lib/api/lead-stage-service.ts` - Added trailing slashes to 2 endpoints
6. **RAILWAY_DEPLOYMENT_FIX.md** - This documentation

**Backend:**
- No changes required (CORS already configured correctly)

---

## Next Steps

1. ⚠️ **REQUIRED:** Update `NEXT_PUBLIC_API_URL` in Vercel to use HTTPS
2. ✅ **DONE:** Commit and push frontend changes (hardcoded URL fixes)
3. ✅ **DONE:** Redeploy to Vercel (auto-deploys on push)
4. ✅ **TEST:** Verify pipeline page loads correctly

---

## Summary

**What was wrong:**
- Vercel environment variable used HTTP instead of HTTPS
- Browser blocked HTTP requests from HTTPS page (mixed content)
- Some files had hardcoded localhost URLs (bypassed env var)
- Missing trailing slashes caused 307 redirects

**What we fixed:**
- ✅ Replaced all hardcoded URLs with environment variable
- ✅ Added trailing slashes to prevent redirects
- ⚠️ **YOU MUST:** Update Vercel env var to HTTPS

**Result:**
- All API calls now use HTTPS when deployed
- No more mixed content errors
- Faster response times (no redirects)
- Centralized configuration (easy to change backend URL)

---

**Last Updated:** 2025-11-17
