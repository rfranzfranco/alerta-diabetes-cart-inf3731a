"""
Aplicacion complementaria en Streamlit para el Sistema de Alerta Temprana de Diabetes Mellitus.
INF-3731A - Inteligencia Artificial.
Permite ejecutar 'streamlit run streamlit_app.py' desde proyecto_py_diabetes.
"""

import json
import sys
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

try:
    import streamlit as st
except ImportError:
    print("Streamlit no esta instalado en este entorno. Use el servidor web principal con 'python run.py'")
    raise SystemExit(0)

from server.inference import DiabetesInferenceEngine
from server.preprocessor import FEATURE_METADATA, FEATURE_NAMES

MODELS_DIR = BASE_DIR / "models"

st.set_page_config(
    page_title="Alerta Temprana Diabetes - INF-3731A",
    page_icon="🩺",
    layout="wide"
)


@st.cache_resource
def get_engine():
    return DiabetesInferenceEngine(MODELS_DIR)


engine = get_engine()

st.title("🩺 Sistema de Alerta Temprana de Diabetes Mellitus")
st.caption("Clasificacion de Riesgo mediante Arboles de Decision CART | Dataset Pima Indians (INF-3731A)")

st.sidebar.header("Parametros del Paciente")
st.sidebar.subheader("Presets Clinicos")
preset_choice = st.sidebar.radio(
    "Cargar caso tipico:",
    [
        "1. Asintomatica (Regla R1)",
        "2. Sin Diagnostico / Frontera (Regla R4)",
        "3. Intolerancia + Obesidad (Regla R6)",
        "4. Hiperglucemia Franca (Regla R8)"
    ]
)

default_values = {
    'Pregnancies': 2,
    'Glucose': 115,
    'BloodPressure': 72,
    'SkinThickness': 25,
    'Insulin': 85,
    'BMI': 28.5,
    'DiabetesPedigreeFunction': 0.45,
    'Age': 35
}

if preset_choice.startswith("1."):
    default_values.update({'Pregnancies': 1, 'Glucose': 85, 'BloodPressure': 66, 'SkinThickness': 23, 'Insulin': 70, 'BMI': 22.5, 'DiabetesPedigreeFunction': 0.25, 'Age': 23})
elif preset_choice.startswith("2."):
    default_values.update({'Pregnancies': 2, 'Glucose': 124, 'BloodPressure': 76, 'SkinThickness': 0, 'Insulin': 0, 'BMI': 29.8, 'DiabetesPedigreeFunction': 0.48, 'Age': 36})
elif preset_choice.startswith("3."):
    default_values.update({'Pregnancies': 3, 'Glucose': 142, 'BloodPressure': 82, 'SkinThickness': 30, 'Insulin': 110, 'BMI': 31.5, 'DiabetesPedigreeFunction': 0.62, 'Age': 41})
elif preset_choice.startswith("4."):
    default_values.update({'Pregnancies': 5, 'Glucose': 168, 'BloodPressure': 88, 'SkinThickness': 36, 'Insulin': 175, 'BMI': 35.4, 'DiabetesPedigreeFunction': 0.85, 'Age': 52})

patient_inputs = {}
st.sidebar.markdown("---")
st.sidebar.subheader("Bioquimica y Metabolismo (0 = No medido)")
for feat in ['Glucose', 'Insulin', 'SkinThickness']:
    meta = FEATURE_METADATA[feat]
    val = default_values[feat]
    min_v = 0 if feat in ('Insulin', 'SkinThickness') else meta['min']
    if isinstance(val, float):
        patient_inputs[feat] = st.sidebar.slider(
            f"{meta['label']} ({meta['unit']})",
            float(min_v), float(meta['max']), float(val), float(meta['step'])
        )
    else:
        patient_inputs[feat] = st.sidebar.slider(
            f"{meta['label']} ({meta['unit']})",
            int(min_v), int(meta['max']), int(val), int(meta['step'])
        )

st.sidebar.subheader("Biometria y Antecedentes")
for feat in ['BMI', 'Age', 'BloodPressure', 'Pregnancies', 'DiabetesPedigreeFunction']:
    meta = FEATURE_METADATA[feat]
    val = default_values[feat]
    if isinstance(val, float):
        patient_inputs[feat] = st.sidebar.slider(
            f"{meta['label']} ({meta['unit']})",
            float(meta['min']), float(meta['max']), float(val), float(meta['step'])
        )
    else:
        patient_inputs[feat] = st.sidebar.slider(
            f"{meta['label']} ({meta['unit']})",
            int(meta['min']), int(meta['max']), int(val), int(meta['step'])
        )

result = engine.evaluate_patient(patient_inputs)

tab1, tab2, tab3 = st.tabs([
    "Consultorio y Dictamen",
    "Reglas Clinicas Legibles (R1-R8)",
    "Metricas Comparadas (INF-3731A)"
])

with tab1:
    col1, col2 = st.columns([1, 1])

    with col1:
        st.subheader(f"Dictamen Clinico ({result['rule_code']})")
        if result['predicted_class'] == 1:
            st.error(f"🚨 **{result['dictum']}**")
        else:
            st.success(f"✅ **{result['dictum']}**")

        st.metric(
            label="Probabilidad Estimada P(DM2)",
            value=f"{result['probability_pct']}%",
            delta=f"Regla {result['rule_code']} | Hoja #{result['leaf_node_id']}"
        )
        st.progress(min(result['probability_pct'] / 100.0, 1.0))

        if result.get('imputed_fields'):
            imp_txt = ", ".join(
                f"{f['label']} = {f['imputed_value']} {f['unit']}"
                for f in result['imputed_fields']
            )
            st.warning(f"Imputacion aplicada para valores no medidos: {imp_txt}")

        st.markdown(f"### {result['clinical_recommendation']['title']}")
        st.info(result['clinical_recommendation']['clinical_message'])

    with col2:
        st.subheader("Ruta Deductiva del Paciente")
        for idx, step in enumerate(result['decision_path']):
            st.markdown(f"**Paso {idx + 1}:** `{step['condition_evaluated']}`")

with tab2:
    st.subheader("Reglas Clinicas Extraidas (R1-R8)")
    rules_path = MODELS_DIR / "clinical_rules.json"
    if rules_path.exists():
        with open(rules_path, "r", encoding="utf-8") as f:
            rules = json.load(f)
        rules_df = pd.DataFrame([
            {
                "Regla": r.get('rule_code', f"R{r['rule_id']}"),
                "Criterio Fisiologico": r['rule_text'].split('-> ENTONCES')[0],
                "Dictamen": r['predicted_label'],
                "P(DM2)": f"{r['prob_diabetic'] * 100:.2f}%",
                "Train (Neg/Pos)": f"{r.get('train_neg', '-')} / {r.get('train_pos', '-')}",
                "Test (Neg/Pos)": f"{r.get('test_neg', '-')} / {r.get('test_pos', '-')}"
            }
            for r in rules
        ])
        st.dataframe(rules_df, use_container_width=True)

with tab3:
    st.subheader("Comparacion de 3 Metricas: Exactitud, F1-Score y Sensibilidad")
    metrics_path = MODELS_DIR / "metrics_summary.json"
    if metrics_path.exists():
        with open(metrics_path, "r", encoding="utf-8") as f:
            m_data = json.load(f)

        m = m_data['metrics']
        base_m = m_data.get('baseline_holdout', {}).get('metrics', {})
        c1, c2, c3, c4 = st.columns(4)
        c1.metric(
            "Sensibilidad (Rectora)",
            f"{m['sensitivity_recall'] * 100:.2f}%",
            delta=f"+{(m['sensitivity_recall'] - base_m.get('sensitivity_recall', 0)) * 100:.2f} pp vs base"
        )
        c2.metric(
            "F1-Score (Equilibrio)",
            f"{m['f1_score'] * 100:.2f}%",
            delta=f"+{(m['f1_score'] - base_m.get('f1_score', 0)) * 100:.2f} pp vs base"
        )
        c3.metric(
            "Exactitud (Accuracy)",
            f"{m['accuracy'] * 100:.2f}%",
            delta=f"+{(m['accuracy'] - base_m.get('accuracy', 0)) * 100:.2f} pp vs base"
        )
        c4.metric("ROC AUC", f"{m['roc_auc']:.4f}")

        cv = m_data.get('cross_validation', {}).get('variants', {})
        if cv:
            st.markdown("### Validacion Cruzada Estratificada (cv = 3, N = 768)")
            cv_df = pd.DataFrame([
                {
                    "Metrica": name,
                    "CART Base": f"{cv['baseline'][k]['mean']*100:.2f}% +/- {cv['baseline'][k]['std']*100:.2f} pp",
                    "CART Balanceado": f"{cv['balanced'][k]['mean']*100:.2f}% +/- {cv['balanced'][k]['std']*100:.2f} pp",
                }
                for k, name in [('accuracy', 'Exactitud'), ('f1', 'F1-Score'), ('recall', 'Sensibilidad')]
            ])
            st.table(cv_df)
