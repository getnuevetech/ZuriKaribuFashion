import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs';
import { ZodError } from 'zod';

// Load environment variables
dotenv.config();

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
  console.log('📁 Created uploads directory');
}

// Import routes
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import fabricSellerRoutes from './routes/fabric-seller';
import designerRoutes from './routes/designer';
import customerRoutes from './routes/customer';
import qaRoutes from './routes/qa';
import orderRoutes from './routes/orders';
import productRoutes from './routes/products';
import uploadRoutes from './routes/upload';
import bannerRoutes from './routes/banners';
import homepageRoutes from './routes/homepage';
import homepageSectionsRoutes from './routes/homepage-sections';
import blogRoutes from './routes/blogs';
import paymentRoutes from './routes/payments';
import shippingRoutes from './routes/shipping';
import currencyRoutes from './routes/currency';
import promotionRoutes from './routes/promotions';
import orderWorkflowRoutes from './routes/order-workflow';
import adminPartnerRoutes from './routes/admin-partners';
import partnerRoutes from './routes/partner';
import categoryPageSettingsRoutes from './routes/category-page-settings';
import adminDesignerFabricCountryAccessRoutes from './routes/admin-designer-fabric-country-access';
import featuredProductRequestsRoutes from './routes/featured-product-requests';
import enterpriseRoutes from './routes/enterprise';
import { runStartupRepairs } from './bootstrap';

const app = express();
const PORT = process.env.PORT || 3001;
const API_ROUTE_FINGERPRINT_VERSION = '2026-03-05-route-guardrails-v1';
const splitOriginList = (value: string) =>
  value
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
const configuredOrigins = splitOriginList(process.env.FRONTEND_URL || '')
  .map((value) => value.trim())
  .filter(Boolean);
const trustedOriginHints = splitOriginList(process.env.CORS_TRUSTED_ORIGIN_HINTS || 'african-fashion,zurikaribu');
const allowVercelPreviewOrigins = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ALLOW_VERCEL_PREVIEW_ORIGINS || 'true').trim().toLowerCase()
);
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://african-fashion-web.onrender.com',
  'https://african-fashion-zurikaribu.vercel.app',
];
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins]);
const vercelOriginPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (/^http:\/\/localhost:\d+$/i.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    if (allowVercelPreviewOrigins && vercelOriginPattern.test(origin)) {
      const normalizedOrigin = origin.toLowerCase();
      const isTrustedVercelOrigin = trustedOriginHints.some(
        (hint) => hint && normalizedOrigin.includes(String(hint).toLowerCase())
      );
      if (isTrustedVercelOrigin) {
        return callback(null, true);
      }
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files for uploads
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static('uploads'));

const getDeploymentMetadata = () => ({
  commit:
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    null,
  branch:
    process.env.RAILWAY_GIT_BRANCH ||
    process.env.GIT_BRANCH ||
    process.env.BRANCH ||
    null,
  service: process.env.RAILWAY_SERVICE_NAME || null,
  environment: process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV || null,
});

const CRITICAL_ROUTE_PATHS = [
  '/api/promotions/preview',
  '/api/promo/preview',
  '/api/promo-codes/preview',
  '/api/payments/create-session',
  '/api/payment/create-session',
  '/api/payments/create-intent',
  '/api/orders/custom-design',
  '/api/orders/ready-to-wear',
  '/api/orders/fabric-only',
  '/api/order/fabric-order',
  '/api/customer/orders/fabric-only',
] as const;

const ROUTE_MOUNTS = [
  '/api/orders',
  '/api/order',
  '/api/customer/orders',
  '/api/payments',
  '/api/payment',
  '/api/promotions',
  '/api/promo',
  '/api/promo-codes',
] as const;

// Health checks
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    deployment: getDeploymentMetadata(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    deployment: getDeploymentMetadata(),
  });
});

app.get('/health/routes', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    deployment: getDeploymentMetadata(),
    routeFingerprint: {
      version: API_ROUTE_FINGERPRINT_VERSION,
      mounts: ROUTE_MOUNTS,
      criticalPaths: CRITICAL_ROUTE_PATHS,
    },
  });
});

app.get('/api/health/routes', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    deployment: getDeploymentMetadata(),
    routeFingerprint: {
      version: API_ROUTE_FINGERPRINT_VERSION,
      mounts: ROUTE_MOUNTS,
      criticalPaths: CRITICAL_ROUTE_PATHS,
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
// Legacy compatibility alias for older frontend auth paths (/api/google, /api/google-link, ...)
app.use('/api', authRoutes);
app.use('/api/admin/designer-fabric-country-access', adminDesignerFabricCountryAccessRoutes);
app.use('/api/admin/designer-fabric-access', adminDesignerFabricCountryAccessRoutes);
app.use('/api/admin/designer/fabric-country-access', adminDesignerFabricCountryAccessRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fabric-seller', fabricSellerRoutes);
app.use('/api/seller', fabricSellerRoutes);
app.use('/api/designer', designerRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/customer/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/homepage-sections', homepageSectionsRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/currency', currencyRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/promo', promotionRoutes);
app.use('/api/promo-codes', promotionRoutes);
app.use('/api/admin/order-workflow', orderWorkflowRoutes);
app.use('/api/admin/partners', adminPartnerRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/category-page-settings', categoryPageSettingsRoutes);
app.use('/api/featured-requests', featuredProductRequestsRoutes);
app.use('/api/featured-product-requests', featuredProductRequestsRoutes);
app.use('/api/enterprise', enterpriseRoutes);
app.use('/api/admin/enterprise', enterpriseRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (String(err?.message || '').trim().toLowerCase() === 'cors origin not allowed') {
    const origin = String(req.headers.origin || '').trim();
    console.warn(`[cors] blocked origin=${origin || 'unknown'}`);
    return res.status(403).json({
      success: false,
      message: 'CORS origin not allowed',
      origin: origin || null,
    });
  }
  console.error('Error:', err);
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.issues,
    });
  }
  const statusCode = err.status || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;
  res.status(err.status || 500).json({
    success: false,
    message: isClientError ? (err.message || 'Request failed') : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

void (async () => {
  try {
    await runStartupRepairs();
  } catch (error) {
    console.error('Startup repairs failed:', error);
  }

  app.listen(PORT, () => {
    const deployment = getDeploymentMetadata();
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`[runtime] node=${process.version}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/health`);
    console.log(
      `[deploy] route-fingerprint=${API_ROUTE_FINGERPRINT_VERSION} commit=${deployment.commit || 'n/a'} branch=${deployment.branch || 'n/a'} service=${deployment.service || 'n/a'} env=${deployment.environment || 'n/a'}`
    );
    console.log(`[deploy] verify with /health/routes and /api/health/routes`);
  });
})();

export default app;
