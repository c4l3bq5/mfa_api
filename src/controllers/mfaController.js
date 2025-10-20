const mfaService = require('../services/mfaService');
const apiClient = require('../services/apiClient');
// const { generateToken } = require('../../utils/helpers'); // REMOVER ESTA LÍNEA

class MFAController {

  // ==================== GENERAR SECRETO MFA Y QR ====================
  
  /**
   * Genera secreto MFA y QR code para un usuario
   * POST /api/mfa/generate
   */
  async generateMFA(req, res) {
    try {
      const { userId, username } = req.body;

      // Validaciones básicas
      if (!userId || !username) {
        return res.status(400).json({
          success: false,
          message: 'userId y username son requeridos'
        });
      }

      console.log(`  Generating MFA for user: ${username} (ID: ${userId})`);

      // 1. Generar secreto MFA
      const secretData = mfaService.generateSecret(username);
      
      // 2. Generar URL para Authenticator
      const otpauthUrl = mfaService.generateOTPAuthUrl(username, secretData.base32);
      
      // 3. Generar QR Code
      const qrCode = await mfaService.generateQRCode(otpauthUrl);
      
      // 4. Generar códigos de respaldo
      const backupCodes = mfaService.generateBackupCodes();

      // 5. Preparar respuesta
      const response = {
        success: true,
        data: {
          userId,
          secret: secretData.base32, // Solo para desarrollo, en producción no enviar
          qrCode,
          otpauthUrl, // Para apps que no usen QR
          backupCodes,
          message: 'Escanea el QR code con Google Authenticator'
        }
      };

      console.log(`  MFA setup generated for user ${username}`);
      
      res.status(200).json(response);

    } catch (error) {
      console.error('  Error in generateMFA:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating MFA setup',
        error: error.message
      });
    }
  }

  // ==================== VERIFICAR Y ACTIVAR MFA ====================
  
  /**
   * Verifica código MFA y activa para usuario
   * POST /api/mfa/verify
   */
  async verifyAndActivateMFA(req, res) {
    try {
      const { userId, mfaCode, secret } = req.body;

      // Validaciones
      if (!userId || !mfaCode || !secret) {
        return res.status(400).json({
          success: false,
          message: 'userId, mfaCode y secret son requeridos'
        });
      }

      console.log(`  Verifying MFA for user ID: ${userId}`);

      // 1. Verificar código MFA
      const isValid = mfaService.verifyToken(secret, mfaCode);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Código MFA inválido o expirado'
        });
      }

      // 2. Actualizar usuario en API principal para activar MFA
      await apiClient.enableMFA(userId, secret);

      console.log(`  MFA activated for user ID: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'MFA activado exitosamente',
        data: {
          userId,
          mfaEnabled: true
        }
      });

    } catch (error) {
      console.error('  Error in verifyAndActivateMFA:', error);
      res.status(500).json({
        success: false,
        message: 'Error activating MFA',
        error: error.message
      });
    }
  }

  // ==================== VERIFICAR CÓDIGO MFA (login) ====================
  
  /**
   * Verifica código MFA durante el login
   * POST /api/mfa/verify-login
   */
  async verifyLoginMFA(req, res) {
    try {
      const { userId, mfaCode } = req.body;

      if (!userId || !mfaCode) {
        return res.status(400).json({
          success: false,
          message: 'userId y mfaCode son requeridos'
        });
      }

      console.log(`  MFA login verification for user ID: ${userId}`);

      // 1. Obtener usuario de API principal
      const user = await apiClient.getUserById(userId);
      
      if (!user || !user.mfa_activo) {
        return res.status(400).json({
          success: false,
          message: 'MFA no está activado para este usuario'
        });
      }

      // 2. Verificar código MFA
      const isValid = mfaService.verifyToken(user.mfa_secreto, mfaCode);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Código MFA inválido'
        });
      }

      console.log(`  MFA login successful for user ID: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'MFA verification successful',
        data: {
          userId,
          mfaVerified: true
        }
      });

    } catch (error) {
      console.error('  Error in verifyLoginMFA:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying MFA login',
        error: error.message
      });
    }
  }

  // ==================== DESACTIVAR MFA ====================
  
  /**
   * Desactiva MFA para un usuario
   * POST /api/mfa/disable
   */
  async disableMFA(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId es requerido'
        });
      }

      console.log(`  Disabling MFA for user ID: ${userId}`);

      await apiClient.disableMFA(userId);

      console.log(`  MFA disabled for user ID: ${userId}`);

      res.status(200).json({
        success: true,
        message: 'MFA desactivado exitosamente',
        data: {
          userId,
          mfaEnabled: false
        }
      });

    } catch (error) {
      console.error('  Error in disableMFA:', error);
      res.status(500).json({
        success: false,
        message: 'Error disabling MFA',
        error: error.message
      });
    }
  }

  // ==================== VERIFICAR ESTADO MFA ====================
  
  /**
   * Verifica si un usuario tiene MFA activado
   * GET /api/mfa/status/:userId
   */
  async getMFAStatus(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId es requerido'
        });
      }

      console.log(`  Checking MFA status for user ID: ${userId}`);

      // Obtener usuario de API principal
      const user = await apiClient.getUserById(userId);
      
      const status = {
        mfaEnabled: user.mfa_activo || false,
        hasSecret: !!user.mfa_secreto,
        userId: parseInt(userId)
      };

      res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('  Error in getMFAStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking MFA status',
        error: error.message
      });
    }
  }

  // ==================== GENERAR NUEVOS CÓDIGOS DE RESPALDO ====================
  
  /**
   * Genera nuevos códigos de respaldo
   * POST /api/mfa/regenerate-backup-codes
   */
  async regenerateBackupCodes(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId es requerido'
        });
      }

      console.log(`  Regenerating backup codes for user ID: ${userId}`);

      // Generar nuevos códigos
      const backupCodes = mfaService.generateBackupCodes();

      res.status(200).json({
        success: true,
        message: 'Códigos de respaldo generados',
        data: {
          userId,
          backupCodes,
          warning: 'Guarda estos códigos en un lugar seguro. Solo se mostrarán una vez.'
        }
      });

    } catch (error) {
      console.error('  Error in regenerateBackupCodes:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating backup codes',
        error: error.message
      });
    }
  }
}

module.exports = new MFAController();