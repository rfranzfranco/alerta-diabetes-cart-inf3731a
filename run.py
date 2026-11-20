"""
Punto de entrada unificado para el Sistema de Alerta Temprana de Diabetes Mellitus.
INF-3731A - Inteligencia Artificial.

Modos de uso:
    python proyecto_py_diabetes/run.py             (Inicia el consultorio virtual web)
    python proyecto_py_diabetes/run.py --train     (Reentrena el modelo podado y regenera reglas)
    python proyecto_py_diabetes/run.py --test      (Ejecuta las pruebas automatizadas)
"""

import argparse
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent

for p in [str(PROJECT_ROOT), str(BASE_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from server.api_server import run_server
from server.model_trainer import train_and_evaluate_model


def main():
    parser = argparse.ArgumentParser(
        description="Sistema de Alerta Temprana de Diabetes Mellitus (INF-3731A)"
    )
    parser.add_argument(
        '--train',
        action='store_true',
        help='Ejecuta el preprocesamiento y entrenamiento del árbol CART'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Ejecuta la suite de pruebas automatizadas'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=8000,
        help='Puerto TCP para el servidor web (por defecto: 8000)'
    )
    parser.add_argument(
        '--host',
        type=str,
        default='0.0.0.0',
        help='Dirección de enlace (por defecto: 0.0.0.0)'
    )

    args = parser.parse_args()

    raw_path = BASE_DIR / "data" / "raw" / "pima_indians_diabetes.csv"
    models_dir = BASE_DIR / "models"

    if args.train:
        print("[*] Iniciando preprocesamiento y reentrenamiento del modelo...")
        summary = train_and_evaluate_model(raw_path, models_dir)
        cv_bal = summary['cross_validation']['variants']['balanced']
        print("[OK] Modelo entrenado exitosamente.")
        print(f"     Exactitud (Accuracy):  {summary['metrics']['accuracy']*100:.2f}%")
        print(f"     F1-Score:              {summary['metrics']['f1_score']*100:.2f}%")
        print(f"     Sensibilidad (Recall): {summary['metrics']['sensitivity_recall']*100:.2f}%")
        print(f"     Especificidad:         {summary['metrics']['specificity']*100:.2f}%")
        print(f"     Precisión:             {summary['metrics']['precision']*100:.2f}%")
        print(f"     ROC AUC:               {summary['metrics']['roc_auc']:.4f}")
        print(
            f"     CV (k=3) -> Acc: {cv_bal['accuracy']['mean']*100:.2f}% | "
            f"F1: {cv_bal['f1']['mean']*100:.2f}% | "
            f"Recall: {cv_bal['recall']['mean']*100:.2f}%"
        )
        return

    if args.test:
        print("[*] Ejecutando pruebas automatizadas...")
        import unittest
        suite = unittest.defaultTestLoader.discover(str(BASE_DIR / 'tests'))
        runner = unittest.TextTestRunner(verbosity=2)
        res = runner.run(suite)
        sys.exit(0 if res.wasSuccessful() else 1)

    if not (models_dir / "decision_tree.joblib").exists() or not (models_dir / "imputer.joblib").exists():
        print("[*] Artefactos del modelo no encontrados; ejecutando entrenamiento inicial...")
        train_and_evaluate_model(raw_path, models_dir)

    # Por defecto, iniciar la aplicación web
    print("=" * 70)
    print("  SISTEMA DE ALERTA TEMPRANA DE DIABETES MELLITUS (INF-3731A)")
    print("  Modelo: DecisionTreeClassifier (CART) | Dataset: Pima Indians")
    print("=" * 70)
    run_server(port=args.port, host=args.host)


if __name__ == '__main__':
    main()
