# AWS Migration Guide (African Fashion Platform)

This repository now includes AWS-ready container images and S3-backed upload support.

## Target Architecture

- **Frontend (`apps/web`)**: S3 + CloudFront (recommended) or ECS/Nginx container
- **API (`apps/api`)**: ECS Fargate behind ALB
- **Database**: Amazon RDS PostgreSQL
- **Uploads**: Amazon S3 bucket (enabled via API env variables)
- **Secrets**: AWS Secrets Manager / SSM Parameter Store

---

## 1) Build and push API image (ECR)

```bash
aws ecr create-repository --repository-name african-fashion-api || true
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

docker build -t african-fashion-api:latest ./apps/api
docker tag african-fashion-api:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/african-fashion-api:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/african-fashion-api:latest
```

---

## 2) Provision PostgreSQL (RDS)

- Create PostgreSQL RDS instance in private subnets.
- Create database and user.
- Save connection string into Secrets Manager:
  - `DATABASE_URL=postgresql://...`

Run migrations once after API task is reachable:

```bash
# Example inside ECS task shell or one-off migration task
cd /app
npx prisma migrate deploy
```

---

## 3) Configure API ECS service

Use `apps/api/Dockerfile` image with container port `3001`.

Recommended health check path:
- `/health`

Minimum env variables:

- `NODE_ENV=production`
- `PORT=3001`
- `DATABASE_URL` (from Secrets Manager)
- `JWT_SECRET`
- `FRONTEND_URL=https://<your-frontend-domain>`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLIC_KEY` equivalents as needed

For S3 uploads (stateless API containers):

- `AWS_UPLOADS_ENABLED=true`
- `AWS_UPLOADS_BUCKET=<uploads-bucket-name>`
- `AWS_UPLOADS_REGION=<region>`
- `AWS_UPLOADS_PREFIX=uploads` (optional)
- `AWS_UPLOADS_BASE_URL=https://<cloudfront-or-public-bucket-domain>` (optional)

> IAM task role must allow `s3:PutObject` on uploads bucket prefix.

---

## 4) Frontend deployment

### Recommended: S3 + CloudFront

```bash
cd apps/web
npm ci
VITE_API_URL=https://<api-domain>/api npm run build
aws s3 sync dist/ s3://<frontend-bucket>/ --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

### Optional: containerized frontend

- Use `apps/web/Dockerfile` and `apps/web/nginx.conf`.
- Pass build arg:
  - `--build-arg VITE_API_URL=https://<api-domain>/api`

---

## 5) Cutover checklist

1. Deploy API and run migrations
2. Confirm `GET /health` and `GET /api/health`
3. Confirm upload endpoint works and returns S3 URL
4. Deploy frontend with `VITE_API_URL` pointing to AWS API domain
5. Configure Route53 + ACM certificates
6. Monitor logs in CloudWatch for 4xx/5xx spikes

---

## 6) Rollback strategy

- Keep previous deployment target active (Render/Railway) until AWS smoke tests pass.
- Keep old DNS TTL low during cutover.
- Rollback by switching DNS back if critical path fails.

