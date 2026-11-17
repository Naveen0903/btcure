"""
BEYOND THE CURE: Multi-Tier REST API & Application Server
Serves static dashboard web assets and handles mathematical/clinical REST endpoints
using pure Python standard library (http.server & socketserver).
Zero external dependencies required.
"""

import http.server
import socketserver
import json
import os
import sys
import base64
import mimetypes
import urllib.parse
from datetime import datetime
from typing import Dict, Any, Optional

# Ensure local imports work
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from core.sitrd_engine import SITRDEngine
from core.markov_engine import MarkovEngine
from core.risk_engine import PatientRiskEngine
from core.resource_engine import ResourceOptimizationEngine
from core.care_gap_engine import CareGapEngine
from core.pharmacist_engine import PharmacistEngine
from core.forecast_engine import ForecastEngine
from core.validation_engine import ModelValidationEngine
from core.synthetic_engine import SyntheticCohortEngine

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Load .env file automatically if present
ENV_FILE = os.path.join(BASE_DIR, ".env")
if os.path.isfile(ENV_FILE):
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as ef:
            for line in ef:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass

PORT = int(os.environ.get("PORT", 8000))
DATA_FILE = os.path.join(BASE_DIR, "data", "karnataka_ntep_data.json")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Use /tmp on Vercel serverless runtime since /var/task is read-only
if os.environ.get("VERCEL"):
    EVAL_FILE = "/tmp/evaluation_responses.json"
else:
    EVAL_FILE = os.path.join(BASE_DIR, "data", "evaluation_responses.json")

# Basic Authentication Accounts (Configurable via .env or Vercel Environment Variables)
DEFAULT_USER = (
    os.environ.get("AUTH_USERNAME")
    or os.environ.get("BASIC_AUTH_USER")
    or os.environ.get("DEMO_USER")
    or os.environ.get("APP_USER")
    or "admin"
)
DEFAULT_PASS = (
    os.environ.get("AUTH_PASSWORD")
    or os.environ.get("BASIC_AUTH_PASS")
    or os.environ.get("DEMO_PASS")
    or os.environ.get("APP_PASSWORD")
    or "ntep2026"
)

AUTH_ACCOUNTS = {
    DEFAULT_USER: {
        "password": DEFAULT_PASS,
        "display_name": DEFAULT_USER,
        "role": "State TB Control Board"
    },
    "admin": {
        "password": DEFAULT_PASS,
        "display_name": "State NTEP Administrator",
        "role": "State TB Control Board"
    },
    "dr.manasa": {
        "password": os.environ.get("PI_PASSWORD", "beyond2026"),
        "display_name": "Dr. Mekkanti Manasa Rekha",
        "role": "Principal Investigator (ABIPER / RGUHS)"
    },
    "dto.karnataka": {
        "password": os.environ.get("DTO_PASSWORD", "endtb2030"),
        "display_name": "District TB Officer",
        "role": "Karnataka NTEP Surveillance"
    }
}

# Load baseline empirical data
with open(DATA_FILE, "r") as f:
    EMPIRICAL_DATA = json.load(f)

# Initialize mathematical & clinical engines
sitrd_engine = SITRDEngine()
markov_engine = MarkovEngine()
risk_engine = PatientRiskEngine()
resource_engine = ResourceOptimizationEngine()
care_gap_engine = CareGapEngine(EMPIRICAL_DATA)
pharmacist_engine = PharmacistEngine()
forecast_engine = ForecastEngine(EMPIRICAL_DATA)
validation_engine = ModelValidationEngine()
synthetic_engine = SyntheticCohortEngine()

# In-memory storage for SUS/MARS evaluations
if os.path.exists(EVAL_FILE):
    try:
        with open(EVAL_FILE, "r") as f:
            EVALUATIONS = json.load(f)
    except Exception:
        EVALUATIONS = []
else:
    EVALUATIONS = [
        {
            "id": 1,
            "role": "State TB Officer (DTO)",
            "district": "BBMP",
            "sus_score": 87.5,
            "mars_score": 4.6,
            "feedback": "Outstanding visibility on unnotified reservoir and district prioritization.",
            "created_at": "2026-11-10T14:30:00"
        },
        {
            "id": 2,
            "role": "Senior Medical Officer / DOTS-Plus",
            "district": "Belagavi",
            "sus_score": 85.0,
            "mars_score": 4.5,
            "feedback": "SHAP waterfall and clinical bundles provide clear actionable next steps at patient intake.",
            "created_at": "2026-11-11T09:15:00"
        }
    ]

class BeyondTheCureHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(BASE_DIR, "static"), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def _set_headers(self, status: int = 200, content_type: str = "application/json", extra_headers: Optional[Dict[str, str]] = None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()

    def _verify_basic_auth(self, username: Optional[str] = None, password: Optional[str] = None) -> Optional[Dict[str, str]]:
        """
        Verifies Basic Authentication from either explicit username/password or
        the HTTP 'Authorization: Basic <base64>' header.
        """
        if username is not None and password is not None:
            acct = AUTH_ACCOUNTS.get(username)
            if acct and acct["password"] == password:
                token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
                return {
                    "username": username,
                    "display_name": acct["display_name"],
                    "role": acct["role"],
                    "token": token
                }
            return None

        auth_header = self.headers.get("Authorization", "")
        if auth_header.startswith("Basic "):
            b64_part = auth_header[6:].strip()
            try:
                decoded = base64.b64decode(b64_part).decode("utf-8")
                if ":" in decoded:
                    u, p = decoded.split(":", 1)
                    acct = AUTH_ACCOUNTS.get(u)
                    if acct and acct["password"] == p:
                        return {
                            "username": u,
                            "display_name": acct["display_name"],
                            "role": acct["role"],
                            "token": b64_part
                        }
            except Exception:
                return None
        return None

    def do_OPTIONS(self):
        self._set_headers(200, "text/plain")

    def _read_json_body(self) -> Dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            return {}
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            return {}

    def do_GET(self):
        url_parsed = urllib.parse.urlparse(self.path)
        path = url_parsed.path

        # REST API Routes
        if path == "/api/health":
            self._set_headers()
            self.wfile.write(json.dumps({
                "status": "online",
                "system": "BEYOND THE CURE Karnataka Surveillance & Decision Engine",
                "cohort_size": 372863,
                "timestamp": datetime.now().isoformat()
            }).encode("utf-8"))
            return

        elif path == "/api/auth/verify":
            user_info = self._verify_basic_auth()
            if user_info:
                self._set_headers(200)
                self.wfile.write(json.dumps({
                    "authenticated": True,
                    "user": user_info
                }).encode("utf-8"))
            else:
                self._set_headers(401)
                self.wfile.write(json.dumps({
                    "authenticated": False,
                    "error": "Invalid or missing Basic Authentication credentials"
                }).encode("utf-8"))
            return

        elif path == "/api/summary":
            self._set_headers()
            self.wfile.write(json.dumps(EMPIRICAL_DATA).encode("utf-8"))
            return

        elif path == "/api/districts":
            self._set_headers()
            self.wfile.write(json.dumps(EMPIRICAL_DATA.get("districts", [])).encode("utf-8"))
            return

        elif path == "/api/care-gaps":
            self._set_headers()
            plateau = care_gap_engine.analyze_mortality_plateau()
            reservoir = care_gap_engine.estimate_unnotified_reservoir()
            cascade = care_gap_engine.get_care_cascade_funnel()
            barriers = care_gap_engine.analyze_pretreatment_barriers()
            anomalies = care_gap_engine.detect_program_anomalies()
            self.wfile.write(json.dumps({
                "mortality_plateau": plateau,
                "unnotified_reservoir": reservoir,
                "care_cascade": cascade,
                "pretreatment_barriers": barriers,
                "program_anomalies": anomalies
            }).encode("utf-8"))
            return

        elif path == "/api/care-gaps/anomalies":
            self._set_headers()
            self.wfile.write(json.dumps(care_gap_engine.detect_program_anomalies()).encode("utf-8"))
            return

        elif path == "/api/care-cascade":
            self._set_headers()
            self.wfile.write(json.dumps(care_gap_engine.get_care_cascade_funnel()).encode("utf-8"))
            return

        elif path == "/api/forecast":
            qs = urllib.parse.parse_qs(url_parsed.query)
            ind = qs.get("indicator", ["relapses"])[0]
            self._set_headers()
            self.wfile.write(json.dumps({
                "forecast": forecast_engine.forecast_indicator(ind),
                "correlations": forecast_engine.get_correlation_matrix()
            }).encode("utf-8"))
            return

        elif path == "/api/validation/models":
            qs = urllib.parse.parse_qs(url_parsed.query)
            mod_id = qs.get("model", ["catboost_calibrated"])[0]
            self._set_headers()
            self.wfile.write(json.dumps({
                "validation": validation_engine.get_validation_report(mod_id),
                "partial_cohort_2025": validation_engine.bound_2025_partial_cohort(90.66)
            }).encode("utf-8"))
            return

        elif path == "/api/evaluation/stats":
            self._set_headers()
            avg_sus = sum(e["sus_score"] for e in EVALUATIONS) / max(1, len(EVALUATIONS))
            avg_mars = sum(e["mars_score"] for e in EVALUATIONS) / max(1, len(EVALUATIONS))
            self.wfile.write(json.dumps({
                "total_responses": len(EVALUATIONS),
                "average_sus_score": round(avg_sus, 1),
                "target_sus": 80.0,
                "sus_compliance": avg_sus >= 80.0,
                "average_mars_score": round(avg_mars, 2),
                "recent_evaluations": EVALUATIONS[-10:]
            }).encode("utf-8"))
            return

        elif path.startswith("/data/"):
            # Serve data file directly
            if path == "/data/karnataka_ntep_data.json":
                self._set_headers(200, "application/json")
                with open(DATA_FILE, "rb") as f:
                    self.wfile.write(f.read())
                return

        # Serve static files explicitly (compatible with both Vercel Serverless & local HTTPServer)
        rel_path = "index.html" if path in ["/", ""] else path.lstrip("/")
        safe_path = os.path.normpath(os.path.join(STATIC_DIR, rel_path))
        if safe_path.startswith(STATIC_DIR) and os.path.isfile(safe_path):
            mime_type, _ = mimetypes.guess_type(safe_path)
            self._set_headers(200, mime_type or "application/octet-stream")
            with open(safe_path, "rb") as f:
                self.wfile.write(f.read())
            return

        # Fallback to standard static file server
        super().do_GET()

    def do_POST(self):
        url_parsed = urllib.parse.urlparse(self.path)
        path = url_parsed.path
        body = self._read_json_body()

        if path == "/api/auth/login":
            u = body.get("username")
            p = body.get("password")
            user_info = self._verify_basic_auth(u, p) if (u is not None and p is not None) else self._verify_basic_auth()
            if user_info:
                self._set_headers(200)
                self.wfile.write(json.dumps({
                    "authenticated": True,
                    "user": user_info
                }).encode("utf-8"))
            else:
                self._set_headers(401)
                self.wfile.write(json.dumps({
                    "authenticated": False,
                    "error": "Invalid username or password"
                }).encode("utf-8"))
            return

        elif path == "/api/simulate/sitrd":
            params = body.get("params", {})
            years = float(body.get("years", 6.0))
            dt = float(body.get("dt", 0.02))
            res = sitrd_engine.simulate_sitrd(params, years=years, dt=dt)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/simulate/markov":
            matrix = body.get("transition_matrix", None)
            cohort = body.get("initial_distribution", None)
            cycles = int(body.get("cycles", 10))
            res = markov_engine.project_trajectory(cohort, matrix, cycles=cycles)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/predict/patient-risk":
            patient = body.get("patient", body)
            res = risk_engine.predict_patient_risk(patient)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/predict/counterfactuals":
            patient = body.get("patient", body)
            res = risk_engine.generate_counterfactuals(patient)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/predict/survival-hazard":
            patient = body.get("patient", body)
            res = risk_engine.predict_survival_hazard(patient)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/validation/bound-2025":
            assumed_tsr = float(body.get("assumed_pending_tsr_pct", 90.66))
            res = validation_engine.bound_2025_partial_cohort(assumed_tsr)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/synthetic/generate":
            n = int(body.get("sample_size", 50))
            seed = int(body.get("seed_offset", 100))
            res = synthetic_engine.generate_synthetic_cohort(n, seed)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/pharmacist/evaluate":
            patient = body.get("patient", body)
            res = pharmacist_engine.get_pharmacist_summary(patient)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/care-gaps/predict-dropoff":
            profile = body.get("profile", body)
            res = care_gap_engine.predict_pretreatment_dropoff_risk(profile)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/triage/batch":
            cohort = body.get("cohort", [])
            results = []
            for idx, pt in enumerate(cohort):
                pred = risk_engine.predict_patient_risk(pt)
                results.append({
                    "id": pt.get("id", f"PT-{1001 + idx}"),
                    "name": pt.get("name", f"Patient {idx + 1}"),
                    "age": pt.get("age", 45),
                    "district": pt.get("district", "Karnataka"),
                    "risk_tier": pred["risk_tier"],
                    "action_code": pred["action_code"],
                    "mortality_pct": pred["probabilities"]["mortality_death"],
                    "ltfu_pct": pred["probabilities"]["loss_to_follow_up"],
                    "success_pct": pred["probabilities"]["treatment_success"],
                    "care_bundles_count": len(pred["care_bundles"])
                })
            # Sort by mortality descending
            results.sort(key=lambda x: x["mortality_pct"], reverse=True)
            self._set_headers()
            self.wfile.write(json.dumps({
                "total_triaged": len(results),
                "critical_count": sum(1 for r in results if r["risk_tier"] == "Critical"),
                "high_count": sum(1 for r in results if r["risk_tier"] == "High"),
                "triage_list": results
            }).encode("utf-8"))
            return

        elif path == "/api/optimize/resources":
            allocations = body.get("allocations", {})
            res = resource_engine.evaluate_scenario(allocations)
            self._set_headers()
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        elif path == "/api/evaluation/submit":
            role = body.get("role", "Healthcare Professional")
            district = body.get("district", "Karnataka State")
            sus_score = float(body.get("sus_score", 85.0))
            mars_score = float(body.get("mars_score", 4.5))
            feedback = body.get("feedback", "")

            entry = {
                "id": len(EVALUATIONS) + 1,
                "role": role,
                "district": district,
                "sus_score": round(sus_score, 1),
                "mars_score": round(mars_score, 2),
                "feedback": feedback,
                "created_at": datetime.now().isoformat()
            }
            EVALUATIONS.append(entry)
            try:
                with open(EVAL_FILE, "w") as f:
                    json.dump(EVALUATIONS, f, indent=2)
            except Exception as e:
                print(f"Warning: could not write evaluations file: {e}")

            self._set_headers()
            self.wfile.write(json.dumps({
                "status": "success",
                "message": "Evaluation recorded successfully",
                "entry": entry
            }).encode("utf-8"))
            return

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": f"Endpoint {path} not found"}).encode("utf-8"))

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def run_server(port=PORT):
    server = ThreadedHTTPServer(("0.0.0.0", port), BeyondTheCureHandler)
    print(f"===========================================================")
    print(f" BEYOND THE CURE PLATFORM SERVER ONLINE")
    print(f" Cohort: N = 3,72,863 (Karnataka Surveillance 2021-2025)")
    print(f" Serving at: http://localhost:{port}")
    print(f"===========================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.server_close()

if __name__ == "__main__":
    p = PORT
    if len(sys.argv) > 1:
        try:
            p = int(sys.argv[1])
        except ValueError:
            pass
    run_server(p)

