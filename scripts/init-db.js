#!/usr/bin/env node

/**
 * Script de inicialización para MFA Service
 * Verifica configuración y conexiones
 */

require('dotenv').config();
const APIConfig = require('../src/config/database');

async function initializeService() {
  console.log(' Inicializando MFA Service...\n');

  try {
    // 1. Verificar variables de entorno críticas
    console.log(' Verificando variables de entorno...');
    
    const requiredEnvVars = ['MAIN_API_URL', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('  Variables de entorno faltantes:', missingVars);
      process.exit(1);
    }
    
    console.log(' Variables de entorno OK');
    console.log(' MAIN_API_URL:', process.env.MAIN_API_URL);
    console.log(' JWT_SECRET:', process.env.JWT_SECRET ? 'Configurado' : 'Faltante');

    // 2. Verificar conexión con API principal
    console.log('\n Verificando conexión con API principal...');
    const apiConnected = await APIConfig.initialize();
    
    if (!apiConnected) {
      console.warn('  No se pudo conectar con la API principal');
      console.warn('   El servicio funcionará en modo limitado');
    } else {
      console.log(' Conexión con API principal establecida');
    }

    // 3. Verificar que podemos generar tokens
    console.log('\n Probando generación de tokens JWT...');
    try {
      const testToken = require('../src/utils/helpers').generateToken({ test: true });
      console.log(' Generación de tokens JWT OK');
    } catch (error) {
      console.error(' Error en generación de tokens:', error.message);
    }

    // 4. Resumen final
    console.log('\n Inicialización completada!');
    console.log('\n Resumen:');
    console.log('   Service: MFA Microservice');
    console.log('   API Principal:', process.env.MAIN_API_URL);
    console.log('   Modo:', process.env.NODE_ENV || 'development');
    console.log('   Conexión API:', apiConnected ? '  Conectada' : '⚠️  Limitada');
    
    console.log('\n Para iniciar el servicio: npm start');

  } catch (error) {
    console.error(' Error durante la inicialización:', error);
    process.exit(1);
  }
}

// Ejecutar inicialización
initializeService();