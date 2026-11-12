"""
In-Memory Handler Verification Test
Tests BeyondTheCureHandler logic directly without requiring network/TCP loopback sockets.
Runs 100% within the standard secure sandbox.
"""

import io
import json
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import server

class MockSocket:
    def __init__(self, request_bytes):
        self._rfile = io.BytesIO(request_bytes)
        self._wfile = io.BytesIO()

    def makefile(self, mode, *args, **kwargs):
        if "r" in mode:
            return self._rfile
        elif "w" in mode:
            return self._wfile
        return self._rfile

    def sendall(self, b):
        self._wfile.write(b)

    def send(self, b):
        self._wfile.write(b)
        return len(b)

    def get_response(self):
        return self._wfile.getvalue()

class TestHandlerInMemory(unittest.TestCase):
    def _execute_request(self, method, path, body=None):
        headers = [f"{method} {path} HTTP/1.1", "Host: localhost"]
        body_bytes = b""
        if body is not None:
            body_bytes = json.dumps(body).encode("utf-8")
            headers.append(f"Content-Length: {len(body_bytes)}")
            headers.append("Content-Type: application/json")
        headers.append("")
        headers.append("")
        request_data = "\r\n".join(headers).encode("utf-8") + body_bytes

        mock_sock = MockSocket(request_data)
        
        # Instantiate handler without a real network socket
        class DummyServer:
            pass
        
        handler = server.BeyondTheCureHandler(mock_sock, ("127.0.0.1", 12345), DummyServer())
        
        raw_response = mock_sock.get_response().decode("utf-8", errors="replace")
        header_part, _, body_part = raw_response.partition("\r\n\r\n")
        status_line = header_part.splitlines()[0] if header_part else ""
        
        json_body = None
        try:
            json_body = json.loads(body_part)
        except Exception:
            json_body = body_part

        return status_line, json_body

    def test_health(self):
        status, body = self._execute_request("GET", "/api/health")
        self.assertIn("200", status)
        self.assertEqual(body["status"], "online")
        self.assertEqual(body["cohort_size"], 372863)

    def test_summary(self):
        status, body = self._execute_request("GET", "/api/summary")
        self.assertIn("200", status)
        self.assertIn("annual_metrics", body)
        self.assertEqual(len(body["annual_metrics"]), 5)

    def test_districts(self):
        status, body = self._execute_request("GET", "/api/districts")
        self.assertIn("200", status)
        self.assertEqual(len(body), 31)

    def test_simulate_sitrd(self):
        payload = {
            "params": {"beta": 0.7881, "gamma": 0.9815, "delta": 0.8726, "lambda_tb": 0.0599, "mu_i": 0.4658, "phi": 0.0618},
            "years": 5.0,
            "dt": 0.05
        }
        status, body = self._execute_request("POST", "/api/simulate/sitrd", payload)
        self.assertIn("200", status)
        self.assertAlmostEqual(body["r0"], 0.5389, places=2)
        self.assertEqual(body["sensitivities"]["Gamma_beta"], 1.0)

    def test_simulate_markov(self):
        status, body = self._execute_request("POST", "/api/simulate/markov", {"cycles": 5})
        self.assertIn("200", status)
        self.assertIn("series", body)
        self.assertIn("absorbing_metrics", body)

    def test_predict_patient_risk(self):
        patient = {
            "age": 68,
            "bmi": 14.5,
            "tb_site": "pulmonary",
            "hiv_positive": True,
            "diabetes": True,
            "tobacco_or_alcohol": True
        }
        status, body = self._execute_request("POST", "/api/predict/patient-risk", {"patient": patient})
        self.assertIn("200", status)
        self.assertIn(body["risk_tier"], ["High", "Critical"])
        self.assertIn("care_bundles", body)

    def test_optimize_resources(self):
        alloc = {
            "cbnaat_tests": 75000,
            "acf_vans": 55,
            "asha_workers": 2200,
            "nutrition_beneficiaries": 70000,
            "fdc_adherence_packs": 75000,
            "tpt_courses": 35000
        }
        status, body = self._execute_request("POST", "/api/optimize/resources", {"allocations": alloc})
        self.assertIn("200", status)
        self.assertIn("total_budget_cr_inr", body)
        self.assertIn("outcomes_2030", body)

    def test_care_gaps(self):
        status, body = self._execute_request("GET", "/api/care-gaps")
        self.assertIn("200", status)
        self.assertIn("mortality_plateau", body)
        self.assertIn("unnotified_reservoir", body)
        self.assertIn("care_cascade", body)

    def test_pharmacist_evaluate(self):
        patient = {
            "age": 55,
            "bmi": 15.5,
            "diabetes": True,
            "crcl": 25,
            "co_medications": ["Dolutegravir", "Metformin"],
            "ast": 180,
            "alt": 210,
            "bilirubin": 2.8,
            "has_jaundice_or_nausea": True
        }
        status, body = self._execute_request("POST", "/api/pharmacist/evaluate", {"patient": patient})
        self.assertIn("200", status)
        self.assertIn("ddi_alerts", body)
        self.assertGreater(len(body["ddi_alerts"]), 0)
        self.assertEqual(body["dili_evaluation"]["dili_status"], "CONFIRMED_DILI_ALERT")
        self.assertIn("Pyrazinamide", body["renal_adjustments"])

    def test_triage_batch(self):
        cohort = [
            {"id": "PT-01", "name": "Ramesh K", "age": 70, "bmi": 14.2, "hiv_positive": True},
            {"id": "PT-02", "name": "Priya S", "age": 24, "bmi": 21.0, "hiv_positive": False}
        ]
        status, body = self._execute_request("POST", "/api/triage/batch", {"cohort": cohort})
        self.assertIn("200", status)
        self.assertEqual(body["total_triaged"], 2)
        # First item should be the higher mortality patient
        self.assertEqual(body["triage_list"][0]["id"], "PT-01")

    def test_evaluation(self):
        entry = {
            "role": "State TB Officer",
            "district": "BBMP",
            "sus_score": 90.0,
            "mars_score": 4.8,
            "feedback": "Flawless epidemiological alignment."
        }
        status, body = self._execute_request("POST", "/api/evaluation/submit", entry)
        self.assertIn("200", status)
        self.assertEqual(body["status"], "success")

        status, stats = self._execute_request("GET", "/api/evaluation/stats")
        self.assertIn("200", status)
        self.assertGreaterEqual(stats["total_responses"], 1)

    def test_static_files(self):
        status, body = self._execute_request("GET", "/index.html")
        self.assertIn("200", status)
        self.assertIn("BEYOND THE CURE", body)
        self.assertIn("3,72,863", body)

        status, js = self._execute_request("GET", "/js/app.js")
        self.assertIn("200", status)
        self.assertIn("window.App", js)

if __name__ == "__main__":
    unittest.main()
