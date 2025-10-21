// mfa-service/src/controllers/firstLoginController.js
const apiClient = require('../services/apiClient');
const mfaService = require('../services/mfaService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class FirstLoginController {

  // ==================== VERIFICAR SI ES PRIMER LOGIN ====================
  
  /**
   * Verifica si un usuario tiene contraseña temporal
   * POST /api/mfa/first-login/check
   */
  async checkFirstLogin(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId es requerido'
        });
      }

      console.log(`🔍 Checking first login for user ID: ${userId}`);

      // Obtener usuario de API principal
      const user = await apiClient.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          userId: user.id,
          requiresPasswordChange: user.es_temporal || false,
          username: user.usuario,
          hasMFAEnabled: user.mfa_activo || false
        }
      });

    } catch (error) {
      console.error('❌ Error in checkFirstLogin:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking first login status',
        error: error.message
      });
    }
  }

  // ==================== CAMBIAR CONTRASEÑA TEMPORAL ====================
  
  /**
   * Cambia la contraseña temporal del primer login
   * POST /api/mfa/first-login/change-password
   */
  async changeTemporaryPassword(req, res) {
    try {
      const { userId, oldPassword, newPassword } = req.body;

      // Validaciones
      if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'userId, oldPassword y newPassword son requeridos'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 6 caracteres'
        });
      }

      console.log(`🔐 Changing temporary password for user ID: ${userId}`);

      // 1. Obtener usuario de API principal
      const user = await apiClient.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // 2. Verificar que tiene contraseña temporal
      if (!user.es_temporal) {
        return res.status(400).json({
          success: false,
          message: 'El usuario no tiene contraseña temporal'
        });
      }

      // 3. Verificar contraseña anterior
      const isValidOldPassword = await bcrypt.compare(oldPassword, user.contrasena);
      
      if (!isValidOldPassword) {
        return res.status(401).json({
          success: false,
          message: 'Contraseña temporal incorrecta'
        });
      }

      // 4. Hash de nueva contraseña
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 5. Actualizar contraseña en API principal
      await apiClient.updateUserPassword(userId, {
        contrasena: hashedPassword,
        es_temporal: false
      });

      console.log(`✅ Temporary password changed for user ID: ${userId}`);

      // 6. Obtener usuario actualizado
      const updatedUser = await apiClient.getUserById(userId);

      // 7. Generar token JWT
      let finalToken = null;
      let requiresMFA = false;

      const JWT_SECRET = process.env.JWT_SECRET || process.env.API_MASTER_TOKEN;

      if (updatedUser.mfa_activo) {
        // Si tiene MFA, generar token temporal para paso MFA
        requiresMFA = true;
        finalToken = jwt.sign(
          { 
            userId: updatedUser.id, 
            step: 'mfa',
            usuario: updatedUser.usuario 
          },
          JWT_SECRET,
          { expiresIn: '10m' }
        );
      } else {
        // Si NO tiene MFA, generar token final
        finalToken = jwt.sign(
          {
            id: updatedUser.id,
            usuario: updatedUser.usuario,
            rol_id: updatedUser.rol_id,
            rol_nombre: updatedUser.rol_nombre,
            persona_id: updatedUser.persona_id
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        // Crear sesión en API principal
        try {
          await apiClient.createSession(updatedUser.id, finalToken);
        } catch (sessionError) {
          console.error('⚠️ Warning: Could not create session:', sessionError.message);
          // No fallar si la sesión no se puede crear
        }
      }

      // Remover campos sensibles
      const { contrasena, mfa_secreto, ...userWithoutSensitive } = updatedUser;

      res.status(200).json({
        success: true,
        message: 'Contraseña cambiada exitosamente',
        data: {
          requiresMFA,
          token: finalToken,
          user: userWithoutSensitive
        }
      });

    } catch (error) {
      console.error('❌ Error in changeTemporaryPassword:', error);
      res.status(500).json({
        success: false,
        message: 'Error al cambiar contraseña',
        error: error.message
      });
    }
  }

  // ==================== CONFIGURAR MFA DESPUÉS DEL PRIMER LOGIN ====================
  
  /**
   * Permite configurar MFA después del primer login (opcional)
   * POST /api/mfa/first-login/setup-mfa
   */
  async setupMFAAfterFirstLogin(req, res) {
    try {
      const { userId, mfaCode, secret } = req.body;

      if (!userId || !mfaCode || !secret) {
        return res.status(400).json({
          success: false,
          message: 'userId, mfaCode y secret son requeridos'
        });
      }

      console.log(`🔐 Setting up MFA after first login for user ID: ${userId}`);

      // 1. Verificar código MFA
      const isValid = mfaService.verifyToken(secret, mfaCode);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Código MFA inválido'
        });
      }

      // 2. Activar MFA en API principal
      await apiClient.enableMFA(userId, secret);

      // 3. Generar códigos de respaldo
      const backupCodes = mfaService.generateBackupCodes();

      console.log(`✅ MFA setup completed for user ID: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'MFA configurado exitosamente',
        data: {
          userId,
          mfaEnabled: true,
          backupCodes,
          warning: 'Guarda estos códigos de respaldo en un lugar seguro'
        }
      });

    } catch (error) {
      console.error('❌ Error in setupMFAAfterFirstLogin:', error);
      res.status(500).json({
        success: false,
        message: 'Error al configurar MFA',
        error: error.message
      });
    }
  }

  // ==================== OBTENER DATOS PARA CONFIGURAR MFA ====================
  
  /**
   * Obtener datos para configurar MFA (secret y QR)
   * POST /api/mfa/first-login/mfa-setup-data
   */
  async getMFASetupData(req, res) {
    try {
      const { userId, username } = req.body;

      if (!userId || !username) {
        return res.status(400).json({
          success: false,
          message: 'userId y username son requeridos'
        });
      }

      console.log(`📱 Generating MFA setup data for user: ${username}`);

      // 1. Generar secreto MFA
      const secretData = mfaService.generateSecret(username);
      
      // 2. Generar URL para Authenticator
      const otpauthUrl = mfaService.generateOTPAuthUrl(username, secretData.base32);
      
      // 3. Generar QR Code
      const qrCode = await mfaService.generateQRCode(otpauthUrl);

      res.status(200).json({
        success: true,
        data: {
          userId,
          secret: secretData.base32,
          qrCode,
          otpauthUrl,
          message: 'Escanea este QR con Google Authenticator'
        }
      });

    } catch (error) {
      console.error('❌ Error in getMFASetupData:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar datos de configuración MFA',
        error: error.message
      });
    }
  }
}

module.exports = new FirstLoginController();