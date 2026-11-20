# Sistema de Alerta Temprana de Diabetes Mellitus (INF-3731A)
## Clasificador CART Interpretable con Arquitectura MVVM, API REST y SQLite

Este proyecto implementa un sistema web interactivo para estratificar el riesgo de diabetes mellitus tipo 2 mediante un árbol de decisión binario (`DecisionTreeClassifier`, algoritmo CART) entrenado sobre el conjunto **Pima Indians Diabetes** (`768` registros, `8` variables fisiológicas), con poda a profundidad `3`, imputación por mediana sin fuga de datos (`SimpleImputer`) y compensación balanceada de clases (`class_weight='balanced'`).

La arquitectura sigue el patrón **MVVM** conectado mediante API REST al backend en Python:
- **Frontend Reactivo (`src/` → `dist/`):** React 18 + Vite + Tailwind CSS + DaisyUI + Lucide Icons, con compilación de producción incluida en `dist/` para ejecución directa con Python sin exigir Node.js al usuario final.
- **Cinco Módulos Integrados:** *Consultorio y Triaje*, *Historial Clínico (BD)*, *Árbol de Decisión* (`SVG 1200 × 560`), *Métricas* y *Reglas Clínicas (`R1–R8`)*.
- **Backend ML y Persistencia (`server/`):** Motor de inferencia compartido en memoria (`DiabetesInferenceEngine`), validación estricta de entradas (rechaza negativos, `NaN`, infinitos y JSON malformado), servidor HTTP multihilo reutilizable (`ReusableThreadingTCPServer`) y base de datos SQLite en modo `WAL` (`patient_evaluations` + `app_meta`).
- **Calidad Verificada:** Suite automatizada de **11 pruebas** (`8` unitarias/regresión + `3` de integración HTTP) ejecutables con `python run.py --test`.

---

### 1. Estructura del Proyecto

```text
proyecto_py_diabetes/
├── data/
│   ├── raw/
│   │   └── pima_indians_diabetes.csv      # Dataset clínico Pima (768 filas, 9 columnas)
│   └── processed/
│       ├── train_processed.csv            # Partición de entrenamiento imputada (75%, n=576)
│       └── test_processed.csv             # Partición de prueba independiente (25%, n=192)
│
├── models/
│   ├── decision_tree.joblib               # Modelo CART podado y balanceado
│   ├── imputer.joblib                     # SimpleImputer (mediana sobre train)
│   ├── tree_structure.json                # Jerarquía del árbol para el grafo SVG
│   ├── clinical_rules.json                # 8 reglas deterministas (R1–R8) con Train/Test
│   └── metrics_summary.json               # Métricas Holdout, CV k=3, matriz y curva ROC
│
├── server/                                # Backend Python (scikit-learn + API REST + SQLite)
│   ├── __init__.py
│   ├── preprocessor.py                    # Imputación clínica sin fuga y partición estratificada
│   ├── model_trainer.py                   # Entrenamiento CART Base vs Balanceado y CV k=3
│   ├── inference.py                       # Inferencia validada, trazado de nodos y conducta clínica
│   ├── database.py                        # Persistencia SQLite en modo WAL (patient_evaluations + app_meta)
│   └── api_server.py                      # API REST (/api/health, /api/predict, /api/history, /api/metrics...)
│
├── src/                                   # Frontend React MVVM
│   ├── models/                            # [M] MODEL
│   │   ├── PatientModel.js                # Metadatos (rangos alineados a Pima) y 4 casos rápidos
│   │   └── apiService.js                  # Cliente HTTP REST con soporte AbortSignal y /api/health
│   ├── viewmodels/                        # [VM] VIEWMODEL
│   │   ├── useTriageViewModel.js          # Estado reactivo, debounce 45 ms + AbortController y SQLite
│   │   ├── useTreeViewModel.js            # Geometría SVG (1200 × 560) y sincronización de nodo activo
│   │   ├── useMetricsViewModel.js         # Métricas comparadas, matriz de confusión, CV k=3 y ROC
│   │   └── useThemeViewModel.js           # Alternancia de tema claro / oscuro
│   └── views/                             # [V] VIEW (Tailwind CSS + DaisyUI)
│       ├── components/
│       │   ├── SidebarNavView.jsx         # Menú lateral, 4 casos rápidos (sin cambiar módulo) y tema
│       │   ├── TriageFormView.jsx         # Controles de 8 variables, calc. IMC, Pedigree y 'No medido'
│       │   ├── DictumCardView.jsx         # Dictamen, regla R1–R8, imputación, SQLite e impresión PDF
│       │   ├── PatientHistoryView.jsx     # Historial SQLite con filtros, recarga y borrado en 2 pasos
│       │   ├── DecisionTreeSvgView.jsx    # Grafo SVG interactivo (hover estable + etiquetas IMC)
│       │   ├── MetricsDashboardView.jsx   # 3 métricas comparadas, Base vs Balanceado, CV k=3 y ROC
│       │   └── ClinicalRulesTableView.jsx # Tabla auditable de reglas R1–R8
│       └── MainLayoutView.jsx             # Disposición principal y alertas de error
│
├── dist/                                  # Compilación estática de producción (incluida para uso directo)
├── tests/
│   └── test_pipeline.py                   # Suite unittest: 11 pruebas (8 unitarias + 3 integración HTTP)
├── streamlit_app.py                       # Interfaz alternativa opcional en Streamlit
├── run.py                                 # CLI unificado: servidor web, --train, --test, --port, --host
├── requirements.txt                       # Dependencias Python
├── package.json                           # Dependencias React / Vite / Tailwind / DaisyUI
├── .gitignore                             # Excluye node_modules, docs/screenshots, __pycache__ y SQLite local
└── README.md
```

---

### 2. Instalación y Ejecución tras Clonar el Repositorio

#### Requisitos
- **Usuario final / Evaluador:** Python `>= 3.10` (no requiere Node.js porque `dist/` viene compilado).
- **Desarrollador frontend (opcional):** Node.js `>= 18 LTS` y `npm` para editar `src/` o recompilar `dist/`.

#### Paso 1: Instalar dependencias de Python
```powershell
git clone <URL_DE_TU_REPOSITORIO>
cd proyecto_py_diabetes
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
*(En Windows, si `python` apunta al alias de Microsoft Store, usa `py` en su lugar).*

#### Paso 2: Iniciar la aplicación web (Modo Producción Recomendado)
```powershell
python run.py --port 8000
```
Abre tu navegador en **`http://localhost:8000`** *(y puedes verificar el estado del backend en `http://localhost:8000/api/health`)*.  
Al iniciar por primera vez, el servidor crea automáticamente `data/clinical_records.db` en modo `WAL` y precarga 2 casos demostrativos.

#### Comandos útiles adicionales
```powershell
# Ejecutar la suite completa de 11 pruebas automatizadas (unitarias + integración HTTP)
python run.py --test

# Reentrenar el modelo CART desde el CSV crudo y regenerar models/ y data/processed/
python run.py --train

# Modo desarrollo frontend con Vite HMR (requiere Node.js; mantener python run.py en otra terminal)
npm install
npm run dev

# Recompilar dist/ tras editar src/
npm run build
```

---

### 3. Endpoints Principales de la API REST (`server/api_server.py`)

| Método y Ruta | Descripción |
| :--- | :--- |
| `GET /` | Sirve la interfaz React compilada desde `dist/` (`503` si falta el build). |
| `GET /api/health` | Estado del servicio, carga del modelo (`8` reglas) y disponibilidad de `dist/`. |
| `GET /api/metadata` | Lista canónica `FEATURE_NAMES` y metadatos `FEATURE_METADATA`. |
| `GET /api/tree` | Topología jerárquica del árbol CART (`models/tree_structure.json`). |
| `GET /api/metrics` | Métricas Holdout (Base vs. Balanceado), CV `k=3`, ROC e importancias. |
| `GET /api/rules` | Las 8 reglas clínicas deterministas (`R1–R8`). |
| `GET /api/history` | Lista hasta 100 registros recientes de SQLite (`data/clinical_records.db`). |
| `POST /api/predict` | Inferencia en tiempo real con validación estricta (`400` inválidos, `413` > 64 KB). |
| `POST /api/history` | Evalúa y persiste la consulta en SQLite (HTTP `201`). |
| `DELETE /api/history?id=<n>` | Elimina un registro por ID entero positivo (`200`, `400` o `404`). |

---

### 4. Métricas del Modelo CART en Prueba (`n = 192`)

| Métrica Clínica | CART Base | CART Balanceado | CV `k = 3` (`N = 768`) |
| :--- | :---: | :---: | :---: |
| **Sensibilidad (*Recall*)** | `46.27%` (`31 VP / 36 FN`) | **`74.63%`** (`50 VP / 17 FN`) | **`81.73% ± 3.62 pp`** |
| **F1-Score** | `52.54%` (`0.5254`) | **`65.36%`** (`0.6536`) | **`65.13% ± 0.90 pp`** |
| **Exactitud (*Accuracy*)** | `70.83%` | **`72.40%`** | `69.40% ± 2.48 pp` |
| **Especificidad** | `84.00%` | **`71.20%`** (`89 VN / 36 FP`) | — |
| **Precisión** | `60.78%` | **`58.14%`** | — |
| **ROC-AUC** | `0.7487` | **`0.7487`** | — |
