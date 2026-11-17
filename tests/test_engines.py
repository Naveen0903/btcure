"""
Automated Mathematical Verification Test Suite
Validates SITRD RK4 solver, R0 formula, Markov matrices, risk engine,
and care gap analytics against empirical dissertation figures.
"""

import unittest
import sys
import os

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.sitrd_engine import SITRDEngine
from core.markov_engine import MarkovEngine
from core.risk_engine import PatientRiskEngine
from core.resource_engine import ResourceOptimizationEngine
from core.care_gap_engine import CareGapEngine

class TestBeyondTheCureEngines(unittest.TestCase):
    def setUp(self):
        self.sitrd = SITRDEngine()
        self.markov = MarkovEngine()
        self.risk = PatientRiskEngine()
        self.resource = ResourceOptimizationEngine()
        self.care_gap = CareGapEngine()

    def test_r0_calculation(self):
        # 2024: beta=0.7881, gamma=0.9815, mu_i=0.4658, mu=0.0150 -> denom = 1.4623 -> R0 = 0.5389 ~ 0.5445
        r0_2024 = self.sitrd.calculate_r0(0.7881, 0.9815, 0.4658, 0.0150)
        self.assertAlmostEqual(r0_2024, 0.5389, places=3)

        # 2021: beta=0.8749, gamma=0.9717, mu_i=0.3627, mu=0.0150 -> denom = 1.3494 -> R0 = 0.6483 ~ 0.6557
        r0_2021 = self.sitrd.calculate_r0(0.8749, 0.9717, 0.3627, 0.0150)
        self.assertAlmostEqual(r0_2021, 0.6483, places=3)

    def test_r0_sensitivities(self):
        sens = self.sitrd.calculate_sensitivities(0.7881, 0.9815, 0.4658, 0.0150)
        # Gamma(R0, beta) must be identically +1.0000
        self.assertEqual(sens["Gamma_beta"], 1.0)
        # Gamma(R0, gamma) must be negative
        self.assertTrue(sens["Gamma_gamma"] < 0)
        # Gamma(R0, mu_i) must be negative
        self.assertTrue(sens["Gamma_mu_i"] < 0)

    def test_rk4_simulation_stability(self):
        res = self.sitrd.simulate_sitrd(years=5.0, dt=0.05)
        self.assertIn("series", res)
        self.assertIn("Susceptible", res["series"])
        self.assertIn("Infectious", res["series"])
        # Compartments must remain positive
        for s_val in res["series"]["Susceptible"]:
            self.assertGreaterEqual(s_val, 0)
        for i_val in res["series"]["Infectious"]:
            self.assertGreaterEqual(i_val, 0)

    def test_markov_matrix_stochasticity(self):
        # Rows must sum to 1.0
        for row in self.markov.default_matrix:
            row_sum = sum(row)
            self.assertAlmostEqual(row_sum, 1.0, places=3)

    def test_markov_absorbing_analysis(self):
        analysis = self.markov.compute_fundamental_matrix(self.markov.default_matrix)
        self.assertIn("fundamental_matrix_N", analysis)
        self.assertIn("expected_time_to_absorption_years", analysis)
        self.assertIn("ultimate_death_probability", analysis)

    def test_patient_risk_stratification(self):
        # High risk patient: elderly, severe malnutrition, HIV+
        patient_high = {
            "age": 68,
            "bmi": 14.8,
            "tb_site": "pulmonary",
            "hiv_positive": True,
            "diabetes": True,
            "tobacco_or_alcohol": True,
            "distance_to_center_km": 15
        }
        res_high = self.risk.predict_patient_risk(patient_high)
        self.assertIn(res_high["risk_tier"], ["High", "Critical"])
        self.assertGreater(res_high["probabilities"]["mortality_death"], 10.0)
        self.assertGreater(len(res_high["care_bundles"]), 0)

        # Low risk patient: young adult, normal weight, no co-morbidities
        patient_low = {
            "age": 28,
            "bmi": 22.0,
            "tb_site": "pulmonary",
            "hiv_positive": False,
            "diabetes": False,
            "tobacco_or_alcohol": False,
            "distance_to_center_km": 2
        }
        res_low = self.risk.predict_patient_risk(patient_low)
        self.assertEqual(res_low["risk_tier"], "Low")
        self.assertGreater(res_low["probabilities"]["treatment_success"], 80.0)

    def test_care_gap_and_unnotified_reservoir(self):
        res = self.care_gap.estimate_unnotified_reservoir()
        self.assertGreater(res["unnotified_reservoir_cases"], 20000)
        plateau = self.care_gap.analyze_mortality_plateau()
        self.assertEqual(plateau["plateau_value_pct"], 6.0)

    def test_objective3_oe_anomalies_and_pretreatment_barriers(self):
        barriers = self.care_gap.analyze_pretreatment_barriers()
        self.assertEqual(barriers["wrongly_diagnosed_excluded_total"], 846)
        self.assertEqual(len(barriers["barrier_categories"]), 4)
        self.assertGreater(barriers["total_5yr_real_untreated"], 6000)

        # Test pre-treatment drop-off AI scorer
        high_risk = self.care_gap.predict_pretreatment_dropoff_risk({
            "address_verified": False,
            "phone_verified": False,
            "is_migrant_worker": True,
            "stigma_or_refusal_history": False,
            "sector": "public",
            "diagnostic_delay_days": 18
        })
        self.assertIn("Critical", high_risk["risk_tier"])
        self.assertGreater(high_risk["dropoff_probability_pct"], 25.0)

        low_risk = self.care_gap.predict_pretreatment_dropoff_risk({
            "address_verified": True,
            "phone_verified": True,
            "is_migrant_worker": False,
            "stigma_or_refusal_history": False,
            "sector": "public",
            "diagnostic_delay_days": 3
        })
        self.assertIn("Low", low_risk["risk_tier"])
        self.assertLess(low_risk["dropoff_probability_pct"], 5.0)

if __name__ == "__main__":
    unittest.main()

