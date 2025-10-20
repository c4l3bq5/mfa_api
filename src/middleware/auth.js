const { verifyToken } = require('../utils/helpers');
const { AuthenticationError } = require('./errorHandler');
const apiClient = require('../services/apiClient');

/**
 * Middleware de autenticación JWT
 * Verifica que el token sea válido y obtiene datos del usuario
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Obtener token del header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Token de autorización requerido');
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      throw new AuthenticationError('Token no proporcionado');
    }

    console.log(' Authenticating token...');

    // 2. Verificar token JWT
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token expirado');
      }
      if (jwtError.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Token inválido');
      }
      throw new AuthenticationError('Error al verificar token');
    }

    // 3. Validar estructura básica del token
    if (!decoded.userId || !decoded.username) {
      throw new AuthenticationError('Token con estructura inválida');
    }

    // 4. (Opcional) Verificar usuario en API principal
    // Esto asegura que el usuario aún existe y está activo
    try {
      const user = await apiClient.getUserById(decoded.userId);
      
      if (!user) {
        throw new AuthenticationError('Usuario no encontrado');
      }

      if (user.activo !== 'activo') {
        throw new AuthenticationError('Usuario inactivo');
      }

      // Adjuntar datos del usuario al request
      req.user = {
        id: user.id,
        username: user.usuario,
        personaId: user.persona_id,
        rol: user.rol_nombre,
        mfaEnabled: user.mfa_activo || false,
        isTemporaryPassword: user.contrasena_temporal || false
      };

      console.log(`  Authenticated user: ${req.user.username} (ID: ${req.user.id})`);

    } catch (apiError) {
      console.error(' Error verifying user with main API:', apiError.message);
      // Podemos decidir si fallar o continuar con los datos del token
      // Por seguridad, fallamos si no podemos verificar con la API principal
      throw new AuthenticationError('No se pudo verificar el usuario');
    }

    next();

  } catch (error) {
    next(error);
  }
};

/**
 * Middleware de autorización por roles
 * Verifica que el usuario tenga el rol requerido
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Usuario no autenticado');
      }

      // Si no se especifican roles, cualquier usuario autenticado puede acceder
      if (allowedRoles.length === 0) {
        return next();
      }

      // Verificar si el usuario tiene uno de los roles permitidos
      if (!allowedRoles.includes(req.user.rol)) {
        throw new AuthenticationError('No tiene permisos para esta acción');
      }

      console.log(` Authorized user ${req.user.username} with role: ${req.user.rol}`);
      next();

    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar MFA
 * Verifica que el usuario tenga MFA habilitado y verificado
 */
const requireMFA = (req, res, next) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Usuario no autenticado');
    }

    // Verificar si el usuario tiene MFA habilitado
    if (!req.user.mfaEnabled) {
      throw new AuthenticationError('MFA no configurado para este usuario');
    }

    // En una implementación completa, verificaríamos si la sesión actual
    // ya pasó por verificación MFA (usando un flag en la sesión)
    
    console.log(` MFA required for user: ${req.user.username}`);
    next();

  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para verificar que NO es contraseña temporal
 * Útil para forzar cambio de contraseña en primer login
 */
const requirePasswordChange = (req, res, next) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Usuario no autenticado');
    }

    if (req.user.isTemporaryPassword) {
      return res.status(403).json({
        success: false,
        message: 'Debe cambiar su contraseña temporal antes de continuar',
        code: 'TEMPORARY_PASSWORD_REQUIRED',
        requiresPasswordChange: true
      });
    }

    next();

  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para desarrollo - Autenticación simulada
 * SOLO USAR EN DESARROLLO
 */
const mockAuthenticate = (req, res, next) => {
  if (process.env.NODE_ENV !== 'development') {
    return next(new AuthenticationError('Mock auth solo disponible en desarrollo'));
  }

  // Usuario mock para desarrollo
  req.user = {
    id: 1,
    username: 'admin_dev',
    personaId: 1,
    rol: 'admin',
    mfaEnabled: false,
    isTemporaryPassword: false
  };

  console.log(' Using mock authentication (DEV ONLY)');
  next();
};

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero adjunta user si existe
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continúa sin usuario
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      return next(); // Continúa sin usuario
    }

    // Verificar token
    const decoded = verifyToken(token);
    
    if (decoded.userId) {
      // Obtener usuario de API principal
      const user = await apiClient.getUserById(decoded.userId);
      
      if (user && user.activo === 'activo') {
        req.user = {
          id: user.id,
          username: user.usuario,
          personaId: user.persona_id,
          rol: user.rol_nombre,
          mfaEnabled: user.mfa_activo || false,
          isTemporaryPassword: user.contrasena_temporal || false
        };
        
        console.log(` Optional auth - User: ${req.user.username}`);
      }
    }

    next();

  } catch (error) {
    // En autenticación opcional, ignoramos errores de token
    console.log(' Optional auth - Invalid token, continuing without user');
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  requireMFA,
  requirePasswordChange,
  mockAuthenticate,
  optionalAuthenticate
};