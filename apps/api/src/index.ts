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
import currencyRoutes from './routes/currency';
import { runStartupRepairs } from './bootstrap';

const app = express();
const PORT = process.env.PORT || 3001;
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'https://african-fashion-web.onrender.com',
];
const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins]);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.has(origin)) {
      return callback(null, true);
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    deployment: {
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
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
// Legacy compatibility alias for older frontend auth paths (/api/google, /api/google-link, ...)
app.use('/api', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fabric-seller', fabricSellerRoutes);
app.use('/api/designer', designerRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/homepage-sections', homepageSectionsRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/currency', currencyRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/health`);
  });
})();

export default app;
