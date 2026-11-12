/**
 * BEYOND THE CURE: High-Performance Client-Side Mathematical Engine
 * Provides instant 60fps RK4 SITRD numerical ODE solver, Markov matrix calculus,
 * and clinical risk scoring with fallback capability.
 */

window.MathEngine = {
  // SITRD RK4 Numerical Solver
  simulateSITRD: function(params, years = 6.0, dt = 0.05) {
    const p = Object.assign({
      beta: 0.7881,
      gamma: 0.9815,
      delta: 0.8726,
      lambda_tb: 0.0599,
      mu_i: 0.4658,
      mu: 0.0150,
      phi: 0.0618,
      N: 67690000.0,
      I0: 67882.0,
      T0: 74704.0,
      R0_cohort: 68095.0,
      D0: 3923.0
    }, params || {});

    const beta = p.beta;
    const gamma = p.gamma;
    const delta = p.delta;
    const lam = p.lambda_tb;
    const mu_i = p.mu_i;
    const mu = p.mu;
    const phi = p.phi;
    const N = p.N;
    const Lambda = mu * N;

    let S = Math.max(0, N - (p.I0 + p.T0 + p.R0_cohort));
    let I = p.I0;
    let T = p.T0;
    let R = p.R0_cohort;
    let D = p.D0;

    const steps = Math.floor(years / dt);
    const timeline = [];
    const series = {
      Susceptible: [],
      Infectious: [],
      Treated: [],
      Recovered: [],
      CumulativeDeaths: []
    };

    function derivatives(s, i, tr, rec, d) {
      const ds = Lambda - (beta * s * i / N) - (mu * s) + (phi * rec);
      const di = (beta * s * i / N) - (gamma + mu_i + mu) * i;
      const dtr = (gamma * i) - (delta + lam + mu) * tr;
      const drec = (delta * tr) - (phi + mu) * rec;
      const dd = (mu_i * i) + (lam * tr);
      return [ds, di, dtr, drec, dd];
    }

    let tCurr = 2024.0;
    for (let step = 0; step <= steps; step++) {
      if (step % 4 === 0 || step === steps) {
        timeline.push(Number(tCurr.toFixed(2)));
        series.Susceptible.push(Math.round(S));
        series.Infectious.push(Math.round(I));
        series.Treated.push(Math.round(T));
        series.Recovered.push(Math.round(R));
        series.CumulativeDeaths.push(Math.round(D));
      }

      // RK4 Steps
      const k1 = derivatives(S, I, T, R, D);
      const k2 = derivatives(
        S + 0.5 * dt * k1[0],
        I + 0.5 * dt * k1[1],
        T + 0.5 * dt * k1[2],
        R + 0.5 * dt * k1[3],
        D + 0.5 * dt * k1[4]
      );
      const k3 = derivatives(
        S + 0.5 * dt * k2[0],
        I + 0.5 * dt * k2[1],
        T + 0.5 * dt * k2[2],
        R + 0.5 * dt * k2[3],
        D + 0.5 * dt * k2[4]
      );
      const k4 = derivatives(
        S + dt * k3[0],
        I + dt * k3[1],
        T + dt * k3[2],
        R + dt * k3[3],
        D + dt * k3[4]
      );

      S = Math.max(0, S + (dt / 6.0) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]));
      I = Math.max(0, I + (dt / 6.0) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]));
      T = Math.max(0, T + (dt / 6.0) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]));
      R = Math.max(0, R + (dt / 6.0) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]));
      D = Math.max(0, D + (dt / 6.0) * (k1[4] + 2 * k2[4] + 2 * k3[4] + k4[4]));

      tCurr += dt;
    }

    const denom = gamma + mu_i + mu;
    const r0 = denom > 0 ? (beta / denom) : 0;

    return {
      r0: Number(r0.toFixed(4)),
      epidemic_phase: r0 < 1.0 ? "Controlled (Decaying Reservoir)" : "Epidemic Expansion",
      sensitivities: {
        Gamma_beta: 1.0000,
        Gamma_gamma: Number((-gamma / denom).toFixed(4)),
        Gamma_mu_i: Number((-mu_i / denom).toFixed(4)),
        Gamma_mu: Number((-mu / denom).toFixed(4))
      },
      timeline: timeline,
      series: series,
      final_state: {
        Infectious: Math.round(I),
        Treated: Math.round(T),
        Recovered: Math.round(R),
        Deaths: Math.round(D)
      }
    };
  },

  // Markov 5x5 Matrix Multiplier & Projection
  simulateMarkov: function(matrix, initialCohort, cycles = 10) {
    const P = matrix || [
      [0.9988, 0.0010, 0.0000, 0.0000, 0.0002],
      [0.0000, 0.0031, 0.9934, 0.0000, 0.0035],
      [0.0000, 0.0000, 0.0042, 0.9359, 0.0599],
      [0.0618, 0.0000, 0.0000, 0.9380, 0.0002],
      [0.0000, 0.0000, 0.0000, 0.0000, 1.0000]
    ];
    const states = ["Susceptible", "Infectious", "Treated", "Recovered", "Death"];
    let curr = initialCohort || [0, 100000, 0, 0, 0];
    const total = curr.reduce((a, b) => a + b, 0) || 100000;

    // Normalize
    let dist = curr.map(v => v / total);
    const timeline = [];
    const series = {
      Susceptible: [],
      Infectious: [],
      Treated: [],
      Recovered: [],
      Death: []
    };

    for (let c = 0; c <= cycles; c++) {
      timeline.push(2024 + c);
      states.forEach((st, i) => {
        series[st].push(Math.round(dist[i] * total));
      });

      // Next step
      const nextDist = [0, 0, 0, 0, 0];
      for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 5; i++) {
          nextDist[j] += dist[i] * P[i][j];
        }
      }
      dist = nextDist;
    }

    return {
      timeline: timeline,
      series: series,
      final_distribution_pct: {
        Susceptible: Number((dist[0] * 100).toFixed(2)),
        Infectious: Number((dist[1] * 100).toFixed(2)),
        Treated: Number((dist[2] * 100).toFixed(2)),
        Recovered: Number((dist[3] * 100).toFixed(2)),
        Death: Number((dist[4] * 100).toFixed(2))
      }
    };
  },

  // Patient Risk Scoring & Explainability
  evaluatePatientRisk: function(p) {
    const age = Number(p.age || 45);
    const bmi = Number(p.bmi || 17.5);
    const hiv = Boolean(p.hiv_positive);
    const dm = Boolean(p.diabetes);
    const tox = Boolean(p.tobacco_or_alcohol);
    const ckd = Boolean(p.ckd_or_liver);
    const rr = Boolean(p.rr_tb);
    const retreatment = Boolean(p.is_retreatment);
    const delay = Number(p.treatment_delay_days || 14);
    const dbtUnlinked = Boolean(p.dbt_unlinked);
    const dist = Number(p.distance_to_center_km || 5);

    let logitDeath = Math.log(0.053 / (1 - 0.053));
    let logitLtfu = Math.log(0.0435 / (1 - 0.0435));
    let logitFail = Math.log(0.0076 / (1 - 0.0076));
    let logitRelapse = Math.log(0.0673 / (1 - 0.0673));

    const shap = [];

    // Underweight
    if (bmi < 16.0) {
      logitDeath += 1.45;
      logitLtfu += 0.40;
      shap.push({ factor: "Severe Underweight (BMI < 16.0)", impact_death: 0.28, impact_ltfu: 0.08, severity: "high" });
    } else if (bmi < 18.5) {
      logitDeath += 0.70;
      logitLtfu += 0.20;
      shap.push({ factor: "Mild Underweight (BMI 16.0-18.4)", impact_death: 0.12, impact_ltfu: 0.03, severity: "medium" });
    } else {
      logitDeath -= 0.35;
      shap.push({ factor: "Normal BMI (>= 18.5)", impact_death: -0.06, impact_ltfu: -0.02, severity: "low" });
    }

    // Age
    if (age >= 60) {
      logitDeath += 1.10;
      shap.push({ factor: `Advanced Age (${age} yrs)`, impact_death: 0.22, impact_ltfu: 0.02, severity: "high" });
    } else if (age < 25) {
      logitDeath -= 0.40;
      logitLtfu += 0.35;
      shap.push({ factor: `Young Mobile Age (${age} yrs)`, impact_death: -0.05, impact_ltfu: 0.09, severity: "medium" });
    }

    // Retreatment
    if (retreatment) {
      logitRelapse += 1.30;
      logitDeath += 0.45;
      shap.push({ factor: "History of Previous TB", impact_death: 0.08, impact_ltfu: 0.11, severity: "high" });
    }

    // HIV
    if (hiv) {
      logitDeath += 1.55;
      shap.push({ factor: "HIV Co-infection", impact_death: 0.31, impact_ltfu: 0.12, severity: "critical" });
    }

    // Diabetes
    if (dm) {
      logitDeath += 0.40;
      logitRelapse += 0.55;
      shap.push({ factor: "Diabetes Mellitus", impact_death: 0.07, impact_ltfu: 0.02, severity: "medium" });
    }

    // Toxic habits
    if (tox) {
      logitLtfu += 0.85;
      logitDeath += 0.35;
      shap.push({ factor: "Tobacco / Alcohol Use", impact_death: 0.06, impact_ltfu: 0.18, severity: "high" });
    }

    // Organ dysfunction
    if (ckd) {
      logitDeath += 1.25;
      shap.push({ factor: "Renal / Hepatic Impairment", impact_death: 0.25, impact_ltfu: 0.05, severity: "critical" });
    }

    // RR-TB
    if (rr) {
      logitDeath += 1.40;
      logitFail += 1.80;
      shap.push({ factor: "Rifampicin Resistance (RR-TB)", impact_death: 0.29, impact_ltfu: 0.15, severity: "critical" });
    }

    // Socioeconomic
    if (dbtUnlinked) {
      logitLtfu += 0.75;
      shap.push({ factor: "Nikshay Poshan DBT Unlinked", impact_death: 0.02, impact_ltfu: 0.16, severity: "medium" });
    }
    if (dist > 10) {
      logitLtfu += 0.60;
      shap.push({ factor: `Long Distance (${dist} km)`, impact_death: 0.01, impact_ltfu: 0.14, severity: "medium" });
    }

    // Softmax / Sigmoid approximation
    let pDeath = 1 / (1 + Math.exp(-logitDeath));
    let pLtfu = 1 / (1 + Math.exp(-logitLtfu));
    let pFail = 1 / (1 + Math.exp(-logitFail));
    let pRelapse = 1 / (1 + Math.exp(-logitRelapse));

    const unfav = pDeath + pLtfu + pFail;
    if (unfav >= 0.90) {
      const scale = 0.88 / unfav;
      pDeath *= scale;
      pLtfu *= scale;
      pFail *= scale;
    }
    const pSuccess = Math.max(0.02, 1 - (pDeath + pLtfu + pFail));

    let tier = "Low";
    let color = "#16a34a";
    let code = "GREEN_FLAG_STANDARD_DOTS";

    if (pDeath >= 0.20 || pLtfu >= 0.35 || rr || (hiv && bmi < 16.0)) {
      tier = "Critical";
      color = "#dc2626";
      code = "RED_FLAG_URGENT_INPATIENT";
    } else if (pDeath >= 0.10 || pLtfu >= 0.20 || (dm && age >= 60)) {
      tier = "High";
      color = "#f97316";
      code = "ORANGE_FLAG_INTENSIVE_HOME_VISIT";
    } else if (unfav >= 0.15) {
      tier = "Moderate";
      color = "#eab308";
      code = "YELLOW_FLAG_ENHANCED_SURVEILLANCE";
    }

    return {
      risk_tier: tier,
      risk_color: color,
      action_code: code,
      probabilities: {
        treatment_success: Number((pSuccess * 100).toFixed(1)),
        mortality_death: Number((pDeath * 100).toFixed(1)),
        loss_to_follow_up: Number((pLtfu * 100).toFixed(1)),
        treatment_failure: Number((pFail * 100).toFixed(1)),
        secondary_relapse: Number((pRelapse * 100).toFixed(1))
      },
      shap_attributions: shap.sort((a, b) => (Math.abs(b.impact_death) + Math.abs(b.impact_ltfu)) - (Math.abs(a.impact_death) + Math.abs(a.impact_ltfu)))
    };
  }
};

