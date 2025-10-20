/**
 * Middleware global para manejo de errores
 * Captura y formatea todos los errores de la aplicación
 */

// ==================== CLASES DE ERROR PERSONALIZADAS ====================

/**
 * Error personalizado para validaciones
 */
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
    this.isOperational = true;
  }
}

/**
 * Error personalizado para autenticación
 */
class AuthenticationError extends Error {
  constructor(message = 'No autorizado') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.isOperational = true;
  }
}

/**
 * Error personalizado para recursos no encontrados
 */
class NotFoundError extends Error {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.isOperational = true;
  }
}

/**
 * Error personalizado para MFA
 */
class MFAError extends Error {
  constructor(message, code = 'MFA_ERROR') {
    super(message);
    this.name = 'MFAError';
    this.statusCode = 400;
    this.code = code;
    this.isOperational = true;
  }
}

// ==================== MIDDLEWARE PRINCIPAL ====================

/**
 * Middleware global de manejo de errores
 */
function errorHandler(err, req, res, next) {
  // Log del error para debugging
  console.error('🚨 Error Handler:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // ==================== MANEJO DE ERRORES ESPECÍFICOS ====================

  // Error de validación (Joi, custom, etc.)
  if (err.name === 'ValidationError' || err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Error de validación',
      error: {
        type: 'VALIDATION_ERROR',
        details: err.details || null,
        code: err.code || 'INVALID_INPUT'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Error de autenticación
  if (err.name === 'AuthenticationError' || err.statusCode === 401) {
    return res.status(401).json({
      success: false,
      message: err.message || 'No autorizado',
      error: {
        type: 'AUTHENTICATION_ERROR',
        code: 'UNAUTHORIZED'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Error de recurso no encontrado
  if (err.name === 'NotFoundError' || err.statusCode === 404) {
    return res.status(404).json({
      success: false,
      message: err.message || 'Recurso no encontrado',
      error: {
        type: 'NOT_FOUND_ERROR',
        code: 'RESOURCE_NOT_FOUND'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Error específico de MFA
  if (err.name === 'MFAError') {
    return res.status(400).json({
      success: false,
      message: err.message || 'Error en verificación MFA',
      error: {
        type: 'MFA_ERROR',
        code: err.code || 'MFA_VERIFICATION_FAILED'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
      error: {
        type: 'JWT_ERROR',
        code: 'INVALID_TOKEN'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Error de JWT expirado
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado',
      error: {
        type: 'JWT_ERROR',
        code: 'TOKEN_EXPIRED'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Error de Axios (comunicación con API principal)
  if (err.isAxiosError) {
    const status = err.response?.status || 500;
    const message = err.response?.data?.message || 'Error en comunicación con servicio externo';

    return res.status(status).json({
      success: false,
      message: message,
      error: {
        type: 'API_COMMUNICATION_ERROR',
        code: 'EXTERNAL_SERVICE_ERROR',
        statusCode: status
      },
      timestamp: new Date().toISOString()
    });
  }

  // ==================== ERRORES GENERALES ====================

  // Error de sintaxis JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'JSON inválido en el cuerpo de la solicitud',
      error: {
        type: 'JSON_SYNTAX_ERROR',
        code: 'INVALID_JSON'
      },
      timestamp: new Date().toISOString()
    });
  }

  // ==================== ERROR NO MANEJADO ====================

  // Error genérico del servidor (500)
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Error interno del servidor' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    message: message,
    error: {
      type: 'INTERNAL_SERVER_ERROR',
      code: 'SERVER_ERROR',
      // Solo incluir stack en desarrollo
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    timestamp: new Date().toISOString(),
    // Información adicional solo en desarrollo
    ...(process.env.NODE_ENV === 'development' && {
      _details: {
        name: err.name,
        originalMessage: err.message
      }
    })
  });
}

// ==================== FUNCIÓN DE WRAPPER PARA ASYNC ====================

/**
 * Wrapper para manejar errores en funciones async/await
 * Elimina la necesidad de try/catch en los controladores
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  asyncHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  MFAError
};