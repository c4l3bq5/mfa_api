const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ==================== UTILIDADES JWT ====================

/**
 * Genera un token JWT
 */
function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Verifica un token JWT
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido o expirado');
  }
}

// ==================== UTILIDADES MFA ====================

/**
 * Genera códigos de respaldo para MFA
 */
function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(6).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Valida formato de código MFA (6 dígitos)
 */
function isValidMFACode(code) {
  return /^\d{6}$/.test(code);
}

/**
 * Genera un ID único para transacciones MFA
 */
function generateTransactionId() {
  return crypto.randomBytes(16).toString('hex');
}

// ==================== UTILIDADES GENERALES ====================

/**
 * Formatea respuesta estándar para API
 */
function formatResponse(success, message, data = null) {
  return {
    success,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Limpia y valida datos de entrada
 */
function sanitizeInput(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = value.trim();
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Delay helper para testing
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  generateToken,
  verifyToken,
  generateBackupCodes,
  isValidMFACode,
  generateTransactionId,
  formatResponse,
  sanitizeInput,
  delay
};