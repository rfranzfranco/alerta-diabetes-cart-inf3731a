/**
 * VIEW: ClinicalRulesTableView.jsx
 * Tabla de reglas clinicas R1 a R8 con conteos reales Train/Test (Tabla 7 del Word).
 */

import React from 'react';
import { FileCode2, CheckCircle2, AlertTriangle } from 'lucide-react';

export function ClinicalRulesTableView({ rules, loading }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3 text-base-content/60">
        <span className="loading loading-spinner loading-md text-primary"></span>
        <span className="text-xs">Cargando reglas clínicas extraídas...</span>
      </div>
    );
  }

  return (
    <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileCode2 className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-sm font-bold">
              Reglas Clínicas Deterministas R1–R8 (Tabla 7 del Informe)
            </h2>
            <p className="text-xs text-base-content/60">
              Reglas SI ... ENTONCES ... con probabilidad posterior balanceada P(DM2) y soporte real en entrenamiento/prueba.
            </p>
          </div>
        </div>
        <span className="badge badge-neutral font-mono font-bold">{rules.length} Reglas Extraídas</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-200">
        <table className="table table-zebra text-xs w-full">
          <thead>
            <tr className="bg-base-200 text-base-content/70">
              <th className="w-16">Regla</th>
              <th>Condiciones Fisiológicas Evaluadas (SI ...)</th>
              <th className="w-44">Dictamen (ENTONCES ...)</th>
              <th className="w-24 text-center">P(DM2)</th>
              <th className="w-28 text-center">Train (Neg/Pos)</th>
              <th className="w-28 text-center">Test (Neg/Pos)</th>
            </tr>
          </thead>
          <tbody>
            {rules.map(r => {
              const isHigh = r.predicted_class === 1;
              const Icon = isHigh ? AlertTriangle : CheckCircle2;
              const code = r.rule_code || `R${r.rule_id}`;
              const hasSplitCounts = typeof r.train_neg === 'number' && typeof r.test_neg === 'number';
              return (
                <tr key={r.rule_id} className="hover">
                  <td>
                    <span className="badge badge-sm badge-neutral font-mono font-bold">
                      {code}
                    </span>
                  </td>
                  <td className="font-mono text-[11px] leading-relaxed">
                    {r.conditions.map((c, i) => (
                      <span key={i}>
                        <span className="bg-base-200 px-1.5 py-0.5 rounded text-base-content font-medium">
                          {c.condition_str}
                        </span>
                        {i < r.conditions.length - 1 && (
                          <span className="text-primary font-bold px-1.5 font-sans">Y</span>
                        )}
                      </span>
                    ))}
                  </td>
                  <td>
                    <div
                      className={`badge badge-sm gap-1 font-bold py-2.5 px-2.5 ${
                        isHigh ? 'badge-error text-white' : 'badge-success text-white'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{isHigh ? 'Alto Riesgo' : 'Riesgo Bajo'}</span>
                    </div>
                  </td>
                  <td className="text-center font-bold font-mono">
                    {(r.prob_diabetic * 100).toFixed(2)}%
                  </td>
                  <td className="text-center text-base-content/70 font-mono">
                    {hasSplitCounts ? `${r.train_neg} / ${r.train_pos}` : `${r.samples_in_leaf} p.`}
                  </td>
                  <td className="text-center text-base-content/70 font-mono">
                    {hasSplitCounts ? `${r.test_neg} / ${r.test_pos}` : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
