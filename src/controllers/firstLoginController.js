// mfa-service/src/controllers/firstLoginController.js
const apiClient = require('../services/apiClient');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

const firstLoginController = {
  /**
   * Verificar si es el primer login de un usuario
   * POST /api/mfa/first-login/check
   */
  async checkFirstLogin(req, res, next) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId es requerido'
        });
      }

      console.log(`🔍 Verificando primer login - userId: ${userId}`);

      const userResponse = await apiClient.getUserById(userId);
      
      if (!userResponse.success || !userResponse.data) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const user = userResponse.data;

      res.json({
        success: true,
        data: {
          isFirstLogin: user.es_temporal === true,
          requiresMFA: user.mfa_activo === true,
          user: {
            id: user.id,
            usuario: user.usuario,
            es_temporal: user.es_temporal,
            mfa_activo: user.mfa_activo
          }
        }
      });

    } catch (error) {
      console.error('❌ Error en checkFirstLogin:', error);
      next(error);
    }
  },

  /**
   * Cambiar contraseña temporal (ÚNICO USO)
   * POST /api/mfa/first-login/change-password
   */
  async changeTemporaryPassword(req, res, next) {
    try {
      const { userId, currentPassword, newPassword } = req.body;

      console.log('🔐 Iniciando cambio de contraseña temporal...');
      console.log('📦 Datos recibidos:', { 
        userId, 
        hasCurrentPassword: !!currentPassword, 
        hasNewPassword: !!newPassword 
      });

      // Validaciones
      if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'userId, currentPassword y newPassword son requeridos'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 8 caracteres'
        });
      }

      console.log(`🔍 Obteniendo datos del usuario ${userId}...`);

      // 1️⃣ Obtener datos del usuario
      const userResponse = await apiClient.getUserById(userId);
      
      if (!userResponse.success || !userResponse.data) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const user = userResponse.data;
      console.log('✅ Usuario encontrado:', user.usuario);

      // 2️⃣ VALIDACIÓN CRÍTICA: Verificar que la contraseña sea temporal
      if (user.es_temporal !== true) {
        return res.status(400).json({
          success: false,
          message: 'Este usuario no tiene una contraseña temporal activa'
        });
      }

      console.log('✅ Usuario tiene contraseña temporal');

      // 3️⃣ Verificar que la contraseña temporal sea correcta
      const isValidOldPassword = await bcrypt.compare(
        currentPassword, 
        user.contrasena
      );
      
      if (!isValidOldPassword) {
        console.log('❌ Contraseña temporal incorrecta');
        return res.status(401).json({
          success: false,
          message: 'La contraseña temporal es incorrecta'
        });
      }

      console.log('✅ Contraseña temporal verificada');

      // 4️⃣ Hashear la nueva contraseña
      console.log('🔐 Hasheando nueva contraseña...');
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // 5️⃣ 🔥 CORRECCIÓN CRÍTICA: Usar contrasena_hasheada
      console.log('🔄 Actualizando contraseña en BD...');
      const updateResponse = await apiClient.updateUser(userId, {
        contrasena_hasheada: newPasswordHash, // 🔥 CAMBIO: Indicar que ya está hasheada
        es_temporal: false
      });

      if (!updateResponse.success) {
        throw new Error('Error al actualizar la contraseña');
      }

      console.log(`✅ Contraseña cambiada y marcada como NO temporal`);

      // 6️⃣ Obtener usuario actualizado
      const updatedUserResponse = await apiClient.getUserById(userId);
      const updatedUser = updatedUserResponse.data;

      // 7️⃣ Verificar si requiere MFA
      if (updatedUser.mfa_activo && updatedUser.mfa_secreto) {
        console.log('🔐 Usuario tiene MFA activado, requiere verificación');
        
        const tempToken = jwt.sign(
          { 
            userId: updatedUser.id, 
            step: 'mfa',
            usuario: updatedUser.usuario 
          },
          JWT_SECRET,
          { expiresIn: '10m' }
        );

        return res.json({
          success: true,
          message: 'Contraseña cambiada. Verificación MFA requerida',
          data: {
            requiresMFA: true,
            requiresSetupMFA: false,
            token: tempToken,
            user: {
              id: updatedUser.id,
              usuario: updatedUser.usuario,
              nombre: updatedUser.nombre,
              a_paterno: updatedUser.a_paterno,
              a_materno: updatedUser.a_materno,
              rol_nombre: updatedUser.rol_nombre,
              mfa_activo: updatedUser.mfa_activo
            }
          }
        });
      }

      console.log('✅ Usuario sin MFA, generando token final');

      // 8️⃣ No tiene MFA - generar token final
      const finalToken = jwt.sign(
        {
          id: updatedUser.id,
          usuario: updatedUser.usuario,
          rol_id: updatedUser.rol_id,
          rol_nombre: updatedUser.rol_nombre,
          persona_id: updatedUser.persona_id
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      // 9️⃣ Crear sesión en api_rest
      try {
        await apiClient.createSession(updatedUser.id, finalToken);
        console.log('✅ Sesión creada en api_rest');
      } catch (sessionError) {
        console.warn('⚠️ No se pudo crear sesión, pero continuando:', sessionError.message);
      }

      console.log(`✅ Login completo sin MFA - userId: ${userId}`);

      res.json({
        success: true,
        message: 'Contraseña cambiada exitosamente',
        data: {
          requiresMFA: false,
          requiresSetupMFA: false,
          token: finalToken,
          user: {
            id: updatedUser.id,
            usuario: updatedUser.usuario,
            nombre: updatedUser.nombre,
            a_paterno: updatedUser.a_paterno,
            a_materno: updatedUser.a_materno,
            rol_nombre: updatedUser.rol_nombre,
            mfa_activo: updatedUser.mfa_activo
          }
        }
      });

    } catch (error) {
      console.error('❌ Error en changeTemporaryPassword:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cambiar contraseña',
        error: error.message
      });
    }
  },

  /**
   * Configurar MFA después del primer login
   * POST /api/mfa/first-login/setup-mfa
   */
  async setupMFAAfterFirstLogin(req, res, next) {
    try {
      const { userId, enableMFA } = req.body;

      if (!userId || enableMFA === undefined) {
        return res.status(400).json({
          success: false,
          message: 'userId y enableMFA son requeridos'
        });
      }

      console.log(`🔐 Setup MFA después de primer login - userId: ${userId}, enableMFA: ${enableMFA}`);

      // Si el usuario NO quiere MFA, completar el login
      if (!enableMFA) {
        const userResponse = await apiClient.getUserById(userId);
        const user = userResponse.data;

        const finalToken = jwt.sign(
          {
            id: user.id,
            usuario: user.usuario,
            rol_id: user.rol_id,
            rol_nombre: user.rol_nombre,
            persona_id: user.persona_id
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        await apiClient.createSession(user.id, finalToken);

        return res.json({
          success: true,
          message: 'Login completado sin MFA',
          data: {
            token: finalToken,
            user: {
              id: user.id,
              usuario: user.usuario,
              nombre: user.nombre,
              a_paterno: user.a_paterno,
              a_materno: user.a_materno,
              rol_nombre: user.rol_nombre,
              mfa_activo: false
            }
          }
        });
      }

      // Si quiere MFA, generar QR
      const speakeasy = require('speakeasy');
      const QRCode = require('qrcode');

      const secret = speakeasy.generateSecret({
        name: `TraumatologiaApp (${userId})`,
        length: 32
      });

      const qrCode = await QRCode.toDataURL(secret.otpauth_url);

      res.json({
        success: true,
        message: 'Código QR generado para configurar MFA',
        data: {
          qrCode,
          secret: secret.base32,
          userId
        }
      });

    } catch (error) {
      console.error('❌ Error en setupMFAAfterFirstLogin:', error);
      next(error);
    }
  }
};

module.exports = firstLoginController;