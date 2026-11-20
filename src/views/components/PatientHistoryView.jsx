/**
 * VIEW: PatientHistoryView.jsx
 * Historial clinico persistido en SQLite con filtros, recarga de caso al consultorio y eliminacion.
 */

import React, { useState, useMemo } from 'react';
import {
  Database,
  Search,
  Trash2,
  Stethoscope,
  RefreshCw,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

export function PatientHistoryView({
  records = [],
  loading,
  error,
  onLoadRecord,
  onDeleteRecord,
  onRefresh
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      if (riskFilter !== 'ALL' && rec.risk_level !== riskFilter) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        rec.patient_name.toLowerCase().includes(q) ||
        rec.patient_context.toLowerCase().includes(q) ||
        (rec.notes || '').toLowerCase().includes(q) ||
        rec.rule_code.toLowerCase().includes(q)
      );
    });
  }, [records, searchTerm, riskFilter]);

  const highRiskCount = records.filter(r => r.predicted_class === 1).length;
  const undiagnosedCount = records.filter(r =>
    (r.patient_context || '').toLowerCase().includes('sin diagnóstico')
  ).length;

  const handleDelete = async (id) => {
    try {
      setDeleteError(null);
      setDeletingId(id);
      await onDeleteRecord(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err.message || 'No se pudo eliminar el registro clínico.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3 text-base-content/60">
        <span className="loading loading-spinner loading-md text-primary"></span>
        <span className="text-xs">Consultando base de datos SQLite (<code className="font-mono">clinical_records.db</code>)...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Estadisticas de BD */}
      <div className="stats stats-vertical md:stats-horizontal shadow-sm bg-base-100 border border-base-200 w-full">
        <div className="stat">
          <div className="stat-title text-xs font-semibold">Consultas Almacenadas (SQLite)</div>
          <div className="stat-value text-primary text-3xl">{records.length}</div>
          <div className="stat-desc text-xs">Archivo local: data/clinical_records.db</div>
        </div>
        <div className="stat">
          <div className="stat-title text-xs font-semibold">Alertas de Alto Riesgo</div>
          <div className="stat-value text-error text-3xl">{highRiskCount}</div>
          <div className="stat-desc text-xs">Derivación prioritaria a laboratorio</div>
        </div>
        <div className="stat">
          <div className="stat-title text-xs font-semibold">Tamizajes sin Diagnóstico</div>
          <div className="stat-value text-secondary text-3xl">{undiagnosedCount}</div>
          <div className="stat-desc text-xs">Evaluaciones orientativas preventivas</div>
        </div>
      </div>

      {/* Tabla de Historial */}
      <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Historial de Pacientes Evaluados</h2>
              <p className="text-xs text-base-content/60">
                Casos reales y de prueba registrados vía API REST (<code className="font-mono">GET/POST/DELETE /api/history</code>).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-base-content/50 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar paciente o regla..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-bordered input-xs pl-8 w-52"
              />
            </div>

            <div className="join">
              {['ALL', 'ALTO', 'BAJO'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setRiskFilter(opt)}
                  className={`btn btn-xs join-item ${riskFilter === opt ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {opt === 'ALL' ? 'Todos' : opt === 'ALTO' ? 'Alto Riesgo' : 'Riesgo Bajo'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onRefresh}
              className="btn btn-xs btn-ghost gap-1"
              title="Actualizar desde SQLite"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recargar
            </button>
          </div>
        </div>

        {(error || deleteError) && (
          <div className="alert alert-error text-xs py-2">{error || deleteError}</div>
        )}

        <div className="overflow-x-auto rounded-xl border border-base-200">
          <table className="table table-zebra text-xs w-full">
            <thead>
              <tr className="bg-base-200 text-base-content/70">
                <th>ID / Fecha</th>
                <th>Paciente y Contexto</th>
                <th>Biomarcadores Clave (CART)</th>
                <th>Regla</th>
                <th>Dictamen y P(DM2)</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-base-content/50 italic">
                    No hay registros que coincidan con el filtro aplicado.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(rec => {
                  const isHigh = rec.predicted_class === 1;
                  const imp = rec.imputed_features || {};
                  const imputedNames = (rec.imputed_fields || []).map(f => f.feature);
                  return (
                    <tr key={rec.id} className="hover">
                      <td className="font-mono text-[11px]">
                        <div className="font-bold">#{rec.id}</div>
                        <div className="text-base-content/50">
                          {new Date(rec.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div className="font-semibold text-base-content">{rec.patient_name}</div>
                        <div className="text-[11px] text-base-content/60">{rec.patient_context}</div>
                        {rec.notes && (
                          <div className="text-[10px] text-base-content/50 mt-0.5 line-clamp-1">
                            {rec.notes}
                          </div>
                        )}
                      </td>
                      <td className="font-mono text-[11px]">
                        <div>
                          Glu: <strong>{imp.Glucose ?? '-'}</strong> | IMC:{' '}
                          <strong>{imp.BMI ?? '-'}</strong>
                        </div>
                        <div className="text-base-content/60">
                          Edad: {imp.Age ?? '-'} | Ins: {imp.Insulin ?? '-'}
                          {imputedNames.length > 0 && (
                            <span className="badge badge-xs badge-info ml-1.5">
                              Imputados: {imputedNames.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-sm badge-neutral font-mono font-bold">
                          {rec.rule_code}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`badge badge-sm gap-1 font-bold text-white ${
                              isHigh ? 'badge-error' : 'badge-success'
                            }`}
                          >
                            {isHigh ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            {isHigh ? 'Alto Riesgo' : 'Riesgo Bajo'}
                          </span>
                          <span className="font-mono font-bold text-[11px]">
                            P(DM2) = {Number(rec.probability_pct).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onLoadRecord(rec)}
                            className="btn btn-xs btn-outline btn-primary gap-1"
                            title="Cargar paciente al Consultorio y Árbol SVG"
                          >
                            <Stethoscope className="w-3 h-3" />
                            Cargar
                          </button>
                          {confirmDeleteId === rec.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={deletingId === rec.id}
                                onClick={() => handleDelete(rec.id)}
                                className="btn btn-xs btn-error text-white"
                                title="Confirmar eliminación permanente"
                              >
                                {deletingId === rec.id ? '...' : 'Confirmar'}
                              </button>
                              <button
                                type="button"
                                disabled={deletingId === rec.id}
                                onClick={() => setConfirmDeleteId(null)}
                                className="btn btn-xs btn-ghost"
                                title="Cancelar eliminación"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={deletingId === rec.id}
                              onClick={() => {
                                setDeleteError(null);
                                setConfirmDeleteId(rec.id);
                              }}
                              className="btn btn-xs btn-ghost text-error"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
