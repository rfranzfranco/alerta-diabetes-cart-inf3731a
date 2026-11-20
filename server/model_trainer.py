"""
Módulo de entrenamiento, evaluación y extracción de reglas clínicas del Árbol de Decisión.
INF-3731A - Inteligencia Artificial.
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve
)
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.tree import DecisionTreeClassifier, _tree

from server.preprocessor import (
    BIOLOGICAL_ZERO_COLS,
    FEATURE_METADATA,
    FEATURE_NAMES,
    TARGET_NAME,
    load_raw_data,
    preprocess_dataset
)


def extract_tree_dict(clf: DecisionTreeClassifier, feature_names: List[str]) -> Dict[str, Any]:
    """
    Serializa la estructura jerarquica del arbol de decision en un diccionario JSON
    para facilitar su renderizado en grafos SVG interactivos en el frontend.
    """
    tree_ = clf.tree_

    def recurse(node_id: int, depth: int) -> Dict[str, Any]:
        is_leaf = bool(tree_.children_left[node_id] == _tree.TREE_LEAF)
        value = tree_.value[node_id][0]
        total_samples = float(np.sum(value))
        prob_diabetic = float(value[1] / total_samples) if total_samples > 0 else 0.0
        predicted_class = int(np.argmax(value))

        node_data: Dict[str, Any] = {
            'node_id': int(node_id),
            'depth': depth,
            'is_leaf': is_leaf,
            'n_samples': int(tree_.n_node_samples[node_id]),
            'impurity': round(float(tree_.impurity[node_id]), 4),
            'value': [int(value[0]), int(value[1])],
            'prob_diabetic': round(prob_diabetic, 4),
            'predicted_class': predicted_class,
            'predicted_label': 'Alerta: Alto Riesgo' if predicted_class == 1 else 'Riesgo Bajo / Estable'
        }

        if not is_leaf:
            feature_idx = int(tree_.feature[node_id])
            feat_name = feature_names[feature_idx]
            threshold = round(float(tree_.threshold[node_id]), 2)
            meta = FEATURE_METADATA.get(feat_name, {})
            label = meta.get('label', feat_name)
            unit = meta.get('unit', '')

            node_data.update({
                'feature': feat_name,
                'feature_label': label,
                'threshold': threshold,
                'unit': unit,
                'condition_text': f"{label} <= {threshold} {unit}".strip(),
                'left_child': recurse(int(tree_.children_left[node_id]), depth + 1),
                'right_child': recurse(int(tree_.children_right[node_id]), depth + 1)
            })

        return node_data

    return recurse(0, 0)


def extract_clinical_rules(
    clf: DecisionTreeClassifier,
    feature_names: List[str],
    x_train: pd.DataFrame = None,
    y_train: pd.Series = None,
    x_test: pd.DataFrame = None,
    y_test: pd.Series = None
) -> List[Dict[str, Any]]:
    """
    Extrae reglas deterministas legibles en lenguaje natural clinico (SI ... ENTONCES ...)
    desde el nodo raiz hasta cada hoja terminal, junto con los conteos reales en train/test.
    """
    tree_ = clf.tree_
    rules: List[Dict[str, Any]] = []

    train_leaves = clf.apply(x_train) if x_train is not None and y_train is not None else None
    test_leaves = clf.apply(x_test) if x_test is not None and y_test is not None else None
    y_train_arr = np.asarray(y_train) if y_train is not None else None
    y_test_arr = np.asarray(y_test) if y_test is not None else None

    def recurse(node_id: int, current_path: List[Dict[str, Any]]) -> None:
        if tree_.children_left[node_id] == _tree.TREE_LEAF:
            value = tree_.value[node_id][0]
            total_samples = float(np.sum(value))
            prob_diabetic = float(value[1] / total_samples) if total_samples > 0 else 0.0
            predicted_class = int(np.argmax(value))

            rule_idx = len(rules) + 1
            rule_text = "SI " + " Y ".join([p['condition_str'] for p in current_path]) if current_path else "SIEMPRE"
            conclusion = "ALERTA: ALTO RIESGO" if predicted_class == 1 else "RIESGO BAJO / ESTABLE"

            rule_entry: Dict[str, Any] = {
                'rule_id': rule_idx,
                'rule_code': f"R{rule_idx}",
                'leaf_node_id': int(node_id),
                'conditions': current_path,
                'rule_text': f"{rule_text} -> ENTONCES {conclusion}",
                'predicted_class': predicted_class,
                'predicted_label': conclusion,
                'prob_diabetic': round(prob_diabetic, 4),
                'samples_in_leaf': int(tree_.n_node_samples[node_id]),
                'class_distribution': [int(value[0]), int(value[1])]
            }
            if train_leaves is not None and y_train_arr is not None:
                mask_tr = train_leaves == node_id
                rule_entry['train_neg'] = int(np.sum(mask_tr & (y_train_arr == 0)))
                rule_entry['train_pos'] = int(np.sum(mask_tr & (y_train_arr == 1)))
            if test_leaves is not None and y_test_arr is not None:
                mask_te = test_leaves == node_id
                rule_entry['test_neg'] = int(np.sum(mask_te & (y_test_arr == 0)))
                rule_entry['test_pos'] = int(np.sum(mask_te & (y_test_arr == 1)))

            rules.append(rule_entry)
            return

        feature_idx = tree_.feature[node_id]
        feat_name = feature_names[feature_idx]
        threshold = round(float(tree_.threshold[node_id]), 2)
        meta = FEATURE_METADATA.get(feat_name, {})
        label = meta.get('label', feat_name)
        unit = meta.get('unit', '')

        # Rama izquierda: <= threshold
        left_cond = {
            'feature': feat_name,
            'operator': '<=',
            'threshold': threshold,
            'condition_str': f"{label} <= {threshold} {unit}".strip()
        }
        recurse(tree_.children_left[node_id], current_path + [left_cond])

        # Rama derecha: > threshold
        right_cond = {
            'feature': feat_name,
            'operator': '>',
            'threshold': threshold,
            'condition_str': f"{label} > {threshold} {unit}".strip()
        }
        recurse(tree_.children_right[node_id], current_path + [right_cond])

    recurse(0, [])
    return rules


def evaluate_cross_validation(
    raw_csv_path: Path,
    max_depth: int = 3,
    criterion: str = 'gini',
    n_splits: int = 3,
    random_state: int = 42
) -> Dict[str, Any]:
    """
    Ejecuta validacion cruzada estratificada sin fuga de datos sobre las tres
    metricas del estudio (accuracy, f1, recall) para base sin ponderar y balanceado.
    """
    df_clean = load_raw_data(raw_csv_path).copy()
    for col in BIOLOGICAL_ZERO_COLS:
        df_clean[col] = df_clean[col].replace(0, np.nan)

    x_all = df_clean[FEATURE_NAMES]
    y_all = df_clean[TARGET_NAME]
    cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)

    cv_results: Dict[str, Any] = {'n_splits': n_splits, 'variants': {}}
    for variant, class_weight in [('baseline', None), ('balanced', 'balanced')]:
        pipe = make_pipeline(
            SimpleImputer(strategy='median'),
            DecisionTreeClassifier(
                criterion=criterion,
                max_depth=max_depth,
                class_weight=class_weight,
                random_state=random_state
            )
        )
        variant_scores: Dict[str, Dict[str, Any]] = {}
        for metric_name in ('accuracy', 'f1', 'recall'):
            scores = cross_val_score(pipe, x_all, y_all, cv=cv, scoring=metric_name)
            variant_scores[metric_name] = {
                'fold_scores': [round(float(s), 4) for s in scores],
                'mean': round(float(np.mean(scores)), 4),
                'std': round(float(np.std(scores)), 4)
            }
        cv_results['variants'][variant] = variant_scores

    return cv_results


def _evaluate_holdout(
    clf: DecisionTreeClassifier,
    x_test: pd.DataFrame,
    y_test: pd.Series
) -> Dict[str, Any]:
    """Calcula metricas de prueba, matriz de confusion, reporte por clase y curva ROC."""
    y_pred = clf.predict(x_test)
    y_prob = clf.predict_proba(x_test)[:, 1]

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    sensitivity = recall_score(y_test, y_pred)
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    precision = precision_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred)
    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)

    raw_report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    formatted_report = {
        key: (
            {m: int(v) if m == 'support' else round(float(v), 4) for m, v in val.items()}
            if isinstance(val, dict)
            else round(float(val), 4)
        )
        for key, val in raw_report.items()
    }

    fpr, tpr, thresholds = roc_curve(y_test, y_prob)
    roc_data = [
        {
            'fpr': round(float(f), 4),
            'tpr': round(float(t), 4),
            'threshold': None if np.isinf(th) else round(float(th), 4)
        }
        for f, t, th in zip(fpr, tpr, thresholds)
    ]

    return {
        'metrics': {
            'sensitivity_recall': round(float(sensitivity), 4),
            'specificity': round(float(specificity), 4),
            'precision': round(float(precision), 4),
            'f1_score': round(float(f1), 4),
            'accuracy': round(float(accuracy), 4),
            'roc_auc': round(float(auc), 4)
        },
        'confusion_matrix': {
            'true_negatives': int(tn),
            'false_positives': int(fp),
            'false_negatives': int(fn),
            'true_positives': int(tp),
            'matrix_2x2': [[int(tn), int(fp)], [int(fn), int(tp)]]
        },
        'classification_report': formatted_report,
        'roc_curve': roc_data
    }


def train_and_evaluate_model(
    raw_csv_path: Path,
    models_dir: Path,
    max_depth: int = 3,
    criterion: str = 'gini',
    random_state: int = 42
) -> Dict[str, Any]:
    """
    Ejecuta el ciclo integral: preprocesamiento, ajuste del clasificador podado
    con compensacion de desbalance, evaluacion clinica y guardado de artefactos.
    """
    models_dir.mkdir(parents=True, exist_ok=True)

    # 1. Preprocesamiento e imputacion
    x_train, x_test, y_train, y_test, _ = preprocess_dataset(
        raw_csv_path=raw_csv_path,
        output_dir=models_dir,
        test_size=0.25,
        random_state=random_state
    )

    # 2. Entrenamiento del modelo propuesto (balanceado) y linea base (sin ponderar)
    clf = DecisionTreeClassifier(
        criterion=criterion,
        max_depth=max_depth,
        class_weight='balanced',
        random_state=random_state
    )
    clf.fit(x_train, y_train)

    clf_base = DecisionTreeClassifier(
        criterion=criterion,
        max_depth=max_depth,
        class_weight=None,
        random_state=random_state
    )
    clf_base.fit(x_train, y_train)

    # 3. Evaluacion en prueba (modelo balanceado y linea base) y validacion cruzada k=3
    balanced_eval = _evaluate_holdout(clf, x_test, y_test)
    baseline_eval = _evaluate_holdout(clf_base, x_test, y_test)

    cv_summary = evaluate_cross_validation(
        raw_csv_path=raw_csv_path,
        max_depth=max_depth,
        criterion=criterion,
        n_splits=3,
        random_state=random_state
    )

    # Importancia de caracteristicas
    feature_importances = [
        {
            'feature': name,
            'label': FEATURE_METADATA.get(name, {}).get('label', name),
            'importance': round(float(imp), 4)
        }
        for name, imp in sorted(
            zip(FEATURE_NAMES, clf.feature_importances_),
            key=lambda item: item[1],
            reverse=True
        )
    ]

    # 4. Serializacion del arbol y reglas (con conteos reales train/test por hoja)
    tree_dict = extract_tree_dict(clf, FEATURE_NAMES)
    clinical_rules = extract_clinical_rules(clf, FEATURE_NAMES, x_train, y_train, x_test, y_test)

    metrics_summary = {
        'model_name': 'DecisionTreeClassifier (Podado)',
        'max_depth': max_depth,
        'criterion': criterion,
        'class_weight': 'balanced',
        'metrics': balanced_eval['metrics'],
        'confusion_matrix': balanced_eval['confusion_matrix'],
        'test_set_size': int(len(y_test)),
        'positive_support': int(np.sum(y_test == 1)),
        'negative_support': int(np.sum(y_test == 0)),
        'classification_report': balanced_eval['classification_report'],
        'baseline_holdout': {
            'metrics': baseline_eval['metrics'],
            'confusion_matrix': baseline_eval['confusion_matrix'],
            'classification_report': baseline_eval['classification_report']
        },
        'cross_validation': cv_summary,
        'feature_importances': feature_importances,
        'roc_curve': balanced_eval['roc_curve']
    }

    # Guardado de artefactos en disco
    joblib.dump(clf, models_dir / "decision_tree.joblib")

    with open(models_dir / "metrics_summary.json", "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2, ensure_ascii=False)

    with open(models_dir / "tree_structure.json", "w", encoding="utf-8") as f:
        json.dump(tree_dict, f, indent=2, ensure_ascii=False)

    with open(models_dir / "clinical_rules.json", "w", encoding="utf-8") as f:
        json.dump(clinical_rules, f, indent=2, ensure_ascii=False)

    return metrics_summary


if __name__ == '__main__':
    raw = Path('implementacion/data/raw/pima_indians_diabetes.csv')
    out = Path('implementacion/models')
    summary = train_and_evaluate_model(raw, out)
    print("Modelo entrenado con exito. Metricas principales:")
    print(json.dumps(summary['metrics'], indent=2))
