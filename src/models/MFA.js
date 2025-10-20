/**
 * Modelo para gestión de datos MFA
 * En una implementación completa, esto se conectaría a una base de datos
 * Por ahora usamos almacenamiento en memoria para desarrollo
 */

class MFAModel {
  constructor() {
    // Almacenamiento en memoria (reemplazar por BD en producción)
    this.mfaSessions = new Map(); // userId -> session data
    this.backupCodes = new Map(); // userId -> backup codes
    this.pendingActivations = new Map(); // userId -> pending MFA data
  }

  // ==================== SESIONES MFA ====================

  /**
   * Crear o actualizar sesión MFA para usuario
   */
  async createMFASession(userId, sessionData) {
    const session = {
      id: this.generateId(),
      userId,
      secret: sessionData.secret,
      backupCodes: sessionData.backupCodes || [],
      qrCode: sessionData.qrCode,
      status: 'pending', // pending, active, disabled
      createdAt: new Date(),
      updatedAt: new Date(),
      verifiedAt: null,
      failedAttempts: 0,
      lastVerificationAttempt: null
    };

    this.mfaSessions.set(userId, session);
    console.log(` MFA session created for user ${userId}`);
    return session;
  }

  /**
   * Obtener sesión MFA por userId
   */
  async getMFASession(userId) {
    const session = this.mfaSessions.get(userId);
    if (!session) {
      throw new Error('Sesión MFA no encontrada');
    }
    return session;
  }

  /**
   * Actualizar sesión MFA
   */
  async updateMFASession(userId, updates) {
    const session = await this.getMFASession(userId);
    
    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date()
    };

    this.mfaSessions.set(userId, updatedSession);
    console.log(` MFA session updated for user ${userId}`);
    return updatedSession;
  }

  /**
   * Eliminar sesión MFA
   */
  async deleteMFASession(userId) {
    const deleted = this.mfaSessions.delete(userId);
    if (deleted) {
      console.log(` MFA session deleted for user ${userId}`);
    }
    return deleted;
  }

  // ==================== ACTIVACIONES PENDIENTES ====================

  /**
   * Guardar datos de activación MFA pendiente
   */
  async savePendingActivation(userId, activationData) {
    const activation = {
      userId,
      secret: activationData.secret,
      qrCode: activationData.qrCode,
      backupCodes: activationData.backupCodes,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
      verificationAttempts: 0
    };

    this.pendingActivations.set(userId, activation);
    console.log(` Pending MFA activation saved for user ${userId}`);
    return activation;
  }

  /**
   * Obtener activación pendiente
   */
  async getPendingActivation(userId) {
    const activation = this.pendingActivations.get(userId);
    
    if (!activation) {
      throw new Error('Activación MFA pendiente no encontrada');
    }

    // Verificar expiración
    if (new Date() > activation.expiresAt) {
      this.pendingActivations.delete(userId);
      throw new Error('La activación MFA ha expirado');
    }

    return activation;
  }

  /**
   * Eliminar activación pendiente
   */
  async deletePendingActivation(userId) {
    const deleted = this.pendingActivations.delete(userId);
    if (deleted) {
      console.log(` Pending MFA activation deleted for user ${userId}`);
    }
    return deleted;
  }

  // ==================== CÓDIGOS DE RESPALDO ====================

  /**
   * Guardar códigos de respaldo para usuario
   */
  async saveBackupCodes(userId, codes) {
    const backupCodeData = {
      userId,
      codes: codes.map(code => ({
        code,
        used: false,
        usedAt: null
      })),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.backupCodes.set(userId, backupCodeData);
    console.log(` Backup codes saved for user ${userId}`);
    return backupCodeData;
  }

  /**
   * Obtener códigos de respaldo
   */
  async getBackupCodes(userId) {
    const backupData = this.backupCodes.get(userId);
    if (!backupData) {
      throw new Error('Códigos de respaldo no encontrados');
    }
    return backupData;
  }

  /**
   * Verificar y marcar código de respaldo como usado
   */
  async useBackupCode(userId, code) {
    const backupData = await this.getBackupCodes(userId);
    
    const codeIndex = backupData.codes.findIndex(
      bc => bc.code === code && !bc.used
    );

    if (codeIndex === -1) {
      throw new Error('Código de respaldo inválido o ya usado');
    }

    // Marcar como usado
    backupData.codes[codeIndex].used = true;
    backupData.codes[codeIndex].usedAt = new Date();
    backupData.updatedAt = new Date();

    this.backupCodes.set(userId, backupData);
    console.log(` Backup code used for user ${userId}`);

    return {
      valid: true,
      remainingCodes: backupData.codes.filter(bc => !bc.used).length
    };
  }

  /**
   * Regenerar códigos de respaldo
   */
  async regenerateBackupCodes(userId, newCodes) {
    const backupData = await this.saveBackupCodes(userId, newCodes);
    console.log(` Backup codes regenerated for user ${userId}`);
    return backupData;
  }

  // ==================== VERIFICACIÓN E INTENTOS ====================

  /**
   * Registrar intento de verificación MFA
   */
  async recordVerificationAttempt(userId, success, codeUsed = null) {
    const session = await this.getMFASession(userId);
    
    const updates = {
      lastVerificationAttempt: new Date()
    };

    if (success) {
      updates.verifiedAt = new Date();
      updates.failedAttempts = 0;
      updates.status = 'active';
    } else {
      updates.failedAttempts = (session.failedAttempts || 0) + 1;
    }

    if (codeUsed) {
      updates.lastCodeUsed = codeUsed;
    }

    return await this.updateMFASession(userId, updates);
  }

  /**
   * Verificar límite de intentos fallidos
   */
  async checkAttemptLimit(userId) {
    const session = await this.getMFASession(userId);
    const maxAttempts = 5; // Límite de intentos fallidos
    
    if (session.failedAttempts >= maxAttempts) {
      await this.updateMFASession(userId, { 
        status: 'locked',
        lockedAt: new Date() 
      });
      throw new Error('MFA bloqueado por demasiados intentos fallidos');
    }

    return true;
  }

  // ==================== ESTADÍSTICAS Y MÉTRICAS ====================

  /**
   * Obtener estadísticas de uso MFA
   */
  async getMFAStats() {
    const sessions = Array.from(this.mfaSessions.values());
    
    const stats = {
      totalUsers: sessions.length,
      activeMFA: sessions.filter(s => s.status === 'active').length,
      pendingMFA: sessions.filter(s => s.status === 'pending').length,
      lockedMFA: sessions.filter(s => s.status === 'locked').length,
      totalVerificationAttempts: sessions.reduce((sum, s) => sum + (s.failedAttempts || 0), 0),
      createdAt: new Date()
    };

    return stats;
  }

  /**
   * Obtener actividad reciente MFA
   */
  async getRecentActivity(limit = 10) {
    const sessions = Array.from(this.mfaSessions.values())
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit);

    return sessions.map(session => ({
      userId: session.userId,
      status: session.status,
      lastActivity: session.updatedAt,
      failedAttempts: session.failedAttempts
    }));
  }

  // ==================== UTILIDADES ====================

  /**
   * Generar ID único
   */
  generateId() {
    return `mfa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Limpiar datos expirados (para mantenimiento)
   */
  async cleanupExpiredData() {
    const now = new Date();
    let cleanedCount = 0;

    // Limpiar activaciones pendientes expiradas
    for (const [userId, activation] of this.pendingActivations.entries()) {
      if (now > activation.expiresAt) {
        this.pendingActivations.delete(userId);
        cleanedCount++;
      }
    }

    // Limpiar sesiones muy antiguas
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    for (const [userId, session] of this.mfaSessions.entries()) {
      if (session.updatedAt < thirtyDaysAgo && session.status !== 'active') {
        this.mfaSessions.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(` Cleaned ${cleanedCount} expired MFA records`);
    }

    return cleanedCount;
  }

  /**
   * Reset completo (solo para testing)
   */
  async reset() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Reset solo disponible en entorno de testing');
    }

    this.mfaSessions.clear();
    this.backupCodes.clear();
    this.pendingActivations.clear();
    
    console.log(' MFA model reset complete');
    return true;
  }
}

// Exportar singleton instance
module.exports = new MFAModel();