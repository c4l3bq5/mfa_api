const express = require('express');
const router = express.Router();

console.log('✅ Express router created');

const mfaController = require('../controllers/mfaController');
console.log('✅ mfaController loaded:', typeof mfaController);

const firstLoginController = require('../controllers/firstLoginController');
console.log('✅ firstLoginController loaded:', typeof firstLoginController);

// ==================== MIDDLEWARES SIMPLIFICADOS ====================

const authenticate = (req, res, next) => {
  console.log(' Authentication middleware - ALLOWING ALL');
  next();
};

const validateRequest = (req, res, next) => {
  if (req.method === 'POST' && !req.body) {
    return res.status(400).json({
      success: false,
      message: 'Request body is required'
    });
  }
  next();
};

// ==================== RUTAS MFA PRINCIPALES ====================

router.post('/generate', authenticate, validateRequest, (req, res) => mfaController.generateMFA(req, res));
router.post('/verify', authenticate, validateRequest, (req, res) => mfaController.verifyAndActivateMFA(req, res));
router.post('/verify-login', validateRequest, (req, res) => mfaController.verifyLoginMFA(req, res));
router.post('/disable', authenticate, validateRequest, (req, res) => mfaController.disableMFA(req, res));
router.get('/status/:userId', authenticate, (req, res) => mfaController.getMFAStatus(req, res));
router.post('/regenerate-backup-codes', authenticate, validateRequest, (req, res) => mfaController.regenerateBackupCodes(req, res));

// ==================== RUTAS PRIMER LOGIN ====================

router.post('/first-login/check', validateRequest, (req, res) => firstLoginController.checkFirstLogin(req, res));
router.post('/first-login/change-password', validateRequest, (req, res) => firstLoginController.changeTemporaryPassword(req, res));
router.post('/first-login/setup-mfa', authenticate, validateRequest, (req, res) => firstLoginController.setupMFAAfterFirstLogin(req, res));

// ==================== RUTAS DE HEALTH Y INFO ====================

router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'MFA Microservice',
      version: '1.0.0',
      description: 'Microservicio para autenticación de dos factores',
      endpoints: {
        mfa: {
          generate: 'POST /api/mfa/generate',
          verify: 'POST /api/mfa/verify',
          verifyLogin: 'POST /api/mfa/verify-login',
          disable: 'POST /api/mfa/disable',
          status: 'GET /api/mfa/status/:userId'
        },
        firstLogin: {
          check: 'POST /api/mfa/first-login/check',
          changePassword: 'POST /api/mfa/first-login/change-password',
          setupMFA: 'POST /api/mfa/first-login/setup-mfa'
        }
      },
      timestamp: new Date().toISOString()
    }
  });
});

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      service: 'MFA Module',
      timestamp: new Date().toISOString(),
      dependencies: {
        main_api: 'connected',
        database: 'memory'
      }
    }
  });
});

console.log('✅ Router configured, about to export');
console.log('✅ Router type:', typeof router);

module.exports = router;