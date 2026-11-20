"""
Servidor HTTP y API REST ligera para el Sistema de Alerta Temprana de Diabetes Mellitus.
INF-3731A - Inteligencia Artificial.
Sin dependencias pesadas de terceros: utiliza la librería estándar de Python.
"""

import http.server
import json
import socketserver
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Type
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from server.database import (
    DEFAULT_DB_PATH,
    delete_evaluation,
    init_db,
    list_evaluations,
    save_evaluation
)
from server.inference import DiabetesInferenceEngine
from server.preprocessor import FEATURE_METADATA, FEATURE_NAMES

DIST_DIR = BASE_DIR / "dist"
MODELS_DIR = BASE_DIR / "models"
MAX_REQUEST_BODY_BYTES = 64 * 1024  # 64 KB


class PayloadTooLargeError(ValueError):
    """Excepción para cuerpos HTTP que exceden el límite permitido."""


class ReusableThreadingTCPServer(socketserver.ThreadingTCPServer):
    """Servidor TCP multihilo con reutilización inmediata de puerto y hilos demonio."""

    allow_reuse_address = True
    daemon_threads = True


class DiabetesApiHandler(http.server.SimpleHTTPRequestHandler):
    """Manejador HTTP con API REST e interfaz React compilada (dist/), compartiendo el motor de inferencia."""

    shared_engine: Optional[DiabetesInferenceEngine] = None
    shared_models_dir: Path = MODELS_DIR
    shared_static_dir: Path = DIST_DIR
    shared_db_path: Path = DEFAULT_DB_PATH

    def __init__(self, *args, **kwargs):
        if self.__class__.shared_engine is None:
            init_db(self.__class__.shared_db_path, seed_demo=True)
            self.__class__.shared_engine = DiabetesInferenceEngine(self.__class__.shared_models_dir)
        self.engine = self.__class__.shared_engine
        super().__init__(*args, directory=str(self.__class__.shared_static_dir), **kwargs)

    def _send_json(self, status_code: int, data: Any):
        payload = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(payload)

    def _read_json_body(self) -> Dict[str, Any]:
        raw_length = self.headers.get('Content-Length', '0')
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise ValueError('Encabezado Content-Length inválido.') from exc

        if length < 0:
            raise ValueError('Encabezado Content-Length negativo.')
        if length > MAX_REQUEST_BODY_BYTES:
            raise PayloadTooLargeError(
                f'El cuerpo de la petición excede el límite de {MAX_REQUEST_BODY_BYTES // 1024} KB.'
            )

        body = self.rfile.read(length).decode('utf-8') if length > 0 else ''
        if not body:
            return {}

        try:
            parsed = json.loads(body)
        except json.JSONDecodeError as exc:
            raise ValueError('El cuerpo JSON está malformado.') from exc

        if not isinstance(parsed, dict):
            raise ValueError('Se esperaba un objeto JSON en el cuerpo de la petición.')
        return parsed

    def _serve_model_json(self, filename: str, not_found_msg: str):
        target_file = self.__class__.shared_models_dir / filename
        if target_file.exists():
            with open(target_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._send_json(200, data)
        return self._send_json(404, {'error': not_found_msg})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/api/health':
            dist_ready = (self.__class__.shared_static_dir / 'index.html').exists()
            return self._send_json(200, {
                'status': 'ok',
                'course': 'INF-3731A',
                'model_loaded': self.engine is not None,
                'rules_loaded': len(self.engine.rules_by_leaf) if self.engine else 0,
                'frontend_ready': dist_ready,
            })

        if path == '/api/tree':
            return self._serve_model_json("tree_structure.json", "Árbol no generado.")

        if path == '/api/metrics':
            return self._serve_model_json("metrics_summary.json", "Métricas no generadas.")

        if path == '/api/rules':
            return self._serve_model_json("clinical_rules.json", "Reglas clínicas no generadas.")

        if path == '/api/metadata':
            return self._send_json(200, {
                'features': FEATURE_NAMES,
                'metadata': FEATURE_METADATA
            })

        if path == '/api/history':
            return self._send_json(200, {
                'records': list_evaluations(db_path=self.__class__.shared_db_path)
            })

        if path == '/' or path == '/index.html':
            if not (self.__class__.shared_static_dir / 'index.html').exists():
                return self._send_json(503, {
                    'error': 'Interfaz web no compilada. Ejecute "npm run build" dentro de proyecto_py_diabetes/.'
                })
            self.path = '/index.html'
            return super().do_GET()

        # Servir recursos estáticos compilados (CSS, JS, fuentes, iconos)
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/predict':
            try:
                data = self._read_json_body()
                result = self.engine.evaluate_patient(data)
                return self._send_json(200, result)
            except PayloadTooLargeError as exc:
                return self._send_json(413, {'error': str(exc)})
            except ValueError as exc:
                return self._send_json(400, {'error': str(exc)})
            except Exception:
                return self._send_json(500, {'error': 'Error interno al procesar la inferencia.'})

        if parsed.path == '/api/history':
            try:
                data = self._read_json_body()
                features = data.get('features', data)
                eval_result = self.engine.evaluate_patient(features)
                saved = save_evaluation(
                    data,
                    eval_result,
                    db_path=self.__class__.shared_db_path
                )
                return self._send_json(201, saved)
            except PayloadTooLargeError as exc:
                return self._send_json(413, {'error': str(exc)})
            except ValueError as exc:
                return self._send_json(400, {'error': str(exc)})
            except Exception:
                return self._send_json(500, {'error': 'Error interno al guardar el registro clínico.'})

        self._send_json(404, {'error': 'Ruta de API no encontrada.'})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/history':
            qs = parse_qs(parsed.query)
            raw_id = (qs.get('id') or [None])[0]
            if not raw_id:
                return self._send_json(400, {'error': 'Se requiere el parámetro id.'})
            try:
                rec_id = int(raw_id)
            except ValueError:
                return self._send_json(400, {'error': 'El parámetro id debe ser un entero positivo.'})

            if rec_id <= 0:
                return self._send_json(400, {'error': 'El parámetro id debe ser un entero positivo.'})

            deleted = delete_evaluation(rec_id, db_path=self.__class__.shared_db_path)
            if not deleted:
                return self._send_json(404, {'error': 'Registro no encontrado.'})
            return self._send_json(200, {'deleted': True, 'id': rec_id})

        self._send_json(404, {'error': 'Ruta de API no encontrada.'})


def build_api_handler(
    engine: DiabetesInferenceEngine,
    models_dir: Path = MODELS_DIR,
    static_dir: Path = DIST_DIR,
    db_path: Path = DEFAULT_DB_PATH,
) -> Type[DiabetesApiHandler]:
    """Crea una clase de manejador ligada a una instancia única del motor y rutas explícitas."""

    class ConfiguredDiabetesApiHandler(DiabetesApiHandler):
        shared_engine = engine
        shared_models_dir = models_dir
        shared_static_dir = static_dir
        shared_db_path = db_path

    return ConfiguredDiabetesApiHandler


def create_server(
    port: int = 8000,
    host: str = "0.0.0.0",
    models_dir: Path = MODELS_DIR,
    static_dir: Path = DIST_DIR,
    db_path: Path = DEFAULT_DB_PATH,
    seed_demo: bool = True,
) -> ReusableThreadingTCPServer:
    """Inicializa BD y motor una sola vez y retorna el servidor HTTP listo para atender."""
    init_db(db_path=db_path, seed_demo=seed_demo)
    engine = DiabetesInferenceEngine(models_dir)
    handler_cls = build_api_handler(
        engine=engine,
        models_dir=models_dir,
        static_dir=static_dir,
        db_path=db_path,
    )
    return ReusableThreadingTCPServer((host, port), handler_cls)


def run_server(port: int = 8000, host: str = "0.0.0.0"):
    """Inicia el servidor HTTP de forma robusta con motor de inferencia compartido."""
    with create_server(port=port, host=host) as httpd:
        print("Servidor del Consultorio Virtual iniciado (INF-3731A):")
        print(f"  URL Local:   http://localhost:{port}")
        print(f"  URL de Red:  http://127.0.0.1:{port}")
        print(f"  Salud API:   http://localhost:{port}/api/health")
        print("Presione Ctrl+C para finalizar el servicio.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDeteniendo el servidor.")


if __name__ == '__main__':
    run_server()
