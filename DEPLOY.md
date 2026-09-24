# 🚀 Deploy to Cloud (No Local Setup Required)

## Lightsail server with Docker

This runs Postgres, the API, and the web app on one Ubuntu Lightsail instance. It creates a new database and does not use the old Railway database. The checked-in Prisma migrations do not create the full schema, so the API container applies `apps/api/prisma/schema.prisma` with `prisma db push` on startup.

1. Create an Ubuntu Lightsail instance and attach a static IP.
2. In the Lightsail networking firewall, allow TCP port 80.
3. SSH in, clone this repo, and start the stack:

```bash
git clone <this-repo-url>
cd <repo>
bash scripts/lightsail-up.sh
```

The script installs Docker if needed, writes a `.env` with generated `POSTGRES_PASSWORD` and `JWT_SECRET`, then runs `docker compose up -d --build`. The site is served on port 80. Nginx proxies `/api`, `/uploads`, and `/health` to the API.

After the first boot:

- Admin: `admin@africanfashion.com` / `Admin123!`
- Customer: `customer@example.com` / `Customer123!`

Set `FRONTEND_URL` in `.env` to the static IP or domain before rebuilding if the detected address is wrong. Leave Stripe variables empty until payments are configured. To redeploy: `docker compose up -d --build`.



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
