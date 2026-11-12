"""
SITRD and Extended SLITRD Mathematical Simulation Engine
Based on Dr. Mekkanti Manasa Rekha's 5-Year Surveillance Research (2021-2025, N = 3,72,863)
Implements 4th-Order Runge-Kutta (RK4) numerical ODE solver, R0 sensitivity analysis,
and counterfactual lives-saved calculation.
"""

import math
from typing import Dict, List, Any, Tuple

class SITRDEngine:
    def __init__(self, baseline_params: Dict[str, float] = None):
        # Default 2024 calibrated empirical baseline
        self.default_params = {
            "beta": 0.7881,      # Transmission rate (person-to-person contact)
            "gamma": 0.9815,     # Notification / treatment linkage rate
            "delta": 0.8726,     # Recovery / cure rate on treatment
            "lambda_tb": 0.0599, # Mortality rate while on treatment
            "mu_i": 0.4658,      # Disease-induced mortality rate when untreated
            "mu": 0.0150,        # Natural baseline mortality rate
            "phi": 0.0618,       # Relapse rate / immunity waning
            "N": 67690000.0,     # Karnataka population (approx 67.7M)
            "I0": 67882.0,       # Initial active infectious cohort
            "T0": 74704.0,       # Initial on-treatment cohort
            "R0_cohort": 68095.0,# Initial recovered cohort
            "D0": 3923.0         # Initial cumulative deaths
        }
        if baseline_params:
            self.default_params.update(baseline_params)

    def calculate_r0(self, beta: float, gamma: float, mu_i: float, mu: float) -> float:
        """
        Calculates basic reproduction number R0:
        R0 = beta / (gamma + mu_i + mu)
        """
        denom = gamma + mu_i + mu
        if denom <= 0:
            return 0.0
        return beta / denom

    def calculate_sensitivities(self, beta: float, gamma: float, mu_i: float, mu: float) -> Dict[str, float]:
        """
        Computes normalized sensitivity index (elasticity) Gamma(R0, p) = (d R0 / dp) * (p / R0)
        """
        denom = gamma + mu_i + mu
        gamma_beta = 1.0000  # Always strictly +1.0000 (unit elasticity)
        gamma_gamma = -gamma / denom
        gamma_mu_i = -mu_i / denom
        gamma_mu = -mu / denom

        return {
            "Gamma_beta": round(gamma_beta, 4),
            "Gamma_gamma": round(gamma_gamma, 4),
            "Gamma_mu_i": round(gamma_mu_i, 4),
            "Gamma_mu": round(gamma_mu, 4)
        }

    def simulate_sitrd(self, 
                       params: Dict[str, float] = None, 
                       years: float = 6.0, 
                       dt: float = 0.02) -> Dict[str, Any]:
        """
        Solves standard SITRD system using RK4:
        dS/dt = Lambda - beta * S * I / N - mu * S + phi * R
        dI/dt = beta * S * I / N - (gamma + mu_i + mu) * I
        dT/dt = gamma * I - (delta + lambda + mu) * T
        dR/dt = delta * T - (phi + mu) * R
        dD/dt = mu_i * I + lambda * T
        """
        p = self.default_params.copy()
        if params:
            p.update(params)

        beta = p["beta"]
        gamma = p["gamma"]
        delta = p["delta"]
        lam = p["lambda_tb"]
        mu_i = p["mu_i"]
        mu = p["mu"]
        phi = p["phi"]
        N = p["N"]
        Lambda = mu * N  # Replenishment birth rate maintaining demographic scale

        # Initial conditions
        I = float(p.get("I0", 67882.0))
        T = float(p.get("T0", 74704.0))
        R = float(p.get("R0_cohort", 68095.0))
        D = float(p.get("D0", 3923.0))
        S = max(0.0, N - (I + T + R))

        steps = int(years / dt)
        timeline = []
        s_series, i_series, t_series, r_series, d_series = [], [], [], [], []
        r0_series = []

        def derivatives(state: Tuple[float, float, float, float, float]):
            s, i, tr, rec, d = state
            ds = Lambda - (beta * s * i / N) - (mu * s) + (phi * rec)
            di = (beta * s * i / N) - (gamma + mu_i + mu) * i
            dt_r = (gamma * i) - (delta + lam + mu) * tr
            dr = (delta * tr) - (phi + mu) * rec
            dd = (mu_i * i) + (lam * tr)
            return ds, di, dt_r, dr, dd

        curr_state = (S, I, T, R, D)
        t_curr = 2024.0

        for step in range(steps + 1):
            s_val, i_val, t_val, r_val, d_val = curr_state
            
            # Record points periodically (e.g. every 5 steps for compact payload)
            if step % 5 == 0 or step == steps:
                timeline.append(round(t_curr, 2))
                s_series.append(round(s_val, 1))
                i_series.append(round(i_val, 1))
                t_series.append(round(t_val, 1))
                r_series.append(round(r_val, 1))
                d_series.append(round(d_val, 1))
                r0_series.append(round(self.calculate_r0(beta, gamma, mu_i, mu), 4))

            # RK4 Integration Step
            k1 = derivatives(curr_state)
            
            state_k2 = tuple(curr_state[j] + 0.5 * dt * k1[j] for j in range(5))
            k2 = derivatives(state_k2)
            
            state_k3 = tuple(curr_state[j] + 0.5 * dt * k2[j] for j in range(5))
            k3 = derivatives(state_k3)
            
            state_k4 = tuple(curr_state[j] + dt * k3[j] for j in range(5))
            k4 = derivatives(state_k4)

            next_state = tuple(
                curr_state[j] + (dt / 6.0) * (k1[j] + 2.0 * k2[j] + 2.0 * k3[j] + k4[j])
                for j in range(5)
            )
            # Ensure non-negative population compartments
            curr_state = tuple(max(0.0, val) for val in next_state)
            t_curr += dt

        r0_val = self.calculate_r0(beta, gamma, mu_i, mu)
        sensitivities = self.calculate_sensitivities(beta, gamma, mu_i, mu)

        return {
            "r0": round(r0_val, 4),
            "epidemic_phase": "Controlled (Decaying Reservoir)" if r0_val < 1.0 else "Epidemic Expansion",
            "sensitivities": sensitivities,
            "timeline": timeline,
            "series": {
                "Susceptible": s_series,
                "Infectious": i_series,
                "Treated": t_series,
                "Recovered": r_series,
                "CumulativeDeaths": d_series
            },
            "final_state": {
                "Infectious": round(curr_state[1], 1),
                "Treated": round(curr_state[2], 1),
                "Recovered": round(curr_state[3], 1),
                "Deaths": round(curr_state[4], 1)
            }
        }

    def simulate_counterfactual_lives_saved(self, 
                                             annual_data: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Calculates empirical counterfactual mortality:
        Without NTEP treatment (gamma = 0), infectious patients suffer untreated case fatality mu_i (34.95% - 48.59%).
        With treatment, on-treatment mortality is lambda (5.99% - 7.52%).
        Deaths averted = Initiated * (mu_i - lambda)
        """
        if not annual_data:
            from data import karnataka_data
            annual_data = karnataka_data.get("annual_metrics", [])

        years = []
        actual_deaths = []
        counterfactual_deaths = []
        averted_annual = []
        cumulative_averted = []
        cum_sum = 0

        for item in annual_data:
            yr = item["year"]
            initiated = item["treatment_initiated"]
            obs_deaths = item["deaths"]
            mu_i = item["mu_i"]
            lam = item["lambda"]

            # Deaths if untreated: initiated * mu_i
            cf_deaths = int(initiated * mu_i)
            # Averted = cf_deaths - obs_deaths
            averted = max(0, cf_deaths - obs_deaths)
            cum_sum += averted

            years.append(yr)
            actual_deaths.append(obs_deaths)
            counterfactual_deaths.append(cf_deaths)
            averted_annual.append(averted)
            cumulative_averted.append(cum_sum)

        return {
            "years": years,
            "actual_deaths": actual_deaths,
            "counterfactual_deaths_without_treatment": counterfactual_deaths,
            "annual_deaths_averted": averted_annual,
            "cumulative_deaths_averted": cumulative_averted,
            "total_lives_saved": cum_sum
        }

