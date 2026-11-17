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
    def _execute_request(self, method, path, body=None, extra_headers=None):
        headers = [f"{method} {path} HTTP/1.1", "Host: localhost"]
        if extra_headers:
            for k, v in extra_headers.items():
                headers.append(f"{k}: {v}")
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
        self.assertIn("pretreatment_barriers", body)
        self.assertIn("program_anomalies", body)
        self.assertEqual(body["program_anomalies"]["summary"]["total_districts_audited"], 31)

    def test_care_gaps_anomalies_and_dropoff(self):
        status, anom = self._execute_request("GET", "/api/care-gaps/anomalies")
        self.assertIn("200", status)
        self.assertEqual(len(anom["district_anomalies"]), 31)

        status, pred = self._execute_request("POST", "/api/care-gaps/predict-dropoff", {
            "profile": {
                "address_verified": False,
                "phone_verified": False,
                "is_migrant_worker": True,
                "stigma_or_refusal_history": True,
                "sector": "private",
                "diagnostic_delay_days": 20
            }
        })
        self.assertIn("200", status)
        self.assertIn("Critical", pred["risk_tier"])
        self.assertGreater(pred["dropoff_probability_pct"], 50.0)

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

    def test_features_2_to_6_endpoints(self):
        # Feature 2 & 3: Counterfactuals & Survival Hazard
        pt = {"age": 62, "bmi": 15.0, "dbt_unlinked": True, "tobacco_or_alcohol": True, "consecutive_missed_days": 15}
        status, cf = self._execute_request("POST", "/api/predict/counterfactuals", {"patient": pt})
        self.assertIn("200", status)
        self.assertIn("modifiable_levers", cf)

        status, surv = self._execute_request("POST", "/api/predict/survival-hazard", {"patient": pt})
        self.assertIn("200", status)
        self.assertEqual(len(surv["months"]), 7)

        # Feature 4: Forecasting & Structural Break
        status, fc = self._execute_request("GET", "/api/forecast?indicator=relapses")
        self.assertIn("200", status)
        self.assertIn("forecast", fc)
        self.assertIn("correlations", fc)

        # Feature 5: Model Validation & 2025 Partial Cohort Bounding
        status, val = self._execute_request("GET", "/api/validation/models?model=catboost_calibrated")
        self.assertIn("200", status)
        self.assertIn("validation", val)
        self.assertIn("partial_cohort_2025", val)

        status, b25 = self._execute_request("POST", "/api/validation/bound-2025", {"assumed_pending_tsr_pct": 92.0})
        self.assertIn("200", status)
        self.assertEqual(b25["pending_on_treatment_2025"], 23412)

        # Feature 6: Synthetic Cohort Generator
        status, syn = self._execute_request("POST", "/api/synthetic/generate", {"sample_size": 25, "seed_offset": 42})
        self.assertIn("200", status)
        self.assertEqual(syn["sample_size_generated"], 25)
        self.assertEqual(len(syn["synthetic_records"]), 25)

    def test_basic_authentication_and_vercel_handler(self):
        # 1. Valid login (Dr. Manasa Rekha PI account)
        status, res = self._execute_request("POST", "/api/auth/login", {"username": "dr.manasa", "password": "beyond2026"})
        self.assertIn("200", status)
        self.assertTrue(res["authenticated"])
        self.assertEqual(res["user"]["username"], "dr.manasa")
        token = res["user"]["token"]

        # 2. Verify with Basic Auth header
        status, vres = self._execute_request("GET", "/api/auth/verify", extra_headers={"Authorization": f"Basic {token}"})
        self.assertIn("200", status)
        self.assertTrue(vres["authenticated"])

        # 3. Invalid login returns 401
        status, bad = self._execute_request("POST", "/api/auth/login", {"username": "dr.manasa", "password": "wrong"})
        self.assertIn("401", status)
        self.assertFalse(bad["authenticated"])

        # 4. Verify Vercel Serverless entrypoint imports cleanly
        from api.index import handler as vercel_handler
        self.assertTrue(issubclass(vercel_handler, server.BeyondTheCureHandler))

if __name__ == "__main__":
    unittest.main()
