const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

class MFAService {
  
  // ==================== GENERACIÓN DE SECRETO MFA ====================
  
  /**
   * Genera un secreto MFA único para un usuario
   */
  generateSecret(username) {
    try {
      const secret = speakeasy.generateSecret({
        name: `MedApp (${username})`,
        issuer: 'Medical System',
        length: 20, // Más seguro que el default
        algorithm: 'sha1'
      });
      
      console.log(` MFA Secret generated for user: ${username}`);
      return secret;
      
    } catch (error) {
      console.error(' Error generating MFA secret:', error);
      throw new Error('Failed to generate MFA secret');
    }
  }

  // ==================== GENERACIÓN DE QR CODE ====================
  
  /**
   * Genera QR Code para la app Authenticator
   */
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl, {
        width: 300,
        height: 300,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      console.log(' QR Code generated successfully');
      return qrCodeDataURL;
      
    } catch (error) {
      console.error(' Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  // ==================== VERIFICACIÓN DE CÓDIGOS MFA ====================
  
  /**
   * Verifica un código TOTP contra el secreto
   */
  verifyToken(secret, token, window = 1) {
    try {
      // Primero verificación estándar
      const isValid = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: token,
        window: window, // Permite 30 segundos de margen
        algorithm: 'sha1'
      });

      console.log(`  MFA Verification: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
      
    } catch (error) {
      console.error('  Error verifying MFA token:', error);
      return false;
    }
  }

  // ==================== CÓDIGOS DE RESPALDO ====================
  
  /**
   * Genera códigos de respaldo (backup codes)
   */
  generateBackupCodes(count = 8) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Genera código de 8 caracteres alfanuméricos
      const code = crypto.randomBytes(6).toString('hex').toUpperCase();
      codes.push(code);
    }
    
    console.log(` Generated ${count} backup codes`);
    return codes;
  }

  // ==================== VALIDACIÓN DE CÓDIGOS DE RESPALDO ====================
  
  /**
   * Verifica si un código de respaldo es válido
   */
  verifyBackupCode(backupCodes, code) {
    const index = backupCodes.indexOf(code);
    if (index > -1) {
      // Remover el código usado
      backupCodes.splice(index, 1);
      console.log(' Backup code verified and consumed');
      return true;
    }
    
    console.log(' Invalid backup code');
    return false;
  }

  // ==================== GENERACIÓN DE URL PARA AUTHENTICATOR ====================
  
  /**
   * Genera URL para apps Authenticator
   */
  generateOTPAuthUrl(username, secret, issuer = 'Medical System') {
    return `otpauth://totp/${issuer}:${username}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  }

  // ==================== GENERACIÓN DE CÓDIGO ACTUAL (para testing) ====================
  
  /**
   * Genera el código actual (útil para testing)
   */
  getCurrentCode(secret) {
    try {
      return speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        algorithm: 'sha1'
      });
    } catch (error) {
      console.error(' Error generating current code:', error);
      return null;
    }
  }

  // ==================== VALIDACIÓN DE SECRETO ====================
  
  /**
   * Valida que un secreto MFA tenga formato correcto
   */
  isValidSecret(secret) {
    try {
      // Intenta generar un código con el secreto
      speakeasy.totp({
        secret: secret,
        encoding: 'base32'
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new MFAService();