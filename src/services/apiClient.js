const axios = require('axios');

const MAIN_API_URL = process.env.MAIN_API_URL || 'http://localhost:3000/api';

class ApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: MAIN_API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para logs
    this.client.interceptors.request.use(
      (config) => {
        console.log(`📤 API Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('📤 API Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`📥 API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error('📥 API Response Error:', error.response?.status, error.message);
        return Promise.reject(error);
      }
    );
  }

  // ==================== MÉTODOS DE USUARIO ====================

  /**
   * Obtener usuario por ID
   */
  async getUserById(userId) {
    try {
      const response = await this.client.get(`/users/${userId}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error(`Error getting user ${userId}:`, error.message);
      throw new Error(`No se pudo obtener el usuario: ${error.message}`);
    }
  }

  /**
   * Verificar credenciales de usuario
   */
  async verifyCredentials(username, password) {
    try {
      const response = await this.client.post('/auth/login', {
        usuario: username,
        contrasena: password
      });
      return response.data;
    } catch (error) {
      console.error('Error verifying credentials:', error.message);
      throw new Error('Credenciales inválidas');
    }
  }

  /**
   * Actualizar usuario
   */
  async updateUser(userId, updateData) {
    try {
      const response = await this.client.put(`/users/${userId}`, updateData);
      return response.data;
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error.message);
      throw new Error(`No se pudo actualizar el usuario: ${error.message}`);
    }
  }

  // ==================== MÉTODOS MFA ====================

  /**
   * Habilitar MFA para usuario
   */
  async enableMFA(userId, secret) {
    try {
      const response = await this.client.patch(`/users/${userId}/enable-mfa`, {
        mfa_secreto: secret,
        mfa_activo: true
      });
      return response.data;
    } catch (error) {
      console.error(`Error enabling MFA for user ${userId}:`, error.message);
      throw new Error(`No se pudo habilitar MFA: ${error.message}`);
    }
  }

  /**
   * Deshabilitar MFA para usuario
   */
  async disableMFA(userId) {
    try {
      const response = await this.client.patch(`/users/${userId}/disable-mfa`);
      return response.data;
    } catch (error) {
      console.error(`Error disabling MFA for user ${userId}:`, error.message);
      throw new Error(`No se pudo deshabilitar MFA: ${error.message}`);
    }
  }

  /**
   * Actualizar configuración MFA
   */
  async updateMFASettings(userId, mfaData) {
    try {
      const response = await this.client.patch(`/users/${userId}/enable-mfa`, mfaData);
      return response.data;
    } catch (error) {
      console.error(`Error updating MFA settings for user ${userId}:`, error.message);
      throw new Error(`No se pudo actualizar MFA: ${error.message}`);
    }
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Verificar conexión con API principal
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error.message);
      return { status: 'error', message: error.message };
    }
  }
}

module.exports = new ApiClient();