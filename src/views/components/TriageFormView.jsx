/**
 * VIEW: TriageFormView.jsx
 * Formulario moderno para pruebas con personas reales: entradas numericas + sliders,
 * calculadora de IMC (Peso/Talla), selector de pedigree y casilla 'No medido'.
 */

import React, { useState } from 'react';
import { FEATURE_METADATA, PEDIGREE_PRESETS } from '../../models/PatientModel';
import {
  Droplet,
  Heart,
  Scale,
  Calendar,
  Users,
  Dna,
  Activity,
  Calculator,
  FlaskConical
} from 'lucide-react';

const FEATURE_ICONS = {
  Glucose: Droplet,
  Insulin: Activity,
  SkinThickness: Scale,
  BMI: Scale,
  Age: Calendar,
  BloodPressure: Heart,
  Pregnancies: Users,
  DiabetesPedigreeFunction: Dna
};

export function TriageFormView({
  patientValues,
  unmeasuredMap = {},
  onFeatureChange,
  onToggleUnmeasured,
  onBasicConsultMode,
  onCalculateBmi
}) {
  const [weightKg, setWeightKg] = useState('72');
  const [heightCm, setHeightCm] = useState('162');
  const [bmiFeedback, setBmiFeedback] = useState(null);

  const metabolismFeatures = ['Glucose', 'Insulin', 'SkinThickness'];
  const biometryFeatures = ['BMI', 'Age', 'BloodPressure', 'Pregnancies', 'DiabetesPedigreeFunction'];

  const handleBmiApply = (e) => {
    e.preventDefault();
    const res = onCalculateBmi(weightKg, heightCm);
    if (res !== null) {
      setBmiFeedback(`IMC aplicado: ${res} kg/m²`);
    }
  };

  const renderFeatureCard = (key) => {
    const meta = FEATURE_METADATA[key];
    const isUnmeasured = Boolean(unmeasuredMap[key]);
    const val = patientValues[key] ?? meta.default;
    const Icon = FEATURE_ICONS[key] || Activity;

    return (
      <div
        key={key}
        className={`bg-base-100 p-4 rounded-xl border shadow-sm flex flex-col gap-2.5 transition-all ${
          meta.isUsedInTree ? 'border-primary/25' : 'border-base-200'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <label className="text-xs font-semibold flex items-center gap-1.5 text-base-content/90 leading-snug">
            <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.isUsedInTree ? 'text-primary' : 'text-base-content/50'}`} />
            <span>{meta.label}</span>
          </label>
          {meta.isUsedInTree ? (
            <span
              className="badge badge-xs badge-primary font-mono shrink-0"
              title="Variable activa dentro de los nodos de corte del árbol CART"
            >
              Gini {meta.treeImportancePct}%
            </span>
          ) : (
            <span
              className="badge badge-xs badge-ghost font-mono shrink-0"
              title="Variable registrada en el perfil; importancia 0% con max_depth=3"
            >
              0% árbol
            </span>
          )}
        </div>

        {/* Entrada numerica directa + Unidad */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={meta.min}
            max={meta.max}
            step={meta.step}
            disabled={isUnmeasured}
            value={isUnmeasured ? meta.trainMedian : val}
            onChange={(e) => onFeatureChange(key, e.target.value)}
            className="input input-bordered input-xs font-mono font-bold w-24 text-center"
          />
          <span className="text-[11px] text-base-content/60 font-medium">{meta.unit}</span>

          {meta.canBeUnmeasured && (
            <label className="ml-auto flex items-center gap-1.5 cursor-pointer text-[11px] text-base-content/70 select-none">
              <input
                type="checkbox"
                checked={isUnmeasured}
                onChange={() => onToggleUnmeasured(key)}
                className="checkbox checkbox-xs checkbox-primary"
              />
              <span>No medido</span>
            </label>
          )}
        </div>

        {/* Slider o aviso de imputacion */}
        {isUnmeasured ? (
          <div className="bg-info/10 border border-info/30 text-info rounded-lg px-2.5 py-1.5 text-[11px] font-medium">
            Se imputará mediana del entrenamiento: <strong>{meta.trainMedian} {meta.unit}</strong>
          </div>
        ) : (
          <input
            type="range"
            min={meta.min}
            max={meta.max}
            step={meta.step}
            value={val}
            onChange={(e) => onFeatureChange(key, e.target.value)}
            className="range range-primary range-xs"
          />
        )}

        <div className="flex justify-between text-[10px] text-base-content/55 pt-0.5 gap-2">
          <span>{meta.refNormal}</span>
          <span className={`font-mono text-right ${meta.isUsedInTree ? 'text-primary font-semibold' : ''}`}>
            {meta.refTree}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Asistentes para evaluacion de personas reales */}
      <div className="bg-base-100 p-4 rounded-2xl border border-base-200 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/80 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-primary" />
              Asistentes Rápidos para Casos Reales
            </h3>
            <p className="text-[11px] text-base-content/60">
              Útiles para personas sin diagnóstico previo que desconocen su IMC exacto, su índice DPF o no cuentan con insulina/pliegue.
            </p>
          </div>

          <button
            type="button"
            onClick={onBasicConsultMode}
            className="btn btn-xs btn-outline btn-primary gap-1.5"
            title="Marca Insulina y Pliegue cutáneo como no medidos para usar las medianas del modelo"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Sin lab. insulina/pliegue
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1 border-t border-base-200">
          {/* Calculadora de IMC */}
          <form onSubmit={handleBmiApply} className="flex flex-wrap items-end gap-2 bg-base-200/50 p-2.5 rounded-xl">
            <div>
              <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                Peso (kg)
              </span>
              <input
                type="number"
                min="25"
                max="220"
                step="0.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="input input-bordered input-xs w-20 font-mono"
              />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-base-content/60 block mb-1">
                Talla (cm)
              </span>
              <input
                type="number"
                min="100"
                max="220"
                step="1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="input input-bordered input-xs w-20 font-mono"
              />
            </div>
            <button type="submit" className="btn btn-xs btn-primary">
              Calcular IMC
            </button>
            {bmiFeedback && (
              <span className="text-[11px] font-mono text-success font-semibold">{bmiFeedback}</span>
            )}
          </form>

          {/* Selector orientativo de Pedigree */}
          <div className="bg-base-200/50 p-2.5 rounded-xl flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase text-base-content/60">
              Guía de Antecedentes Familiares (Pedigree DPF)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PEDIGREE_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onFeatureChange('DiabetesPedigreeFunction', p.value)}
                  className={`btn btn-xs ${
                    Math.abs((patientValues.DiabetesPedigreeFunction ?? 0) - p.value) < 0.02
                      ? 'btn-secondary'
                      : 'btn-ghost bg-base-100 border border-base-300'
                  }`}
                  title={`${p.hint} (DPF = ${p.value})`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grupo 1: Bioquimica */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Droplet className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
            Bioquímica y Metabolismo
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {metabolismFeatures.map(renderFeatureCard)}
        </div>
      </div>

      {/* Grupo 2: Biometria */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/70">
            Biometría y Antecedentes
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {biometryFeatures.map(renderFeatureCard)}
        </div>
      </div>
    </div>
  );
}
