// mfa-service/src/services/apiClient.js
const axios = require('axios');

const MAIN_API_URL = process.env.MAIN_API_URL || 'https://apimed-production.up.railway.app/api';

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

  // ==================== MÉTODOS GENÉRICOS ====================

  /**
   * GET genérico
   */
  async get(endpoint) {
    try {
      const response = await this.client.get(endpoint);
      return response.data;
    } catch (error) {
      console.error(`Error GET ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * POST genérico
   */
  async post(endpoint, data) {
    try {
      const response = await this.client.post(endpoint, data);
      return response.data;
    } catch (error) {
      console.error(`Error POST ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * PUT genérico
   */
  async put(endpoint, data) {
    try {
      const response = await this.client.put(endpoint, data);
      return response.data;
    } catch (error) {
      console.error(`Error PUT ${endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * PATCH genérico
   */
  async patch(endpoint, data) {
    try {
      const response = await this.client.patch(endpoint, data);
      return response.data;
    } catch (error) {
      console.error(`Error PATCH ${endpoint}:`, error.message);
      throw error;
    }
  }

  // ==================== MÉTODOS DE USUARIO ====================

  /**
   * Obtener usuario por ID
   */
  async getUserById(userId) {
    try {
      const response = await this.get(`/users/${userId}`);
      return response.data || response;
    } catch (error) {
      console.error(`Error getting user ${userId}:`, error.message);
      throw new Error(`No se pudo obtener el usuario: ${error.message}`);
    }
  }

  /**
   * Actualizar usuario
   */
  async updateUser(userId, updateData) {
    try {
      const response = await this.put(`/users/${userId}`, updateData);
      return response;
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error.message);
      throw new Error(`No se pudo actualizar el usuario: ${error.message}`);
    }
  }

  /**
   * Actualizar contraseña de usuario
   */
  async updateUserPassword(userId, passwordData) {
    try {
      console.log(`🔑 Updating password for user ${userId}`);
      
      const response = await this.put(`/users/${userId}`, passwordData);
      
      console.log(`✅ Password updated for user ${userId}`);
      return response.data || response;
    } catch (error) {
      console.error(`❌ Error updating password for user ${userId}:`, error.message);
      throw new Error(`No se pudo actualizar la contraseña: ${error.message}`);
    }
  }

  // ==================== MÉTODOS MFA ====================

  /**
   * Habilitar MFA para usuario
   */
  async enableMFA(userId, secret) {
    try {
      const response = await this.patch(`/users/${userId}/enable-mfa`, {
        mfa_secreto: secret,
        mfa_activo: true
      });
      return response;
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
      const response = await this.patch(`/users/${userId}/disable-mfa`);
      return response;
    } catch (error) {
      console.error(`Error disabling MFA for user ${userId}:`, error.message);
      throw new Error(`No se pudo deshabilitar MFA: ${error.message}`);
    }
  }

  // ==================== MÉTODOS DE SESIÓN ====================

  /**
   * Crear sesión en api_rest después del login
   */
  async createSession(userId, token) {
    try {
      console.log(`🔐 Creating session for user ${userId}`);
      
      const response = await this.post('/sessions', {
        usuario_id: userId,
        token: token
      });
      
      console.log(`✅ Session created for user ${userId}`);
      return response;
    } catch (error) {
      console.error(`❌ Error creating session for user ${userId}:`, error.message);
      console.warn(`⚠️ Continuing without session creation`);
      return null;
    }
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Verificar conexión con API principal
   */
  async healthCheck() {
    try {
      const response = await this.get('/health');
      return response;
    } catch (error) {
      console.error('Health check failed:', error.message);
      return { status: 'error', message: error.message };
    }
  }
}

module.exports = new ApiClient();