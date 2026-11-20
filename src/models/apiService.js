/**
 * MODEL: apiService.js
 * Cliente de comunicacion HTTP REST con el backend Python (inferencia, metricas y SQLite).
 * INF-3731A - Inteligencia Artificial.
 */

const API_BASE = '/api';

export const apiService = {
  /**
   * Comprueba el estado de salud del servidor HTTP, el modelo y el frontend.
   * @returns {Promise<Object>}
   */
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Servicio de API no disponible');
    return await res.json();
  },

  /**
   * Envia las 8 variables fisiologicas del paciente para inferencia clinica.
   * Un valor 0 en variables biologicas activa SimpleImputer en el backend.
   * @param {Object} patientData
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<Object>}
   */
  async predict(patientData, { signal } = {}) {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error en la inferencia (${res.status})`);
    }

    return await res.json();
  },

  /**
   * Obtiene la estructura jerarquica del arbol de decision para renderizado SVG.
   * @returns {Promise<Object>}
   */
  async getTreeTopology() {
    const res = await fetch(`${API_BASE}/tree`);
    if (!res.ok) throw new Error('No se pudo cargar la topologia del arbol');
    return await res.json();
  },

  /**
   * Obtiene metricas de prueba (balanceado y base), validacion cruzada k=3 y curva ROC.
   * @returns {Promise<Object>}
   */
  async getMetrics() {
    const res = await fetch(`${API_BASE}/metrics`);
    if (!res.ok) throw new Error('No se pudieron cargar las metricas de evaluacion');
    return await res.json();
  },

  /**
   * Obtiene el listado de reglas clinicas extraidas (R1-R8).
   * @returns {Promise<Array>}
   */
  async getRules() {
    const res = await fetch(`${API_BASE}/rules`);
    if (!res.ok) throw new Error('No se pudieron cargar las reglas clinicas');
    return await res.json();
  },

  /**
   * Lista las evaluaciones historicas almacenadas en SQLite.
   * @returns {Promise<Array>}
   */
  async getHistory() {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) throw new Error('No se pudo cargar el historial clinico');
    const data = await res.json();
    return data.records || [];
  },

  /**
   * Evalua y guarda una consulta clinica en SQLite.
   * @param {Object} payload { patient_name, patient_context, notes, features }
   * @returns {Promise<Object>}
   */
  async saveHistoryRecord(payload) {
    const res = await fetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No se pudo guardar el registro clinico');
    }

    return await res.json();
  },

  /**
   * Elimina una evaluacion guardada por su ID.
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async deleteHistoryRecord(id) {
    const res = await fetch(`${API_BASE}/history?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No se pudo eliminar el registro');
    }

    return await res.json();
  }
};
