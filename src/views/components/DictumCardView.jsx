/**
 * VIEW: DictumCardView.jsx
 * Tarjeta de dictamen clinico con regla activada (R1-R8), transparencia de imputacion,
 * guardado en SQLite e impresion de ficha preventiva.
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Save,
  Printer,
  CheckCircle2,
  Info
} from 'lucide-react';

const CONTEXT_OPTIONS = [
  'Tamizaje preventivo (sin diagnóstico previo)',
  'Paciente con diagnóstico previo de diabetes',
  'Caso académico de prueba'
];

export function DictumCardView({
  isHighRisk,
  probabilityPct,
  ruleCode,
  leafNodeId,
  ruleSummary,
  imputedFields = [],
  recommendation,
  decisionSteps,
  onSaveEvaluation,
  savingHistory = false,
  onOpenHistory
}) {
  const [patientName, setPatientName] = useState('');
  const [patientContext, setPatientContext] = useState(CONTEXT_OPTIONS[0]);
  const [notes, setNotes] = useState('');
  const [savedNotice, setSavedNotice] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const alertClass = isHighRisk ? 'border-error/40 bg-error/10' : 'border-success/40 bg-success/10';
  const badgeClass = isHighRisk ? 'badge-error' : 'badge-success';
  const progressClass = isHighRisk ? 'progress-error' : 'progress-success';
  const Icon = isHighRisk ? ShieldAlert : ShieldCheck;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSavedNotice(null);
    try {
      const saved = await onSaveEvaluation({
        patientName: patientName.trim() || `Evaluación ${new Date().toLocaleTimeString()}`,
        patientContext,
        notes
      });
      setSavedNotice(`Registro #${saved.id} guardado en SQLite (${saved.rule_code}).`);
      setPatientName('');
      setNotes('');
    } catch (err) {
      setSaveError(err.message || 'No se pudo guardar en SQLite');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Tarjeta de Dictamen Principal */}
      <div className={`p-6 rounded-2xl border ${alertClass} shadow-sm transition-all`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">
              Dictamen CART
            </span>
            <span className="badge badge-neutral font-mono font-bold text-xs">
              Regla {ruleCode} (Hoja #{leafNodeId})
            </span>
          </div>

          <div className={`badge ${badgeClass} text-white font-bold py-3 px-3 gap-1.5 shadow-sm`}>
            <Icon className="w-3.5 h-3.5" />
            <span>{isHighRisk ? 'Alerta: Alto Riesgo' : 'Riesgo Bajo / Estable'}</span>
          </div>
        </div>

        {/* Display de Probabilidad */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-5xl font-black tracking-tight">{probabilityPct.toFixed(1)}</span>
          <span className="text-xl font-bold text-base-content/50">%</span>
          <span className="text-xs text-base-content/70 ml-2 font-medium">
            Probabilidad posterior balanceada P(DM2)
          </span>
        </div>

        {/* Medidor visual con indicador de umbral al 50% */}
        <div className="relative mt-4 mb-5">
          <progress
            className={`progress ${progressClass} w-full h-3`}
            value={Math.max(probabilityPct, 4)}
            max="100"
          ></progress>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-base-content/40 pointer-events-none"
            style={{ left: '50%' }}
            title="Umbral de decisión (50%)"
          >
            <span className="absolute -top-4 -translate-x-1/2 text-[9px] font-mono text-base-content/50">
              Umbral 50%
            </span>
          </div>
        </div>

        {/* Soporte empirico de la hoja (Tabla 7 del Word) */}
        {ruleSummary && typeof ruleSummary.train_neg === 'number' && (
          <div className="bg-base-100/80 px-3 py-2 rounded-lg border border-base-200 text-[11px] font-mono text-base-content/75 mb-3 flex flex-wrap justify-between gap-2">
            <span>
              Cohorte Entrenamiento: <strong>{ruleSummary.train_neg}</strong> sanos /{' '}
              <strong>{ruleSummary.train_pos}</strong> diabéticos
            </span>
            <span>
              Prueba: <strong>{ruleSummary.test_neg}</strong> / <strong>{ruleSummary.test_pos}</strong>
            </span>
          </div>
        )}

        {/* Aviso transparente de valores imputados */}
        {imputedFields.length > 0 && (
          <div className="bg-info/10 border border-info/30 rounded-xl p-3 mb-3 text-xs text-base-content/85 flex items-start gap-2">
            <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
            <div>
              <strong className="block text-[11px] uppercase tracking-wider text-info">
                Imputación Automática Aplicada (SimpleImputer)
              </strong>
              <span className="text-[11px]">
                Se emplearon medianas del entrenamiento para campos no medidos:{' '}
                {imputedFields.map((f, idx) => (
                  <span key={f.feature} className="font-mono font-semibold">
                    {idx > 0 ? ', ' : ''}
                    {f.label}: {f.imputed_value} {f.unit}
                  </span>
                ))}
                .
              </span>
            </div>
          </div>
        )}

        {/* Recomendacion Clinica */}
        {recommendation && (
          <div className="bg-base-100 p-4 rounded-xl border border-base-200 mt-2">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className={`w-4 h-4 ${isHighRisk ? 'text-error' : 'text-success'}`} />
              <h4 className="text-xs font-bold text-base-content">{recommendation.title}</h4>
            </div>
            <p className="text-xs text-base-content/70 leading-relaxed mb-3">
              {recommendation.clinical_message}
            </p>

            {recommendation.clinical_findings && recommendation.clinical_findings.length > 0 && (
              <div className="pt-2.5 border-t border-base-200">
                <span className="text-[11px] font-bold text-base-content/60 block mb-1">
                  Hallazgos observados:
                </span>
                <ul className="text-xs space-y-1">
                  {recommendation.clinical_findings.map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-base-content/90 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Secuencia Deductiva de Decision */}
      <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-primary" />
            Secuencia Deductiva ({ruleCode})
          </h3>
          <span className="badge badge-sm badge-neutral font-mono font-bold">
            {decisionSteps.length} Condiciones
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {decisionSteps.length === 0 ? (
            <p className="text-xs text-base-content/50 italic">Calculando trazabilidad de nodos...</p>
          ) : (
            decisionSteps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-base-200 text-xs"
              >
                <span className="badge badge-sm badge-primary font-mono font-bold shrink-0">
                  #{idx + 1}
                </span>
                <span className="font-medium text-base-content/90 flex-1">
                  {step.condition_evaluated}
                </span>
                <span className="text-[11px] text-base-content/50 font-mono flex items-center gap-1">
                  Rama <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Guardar en SQLite e Imprimir */}
      <form
        onSubmit={handleSave}
        className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-3 print:hidden"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/70 flex items-center gap-1.5">
            <Save className="w-4 h-4 text-primary" />
            Registrar Consulta en Base de Datos (SQLite)
          </h3>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-xs btn-ghost gap-1.5"
            title="Imprimir o guardar ficha clínica como PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Ficha
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <input
            type="text"
            placeholder="Nombre o código del paciente (ej. Paciente J.R.)"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="input input-bordered input-xs w-full"
          />
          <select
            value={patientContext}
            onChange={(e) => setPatientContext(e.target.value)}
            className="select select-bordered select-xs w-full"
          >
            {CONTEXT_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <input
          type="text"
          placeholder="Nota clínica breve (ej. Glucosa postprandial en consultorio, sin insulina medida)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input input-bordered input-xs w-full"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="submit"
            disabled={savingHistory}
            className="btn btn-sm btn-primary gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {savingHistory ? 'Guardando...' : 'Guardar Evaluación en SQLite'}
          </button>

          {savedNotice && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="text-xs text-success font-semibold flex items-center gap-1 hover:underline"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {savedNotice} Ver historial
            </button>
          )}
          {saveError && <span className="text-xs text-error font-medium">{saveError}</span>}
        </div>
      </form>
    </div>
  );
}
