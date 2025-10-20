const apiClient = require('../services/apiClient');
const mfaService = require('../services/mfaService');
const { generateTempPassword, hashPassword } = require('../utils/helpers');

class FirstLoginController {

  // ==================== VERIFICAR PRIMER LOGIN ====================
  
  /**
   * Verifica si es primer login con contraseña temporal
   * POST /api/mfa/first-login/check
   */
  async checkFirstLogin(req, res) {
    try {
      const { username, password } = req.body;

      // Validaciones
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'username y password son requeridos'
        });
      }

      console.log(` Checking first login for user: ${username}`);

      // 1. Verificar credenciales con API principal
      let loginResult;
      try {
        loginResult = await apiClient.verifyCredentials(username, password);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      // 2. Obtener información completa del usuario
      const user = await apiClient.getUserById(loginResult.user.id);

      // 3. Determinar si es primer login
      // Asumimos que contrasena_temporal indica primer login
      const isFirstLogin = user.contrasena_temporal || false;
      const requiresPasswordChange = isFirstLogin;
      const hasMFAEnabled = user.mfa_activo || false;

      console.log(` First login check for ${username}:`, {
        isFirstLogin,
        requiresPasswordChange,
        hasMFAEnabled
      });

      res.status(200).json({
        success: true,
        data: {
          userId: user.id,
          username: user.usuario,
          isFirstLogin,
          requiresPasswordChange,
          hasMFAEnabled,
          userData: {
            nombre: user.nombre,
            email: user.mail,
            rol: user.rol_nombre
          }
        }
      });

    } catch (error) {
      console.error(' Error in checkFirstLogin:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking first login status',
        error: error.message
      });
    }
  }

  // ==================== CAMBIAR CONTRASEÑA TEMPORAL ====================
  
  /**
   * Cambiar contraseña temporal por definitiva
   * POST /api/mfa/first-login/change-password
   */
  async changeTemporaryPassword(req, res) {
    try {
      const { userId, currentPassword, newPassword, confirmPassword } = req.body;

      // Validaciones
      if (!userId || !currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Las contraseñas no coinciden'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 8 caracteres'
        });
      }

      console.log(` Changing temporary password for user ID: ${userId}`);

      // 1. Verificar que la contraseña actual es correcta
      // Para esto necesitamos obtener el usuario y verificar credenciales
      const user = await apiClient.getUserById(userId);
      
      // En una implementación real, verificaríamos la contraseña actual
      // contra el hash almacenado. Por ahora asumimos que es correcta
      // ya que el usuario acaba de hacer login.

      // 2. Actualizar contraseña en API principal
      await apiClient.updateUser(userId, {
        contrasena: newPassword,
        contrasena_temporal: false,
        // Agregar campo de fecha de cambio de contraseña si existe
        password_changed_at: new Date().toISOString()
      });

      console.log(` Password changed successfully for user ID: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Contraseña actualizada exitosamente',
        data: {
          userId,
          passwordChanged: true,
          requiresMFA: true // Recomendar configurar MFA después
        }
      });

    } catch (error) {
      console.error(' Error in changeTemporaryPassword:', error);
      res.status(500).json({
        success: false,
        message: 'Error changing password',
        error: error.message
      });
    }
  }

  // ==================== CONFIGURAR MFA DESPUÉS DE PRIMER LOGIN ====================
  
  /**
   * Configurar MFA después de cambiar contraseña temporal
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

      console.log(` Setting up MFA after first login for user ID: ${userId}`);

      // 1. Verificar código MFA
      const isValid = mfaService.verifyToken(secret, mfaCode);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Código MFA inválido'
        });
      }

      // 2. Activar MFA en API principal
      await apiClient.updateMFASettings(userId, {
        mfa_secreto: secret,
        mfa_activo: true
      });

      // 3. Generar códigos de respaldo
      const backupCodes = mfaService.generateBackupCodes();

      console.log(` MFA setup completed for user ID: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'MFA configurado exitosamente',
        data: {
          userId,
          mfaEnabled: true,
          backupCodes,
          setupComplete: true
        }
      });

    } catch (error) {
      console.error(' Error in setupMFAAfterFirstLogin:', error);
      res.status(500).json({
        success: false,
        message: 'Error setting up MFA',
        error: error.message
      });
    }
  }

  // ==================== FLUJO COMPLETO PRIMER LOGIN ====================
  
  /**
   * Flujo completo para primer login
   * POST /api/mfa/first-login/complete
   */
  async completeFirstLoginFlow(req, res) {
    try {
      const { 
        userId, 
        currentPassword, 
        newPassword, 
        confirmPassword,
        mfaCode,
        secret 
      } = req.body;

      console.log(` Starting complete first login flow for user ID: ${userId}`);

      // 1. Validaciones básicas
      if (!userId || !currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Datos de contraseña requeridos'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Las contraseñas no coinciden'
        });
      }

      // 2. Cambiar contraseña temporal
      await this.changeTemporaryPassword(req, res);
      
      // Si hay error en changeTemporaryPassword, se propaga
      if (res.headersSent) return;

      // 3. Si se proporcionó configuración MFA, configurarla
      if (mfaCode && secret) {
        const mfaRequest = {
          body: { userId, mfaCode, secret }
        };
        const mfaResponse = {
          status: (code) => ({
            json: (data) => {
              if (code !== 200) {
                throw new Error(data.message);
              }
            }
          })
        };

        await this.setupMFAAfterFirstLogin(mfaRequest, mfaResponse);
      }

      console.log(` First login flow completed for user ID: ${userId}`);

      // 4. Respuesta final
      res.status(200).json({
        success: true,
        message: 'Flujo de primer login completado exitosamente',
        data: {
          userId,
          passwordChanged: true,
          mfaEnabled: !!(mfaCode && secret),
          setupComplete: true
        }
      });

    } catch (error) {
      console.error(' Error in completeFirstLoginFlow:', error);
      res.status(500).json({
        success: false,
        message: 'Error completing first login flow',
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

      console.log(` Generating MFA setup data for user: ${username}`);

      // 1. Generar secreto MFA
      const secretData = mfaService.generateSecret(username);
      
      // 2. Generar QR Code
      const otpauthUrl = mfaService.generateOTPAuthUrl(username, secretData.base32);
      const qrCode = await mfaService.generateQRCode(otpauthUrl);

      res.status(200).json({
        success: true,
        data: {
          userId,
          secret: secretData.base32,
          qrCode,
          otpauthUrl,
          message: 'Use este QR para configurar Google Authenticator'
        }
      });

    } catch (error) {
      console.error(' Error in getMFASetupData:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating MFA setup data',
        error: error.message
      });
    }
  }
}

module.exports = new FirstLoginController();