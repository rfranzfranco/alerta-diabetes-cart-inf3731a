/**
 * VIEWMODEL: useTriageViewModel.js
 * Logica reactiva de triaje clinico, imputacion de campos no medidos,
 * calculadora de IMC e integracion con el historial SQLite.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FEATURE_METADATA,
  CLINICAL_PRESETS,
  getDefaultPatientValues
} from '../models/PatientModel';
import { apiService } from '../models/apiService';

function buildEffectivePayload(values, unmeasuredMap) {
  const payload = { ...values };
  Object.keys(unmeasuredMap).forEach(key => {
    if (unmeasuredMap[key]) {
      payload[key] = 0;
    }
  });
  return payload;
}

function normalizeValuesAndFlags(rawData) {
  const nextValues = getDefaultPatientValues();
  const nextUnmeasured = {};

  Object.keys(FEATURE_METADATA).forEach(key => {
    const meta = FEATURE_METADATA[key];
    const incoming = rawData?.[key];
    if (meta.canBeUnmeasured && (incoming === 0 || incoming === '0' || incoming === null)) {
      nextUnmeasured[key] = true;
      nextValues[key] = meta.trainMedian ?? meta.default;
    } else if (incoming !== undefined && !Number.isNaN(Number(incoming))) {
      nextUnmeasured[key] = false;
      nextValues[key] = Number(incoming);
    }
  });

  return { nextValues, nextUnmeasured };
}

export function useTriageViewModel() {
  const [patientValues, setPatientValues] = useState(getDefaultPatientValues);
  const [unmeasuredMap, setUnmeasuredMap] = useState({});
  const [activePreset, setActivePreset] = useState('asymptomatic');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estado del historial SQLite
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [savingHistory, setSavingHistory] = useState(false);

  const debounceTimerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestSeqRef = useRef(0);
  const patientValuesRef = useRef(patientValues);
  const unmeasuredMapRef = useRef(unmeasuredMap);

  patientValuesRef.current = patientValues;
  unmeasuredMapRef.current = unmeasuredMap;

  const runPrediction = useCallback(async (values, flags) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const reqId = ++requestSeqRef.current;

    try {
      setLoading(true);
      setError(null);
      const effectivePayload = buildEffectivePayload(values, flags);
      const res = await apiService.predict(effectivePayload, { signal: controller.signal });
      if (reqId === requestSeqRef.current) {
        setPrediction(res);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (reqId === requestSeqRef.current) {
        setError(err.message || 'Error al procesar la evaluación clínica');
      }
    } finally {
      if (reqId === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const records = await apiService.getHistory();
      setHistoryRecords(records);
    } catch (err) {
      setHistoryError(err.message || 'No se pudo cargar el historial SQLite');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const schedulePrediction = useCallback((values, flags) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      runPrediction(values, flags);
    }, 45);
  }, [runPrediction]);

  const updateFeature = useCallback((featureKey, rawVal) => {
    if (rawVal === '' || rawVal === null || Number.isNaN(Number(rawVal))) return;
    const meta = FEATURE_METADATA[featureKey];
    let numVal = parseFloat(rawVal);
    if (meta) {
      numVal = Math.min(meta.max, Math.max(meta.min, numVal));
    }
    setActivePreset(null);

    const nextFlags = { ...unmeasuredMapRef.current, [featureKey]: false };
    const nextValues = { ...patientValuesRef.current, [featureKey]: numVal };
    unmeasuredMapRef.current = nextFlags;
    patientValuesRef.current = nextValues;

    setUnmeasuredMap(nextFlags);
    setPatientValues(nextValues);
    schedulePrediction(nextValues, nextFlags);
  }, [schedulePrediction]);

  const toggleUnmeasured = useCallback((featureKey) => {
    setActivePreset(null);
    const nextFlags = {
      ...unmeasuredMapRef.current,
      [featureKey]: !unmeasuredMapRef.current[featureKey]
    };
    unmeasuredMapRef.current = nextFlags;
    setUnmeasuredMap(nextFlags);
    schedulePrediction(patientValuesRef.current, nextFlags);
  }, [schedulePrediction]);

  const applyBasicConsultMode = useCallback(() => {
    setActivePreset(null);
    const nextFlags = {
      ...unmeasuredMapRef.current,
      Insulin: true,
      SkinThickness: true
    };
    unmeasuredMapRef.current = nextFlags;
    setUnmeasuredMap(nextFlags);
    runPrediction(patientValuesRef.current, nextFlags);
  }, [runPrediction]);

  const applyCalculatedBmi = useCallback((weightKg, heightCm) => {
    const w = parseFloat(weightKg);
    const hCm = parseFloat(heightCm);
    if (!(w > 0) || !(hCm > 40)) return null;
    const hM = hCm / 100;
    const rawBmi = w / (hM * hM);
    const meta = FEATURE_METADATA.BMI;
    const clampedBmi = Number(Math.min(meta.max, Math.max(meta.min, rawBmi)).toFixed(1));
    updateFeature('BMI', clampedBmi);
    return clampedBmi;
  }, [updateFeature]);

  const applyPreset = useCallback((presetId) => {
    const preset = CLINICAL_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const { nextValues, nextUnmeasured } = normalizeValuesAndFlags(preset.data);
    patientValuesRef.current = nextValues;
    unmeasuredMapRef.current = nextUnmeasured;
    setActivePreset(presetId);
    setPatientValues(nextValues);
    setUnmeasuredMap(nextUnmeasured);
    runPrediction(nextValues, nextUnmeasured);
  }, [runPrediction]);

  const loadRecordIntoTriage = useCallback((record) => {
    const { nextValues, nextUnmeasured } = normalizeValuesAndFlags(record.raw_features || {});
    patientValuesRef.current = nextValues;
    unmeasuredMapRef.current = nextUnmeasured;
    setActivePreset(null);
    setPatientValues(nextValues);
    setUnmeasuredMap(nextUnmeasured);
    runPrediction(nextValues, nextUnmeasured);
  }, [runPrediction]);

  const saveToHistory = useCallback(async ({ patientName, patientContext, notes }) => {
    try {
      setSavingHistory(true);
      const featuresPayload = buildEffectivePayload(patientValuesRef.current, unmeasuredMapRef.current);
      const saved = await apiService.saveHistoryRecord({
        patient_name: patientName,
        patient_context: patientContext,
        notes,
        features: featuresPayload
      });
      setHistoryRecords(prev => [saved, ...prev]);
      return saved;
    } finally {
      setSavingHistory(false);
    }
  }, []);

  const removeFromHistory = useCallback(async (recordId) => {
    await apiService.deleteHistoryRecord(recordId);
    setHistoryRecords(prev => prev.filter(r => r.id !== recordId));
  }, []);

  useEffect(() => {
    applyPreset('asymptomatic');
    refreshHistory();
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [applyPreset, refreshHistory]);

  return {
    patientValues,
    unmeasuredMap,
    activePreset,
    prediction,
    loading,
    error,
    updateFeature,
    toggleUnmeasured,
    applyBasicConsultMode,
    applyCalculatedBmi,
    applyPreset,
    presets: CLINICAL_PRESETS,
    isHighRisk: prediction?.predicted_class === 1,
    probabilityPct: prediction?.probability_pct ?? 0,
    dictum: prediction?.dictum ?? 'Evaluando perfil...',
    visitedNodes: prediction?.visited_nodes ?? [],
    leafNodeId: prediction?.leaf_node_id ?? 0,
    ruleCode: prediction?.rule_code ?? 'R1',
    ruleSummary: prediction?.rule_summary ?? null,
    decisionSteps: prediction?.decision_path ?? [],
    imputedFields: prediction?.imputed_fields ?? [],
    imputedFeatures: prediction?.imputed_features ?? {},
    clinicalRecommendation: prediction?.clinical_recommendation ?? null,
    // Historial SQLite
    historyRecords,
    historyLoading,
    historyError,
    savingHistory,
    refreshHistory,
    saveToHistory,
    removeFromHistory,
    loadRecordIntoTriage
  };
}
