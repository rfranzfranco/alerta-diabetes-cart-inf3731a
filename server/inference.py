"""
Motor de inferencia clínica y trazabilidad del camino de decisión.
INF-3731A - Inteligencia Artificial.
"""

import json
import math
import sys
from pathlib import Path
from typing import Any, Dict, List

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import joblib
import numpy as np
import pandas as pd
from sklearn.tree import _tree

from server.preprocessor import (
    BIOLOGICAL_ZERO_COLS,
    FEATURE_METADATA,
    FEATURE_NAMES
)

DEFAULT_LEAF_TO_RULE = {
    3: 1,
    4: 2,
    6: 3,
    7: 4,
    10: 5,
    11: 6,
    13: 7,
    14: 8,
}


class DiabetesInferenceEngine:
    """
    Ejecutor de inferencia con explicabilidad funcional: rastrea en tiempo real
    cada nodo recorrido por el paciente en el arbol de clasificacion.
    """

    def __init__(self, models_dir: Path):
        self.models_dir = models_dir
        self.model_path = models_dir / "decision_tree.joblib"
        self.imputer_path = models_dir / "imputer.joblib"
        self.rules_path = models_dir / "clinical_rules.json"

        if not self.model_path.exists() or not self.imputer_path.exists():
            raise FileNotFoundError(
                "Los artefactos del modelo no se encuentran. Ejecute primero el entrenamiento."
            )

        self.clf = joblib.load(self.model_path)
        self.imputer = joblib.load(self.imputer_path)
        self.rules_by_leaf: Dict[int, Dict[str, Any]] = {}
        if self.rules_path.exists():
            with open(self.rules_path, "r", encoding="utf-8") as f:
                for rule in json.load(f):
                    self.rules_by_leaf[int(rule["leaf_node_id"])] = rule

    def evaluate_patient(self, input_features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calcula el dictamen de riesgo, la probabilidad, la regla R1-R8 y las variables imputadas.
        Valida tipos, finitud y rangos no negativos antes de inferir.
        """
        if not isinstance(input_features, dict):
            raise ValueError("El perfil del paciente debe enviarse como un objeto JSON válido.")

        raw_row: Dict[str, float] = {}
        raw_features: Dict[str, float] = {}
        missing_bio_cols: List[str] = []

        for feat in FEATURE_NAMES:
            val = input_features.get(feat, FEATURE_METADATA[feat]['default'])
            is_empty = val is None or (isinstance(val, str) and not val.strip())

            if is_empty:
                if feat in BIOLOGICAL_ZERO_COLS:
                    num_val = 0.0
                else:
                    raise ValueError(
                        f"El campo obligatorio '{FEATURE_METADATA[feat]['label']}' no puede estar vacío."
                    )
            else:
                if isinstance(val, bool):
                    raise ValueError(
                        f"Valor inválido para '{FEATURE_METADATA[feat]['label']}': se esperaba un número."
                    )
                try:
                    num_val = float(val)
                except (TypeError, ValueError) as exc:
                    raise ValueError(
                        f"Valor no numérico en '{FEATURE_METADATA[feat]['label']}'."
                    ) from exc

                if not math.isfinite(num_val):
                    raise ValueError(
                        f"Valor fuera de dominio (NaN o infinito) en '{FEATURE_METADATA[feat]['label']}'."
                    )
                if num_val < 0:
                    raise ValueError(
                        f"El campo '{FEATURE_METADATA[feat]['label']}' no admite valores negativos."
                    )
                if feat in ('Age', 'DiabetesPedigreeFunction') and num_val == 0:
                    raise ValueError(
                        f"El campo '{FEATURE_METADATA[feat]['label']}' debe ser mayor que cero."
                    )

            raw_features[feat] = round(num_val, 2)

            if feat in BIOLOGICAL_ZERO_COLS and (is_empty or num_val == 0):
                raw_row[feat] = np.nan
                missing_bio_cols.append(feat)
            else:
                raw_row[feat] = num_val

        df_raw = pd.DataFrame([raw_row], columns=FEATURE_NAMES)
        imputed_array = self.imputer.transform(df_raw)
        df_imputed = pd.DataFrame(imputed_array, columns=FEATURE_NAMES)

        imputed_fields = [
            {
                'feature': feat,
                'label': FEATURE_METADATA[feat]['label'],
                'unit': FEATURE_METADATA[feat]['unit'],
                'imputed_value': round(float(df_imputed.iloc[0][feat]), 2)
            }
            for feat in missing_bio_cols
        ]

        # Inferencia con scikit-learn
        predicted_class = int(self.clf.predict(df_imputed)[0])
        probabilities = self.clf.predict_proba(df_imputed)[0]
        prob_diabetic = float(probabilities[1])
        prob_pct = round(prob_diabetic * 100, 1)

        # Rastreo manual del camino del arbol para explicabilidad completa
        tree_ = self.clf.tree_
        visited_nodes: List[int] = []
        path_details: List[Dict[str, Any]] = []

        current_node = 0
        while True:
            visited_nodes.append(int(current_node))

            if tree_.children_left[current_node] == _tree.TREE_LEAF:
                # Nodo hoja alcanzado
                break

            feature_idx = int(tree_.feature[current_node])
            feat_name = FEATURE_NAMES[feature_idx]
            threshold = float(tree_.threshold[current_node])
            patient_val = float(df_imputed.iloc[0][feat_name])

            meta = FEATURE_METADATA.get(feat_name, {})
            label = meta.get('label', feat_name)
            unit = meta.get('unit', '')

            if patient_val <= threshold:
                next_node = int(tree_.children_left[current_node])
                direction = "left"
                comp_str = f"{label} ({patient_val:.1f} {unit}) <= {threshold:.1f} {unit}"
            else:
                next_node = int(tree_.children_right[current_node])
                direction = "right"
                comp_str = f"{label} ({patient_val:.1f} {unit}) > {threshold:.1f} {unit}"

            path_details.append({
                'node_id': int(current_node),
                'feature': feat_name,
                'feature_label': label,
                'patient_value': round(patient_val, 2),
                'threshold': round(threshold, 2),
                'unit': unit,
                'direction': direction,
                'condition_evaluated': comp_str,
                'next_node': next_node
            })

            current_node = next_node

        leaf_node_id = visited_nodes[-1] if visited_nodes else 0
        matched_rule = self.rules_by_leaf.get(leaf_node_id)
        rule_id = int(matched_rule['rule_id']) if matched_rule else DEFAULT_LEAF_TO_RULE.get(leaf_node_id, 0)
        rule_code = matched_rule.get('rule_code', f"R{rule_id}") if matched_rule else (f"R{rule_id}" if rule_id else f"N{leaf_node_id}")
        rule_summary = None
        if matched_rule:
            rule_summary = {
                'rule_id': rule_id,
                'rule_code': rule_code,
                'rule_text': matched_rule.get('rule_text', ''),
                'samples_in_leaf': matched_rule.get('samples_in_leaf'),
                'train_neg': matched_rule.get('train_neg'),
                'train_pos': matched_rule.get('train_pos'),
                'test_neg': matched_rule.get('test_neg'),
                'test_pos': matched_rule.get('test_pos'),
            }

        # Generacion de recomendacion clinica personalizada
        recommendation = self._generate_recommendation(
            predicted_class=predicted_class,
            prob_diabetic=prob_diabetic,
            patient_series=df_imputed.iloc[0],
            path_details=path_details
        )

        return {
            'predicted_class': predicted_class,
            'risk_level': 'ALTO' if predicted_class == 1 else 'BAJO',
            'dictum': 'Alerta: Alto Riesgo - Requiere Valoración Médica' if predicted_class == 1 else 'Riesgo Bajo / Estable',
            'prob_diabetic': round(prob_diabetic, 4),
            'probability_pct': prob_pct,
            'visited_nodes': visited_nodes,
            'leaf_node_id': leaf_node_id,
            'rule_id': rule_id,
            'rule_code': rule_code,
            'rule_summary': rule_summary,
            'decision_path': path_details,
            'raw_features': raw_features,
            'imputed_features': {k: round(float(v), 2) for k, v in df_imputed.iloc[0].items()},
            'imputed_fields': imputed_fields,
            'clinical_recommendation': recommendation
        }

    def _generate_recommendation(
        self,
        predicted_class: int,
        prob_diabetic: float,
        patient_series: pd.Series,
        path_details: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Formula recomendaciones preventivas estructuradas acordes a criterios de OMS/ADA.
        """
        alerts = []
        glucose = patient_series['Glucose']
        bmi = patient_series['BMI']
        bp = patient_series['BloodPressure']

        if glucose >= 200:
            alerts.append(f"Glucemia a 2 h en rango diagnóstico de diabetes ({glucose:.0f} mg/dL, ≥ 200 mg/dL).")
        elif glucose >= 140:
            alerts.append(f"Intolerancia a la glucosa a 2 h en prueba oral ({glucose:.0f} mg/dL, 140–199 mg/dL).")
        elif glucose > 132.5:
            alerts.append(f"Glucemia a 2 h sobre el umbral raíz del árbol CART ({glucose:.0f} mg/dL > 132.5 mg/dL).")

        if bmi >= 30:
            alerts.append(f"Obesidad clínica con IMC de {bmi:.1f} kg/m².")
        elif bmi >= 25:
            alerts.append(f"Sobrepeso con IMC de {bmi:.1f} kg/m².")

        if bp >= 90:
            alerts.append(f"Presión diastólica elevada ({bp:.0f} mm Hg).")

        if predicted_class == 1:
            title = "Conducta Clínica Prioritaria: Derivación a Examen Serológico"
            message = (
                "El perfil del paciente presenta criterios concordantes con alto riesgo de alteración metabólica. "
                "Se recomienda emitir orden de laboratorio para prueba de glucosa plasmática en ayunas y hemoglobina "
                "glicosilada (HbA1c) en un plazo menor a 15 días, acompañada de evaluación nutricional preventiva."
            )
            urgency = "Alta"
        else:
            title = "Conducta Clínica Preventiva: Control Ambulatorio Estándar"
            message = (
                "Los parámetros evaluados se ubican dentro de los márgenes de riesgo bajo según el árbol de decisión. "
                "Se aconseja mantener hábitos saludables de actividad física, alimentación equilibrada y control de rutina "
                "anual en centro de salud primario."
            )
            urgency = "Rutinaria"

        return {
            'title': title,
            'urgency': urgency,
            'clinical_message': message,
            'clinical_findings': alerts
        }
