# Wizard Specification - 12 Questions
**Version:** 1.0  
**Created:** 2025-10-30

---

## Question 1: Project Name

**Prompt:** "What is your project name?"

**Type:** Text input

**Validation:**
- 3-50 characters
- Alphanumeric + hyphens/underscores
- No spaces
- Lowercase recommended

**Example Answers:**
- "my-crm-app"
- "booking_system"
- "inventory-tracker"

**Used For:**
- Directory name
- Package name
- Database name
- Default domain

---

## Question 2: Project Description

**Prompt:** "Briefly describe your project (1-2 sentences)"

**Type:** Text input

**Validation:**
- 10-200 characters
- Free text

**Example Answers:**
- "A CRM for managing B2B client relationships and sales pipeline"
- "Internal tool for tracking inventory across multiple warehouses"
- "Booking system for yoga studios with class scheduling"

**Used For:**
- README description
- Package.json description
- Documentation generation

---

## Question 3: Business Type

**Prompt:** "What type of business app are you building?"

**Type:** Single select

**Choices:**
1. **B2B Platform** (SaaS, marketplace)
   - Scoring: +2 Next+FastAPI, +2 Next+Supabase
2. **Internal Tool** (CRM, admin dashboard)
   - Scoring: +3 Rails, +2 Django
3. **E-commerce** (online store, booking)
   - Scoring: +2 Rails, +1 Django
4. **Content Platform** (blog, docs)
   - Scoring: +2 Next+Supabase, +1 Rails
5. **Mobile-first App** (with backend API)
   - Scoring: +3 Next+FastAPI, +2 Next+Supabase
6. **Other** (will specify)
   - Scoring: Neutral

**Example Impact:**
- B2B Platform → Favors API-first architectures
- Internal Tool → Favors rapid development (Rails/Django)
- Mobile-first → Strongly favors decoupled backend

---

## Question 4: Expected User Count

**Prompt:** "How many users do you expect in the first year?"

**Type:** Single select

**Choices:**
1. **1-100** (Small team/pilot)
   - Scoring: +1 All stacks
2. **100-1,000** (Growing startup)
   - Scoring: +1 All stacks
3. **1,000-10,000** (Established product)
   - Scoring: +1 Next+FastAPI, +1 Next+Supabase
4. **10,000+** (High scale)
   - Scoring: +2 Next+FastAPI, -1 Rails (performance)

**Example Impact:**
- 1-100: Any stack works
- 10,000+: Need horizontal scaling (favors stateless APIs)

---

## Question 5: Data Volume

**Prompt:** "How much data will you handle?"

**Type:** Single select

**Choices:**
1. **Small** (<10k records)
   - Scoring: +1 All stacks
2. **Medium** (10k-100k records)
   - Scoring: +1 All stacks
3. **Large** (100k-1M records)
   - Scoring: +1 Next+FastAPI, +1 Django
4. **Very Large** (1M+ records)
   - Scoring: +2 Next+FastAPI (async), -1 Rails (ActiveRecord overhead)

**Example Impact:**
- Small/Medium: Any stack fine
- Very Large: Need query optimization (favors explicit SQL control)

---

## Question 6: Real-Time Requirements

**Prompt:** "Do you need real-time features? (live updates, chat, notifications)"

**Type:** Yes/No

**Choices:**
1. **Yes** - Need real-time
   - Scoring: +3 Rails (Hotwire), +3 Next+Supabase (real-time DB)
2. **No** - Standard request/response is fine
   - Scoring: +1 All stacks

**Example Impact:**
- Yes → Strongly favors Rails (Turbo Streams) or Supabase (subscriptions)
- No → Doesn't affect choice

---

## Question 7: Mobile-First

**Prompt:** "Will this be primarily accessed from mobile devices?"

**Type:** Yes/No

**Choices:**
1. **Yes** - Mobile-first
   - Scoring: +3 Next+FastAPI, +3 Next+Supabase (API-first)
2. **No** - Desktop/web-first
   - Scoring: +2 Rails, +2 Django (server-rendered)

**Example Impact:**
- Yes → Strongly favors decoupled frontend/backend (API)
- No → Monoliths (Rails/Django) are fine

---

## Question 8: Team Size

**Prompt:** "How many developers will work on this?"

**Type:** Single select

**Choices:**
1. **Just me** (solo)
   - Scoring: +2 Next+Supabase (simplest deployment)
2. **2-3 developers**
   - Scoring: +1 All stacks
3. **4-10 developers**
   - Scoring: +1 Next+FastAPI (clear separation), +1 Django
4. **10+ developers**
   - Scoring: +2 Next+FastAPI (microservices-ready)

**Example Impact:**
- Solo → Simplicity matters most
- 10+ → Need clear separation (frontend/backend teams)

---

## Question 9: Backend Experience

**Prompt:** "What backend language is your team most comfortable with?"

**Type:** Single select

**Choices:**
1. **Python**
   - Scoring: +4 Next+FastAPI, +4 Django
2. **Ruby**
   - Scoring: +5 Rails
3. **JavaScript/TypeScript**
   - Scoring: +2 Next+Supabase (minimal backend)
4. **None / Learning**
   - Scoring: +3 Next+Supabase (serverless, easier)

**Example Impact:**
- Python → Strongly favors FastAPI or Django
- None → Strongly favors serverless (Supabase)

---

## Question 10: Deployment Complexity Tolerance

**Prompt:** "How comfortable are you with deployment complexity?"

**Type:** Single select

**Choices:**
1. **I want one-click deployment**
   - Scoring: +4 Next+Supabase (Vercel + Supabase = 2 clicks)
2. **I can handle moderate setup** (Docker, Railway)
   - Scoring: +2 Rails, +2 Django, +1 Next+FastAPI
3. **I'm comfortable with full DevOps** (AWS, K8s)
   - Scoring: +1 All stacks

**Example Impact:**
- One-click → Strongly favors Next+Supabase
- Full DevOps → Any stack works

---

## Question 11: Budget Constraints

**Prompt:** "What's your monthly hosting budget for first year?"

**Type:** Single select

**Choices:**
1. **Minimal** ($0-20/month)
   - Scoring: +2 Rails/Django (self-hosted cheapest), -1 Supabase (free tier limited)
2. **Low** ($20-100/month)
   - Scoring: +1 All stacks
3. **Medium** ($100-500/month)
   - Scoring: +1 All stacks
4. **High** ($500+/month)
   - Scoring: +1 All stacks

**Example Impact:**
- Minimal → Self-hosted (Rails/Django) on cheap VPS
- High → Doesn't matter, use best tool

---

## Question 12: Must-Have Features

**Prompt:** "Select all features you need (multi-select):"

**Type:** Multi-select

**Choices:**
- **User Authentication** (all stacks: +1)
- **Multi-tenant/Organizations** (+1 Rails, +2 Next+FastAPI/Supabase)
- **PDF/Excel Exports** (+2 Rails, +2 Django, +1 Next+FastAPI)
- **File Uploads** (+1 all stacks)
- **Payment Processing** (+2 Next+Supabase, +1 Rails)
- **Email Notifications** (+1 all stacks)
- **Search/Filtering** (+1 all stacks)
- **Real-time Chat** (+3 Rails, +3 Next+Supabase)
- **Third-party Integrations** (+1 all stacks)
- **Mobile App** (+3 Next+FastAPI, +3 Next+Supabase)

**Example Impact:**
- Multi-tenant → Needs RLS (Supabase) or careful architecture
- Exports → Needs backend processing (Rails/Django/FastAPI)
- Mobile App → Needs API-first (FastAPI/Supabase)

---

## Recommendation Algorithm

```javascript
function recommendStack(answers) {
  const scores = {
    rails: { score: 0, reasons: [] },
    'nextjs-fastapi': { score: 0, reasons: [] },
    'nextjs-supabase': { score: 0, reasons: [] },
    django: { score: 0, reasons: [] }
  };
  
  // Q3: Business Type
  if (answers.businessType === 'B2B Platform') {
    scores['nextjs-fastapi'].score += 2;
    scores['nextjs-fastapi'].reasons.push('API-first architecture ideal for B2B platforms');
    scores['nextjs-supabase'].score += 2;
    scores['nextjs-supabase'].reasons.push('Fast development for SaaS products');
  }
  
  // Q6: Real-time
  if (answers.realTime === 'yes') {
    scores.rails.score += 3;
    scores.rails.reasons.push('Hotwire provides excellent real-time capabilities');
    scores['nextjs-supabase'].score += 3;
    scores['nextjs-supabase'].reasons.push('Supabase real-time subscriptions are powerful');
  }
  
  // Q9: Backend Experience
  if (answers.backendExperience === 'Python') {
    scores['nextjs-fastapi'].score += 4;
    scores['nextjs-fastapi'].reasons.push('Team knows Python - FastAPI is excellent choice');
    scores.django.score += 4;
    scores.django.reasons.push('Team knows Python - Django is mature framework');
  }
  
  // ... 30+ more rules
  
  // Pick winner
  const winner = Object.keys(scores).reduce((a, b) => 
    scores[a].score > scores[b].score ? a : b
  );
  
  return {
    recommended: winner,
    allScores: scores,
    reasoning: scores[winner].reasons,
    confidence: calculateConfidence(scores)
  };
}

function calculateConfidence(scores) {
  const winner = Math.max(...Object.values(scores).map(s => s.score));
  const secondPlace = Object.values(scores)
    .map(s => s.score)
    .sort((a, b) => b - a)[1];
  
  const gap = winner - secondPlace;
  
  // Confidence based on gap
  // Gap >= 8: High confidence (90%)
  // Gap 5-7: Medium confidence (70%)
  // Gap < 5: Low confidence (50%)
  return gap >= 8 ? 'high' : gap >= 5 ? 'medium' : 'low';
}
```

---

## Example Wizard Session

```
$ npx create-claude-app

🚀 Claude App Builder Framework v1.0
Let's build your business app together!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section 1: Project Basics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? What is your project name? › my-crm-app

? Briefly describe your project (1-2 sentences)
› A CRM for managing B2B client relationships and sales pipeline

? What type of business app are you building? 
❯ B2B Platform (SaaS, marketplace)
  Internal Tool (CRM, admin dashboard)
  E-commerce (online store, booking)
  Content Platform (blog, docs)
  Mobile-first App (with backend API)
  Other (I'll specify)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section 2: Technical Requirements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? How many users do you expect in the first year?
  1-100 (Small team/pilot)
❯ 100-1,000 (Growing startup)
  1,000-10,000 (Established product)
  10,000+ (High scale)

? How much data will you handle?
  Small (<10k records)
❯ Medium (10k-100k records)
  Large (100k-1M records)
  Very Large (1M+ records)

? Do you need real-time features? (Y/n) › No

? Will this be primarily accessed from mobile devices? (Y/n) › No

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section 3: Team Context
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? How many developers will work on this?
  Just me
❯ 2-3 developers
  4-10 developers
  10+ developers

? What backend language is your team most comfortable with?
❯ Python
  Ruby
  JavaScript/TypeScript
  None / Learning

? How comfortable are you with deployment complexity?
  I want one-click deployment
❯ I can handle moderate setup (Docker, Railway)
  I'm comfortable with full DevOps (AWS, K8s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Section 4: Feature Priorities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

? Select all features you need: (Use space to select, enter to confirm)
❯ ◉ User Authentication
  ◉ Multi-tenant/Organizations
  ◉ PDF/Excel Exports
  ◉ File Uploads
  ◯ Payment Processing
  ◉ Email Notifications
  ◉ Search/Filtering
  ◯ Real-time Chat
  ◯ Third-party Integrations
  ◯ Mobile App

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 Analyzing your requirements...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Recommendation: Next.js + FastAPI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Confidence: High (90%)

Why we recommend this stack:

✅ Your team knows Python (FastAPI is excellent for Python developers)
✅ B2B platform needs API-first architecture (FastAPI provides this)
✅ Multi-tenant support built into template
✅ PDF/Excel exports included in backend services
✅ Moderate deployment complexity fits your tolerance
✅ Scales well for 100-1,000 users

Other options considered:
- Django: Score 18 (good for Python teams, but less API-focused)
- Rails: Score 12 (excellent framework, but Ruby not in your skillset)
- Next.js + Supabase: Score 14 (simpler deployment, but less control)

? Proceed with Next.js + FastAPI? (Y/n) › Yes

✅ Great choice! Generating your project...

[Progress bar]

✅ Project generated successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. cd my-crm-app
2. Set up environment variables:
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env

3. Start development servers:
   # Terminal 1 (Backend)
   cd backend && uvicorn main:app --reload

   # Terminal 2 (Frontend)
   cd frontend && npm run dev

4. Open http://localhost:3000

5. Read README.md for detailed setup guide

🎉 Happy coding!
```

---

**End of Wizard Specification**
