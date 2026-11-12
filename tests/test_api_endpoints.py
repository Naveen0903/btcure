"""
End-to-End REST API Integration Test
Tests all server endpoints on a test port.
"""

import threading
import time
import urllib.request
import json
import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import server

TEST_PORT = 8089

class TestServerEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Start server in daemon thread
        cls.httpd = server.ThreadedHTTPServer(("127.0.0.1", TEST_PORT), server.BeyondTheCureHandler)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever)
        cls.server_thread.daemon = True
        cls.server_thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def _get(self, path):
        url = f"http://127.0.0.1:{TEST_PORT}{path}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status, json.loads(res.read().decode("utf-8"))

    def _post(self, path, payload):
        url = f"http://127.0.0.1:{TEST_PORT}{path}"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status, json.loads(res.read().decode("utf-8"))

    def test_health_check(self):
        status, data = self._get("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "online")
        self.assertEqual(data["cohort_size"], 372863)

    def test_summary_and_districts(self):
        status, data = self._get("/api/summary")
        self.assertEqual(status, 200)
        self.assertIn("annual_metrics", data)
        self.assertEqual(len(data["annual_metrics"]), 5)

        status, dists = self._get("/api/districts")
        self.assertEqual(status, 200)
        self.assertEqual(len(dists), 31)

    def test_simulate_sitrd(self):
        payload = {
            "params": {"beta": 0.7881, "gamma": 0.9815, "delta": 0.8726, "lambda_tb": 0.0599, "mu_i": 0.4658, "phi": 0.0618},
            "years": 5.0,
            "dt": 0.05
        }
        status, res = self._post("/api/simulate/sitrd", payload)
        self.assertEqual(status, 200)
        self.assertAlmostEqual(res["r0"], 0.5389, places=2)
        self.assertEqual(res["sensitivities"]["Gamma_beta"], 1.0)
        self.assertIn("timeline", res)

    def test_simulate_markov(self):
        status, res = self._post("/api/simulate/markov", {"cycles": 5})
        self.assertEqual(status, 200)
        self.assertIn("series", res)
        self.assertIn("absorbing_metrics", res)

    def test_predict_patient_risk(self):
        patient = {
            "age": 65,
            "bmi": 15.0,
            "tb_site": "pulmonary",
            "hiv_positive": True,
            "diabetes": True,
            "tobacco_or_alcohol": True
        }
        status, res = self._post("/api/predict/patient-risk", {"patient": patient})
        self.assertEqual(status, 200)
        self.assertIn(res["risk_tier"], ["High", "Critical"])
        self.assertIn("shap_attributions", res)
        self.assertIn("care_bundles", res)

    def test_optimize_resources(self):
        alloc = {
            "cbnaat_tests": 80000,
            "acf_vans": 60,
            "asha_workers": 2500,
            "nutrition_beneficiaries": 75000,
            "fdc_adherence_packs": 80000,
            "tpt_courses": 45000
        }
        status, res = self._post("/api/optimize/resources", {"allocations": alloc})
        self.assertEqual(status, 200)
        self.assertIn("total_budget_cr_inr", res)
        self.assertIn("outcomes_2030", res)

    def test_care_gaps(self):
        status, res = self._get("/api/care-gaps")
        self.assertEqual(status, 200)
        self.assertIn("mortality_plateau", res)
        self.assertIn("unnotified_reservoir", res)

    def test_evaluation_submit_and_stats(self):
        entry = {
            "role": "Medical Officer",
            "district": "Kalaburagi",
            "sus_score": 88.0,
            "mars_score": 4.7,
            "feedback": "Intuitive CDSS alerts."
        }
        status, res = self._post("/api/evaluation/submit", entry)
        self.assertEqual(status, 200)
        self.assertEqual(res["status"], "success")

        status, stats = self._get("/api/evaluation/stats")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(stats["total_responses"], 1)

    def test_static_html(self):
        url = f"http://127.0.0.1:{TEST_PORT}/index.html"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as res:
            self.assertEqual(res.status, 200)
            content = res.read().decode("utf-8")
            self.assertIn("BEYOND THE CURE", content)
            self.assertIn("3,72,863", content)

if __name__ == "__main__":
    unittest.main()

