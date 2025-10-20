/**
 * Configuración simplificada - Solo verifica conexión con API principal
 */

const apiClient = require('../services/apiClient');

class APIConfig {
  constructor() {
    this.isConnected = false;
  }

  async initialize() {
    try {
      console.log(' Verificando conexión con API principal...');
      
      // Health check simple
      await this.request('GET', '/health');
      
      this.isConnected = true;
      console.log(' Conexión con API principal establecida');
      
      return true;

    } catch (error) {
      console.error(' No se pudo conectar con la API principal');
      this.isConnected = false;
      return false;
    }
  }

  async request(method, endpoint) {
    // Método simple para health check
    const axios = require('axios');
    const response = await axios({
      method,
      url: `${process.env.MAIN_API_URL}${endpoint}`,
      timeout: 5000
    });
    return response.data;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      apiUrl: process.env.MAIN_API_URL,
      service: 'MFA Service',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new APIConfig();