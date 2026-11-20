"""
Modulo de persistencia ligera en SQLite para evaluaciones clinicas de pacientes.
INF-3731A - Inteligencia Artificial.
"""

from contextlib import contextmanager
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "clinical_records.db"

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS patient_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    patient_context TEXT NOT NULL,
    notes TEXT DEFAULT '',
    raw_features_json TEXT NOT NULL,
    imputed_features_json TEXT NOT NULL,
    imputed_fields_json TEXT NOT NULL,
    predicted_class INTEGER NOT NULL,
    risk_level TEXT NOT NULL,
    probability_pct REAL NOT NULL,
    rule_code TEXT NOT NULL,
    leaf_node_id INTEGER NOT NULL,
    dictum TEXT NOT NULL
)
"""

_CREATE_META_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
)
"""

_SEED_RECORDS = [
    {
        "created_at": "2026-11-10T10:15:00+00:00",
        "patient_name": "Paciente Demo 01 (Tamizaje sin diagnóstico previo)",
        "patient_context": "Tamizaje preventivo (sin diagnóstico previo)",
        "notes": "Caso ilustrativo sin exámenes de insulina ni pliegue; se aplica imputación por mediana en consulta básica (Regla R4).",
        "raw_features": {
            "Pregnancies": 2,
            "Glucose": 126,
            "BloodPressure": 76,
            "SkinThickness": 0,
            "Insulin": 0,
            "BMI": 31.2,
            "DiabetesPedigreeFunction": 0.48,
            "Age": 38,
        },
        "imputed_features": {
            "Pregnancies": 2.0,
            "Glucose": 126.0,
            "BloodPressure": 76.0,
            "SkinThickness": 29.0,
            "Insulin": 125.0,
            "BMI": 31.2,
            "DiabetesPedigreeFunction": 0.48,
            "Age": 38.0,
        },
        "imputed_fields": [
            {"feature": "SkinThickness", "label": "Pliegue cutáneo del tríceps", "unit": "mm", "imputed_value": 29.0},
            {"feature": "Insulin", "label": "Insulina sérica", "unit": "µU/mL", "imputed_value": 125.0},
        ],
        "predicted_class": 1,
        "risk_level": "ALTO",
        "probability_pct": 58.8,
        "rule_code": "R4",
        "leaf_node_id": 7,
        "dictum": "Alerta: Alto Riesgo - Requiere Valoración Médica",
    },
    {
        "created_at": "2026-11-10T11:30:00+00:00",
        "patient_name": "Paciente Demo 02 (Diabetes tipo 2 diagnosticada)",
        "patient_context": "Paciente con diagnóstico previo de diabetes",
        "notes": "Control metabólico con hiperglucemia e hiperinsulinemia marcada (Regla R8).",
        "raw_features": {
            "Pregnancies": 4,
            "Glucose": 172,
            "BloodPressure": 86,
            "SkinThickness": 34,
            "Insulin": 165,
            "BMI": 34.8,
            "DiabetesPedigreeFunction": 0.78,
            "Age": 51,
        },
        "imputed_features": {
            "Pregnancies": 4.0,
            "Glucose": 172.0,
            "BloodPressure": 86.0,
            "SkinThickness": 34.0,
            "Insulin": 165.0,
            "BMI": 34.8,
            "DiabetesPedigreeFunction": 0.78,
            "Age": 51.0,
        },
        "imputed_fields": [],
        "predicted_class": 1,
        "risk_level": "ALTO",
        "probability_pct": 91.8,
        "rule_code": "R8",
        "leaf_node_id": 14,
        "dictum": "Alerta: Alto Riesgo - Requiere Valoración Médica",
    },
]


@contextmanager
def _session(db_path: Path) -> Iterator[sqlite3.Connection]:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": int(row["id"]),
        "created_at": row["created_at"],
        "patient_name": row["patient_name"],
        "patient_context": row["patient_context"],
        "notes": row["notes"] or "",
        "raw_features": json.loads(row["raw_features_json"]),
        "imputed_features": json.loads(row["imputed_features_json"]),
        "imputed_fields": json.loads(row["imputed_fields_json"]),
        "predicted_class": int(row["predicted_class"]),
        "risk_level": row["risk_level"],
        "probability_pct": float(row["probability_pct"]),
        "rule_code": row["rule_code"],
        "leaf_node_id": int(row["leaf_node_id"]),
        "dictum": row["dictum"],
    }


def _insert_record(conn: sqlite3.Connection, record: Dict[str, Any]) -> int:
    cursor = conn.execute(
        """
        INSERT INTO patient_evaluations (
            created_at, patient_name, patient_context, notes,
            raw_features_json, imputed_features_json, imputed_fields_json,
            predicted_class, risk_level, probability_pct,
            rule_code, leaf_node_id, dictum
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            record["created_at"],
            record["patient_name"],
            record["patient_context"],
            record.get("notes", ""),
            json.dumps(record["raw_features"], ensure_ascii=False),
            json.dumps(record["imputed_features"], ensure_ascii=False),
            json.dumps(record.get("imputed_fields", []), ensure_ascii=False),
            int(record["predicted_class"]),
            record["risk_level"],
            float(record["probability_pct"]),
            record["rule_code"],
            int(record["leaf_node_id"]),
            record["dictum"],
        ),
    )
    return int(cursor.lastrowid)


def init_db(db_path: Path = DEFAULT_DB_PATH, seed_demo: bool = True) -> None:
    """
    Inicializa el esquema SQLite y carga casos demostrativos una sola vez
    cuando la base de datos es nueva (evita re-siembra al vaciar el historial).
    """
    with _session(db_path) as conn:
        conn.execute(_CREATE_TABLE_SQL)
        conn.execute(_CREATE_META_TABLE_SQL)
        seeded_row = conn.execute(
            "SELECT value FROM app_meta WHERE key = 'demo_seeded'"
        ).fetchone()
        already_seeded = seeded_row is not None and seeded_row["value"] == "1"
        count = conn.execute("SELECT COUNT(*) FROM patient_evaluations").fetchone()[0]

        if seed_demo and not already_seeded and count == 0:
            for item in _SEED_RECORDS:
                _insert_record(conn, item)
            conn.execute(
                "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('demo_seeded', '1')"
            )
        elif count > 0 and not already_seeded:
            conn.execute(
                "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('demo_seeded', '1')"
            )


def save_evaluation(
    payload: Dict[str, Any],
    evaluation_result: Dict[str, Any],
    db_path: Path = DEFAULT_DB_PATH,
) -> Dict[str, Any]:
    """Almacena una evaluación clínica en SQLite y retorna el registro persistido."""
    init_db(db_path, seed_demo=False)
    created_at = datetime.now(timezone.utc).isoformat()
    patient_name = str(payload.get("patient_name") or "Paciente sin identificar").strip()[:160]
    patient_context = str(
        payload.get("patient_context") or "Tamizaje preventivo (sin diagnóstico previo)"
    ).strip()[:200]
    notes = str(payload.get("notes") or "").strip()[:1000]

    record_data = {
        "created_at": created_at,
        "patient_name": patient_name or "Paciente sin identificar",
        "patient_context": patient_context or "Tamizaje preventivo (sin diagnóstico previo)",
        "notes": notes,
        "raw_features": evaluation_result.get("raw_features", payload.get("features", {})),
        "imputed_features": evaluation_result.get("imputed_features", {}),
        "imputed_fields": evaluation_result.get("imputed_fields", []),
        "predicted_class": evaluation_result["predicted_class"],
        "risk_level": evaluation_result["risk_level"],
        "probability_pct": evaluation_result["probability_pct"],
        "rule_code": evaluation_result.get("rule_code", f"N{evaluation_result.get('leaf_node_id', 0)}"),
        "leaf_node_id": evaluation_result["leaf_node_id"],
        "dictum": evaluation_result["dictum"],
    }

    with _session(db_path) as conn:
        new_id = _insert_record(conn, record_data)
        row = conn.execute(
            "SELECT * FROM patient_evaluations WHERE id = ?", (new_id,)
        ).fetchone()
        return _row_to_dict(row)


def list_evaluations(
    limit: int = 100, db_path: Path = DEFAULT_DB_PATH
) -> List[Dict[str, Any]]:
    """Lista las evaluaciones almacenadas ordenadas de la más reciente a la más antigua."""
    init_db(db_path, seed_demo=False)
    with _session(db_path) as conn:
        rows = conn.execute(
            "SELECT * FROM patient_evaluations ORDER BY id DESC LIMIT ?",
            (int(limit),),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]


def delete_evaluation(record_id: int, db_path: Path = DEFAULT_DB_PATH) -> bool:
    """Elimina un registro histórico por su ID primario."""
    init_db(db_path, seed_demo=False)
    with _session(db_path) as conn:
        cursor = conn.execute(
            "DELETE FROM patient_evaluations WHERE id = ?", (int(record_id),)
        )
        return cursor.rowcount > 0
