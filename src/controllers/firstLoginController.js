// mfa-service/src/controllers/firstLoginController.js
const apiClient = require('../services/apiClient');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

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

      // Obtener usuario desde api_rest
      const userResponse = await apiClient.get(`/users/${userId}`);
      
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
      const { userId, oldPassword, newPassword } = req.body;

      // Validaciones
      if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Faltan campos requeridos'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      console.log(`🔐 Cambio de contraseña temporal - userId: ${userId}`);

      // 1️⃣ Obtener datos del usuario
      const userResponse = await apiClient.get(`/users/${userId}`);
      
      if (!userResponse.success || !userResponse.data) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const user = userResponse.data;

      // 2️⃣ ✅ VALIDACIÓN CRÍTICA: Verificar que la contraseña sea temporal
      if (user.es_temporal !== true) {
        return res.status(400).json({
          success: false,
          message: 'Este usuario no tiene una contraseña temporal activa'
        });
      }

      // 3️⃣ Verificar que la contraseña temporal sea correcta
      const isValidOldPassword = await bcrypt.compare(oldPassword, user.contrasena);
      
      if (!isValidOldPassword) {
        return res.status(401).json({
          success: false,
          message: 'La contraseña temporal es incorrecta'
        });
      }

      // 4️⃣ Hashear la nueva contraseña
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // 5️⃣ ✅ ACTUALIZAR: Nueva contraseña + es_temporal = false (UN SOLO USO)
      const updateResponse = await apiClient.put(`/users/${userId}`, {
        contrasena: newPasswordHash,
        es_temporal: false // ← CRÍTICO: Marca como NO temporal
      });

      if (!updateResponse.success) {
        throw new Error('Error al actualizar la contraseña');
      }

      console.log(`✅ Contraseña cambiada y marcada como NO temporal - userId: ${userId}`);

      // 6️⃣ Obtener usuario actualizado
      const updatedUserResponse = await apiClient.get(`/users/${userId}`);
      const updatedUser = updatedUserResponse.data;

      // 7️⃣ Verificar si requiere MFA
      if (updatedUser.mfa_activo && updatedUser.mfa_secreto) {
        // Usuario ya tiene MFA configurado - requiere verificación
        const tempToken = jwt.sign(
          { 
            userId: updatedUser.id, 
            step: 'mfa',
            usuario: updatedUser.usuario 
          },
          process.env.JWT_SECRET || 'your-secret-key',
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

      // 8️⃣ No tiene MFA - generar token final
      const finalToken = jwt.sign(
        {
          id: updatedUser.id,
          usuario: updatedUser.usuario,
          rol_id: updatedUser.rol_id,
          rol_nombre: updatedUser.rol_nombre,
          persona_id: updatedUser.persona_id
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      // 9️⃣ Crear sesión en api_rest
      await apiClient.post('/sessions', {
        usuario_id: updatedUser.id,
        token: finalToken
      });

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
      next(error);
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
        const userResponse = await apiClient.get(`/users/${userId}`);
        const user = userResponse.data;

        const finalToken = jwt.sign(
          {
            id: user.id,
            usuario: user.usuario,
            rol_id: user.rol_id,
            rol_nombre: user.rol_nombre,
            persona_id: user.persona_id
          },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        await apiClient.post('/sessions', {
          usuario_id: user.id,
          token: finalToken
        });

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