const apiClient = require('./apiClient');

class UserService {
  
  /**
   * Verificar si usuario necesita primer login (contraseña temporal)
   */
  async checkFirstLogin(userId) {
    try {
      const user = await apiClient.getUserById(userId);
      
      // En tu sistema, necesitaríamos un campo contrasena_temporal
      // Por ahora asumimos que si no tiene MFA configurado, necesita setup
      return {
        firstLogin: !user.mfa_activo,
        userData: user
      };
    } catch (error) {
      throw new Error(`Error checking first login: ${error.message}`);
    }
  }

  /**
   * Verificar credenciales de usuario
   */
  async verifyUserCredentials(username, password) {
    try {
      const result = await apiClient.verifyCredentials(username, password);
      
      if (result.success && result.requiresMfa) {
        return {
          valid: true,
          requiresMfa: true,
          tempToken: result.tempToken,
          user: result.data?.user
        };
      }

      return {
        valid: result.success,
        requiresMfa: false,
        user: result.data?.user
      };

    } catch (error) {
      throw new Error(`Invalid credentials: ${error.message}`);
    }
  }

  /**
   * Completar verificación MFA durante login
   */
  async completeMFALogin(tempToken, mfaCode) {
    try {
      const result = await apiClient.verifyMFAToken(tempToken, mfaCode);
      return result;
    } catch (error) {
      throw new Error(`MFA verification failed: ${error.message}`);
    }
  }
}

module.exports = new UserService();