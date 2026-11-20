/**
 * VIEWMODEL: useMetricsViewModel.js
 * Gestion de las 3 metricas comparadas (Exactitud, F1-Score, Sensibilidad),
 * contraste CART Base vs. Balanceado, validacion cruzada k=3 y reglas R1-R8.
 */

import { useState, useEffect } from 'react';
import { apiService } from '../models/apiService';

export function useMetricsViewModel() {
  const [metricsData, setMetricsData] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      apiService.getMetrics(),
      apiService.getRules()
    ])
      .then(([m, r]) => {
        if (mounted) {
          setMetricsData(m);
          setRules(r);
          setLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const m = metricsData?.metrics;
  const cm = metricsData?.confusion_matrix;
  const baseM = metricsData?.baseline_holdout?.metrics;
  const baseCm = metricsData?.baseline_holdout?.confusion_matrix;

  return {
    loading,
    error,
    metrics: {
      accuracy: m ? (m.accuracy * 100).toFixed(2) : '72.40',
      f1Pct: m ? (m.f1_score * 100).toFixed(2) : '65.36',
      f1Score: m ? m.f1_score.toFixed(4) : '0.6536',
      sensitivity: m ? (m.sensitivity_recall * 100).toFixed(2) : '74.63',
      specificity: m ? (m.specificity * 100).toFixed(2) : '71.20',
      precision: m ? (m.precision * 100).toFixed(2) : '58.14',
      rocAuc: m ? m.roc_auc.toFixed(4) : '0.7487'
    },
    baseline: {
      accuracy: baseM ? (baseM.accuracy * 100).toFixed(2) : '70.83',
      f1Pct: baseM ? (baseM.f1_score * 100).toFixed(2) : '52.54',
      f1Score: baseM ? baseM.f1_score.toFixed(4) : '0.5254',
      sensitivity: baseM ? (baseM.sensitivity_recall * 100).toFixed(2) : '46.27',
      specificity: baseM ? (baseM.specificity * 100).toFixed(2) : '84.00',
      precision: baseM ? (baseM.precision * 100).toFixed(2) : '60.78',
      rocAuc: baseM ? baseM.roc_auc.toFixed(4) : '0.7487',
      confusionMatrix: {
        tn: baseCm?.true_negatives ?? 105,
        fp: baseCm?.false_positives ?? 20,
        fn: baseCm?.false_negatives ?? 36,
        tp: baseCm?.true_positives ?? 31
      }
    },
    confusionMatrix: {
      tn: cm?.true_negatives ?? 89,
      fp: cm?.false_positives ?? 36,
      fn: cm?.false_negatives ?? 17,
      tp: cm?.true_positives ?? 50,
      totalTestPatients: metricsData?.test_set_size ?? 192
    },
    classificationReport: {
      balanced: metricsData?.classification_report ?? null,
      baseline: metricsData?.baseline_holdout?.classification_report ?? null
    },
    crossValidation: metricsData?.cross_validation ?? null,
    featureImportances: metricsData?.feature_importances || [],
    rocCurvePoints: metricsData?.roc_curve || [],
    rules
  };
}
