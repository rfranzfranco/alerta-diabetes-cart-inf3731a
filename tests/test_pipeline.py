"""
Suite de pruebas automatizadas (unitarias e integración HTTP) para el
Sistema de Alerta Temprana de Diabetes Mellitus.
INF-3731A - Inteligencia Artificial.
"""

import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import pandas as pd
from server.api_server import create_server
from server.database import (
    delete_evaluation,
    init_db,
    list_evaluations,
    save_evaluation
)
from server.inference import DiabetesInferenceEngine
from server.model_trainer import train_and_evaluate_model
from server.preprocessor import (
    BIOLOGICAL_ZERO_COLS,
    FEATURE_NAMES,
)


class TestDiabetesPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base_dir = Path(__file__).resolve().parent.parent
        cls.raw_data = base_dir / "data" / "raw" / "pima_indians_diabetes.csv"
        cls.models_dir = base_dir / "models"
        # Asegurar que los artefactos del modelo estén entrenados
        cls.summary = train_and_evaluate_model(cls.raw_data, cls.models_dir)
        cls.engine = DiabetesInferenceEngine(cls.models_dir)

    def test_raw_dataset_exists_and_valid(self):
        """Verifica que el dataset crudo tenga las 768 filas y 9 columnas requeridas."""
        self.assertTrue(self.raw_data.exists())
        df = pd.read_csv(self.raw_data)
        self.assertEqual(df.shape, (768, 9))
        for col in FEATURE_NAMES + ['Outcome']:
            self.assertIn(col, df.columns)

    def test_no_data_leakage_and_clean_imputation(self):
        """Comprueba que en el dataset procesado no existan ceros en variables biológicas."""
        base_dir = Path(__file__).resolve().parent.parent
        train_proc = base_dir / "data" / "processed" / "train_processed.csv"
        self.assertTrue(train_proc.exists())
        df_train = pd.read_csv(train_proc)
        for col in BIOLOGICAL_ZERO_COLS:
            zeros_count = (df_train[col] == 0).sum()
            self.assertEqual(zeros_count, 0, f"Se encontraron ceros en {col}")

    def test_clinical_sensitivity_threshold(self):
        """Garantiza que la sensibilidad supere 70% en prueba y en validación cruzada k=3."""
        recall = self.summary['metrics']['sensitivity_recall']
        self.assertGreaterEqual(recall, 0.70, f"Sensibilidad insuficiente: {recall}")
        self.assertIn('classification_report', self.summary)
        self.assertIn('cross_validation', self.summary)
        cv_recall = self.summary['cross_validation']['variants']['balanced']['recall']['mean']
        self.assertGreaterEqual(cv_recall, 0.70, f"Sensibilidad CV insuficiente: {cv_recall}")

    def test_documented_metrics_regression(self):
        """Blinda la fidelidad exacta de las métricas y matriz de confusión con Proyecto_IA_final.docx."""
        m = self.summary['metrics']
        cm = self.summary['confusion_matrix']
        self.assertAlmostEqual(m['accuracy'], 0.7240, places=4)
        self.assertAlmostEqual(m['f1_score'], 0.6536, places=4)
        self.assertAlmostEqual(m['sensitivity_recall'], 0.7463, places=4)
        self.assertAlmostEqual(m['specificity'], 0.7120, places=4)
        self.assertAlmostEqual(m['roc_auc'], 0.7487, places=4)
        self.assertEqual(cm['matrix_2x2'], [[89, 36], [17, 50]])

        base_m = self.summary['baseline_holdout']['metrics']
        base_cm = self.summary['baseline_holdout']['confusion_matrix']
        self.assertAlmostEqual(base_m['accuracy'], 0.7083, places=4)
        self.assertAlmostEqual(base_m['f1_score'], 0.5254, places=4)
        self.assertAlmostEqual(base_m['sensitivity_recall'], 0.4627, places=4)
        self.assertEqual(base_cm['matrix_2x2'], [[105, 20], [36, 31]])

    def test_inference_asymptomatic_case(self):
        """Prueba que un caso asintomático joven reciba dictamen de bajo riesgo (R1)."""
        patient = {
            'Pregnancies': 1,
            'Glucose': 85,
            'BloodPressure': 66,
            'SkinThickness': 23,
            'Insulin': 70,
            'BMI': 22.0,
            'DiabetesPedigreeFunction': 0.20,
            'Age': 24
        }
        res = self.engine.evaluate_patient(patient)
        self.assertEqual(res['predicted_class'], 0)
        self.assertEqual(res['risk_level'], 'BAJO')
        self.assertEqual(res['rule_code'], 'R1')
        self.assertLess(res['probability_pct'], 50.0)
        self.assertTrue(len(res['visited_nodes']) >= 2)

    def test_inference_hyperglycemic_case(self):
        """Prueba que un paciente con glucosa > 160 e IMC > 35 reciba dictamen de alto riesgo (R8)."""
        patient = {
            'Pregnancies': 4,
            'Glucose': 175,
            'BloodPressure': 86,
            'SkinThickness': 35,
            'Insulin': 190,
            'BMI': 36.2,
            'DiabetesPedigreeFunction': 0.75,
            'Age': 48
        }
        res = self.engine.evaluate_patient(patient)
        self.assertEqual(res['predicted_class'], 1)
        self.assertEqual(res['risk_level'], 'ALTO')
        self.assertEqual(res['rule_code'], 'R8')
        self.assertGreater(res['probability_pct'], 60.0)
        self.assertIn('Alerta', res['dictum'])

    def test_inference_rejects_invalid_inputs(self):
        """Verifica que el motor rechace valores negativos, NaN, infinitos y tipos inválidos."""
        base = {
            'Pregnancies': 2,
            'Glucose': 120,
            'BloodPressure': 72,
            'SkinThickness': 25,
            'Insulin': 85,
            'BMI': 28.5,
            'DiabetesPedigreeFunction': 0.45,
            'Age': 35
        }
        invalid_cases = [
            {**base, 'Glucose': -10},
            {**base, 'Age': -5},
            {**base, 'Age': 0},
            {**base, 'Pregnancies': -1},
            {**base, 'DiabetesPedigreeFunction': 0},
            {**base, 'BMI': float('nan')},
            {**base, 'Insulin': float('inf')},
            {**base, 'Glucose': 'no-es-numero'},
            {**base, 'Age': True},
            {**base, 'Age': ''},
        ]
        for bad_payload in invalid_cases:
            with self.subTest(payload=bad_payload):
                with self.assertRaises(ValueError):
                    self.engine.evaluate_patient(bad_payload)

    def test_sqlite_database_and_rule_mapping(self):
        """Verifica regla R1-R8, imputación transparente, CRUD en SQLite y ausencia de re-siembra zombi."""
        patient_no_lab = {
            'Pregnancies': 2,
            'Glucose': 124,
            'BloodPressure': 76,
            'SkinThickness': 0,
            'Insulin': 0,
            'BMI': 29.8,
            'DiabetesPedigreeFunction': 0.48,
            'Age': 36
        }
        res = self.engine.evaluate_patient(patient_no_lab)
        self.assertEqual(res['rule_code'], 'R4')
        self.assertEqual(res['leaf_node_id'], 7)
        imputed_names = {item['feature'] for item in res['imputed_fields']}
        self.assertEqual(imputed_names, {'SkinThickness', 'Insulin'})

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_db = Path(tmpdir) / "test_clinical.db"
            init_db(tmp_db, seed_demo=True)
            initial = list_evaluations(db_path=tmp_db)
            self.assertEqual(len(initial), 2)

            saved = save_evaluation(
                {
                    'patient_name': 'Paciente Prueba SQLite',
                    'patient_context': 'Tamizaje preventivo (sin diagnóstico previo)',
                    'notes': 'Prueba automatizada'
                },
                res,
                db_path=tmp_db
            )
            self.assertEqual(saved['rule_code'], 'R4')
            after_save = list_evaluations(db_path=tmp_db)
            self.assertEqual(len(after_save), 3)
            self.assertTrue(delete_evaluation(saved['id'], db_path=tmp_db))
            self.assertEqual(len(list_evaluations(db_path=tmp_db)), 2)

            # Eliminar todos los registros y comprobar que NO reaparecen los demo
            for rec in list_evaluations(db_path=tmp_db):
                self.assertTrue(delete_evaluation(rec['id'], db_path=tmp_db))
            self.assertEqual(list_evaluations(db_path=tmp_db), [])
            init_db(tmp_db, seed_demo=True)
            self.assertEqual(list_evaluations(db_path=tmp_db), [])


class TestDiabetesHttpApi(unittest.TestCase):
    """Pruebas de integración HTTP sobre el servidor API REST en puerto efímero."""

    @classmethod
    def setUpClass(cls):
        cls.base_dir = Path(__file__).resolve().parent.parent
        cls.models_dir = cls.base_dir / "models"
        cls.dist_dir = cls.base_dir / "dist"
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls.tmp_db = Path(cls._tmpdir.name) / "api_test.db"

        cls.httpd = create_server(
            port=0,
            host="127.0.0.1",
            models_dir=cls.models_dir,
            static_dir=cls.dist_dir,
            db_path=cls.tmp_db,
            seed_demo=True,
        )
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=3)
        cls._tmpdir.cleanup()

    def _request(self, method: str, path: str, body=None, raw_body: bytes = None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        headers = {}
        payload = None
        if raw_body is not None:
            payload = raw_body
            headers["Content-Type"] = "application/json"
        elif body is not None:
            payload = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        conn.request(method, path, body=payload, headers=headers)
        resp = conn.getresponse()
        data = resp.read().decode("utf-8")
        conn.close()
        return resp.status, json.loads(data) if data else {}

    def test_health_and_read_endpoints(self):
        """Comprueba /api/health, /api/metrics, /api/tree, /api/rules y /api/metadata."""
        status, health = self._request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(health["status"], "ok")
        self.assertEqual(health["course"], "INF-3731A")
        self.assertTrue(health["model_loaded"])
        self.assertEqual(health["rules_loaded"], 8)

        for ep in ("/api/metrics", "/api/tree", "/api/rules", "/api/metadata"):
            st, body = self._request("GET", ep)
            self.assertEqual(st, 200, f"Fallo en {ep}")
            self.assertTrue(body)

    def test_predict_valid_and_invalid_payloads(self):
        """Comprueba POST /api/predict con caso válido y rechazo HTTP 400 ante datos inválidos."""
        st_ok, res_ok = self._request("POST", "/api/predict", body={
            "Pregnancies": 2,
            "Glucose": 124,
            "BloodPressure": 76,
            "SkinThickness": 0,
            "Insulin": 0,
            "BMI": 29.8,
            "DiabetesPedigreeFunction": 0.48,
            "Age": 36,
        })
        self.assertEqual(st_ok, 200)
        self.assertEqual(res_ok["rule_code"], "R4")
        self.assertEqual(res_ok["risk_level"], "ALTO")

        st_neg, err_neg = self._request("POST", "/api/predict", body={"Glucose": -50, "Age": 35})
        self.assertEqual(st_neg, 400)
        self.assertIn("error", err_neg)

        st_json, err_json = self._request("POST", "/api/predict", raw_body=b"{malformed")
        self.assertEqual(st_json, 400)
        self.assertIn("error", err_json)

    def test_history_crud_via_http(self):
        """Verifica ciclo completo POST -> GET -> DELETE en /api/history y validación de IDs."""
        st_get1, hist1 = self._request("GET", "/api/history")
        self.assertEqual(st_get1, 200)
        initial_count = len(hist1["records"])
        self.assertEqual(initial_count, 2)

        st_post, created = self._request("POST", "/api/history", body={
            "patient_name": "Paciente Integración HTTP",
            "patient_context": "Tamizaje preventivo (sin diagnóstico previo)",
            "notes": "Prueba de extremo a extremo",
            "features": {
                "Pregnancies": 1,
                "Glucose": 85,
                "BloodPressure": 66,
                "SkinThickness": 23,
                "Insulin": 70,
                "BMI": 22.5,
                "DiabetesPedigreeFunction": 0.25,
                "Age": 23,
            },
        })
        self.assertEqual(st_post, 201)
        self.assertEqual(created["rule_code"], "R1")
        created_id = created["id"]

        st_del, del_body = self._request("DELETE", f"/api/history?id={created_id}")
        self.assertEqual(st_del, 200)
        self.assertTrue(del_body["deleted"])

        st_del_404, _ = self._request("DELETE", f"/api/history?id={created_id}")
        self.assertEqual(st_del_404, 404)

        st_del_400, _ = self._request("DELETE", "/api/history?id=-1")
        self.assertEqual(st_del_400, 400)


if __name__ == '__main__':
    unittest.main()
