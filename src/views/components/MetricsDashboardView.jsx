/**
 * VIEW: MetricsDashboardView.jsx
 * Panel alineado con Proyecto_IA_revisado_comp.docx:
 * 1) 3 metricas comparadas (Sensibilidad, F1-Score, Exactitud) + complementarias
 * 2) Contraste CART Base vs Balanceado (Tablas 4 y 5)
 * 3) Validacion cruzada estratificada cv=3 (Tabla 6) y classification_report
 * 4) Curva ROC (Figura 2) e Importancia de las 8 variables (Figura 3)
 */

import React from 'react';
import {
  ShieldCheck,
  Target,
  BarChart2,
  TrendingUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

function fmtPpDiff(bal, base, decimals = 2) {
  const diff = Number(bal) - Number(base);
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(decimals)} pp`;
}

export function MetricsDashboardView({
  metrics,
  baseline,
  confusionMatrix,
  classificationReport,
  crossValidation,
  featureImportances,
  rocCurvePoints,
  loading
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3 text-base-content/60">
        <span className="loading loading-spinner loading-md text-primary"></span>
        <span className="text-xs">Cargando métricas de evaluación del modelo...</span>
      </div>
    );
  }

  const renderRocSvg = () => {
    const width = 460;
    const height = 270;
    const padLeft = 45;
    const padBottom = 38;
    const padRight = 20;
    const padTop = 18;

    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    let pathD = `M ${padLeft} ${padTop + plotH}`;
    let areaD = `M ${padLeft} ${padTop + plotH}`;

    rocCurvePoints.forEach(pt => {
      const x = padLeft + pt.fpr * plotW;
      const y = padTop + (1 - pt.tpr) * plotH;
      pathD += ` L ${x} ${y}`;
      areaD += ` L ${x} ${y}`;
    });

    areaD += ` L ${padLeft + plotW} ${padTop + plotH} Z`;

    const opX = padLeft + (confusionMatrix.fp / 125) * plotW;
    const opY = padTop + (1 - confusionMatrix.tp / 67) * plotH;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto block">
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={padLeft + plotW}
          y2={padTop}
          stroke="currentColor"
          strokeDasharray="4 4"
          strokeWidth="1.5"
          className="text-base-content/30"
        />
        <path d={areaD} className="fill-primary/10" />
        <path d={pathD} fill="none" className="stroke-primary stroke-[3px]" />
        <circle cx={opX} cy={opY} r="5.5" className="fill-error stroke-base-100 stroke-2" />
        <text
          x={opX + 10}
          y={opY + 4}
          className="text-[10px] font-mono font-bold fill-error"
        >
          ({(confusionMatrix.fp / 125 * 100).toFixed(1)}% FPR, {(confusionMatrix.tp / 67 * 100).toFixed(1)}% TPR)
        </text>
        <text
          x={padLeft + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          className="text-[11px] fill-base-content/60"
        >
          Tasa de Falsos Positivos (1 - Especificidad)
        </text>
        <text
          transform="rotate(-90)"
          x={-(padTop + plotH / 2)}
          y={14}
          textAnchor="middle"
          className="text-[11px] fill-base-content/60"
        >
          Sensibilidad / TPR
        </text>
      </svg>
    );
  };

  const cvBase = crossValidation?.variants?.baseline;
  const cvBal = crossValidation?.variants?.balanced;
  const cvRows = [
    { key: 'accuracy', label: 'Exactitud (accuracy)' },
    { key: 'f1', label: 'F1-Score (f1)' },
    { key: 'recall', label: 'Sensibilidad (recall)' }
  ];

  const comparisonRows = [
    {
      label: 'Exactitud (Accuracy)',
      role: 'Evaluada (global)',
      isPrimary: true,
      baseVal: `${baseline.accuracy}%`,
      balVal: `${metrics.accuracy}%`,
      diff: fmtPpDiff(metrics.accuracy, baseline.accuracy)
    },
    {
      label: 'F1-Score',
      role: 'Evaluada (equilibrio)',
      isPrimary: true,
      baseVal: `${baseline.f1Pct}%`,
      balVal: `${metrics.f1Pct}%`,
      diff: fmtPpDiff(metrics.f1Pct, baseline.f1Pct)
    },
    {
      label: 'Sensibilidad (Recall)',
      role: 'Evaluada (rectora)',
      isPrimary: true,
      baseVal: `${baseline.sensitivity}%`,
      balVal: `${metrics.sensitivity}%`,
      diff: fmtPpDiff(metrics.sensitivity, baseline.sensitivity)
    },
    {
      label: 'Especificidad',
      role: 'Complementaria',
      isPrimary: false,
      baseVal: `${baseline.specificity}%`,
      balVal: `${metrics.specificity}%`,
      diff: fmtPpDiff(metrics.specificity, baseline.specificity)
    },
    {
      label: 'Precisión',
      role: 'Complementaria',
      isPrimary: false,
      baseVal: `${baseline.precision}%`,
      balVal: `${metrics.precision}%`,
      diff: fmtPpDiff(metrics.precision, baseline.precision)
    },
    {
      label: 'ROC-AUC',
      role: 'Separabilidad global',
      isPrimary: false,
      baseVal: baseline.rocAuc,
      balVal: metrics.rocAuc,
      diff: '0.0000'
    }
  ];

  const reportBal = classificationReport?.balanced;
  const reportBase = classificationReport?.baseline;

  return (
    <div className="flex flex-col gap-6">
      {/* Bloque 1: Las 3 Metricas Comparadas del Proyecto */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">
              Comparación de las Tres Métricas del Estudio (Prueba n = {confusionMatrix.totalTestPatients})
            </h2>
            <p className="text-xs text-base-content/60">
              Criterios contrastados entre CART sin ponderación y CART balanceado (`Proyecto_IA_revisado_comp.docx`).
            </p>
          </div>
          <span className="badge badge-primary font-semibold text-xs">
            Métrica Rectora: Sensibilidad + F1-Score
          </span>
        </div>

        <div className="stats stats-vertical lg:stats-horizontal shadow-sm bg-base-100 border border-base-200 w-full">
          <div className="stat">
            <div className="stat-figure text-primary">
              <Target className="w-8 h-8" />
            </div>
            <div className="stat-title text-xs font-bold text-primary">
              1. Sensibilidad (Recall) • Rectora
            </div>
            <div className="stat-value text-primary text-3xl">{metrics.sensitivity}%</div>
            <div className="stat-desc text-xs font-semibold text-success">
              Base: {baseline.sensitivity}% ({fmtPpDiff(metrics.sensitivity, baseline.sensitivity)} • +19 positivos detectados)
            </div>
          </div>

          <div className="stat">
            <div className="stat-figure text-secondary">
              <BarChart2 className="w-8 h-8" />
            </div>
            <div className="stat-title text-xs font-bold text-secondary">
              2. F1-Score • Equilibrio Clínico
            </div>
            <div className="stat-value text-secondary text-3xl">{metrics.f1Pct}%</div>
            <div className="stat-desc text-xs font-medium">
              Base: {baseline.f1Pct}% ({fmtPpDiff(metrics.f1Pct, baseline.f1Pct)} • índice {metrics.f1Score})
            </div>
          </div>

          <div className="stat">
            <div className="stat-figure text-base-content/60">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="stat-title text-xs font-bold">
              3. Exactitud (Accuracy) • Global
            </div>
            <div className="stat-value text-3xl">{metrics.accuracy}%</div>
            <div className="stat-desc text-xs">
              Base: {baseline.accuracy}% ({fmtPpDiff(metrics.accuracy, baseline.accuracy)} • enmascara FN)
            </div>
          </div>
        </div>

        {/* Metricas Complementarias */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-base-100 px-4 py-3 rounded-xl border border-base-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-base-content/60 block">
                Especificidad (complementaria)
              </span>
              <span className="text-lg font-bold font-mono">{metrics.specificity}%</span>
            </div>
            <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />
          </div>
          <div className="bg-base-100 px-4 py-3 rounded-xl border border-base-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-base-content/60 block">
                Precisión (complementaria)
              </span>
              <span className="text-lg font-bold font-mono">{metrics.precision}%</span>
            </div>
            <BarChart2 className="w-5 h-5 text-accent shrink-0" />
          </div>
          <div className="bg-base-100 px-4 py-3 rounded-xl border border-base-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-base-content/60 block">
                Área ROC (AUC global)
              </span>
              <span className="text-lg font-bold font-mono">{metrics.rocAuc}</span>
            </div>
            <TrendingUp className="w-5 h-5 text-info shrink-0" />
          </div>
        </div>
      </div>

      {/* Bloque 2: Tablas 4 y 5 (Comparacion CART Base vs Balanceado + Matrices) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-bold">
              Comparativa Directa: CART Sin Ponderar vs. CART Balanceado (Tabla 5)
            </h3>
            <p className="text-xs text-base-content/60">
              El modelo balanceado rescata pacientes positivos en la hoja frontera R4 sin perder ROC-AUC.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-base-200">
            <table className="table table-xs w-full">
              <thead>
                <tr className="bg-base-200 text-base-content/75">
                  <th>Métrica evaluada</th>
                  <th>Rol</th>
                  <th className="text-right">CART Base</th>
                  <th className="text-right">CART Balanceado</th>
                  <th className="text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(r => (
                  <tr key={r.label} className={r.isPrimary ? 'bg-primary/5 font-semibold' : ''}>
                    <td>{r.label}</td>
                    <td className="text-[11px] text-base-content/70">{r.role}</td>
                    <td className="text-right font-mono">{r.baseVal}</td>
                    <td className="text-right font-mono font-bold text-primary">{r.balVal}</td>
                    <td className="text-right font-mono">{r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Matrices de Confusion comparadas (Tabla 4) */}
        <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Matriz de Confusión (192 Pacientes de Prueba)</h3>
              <p className="text-xs text-base-content/60">
                Base: FN = {baseline.confusionMatrix.fn}, VP = {baseline.confusionMatrix.tp} &rarr; Balanceado: FN = {confusionMatrix.fn}, VP = {confusionMatrix.tp} (-19 FN).
              </p>
            </div>
            <span className="badge badge-success text-white font-mono text-xs font-bold">
              -52.78% Falsos Negativos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="table table-bordered text-center text-xs w-full">
              <thead>
                <tr>
                  <th colSpan="2" rowSpan="2" className="bg-base-200/50"></th>
                  <th colSpan="2" className="bg-base-200 font-bold">Predicción CART Balanceado</th>
                </tr>
                <tr>
                  <th className="bg-base-200/70 font-semibold">Riesgo Bajo (0)</th>
                  <th className="bg-base-200/70 font-semibold">Alto Riesgo (1)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th rowSpan="2" className="bg-base-200 font-bold [writing-mode:vertical-lr] rotate-180">
                    Realidad
                  </th>
                  <td className="font-semibold bg-base-200/50 text-left">No Diabético (125)</td>
                  <td className="p-2.5 bg-base-100">
                    <span className="text-xl font-black block">{confusionMatrix.tn}</span>
                    <span className="text-[11px] font-semibold text-success block">VN (Base: {baseline.confusionMatrix.tn})</span>
                  </td>
                  <td className="p-2.5 bg-base-100">
                    <span className="text-xl font-black block">{confusionMatrix.fp}</span>
                    <span className="text-[11px] font-semibold text-warning block">FP (Base: {baseline.confusionMatrix.fp})</span>
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold bg-base-200/50 text-left">Diabético (67)</td>
                  <td className="p-2.5 bg-error/10 border-2 border-error">
                    <span className="text-xl font-black text-error block">{confusionMatrix.fn}</span>
                    <span className="text-[11px] font-bold text-error block">FN (Base: {baseline.confusionMatrix.fn})</span>
                  </td>
                  <td className="p-2.5 bg-base-100">
                    <span className="text-xl font-black text-primary block">{confusionMatrix.tp}</span>
                    <span className="text-[11px] font-semibold text-primary block">VP (Base: {baseline.confusionMatrix.tp})</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-base-200/70 p-3 rounded-xl text-xs text-base-content/80 flex items-start gap-2 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              <strong>Por qué Sensibilidad + F1-Score superan a Exactitud:</strong> Sin balanceo, la Exactitud (70.83%) oculta que el modelo pierde el 53.73% de los diabéticos (36/67). Balanceando pesos, los Falsos Negativos bajan de 36 a 17 y el F1 sube +12.82 pp.
            </span>
          </div>
        </div>
      </div>

      {/* Bloque 3: Validacion Cruzada cv=3 (Tabla 6) y classification_report */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-bold">
              Validación Cruzada Estratificada (cv = {crossValidation?.n_splits ?? 3}, N = 768) • Tabla 6
            </h3>
            <p className="text-xs text-base-content/60">
              Imputación dentro de cada pliegue sin fuga de datos (`StratifiedKFold` + `Pipeline`).
            </p>
          </div>
          {cvBase && cvBal ? (
            <div className="overflow-x-auto rounded-xl border border-base-200">
              <table className="table table-xs w-full">
                <thead>
                  <tr className="bg-base-200 text-base-content/75">
                    <th>Métrica (scoring)</th>
                    <th className="text-right">CART Base (media &plusmn; DE)</th>
                    <th className="text-right">CART Balanceado (media &plusmn; DE)</th>
                    <th className="text-right">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {cvRows.map(row => {
                    const b = cvBase[row.key];
                    const p = cvBal[row.key];
                    const bMean = (b.mean * 100).toFixed(2);
                    const bStd = (b.std * 100).toFixed(2);
                    const pMean = (p.mean * 100).toFixed(2);
                    const pStd = (p.std * 100).toFixed(2);
                    return (
                      <tr key={row.key} className="hover">
                        <td className="font-semibold">{row.label}</td>
                        <td className="text-right font-mono">{bMean}% &plusmn; {bStd} pp</td>
                        <td className="text-right font-mono font-bold text-primary">{pMean}% &plusmn; {pStd} pp</td>
                        <td className="text-right font-mono font-semibold">{fmtPpDiff(pMean, bMean)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-base-content/60">Sin datos de validación cruzada.</p>
          )}
        </div>

        {/* Desglose classification_report */}
        <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-bold">Reporte Detallado por Clase (`classification_report`)</h3>
            <p className="text-xs text-base-content/60">
              Equilibrio entre clase 0 (sana) y clase 1 (diabética). Macro F1 sube de{' '}
              <strong>{reportBase?.['macro avg']?.['f1-score']?.toFixed(4) ?? '0.6574'}</strong> a{' '}
              <strong>{reportBal?.['macro avg']?.['f1-score']?.toFixed(4) ?? '0.7121'}</strong>.
            </p>
          </div>
          {reportBal ? (
            <div className="overflow-x-auto rounded-xl border border-base-200">
              <table className="table table-xs w-full">
                <thead>
                  <tr className="bg-base-200 text-base-content/75">
                    <th>Segmento / Clase</th>
                    <th className="text-right">Precisión</th>
                    <th className="text-right">Recall</th>
                    <th className="text-right">F1-Score</th>
                    <th className="text-right">Soporte</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: '0', label: 'Clase 0 (No Diabético)' },
                    { key: '1', label: 'Clase 1 (Diabético)' },
                    { key: 'macro avg', label: 'Promedio Macro' },
                    { key: 'weighted avg', label: 'Promedio Ponderado' }
                  ].map(item => {
                    const row = reportBal[item.key];
                    if (!row) return null;
                    return (
                      <tr key={item.key} className={item.key === '1' ? 'bg-primary/5 font-semibold' : ''}>
                        <td>{item.label}</td>
                        <td className="text-right font-mono">{Number(row.precision).toFixed(4)}</td>
                        <td className="text-right font-mono">{Number(row.recall).toFixed(4)}</td>
                        <td className="text-right font-mono">{Number(row['f1-score']).toFixed(4)}</td>
                        <td className="text-right font-mono">{row.support}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-base-content/60">Reporte por clase no disponible.</p>
          )}
        </div>
      </div>

      {/* Bloque 4: Curva ROC e Importancia de las 8 Caracteristicas (Figura 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">Curva Característica Operativa (ROC • Figura 2)</h3>
              <p className="text-xs text-base-content/60">Sensibilidad frente a tasa de Falsos Positivos.</p>
            </div>
            <span className="badge badge-primary font-mono font-bold">AUC = {metrics.rocAuc}</span>
          </div>
          <div className="bg-base-200/40 rounded-xl p-2 border border-base-200">
            {renderRocSvg()}
          </div>
        </div>

        <div className="bg-base-100 p-5 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-bold">Importancia Relativa de las 8 Variables (`feature_importances_` • Figura 3)</h3>
            <p className="text-xs text-base-content/60">
              Reducción normalizada de impureza de Gini con poda `max_depth = 3` (4 activas y 4 en 0.00%).
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            {featureImportances.map(f => {
              const pct = (f.importance * 100).toFixed(2);
              const isActive = f.importance > 0;
              return (
                <div key={f.feature} className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className={isActive ? 'text-base-content font-semibold' : 'text-base-content/50'}>
                      {f.label} ({f.feature})
                    </span>
                    <span className={`font-mono font-bold ${isActive ? 'text-primary' : 'text-base-content/40'}`}>
                      {pct}%
                    </span>
                  </div>
                  <progress
                    className={`progress w-full h-2 ${isActive ? 'progress-primary' : 'opacity-30'}`}
                    value={Number(pct)}
                    max="100"
                  ></progress>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
