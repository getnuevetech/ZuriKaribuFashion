# 🚀 Deploy to Cloud (No Local Setup Required)

## Option 1: Deploy to Render.com (Recommended - FREE)

### Step 1: Connect GitHub to Render
1. Go to [Render.com](https://render.com) and sign up/login
2. Click "New" → "Blueprint"
3. Connect your GitHub account
4. Select the `agolomola/AfricanFashion` repository
5. Render will automatically detect `render.yaml` and create all services

### Step 2: Configure Environment Variables
After deployment, add these in Render Dashboard:

**For african-fashion-api:**
- `STRIPE_SECRET_KEY` - Your Stripe secret key (sk_test_... or sk_live_...)
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret

**For african-fashion-web:**
- `VITE_STRIPE_PUBLIC_KEY` - Your Stripe public key (pk_test_... or pk_live_...)

### Step 3: Your Live URLs
After deployment (~5 minutes), you'll get:
- **Frontend**: https://african-fashion-web.onrender.com
- **Backend API**: https://african-fashion-api.onrender.com
- **Database**: Managed PostgreSQL (internal)

---

## Option 2: Deploy to Railway.app (Alternative)

1. Go to [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `agolomola/AfricanFashion`
4. Add PostgreSQL database from Railway dashboard
5. Set environment variables
6. Deploy!

### Railway reliability guardrails (recommended)

Use these settings on the API service to avoid "route missing" drift:

- **Root Directory:** `apps/api`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm run start`
- After changing settings: **Clear Build Cache** and redeploy.

After each deploy, run a route smoke check from repo root:

```bash
npm run smoke:api:routes -- --base="https://YOUR-RAILWAY-API-DOMAIN/api" --token="YOUR_JWT_TOKEN"
```

Expected behavior:
- `200/400/401/403` = route exists
- `404` = route missing in deployed runtime

You can also inspect runtime route fingerprint endpoints:
- `https://YOUR-RAILWAY-API-DOMAIN/health/routes`
- `https://YOUR-RAILWAY-API-DOMAIN/api/health/routes`

---

## Option 3: Deploy to Heroku

```bash
# Install Heroku CLI, then:
heroku login
heroku create african-fashion-api
heroku addons:create heroku-postgresql:mini
heroku config:set JWT_SECRET=your-secret
heroku config:set STRIPE_SECRET_KEY=sk_...
git push heroku main
```

---

## Option 4: Deploy to AWS (Production Recommended)

AWS migration assets are now included in this repository:

- `deploy/aws/README.md` (full migration runbook)
- `apps/api/Dockerfile` (ECS-ready API image)
- `apps/web/Dockerfile` + `apps/web/nginx.conf` (containerized web option)
- `apps/api/.env.aws.example`
- `apps/web/.env.aws.example`

Recommended AWS target:
- Frontend: **S3 + CloudFront**
- API: **ECS Fargate + ALB**
- DB: **RDS PostgreSQL**
- Uploads: **S3** (`AWS_UPLOADS_ENABLED=true`, `AWS_UPLOADS_REQUIRE_S3=true`)

---

## 🔑 Required Environment Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `STRIPE_SECRET_KEY` | Stripe API secret | [Stripe Dashboard](https://dashboard.stripe.com) |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint secret | Stripe Dashboard → Webhooks |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key | Stripe Dashboard |

---

## 📱 Access Your Live App

Once deployed:
1. **Customer Site**: Visit the frontend URL
2. **Admin Dashboard**: `/admin/dashboard`
3. **API Docs**: Backend URL + `/api/health`

### Default Test Accounts (after seeding):
- Customer: `customer@example.com` / `password123`
- Admin: `admin@africanfashion.com` / `admin123`
- Designer: `designer@example.com` / `password123`
- Fabric Seller: `seller@example.com` / `password123`
- QA: `qa@example.com` / `password123`

---

## 🔄 Auto-Deploy

Every push to `main` branch automatically redeploys!

---

## 💰 Costs

| Platform | Database | Backend | Frontend | Total |
|----------|----------|---------|----------|-------|
| **Render** | Free (90 days) | Free | Free | **FREE** |
| **Railway** | $5/mo | $5/mo | Free | ~$10/mo |
| **Heroku** | $5/mo | $7/mo | - | ~$12/mo |

---

## 🆘 Need Help?

If deployment fails:
1. Check Render Dashboard logs
2. Verify environment variables are set
3. Ensure database migrations ran successfully
4. Contact support or check documentation
