"""
Módulo de preprocesamiento e imputación clínica para el dataset Pima Indians Diabetes.
INF-3731A - Inteligencia Artificial.
"""

from pathlib import Path
from typing import Dict, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split

FEATURE_NAMES = [
    'Pregnancies',
    'Glucose',
    'BloodPressure',
    'SkinThickness',
    'Insulin',
    'BMI',
    'DiabetesPedigreeFunction',
    'Age'
]

TARGET_NAME = 'Outcome'

BIOLOGICAL_ZERO_COLS = [
    'Glucose',
    'BloodPressure',
    'SkinThickness',
    'Insulin',
    'BMI'
]

FEATURE_METADATA: Dict[str, Dict] = {
    'Pregnancies': {
        'label': 'Embarazos',
        'unit': 'concepciones',
        'min': 0,
        'max': 17,
        'default': 2,
        'step': 1,
        'description': 'Número de embarazos concluidos o en curso.'
    },
    'Glucose': {
        'label': 'Glucosa plasmática',
        'unit': 'mg/dL',
        'min': 44,
        'max': 200,
        'default': 115,
        'step': 1,
        'description': 'Concentración de glucosa plasmática a 2 horas en prueba oral (OGTT).'
    },
    'BloodPressure': {
        'label': 'Presión arterial diastólica',
        'unit': 'mm Hg',
        'min': 40,
        'max': 130,
        'default': 72,
        'step': 1,
        'description': 'Presión sanguínea diastólica en reposo.'
    },
    'SkinThickness': {
        'label': 'Pliegue cutáneo del tríceps',
        'unit': 'mm',
        'min': 7,
        'max': 99,
        'default': 25,
        'step': 1,
        'description': 'Grosor del pliegue cutáneo tricipital medido con calibrador.'
    },
    'Insulin': {
        'label': 'Insulina sérica',
        'unit': 'µU/mL',
        'min': 14,
        'max': 846,
        'default': 85,
        'step': 1,
        'description': 'Insulina sérica evaluada a dos horas post-carga.'
    },
    'BMI': {
        'label': 'Índice de masa corporal (IMC)',
        'unit': 'kg/m²',
        'min': 15.0,
        'max': 67.0,
        'default': 28.5,
        'step': 0.1,
        'description': 'Relación entre peso y estatura al cuadrado.'
    },
    'DiabetesPedigreeFunction': {
        'label': 'Pedigree genético familiar',
        'unit': 'índice',
        'min': 0.05,
        'max': 2.50,
        'default': 0.45,
        'step': 0.01,
        'description': 'Ponderación genética de antecedentes familiares de diabetes.'
    },
    'Age': {
        'label': 'Edad del paciente',
        'unit': 'años',
        'min': 21,
        'max': 85,
        'default': 35,
        'step': 1,
        'description': 'Edad cronológica cumplida.'
    }
}


def load_raw_data(data_path: Path) -> pd.DataFrame:
    """Carga el dataset Pima en formato CSV."""
    if not data_path.exists():
        raise FileNotFoundError(f"No se encontro el archivo de datos en: {data_path}")
    return pd.read_csv(data_path)


def preprocess_dataset(
    raw_csv_path: Path,
    output_dir: Path,
    test_size: float = 0.25,
    random_state: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, SimpleImputer]:
    """
    Reemplaza ceros fisiologicos por NaN, efectua la particion estratificada
    y ajusta el imputador por mediana sobre el conjunto de entrenamiento
    sin permitir fuga de datos (data leakage).
    """
    df = load_raw_data(raw_csv_path)

    # Identificacion de ceros que representan datos no medidos
    df_clean = df.copy()
    for col in BIOLOGICAL_ZERO_COLS:
        df_clean[col] = df_clean[col].replace(0, np.nan)

    x = df_clean[FEATURE_NAMES]
    y = df_clean[TARGET_NAME]

    # Particion estratificada para preservar la prevalencia epidemiologica
    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=test_size,
        random_state=random_state,
        stratify=y
    )

    # Imputacion por mediana estimada exclusivamente sobre el conjunto de entrenamiento
    imputer = SimpleImputer(strategy='median')
    x_train_imp = pd.DataFrame(
        imputer.fit_transform(x_train),
        columns=FEATURE_NAMES,
        index=x_train.index
    )
    x_test_imp = pd.DataFrame(
        imputer.transform(x_test),
        columns=FEATURE_NAMES,
        index=x_test.index
    )

    # Persistencia de datasets procesados y artefacto de imputacion
    output_dir.mkdir(parents=True, exist_ok=True)
    processed_dir = output_dir.parent / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    train_export = x_train_imp.copy()
    train_export[TARGET_NAME] = y_train
    train_export.to_csv(processed_dir / "train_processed.csv", index=False)

    test_export = x_test_imp.copy()
    test_export[TARGET_NAME] = y_test
    test_export.to_csv(processed_dir / "test_processed.csv", index=False)

    # Guardar imputador ajustado
    imputer_file = output_dir / "imputer.joblib"
    joblib.dump(imputer, imputer_file)

    return x_train_imp, x_test_imp, y_train, y_test, imputer
