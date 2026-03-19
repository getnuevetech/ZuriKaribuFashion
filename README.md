# 🌍 African Fashion Marketplace

A full-stack eCommerce platform connecting African fashion designers, fabric sellers, and global customers with 3D virtual try-on, order splitting, and Stripe payments.

## ✨ Features

- **5 User Types**: Customer, Fabric Seller, Fashion Designer, QA Team, Administrator
- **Order Splitting**: Automatic order distribution across Admin/Fabric/Designer
- **3D Virtual Try-On**: React Three Fiber implementation
- **Stripe Payments**: Full payment integration
- **Dynamic Pricing**: Rule-based pricing engine
- **Location Matching**: Geo-based seller/designer matching

## 🚀 Quick Deploy (No Local Setup)

### Option 1: One-Click Deploy to Render (FREE)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/blueprints?repo=https://github.com/agolomola/AfricanFashion)

1. Click the button above
2. Sign up/login to Render (free)
3. Connect your GitHub account
4. Click "Apply" - Render will automatically:
   - Create PostgreSQL database
   - Deploy backend API
   - Deploy frontend
   - Set up all services

### Option 2: Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template)

### Option 3: Deploy to AWS

AWS migration assets are available in:

- `deploy/aws/README.md`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `.github/workflows/aws-deploy-main.yml` (auto deploy on merge to `main`)

## 🤖 Cloud Agent Environment Setup

To prepare cloud agents quickly (install dependencies in both apps and generate Prisma client), run:

```bash
npm run setup:cloud
```

Repository-level defaults are configured for cloud usage:
- Node version via `.nvmrc` (20, satisfies Node 18+ requirement)
- npm cache in workspace via `.npmrc` (`.npm-cache`)

## 🔐 RBAC (Role-Based Access Control)

Access control source of truth:
- Backend permission matrix: `apps/api/src/rbac.ts`
- Backend enforcement middleware: `apps/api/src/middleware/auth.ts` (`authorizePermissions`)
- Frontend role routing helpers: `apps/web/src/auth/rbac.ts`

## 📁 Project Structure

```
AfricanFashion/
├── apps/
│   ├── api/          # Express + TypeScript Backend
│   └── web/          # React + Vite Frontend
├── packages/
│   └── database/     # Prisma + PostgreSQL
├── render.yaml       # Render deployment config
└── DEPLOY.md         # Detailed deployment guide
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TypeScript, Tailwind CSS, Three.js |
| Backend | Express, TypeScript, Prisma |
| Database | PostgreSQL |
| Auth | JWT |
| Payments | Stripe |
| State | Zustand, React Query |

## 🌐 Live URLs (After Deploy)

- **Frontend**: `https://african-fashion-web.onrender.com`
- **API**: `https://african-fashion-api.onrender.com`

## 🔑 Environment Variables

Required for production:
- `STRIPE_SECRET_KEY` - From [Stripe Dashboard](https://dashboard.stripe.com)
- `STRIPE_WEBHOOK_SECRET` - From Stripe Webhooks
- `VITE_STRIPE_PUBLIC_KEY` - From Stripe Dashboard

## 👥 Default Test Accounts

After database seeding:

| Role | Email | Password |
|------|-------|----------|
| Customer | `customer@example.com` | `password123` |
| Admin | `admin@africanfashion.com` | `admin123` |
| Designer | `designer@example.com` | `password123` |
| Fabric Seller | `seller@example.com` | `password123` |
| QA | `qa@example.com` | `password123` |

## 📖 Documentation

- [Deployment Guide](DEPLOY.md) - Detailed deployment instructions
- [AWS Migration Guide](deploy/aws/README.md) - AWS migration runbook
- [API Documentation](apps/api/README.md) - Backend API docs
- [Modularization Blueprint (Draft)](docs/architecture/modularization-blueprint.md) - Domain split and service extraction plan
- [Hybrid Kimi Adoption Blueprint (Draft)](docs/architecture/hybrid-kimi-adoption-blueprint.md) - Brand + conversion-safe rollout plan for premium editorial design
- [Kimi Handoff + Remediation Plan (Draft)](docs/architecture/kimi-design-handoff-and-remediation.md) - Actionable handoff checklist and critical/non-critical issue resolution plan

## 📝 License

MIT License - see [LICENSE](LICENSE)

---

**Ready to deploy?** Click the "Deploy to Render" button above! 🚀
