// mfa-service/src/app.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const mfaRoutes = require('./routes/mfa');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== CORS CONFIGURATION ====================
// ✅ CORS PERMISIVO - Permite TODOS los orígenes
app.use(cors({
  origin: '*', // Permitir TODOS los orígenes
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: false, // Cambiar a false cuando origin es '*'
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware (útil para debugging)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
  if (req.method === 'POST' && req.body) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// ==================== ROUTES ====================
app.use('/api/mfa', mfaRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MFA Service API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      info: '/api/mfa/info',
      generate: 'POST /api/mfa/generate',
      verify: 'POST /api/mfa/verify',
      verifyLogin: 'POST /api/mfa/verify-login',
      firstLogin: {
        check: 'POST /api/mfa/first-login/check',
        changePassword: 'POST /api/mfa/first-login/change-password'
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    service: 'MFA Service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mainApiUrl: process.env.MAIN_API_URL
  });
});

// ==================== ERROR HANDLERS ====================
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/mfa/info',
      'POST /api/mfa/generate',
      'POST /api/mfa/verify',
      'POST /api/mfa/verify-login',
      'POST /api/mfa/first-login/check',
      'POST /api/mfa/first-login/change-password'
    ]
  });
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MFA Service running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Main API: ${process.env.MAIN_API_URL || 'Not configured'}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Endpoints: http://localhost:${PORT}/`);
});

module.exports = app;