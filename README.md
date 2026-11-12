# BEYOND THE CURE: Karnataka NTEP Surveillance & Clinical Decision Platform

> **Operational Research Surveillance (2021–2025, N = 3,72,863)**  
> Approved by Karnataka State TB Control Board (OM No. 22/2025-26)  
> Academic Supervision: **Dr. Mekkanti Manasa Rekha**, Acharya & BM Reddy College of Pharmacy, Rajiv Gandhi University of Health Sciences (RGUHS)

---

## 1. Executive Summary & Core Epidemiological Findings

This platform translates the complete empirical findings of the 5-year Karnataka National Tuberculosis Elimination Programme (NTEP) epidemiological study ($N = 3,72,863$) into an interactive, production-ready enterprise digital health and biomathematical decision support system.

### Key Milestones & Mathematical Discoveries:
1. **1,27,310 Cumulative Deaths Averted:** Compared to the untreated natural progression counterfactual ($\mu_i = 34.95\% \to 48.59\%$), NTEP diagnosis and treatment averted over 1.27 lakh deaths between 2021 and 2025.
2. **The 8.10x Untreated Mortality Penalty:** By 2025, untreated active TB patients experienced a case fatality rate of $48.59\%$, compared to $6.00\%$ among treated patients ($\mu_i / \lambda = 8.10\times$).
3. **The Karnataka TB Paradox:** While notified patients experience an on-treatment cascade basic reproduction number $R_0 = 0.544$ (epidemic decay), state-wide annual notifications remained flat ($Y = 64,329.2 + 567.0X, p = 0.743$). This proves the existence of a persistent, unnotified community transmission reservoir ($I_u \approx 35,000\text{–}45,000$) sustaining high contact rates ($\beta = 0.788\text{–}0.902$).
4. **Deconstructing the 6% Mortality Plateau:** Despite DR-TB notifications reaching zero in 2024 and Treatment Success Rate (TSR) reaching $91.2\%$, on-treatment mortality ($\lambda$) hit an irreducible biological floor of $\approx 6.0\%$. Clinical field triage revealed that **46.2% of on-treatment deaths occur within the first 60 days**, driven by severe cachexia ($\text{BMI} < 16.0$) and late presentation (mean diagnostic delay: 23.8 days).
5. **Unit Parameter Elasticity:** Normalized sensitivity analysis demonstrates that $\Gamma(R_0, \beta) \equiv +1.0000$ (unit elasticity across all 5 years), confirming that transmission interruption (ACF + TPT) produces the single largest epidemiological dividend.

---

## 2. Architecture & Modules

The platform is engineered as a clean, multi-tier system with zero external dependency overhead:

```
tbapp/
├── server.py                   # Multi-threaded Python REST server (http.server/socketserver)
├── run.sh                      # One-click startup script (auto-detects .venv)
├── requirements.txt            # Optional dependencies (numpy, scipy, pandas, pytest)
├── BEYOND_THE_CURE_Enterprise_Proposal.md # Full technical & commercial proposal (42 use cases)
├── data/
│   ├── karnataka_ntep_data.json # 2021-2025 surveillance datasets, 31 districts, parameters
│   └── evaluation_responses.json # Stored SUS / MARS healthcare professional evaluations
├── core/
│   ├── sitrd_engine.py         # Runge-Kutta 4th Order (RK4) numerical ODE solver & R0 sensitivity
│   ├── markov_engine.py        # 5x5 DTMC matrix engine, P^n projection, fundamental matrix N
│   ├── risk_engine.py          # Calibrated outcome predictor, 4-tier risk, SHAP attributions, bundles
│   ├── pharmacist_engine.py    # DDI interaction checker, DILI re-introduction, renal & B6 dosing
│   ├── resource_engine.py      # Multi-lever programmatic optimizer (CBNAAT, ACF, ASHA, DBT, FDC, TPT)
│   └── care_gap_engine.py      # Plateau deconstruction, unnotified reservoir & 6-stage care cascade
├── static/
│   ├── index.html              # Modern responsive Single Page Application UI
│   ├── css/styles.css          # Medical high-contrast theme, glassmorphism, responsive grid
│   └── js/
│       ├── app.js              # Master state management, tab routing, API & fallback controller
│       ├── charts.js           # Retina-crisp Canvas & SVG rendering engine (trajectories, tornado, lives saved)
│       └── math_engine_client.js # Client-side 60fps RK4 & Markov mathematical engine
└── tests/
    ├── test_engines.py         # Mathematical verification tests (R0, stochasticity, RK4 stability)
    ├── test_api_endpoints.py   # REST API loopback integration test
    └── test_handler_in_memory.py # In-memory sandbox-compatible handler test suite (12 tests)
```

---

## 3. Five Core Application Workspaces

1. **Executive "End TB" Command Center:**
   - Real-time KPIs: $3,72,863$ cohort, $1,27,310$ lives saved, $88.5\%$ mean TSR, $8.10\times$ mortality penalty.
   - Interactive counterfactual lives saved visualization.
   - 5-year longitudinal surveillance table with SITRD $R_0$ progression.
2. **Biomathematical Digital Twin & Markov Studio:**
   - Interactive 60 FPS parameter sliders for $\beta, \gamma, \delta, \lambda, \mu_i, \varphi$.
   - Runge-Kutta 4th Order numerical simulation projecting $S(t), I(t), T(t), R(t), D(t)$ forward to 2030.
   - Normalized elasticity tornado chart ($\Gamma(R_0, \cdot)$).
   - 5-state Markov chain multi-year cohort projection ($P^n$).
3. **Clinical & Pharmacist Precision Care Workbench:**
   - Patient intake form with age, BMI, site, HIV, DM, tobacco/alcohol, organ impairment, RR-TB, retreatment, transit distance, and Nikshay Poshan DBT status.
   - Instant 4-tier risk classification: **Critical (Red)**, **High (Orange)**, **Moderate (Yellow)**, **Low (Green)**.
   - Multi-class outcome probabilities: Success, Mortality, LTFU, Failure, Relapse.
   - Explainable AI: SHAP-style waterfall feature attribution list.
   - Protocol-driven clinical and pharmacist care bundles.
4. **31-District Karnataka Surveillance & Geospatial Map:**
   - Complete coverage of all 31 districts of Karnataka (BBMP, Belagavi, Kalaburagi, Raichur, Ballari, Mysuru, Udupi, etc.).
   - Burden classification, TSR, TB mortality rate per 100k, and diabetic co-morbidity.
   - Interactive inspection modal displaying customized district action plans.
5. **Resource Optimization Lab & Policy Scenario Studio:**
   - Programmatic sliders across 6 interventions: CBNAAT tests, ACF vans, ASHA workers, Nikshay Poshan DBT, FDC packs, TPT 3HP courses.
   - Real-time budget calculation in INR Crores.
   - Forward trajectory projection to 2030, additional deaths averted, and WHO End TB milestone compliance.
6. **Operational Usability (SUS / MARS) Protocol:**
   - Built-in evaluation questionnaire for District TB Officers, Medical Officers, and Pharmacists.
   - Live compliance tracking against Objective 9's target ($SUS \ge 80.0$).

---

## 4. Quickstart & Verification

### Running the Application:
Simply launch via the startup script:
```bash
./run.sh
```
Or directly with Python:
```bash
python3 server.py 8000
```
Then open your browser at:
```
http://localhost:8000
```

### Running Automated Test Suites:
Run the comprehensive mathematical and handler verification test suites:
```bash
python3 tests/test_engines.py
python3 tests/test_handler_in_memory.py
```
All 17 verification tests execute in $< 0.01$ seconds with zero external dependencies!

