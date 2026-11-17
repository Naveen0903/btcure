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

    const baseResult = {
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

    if (!p._skip_extensions) {
      baseResult.dice_counterfactuals = this.generateCounterfactuals(p, baseResult);
      baseResult.survival_trajectory = this.predictSurvivalHazard(p, baseResult);
    }
    return baseResult;
  },

  // Feature 2 Client-Side Fallback: DiCE Counterfactual Explanations
  generateCounterfactuals: function(p, baseRes) {
    const baseProbs = baseRes.probabilities;
    const levers = [];
    const optP = Object.assign({}, p, { _skip_extensions: true });

    if (Number(p.bmi || 17.5) < 18.5) {
      const cf = this.evaluatePatientRisk(Object.assign({}, p, { bmi: 19.0, _skip_extensions: true })).probabilities;
      levers.push({
        lever: "Nutritional Rehabilitation (Raise BMI to >= 18.5 kg/m²)",
        from_state: `BMI ${Number(p.bmi || 17.5).toFixed(1)} kg/m²`,
        to_state: "BMI 19.0 kg/m² (Therapeutic Refeeding)",
        delta_death_pct: Number((cf.mortality_death - baseProbs.mortality_death).toFixed(1)),
        delta_ltfu_pct: Number((cf.loss_to_follow_up - baseProbs.loss_to_follow_up).toFixed(1)),
        delta_success_pct: Number((cf.treatment_success - baseProbs.treatment_success).toFixed(1))
      });
      optP.bmi = 19.0;
    }
    if (p.dbt_unlinked) {
      const cf = this.evaluatePatientRisk(Object.assign({}, p, { dbt_unlinked: false, _skip_extensions: true })).probabilities;
      levers.push({
        lever: "Link Nikshay Poshan Direct Benefit Transfer (INR 1,000/mo)",
        from_state: "DBT Pending / Unlinked",
        to_state: "Same-Day Bank Aadhaar Seeding",
        delta_death_pct: Number((cf.mortality_death - baseProbs.mortality_death).toFixed(1)),
        delta_ltfu_pct: Number((cf.loss_to_follow_up - baseProbs.loss_to_follow_up).toFixed(1)),
        delta_success_pct: Number((cf.treatment_success - baseProbs.treatment_success).toFixed(1))
      });
      optP.dbt_unlinked = false;
    }
    if (p.tobacco_or_alcohol) {
      const cf = this.evaluatePatientRisk(Object.assign({}, p, { tobacco_or_alcohol: false, _skip_extensions: true })).probabilities;
      levers.push({
        lever: "Brief Alcohol/Tobacco Cessation & Peer Counseling",
        from_state: "Active Substance Use",
        to_state: "Enrolled in De-addiction Support",
        delta_death_pct: Number((cf.mortality_death - baseProbs.mortality_death).toFixed(1)),
        delta_ltfu_pct: Number((cf.loss_to_follow_up - baseProbs.loss_to_follow_up).toFixed(1)),
        delta_success_pct: Number((cf.treatment_success - baseProbs.treatment_success).toFixed(1))
      });
      optP.tobacco_or_alcohol = false;
    }
    if (Number(p.distance_to_center_km || 5) > 10) {
      const cf = this.evaluatePatientRisk(Object.assign({}, p, { distance_to_center_km: 2, _skip_extensions: true })).probabilities;
      levers.push({
        lever: "Doorstep ASHA DOTS / Video Observed Therapy (VOT)",
        from_state: `${p.distance_to_center_km} km Transit Barrier`,
        to_state: "Doorstep Refill (< 2 km equivalent)",
        delta_death_pct: Number((cf.mortality_death - baseProbs.mortality_death).toFixed(1)),
        delta_ltfu_pct: Number((cf.loss_to_follow_up - baseProbs.loss_to_follow_up).toFixed(1)),
        delta_success_pct: Number((cf.treatment_success - baseProbs.treatment_success).toFixed(1))
      });
      optP.distance_to_center_km = 2;
    }
    if (Number(p.treatment_delay_days || 14) > 21) {
      const cf = this.evaluatePatientRisk(Object.assign({}, p, { treatment_delay_days: 7, _skip_extensions: true })).probabilities;
      levers.push({
        lever: "Fast-Track CBNAAT Stabilization & Intensive Monitoring",
        from_state: `${p.treatment_delay_days} Days Diagnostic Lag`,
        to_state: "Rapid Stabilization Protocol (<= 7d)",
        delta_death_pct: Number((cf.mortality_death - baseProbs.mortality_death).toFixed(1)),
        delta_ltfu_pct: Number((cf.loss_to_follow_up - baseProbs.loss_to_follow_up).toFixed(1)),
        delta_success_pct: Number((cf.treatment_success - baseProbs.treatment_success).toFixed(1))
      });
      optP.treatment_delay_days = 7;
    }

    const optRes = this.evaluatePatientRisk(optP);
    const optProbs = optRes.probabilities;
    return {
      baseline_tier: baseRes.risk_tier,
      counterfactual_tier: optRes.risk_tier,
      baseline_probabilities: baseProbs,
      counterfactual_probabilities: optProbs,
      total_mortality_reduction_pct: Number((baseProbs.mortality_death - optProbs.mortality_death).toFixed(1)),
      total_ltfu_reduction_pct: Number((baseProbs.loss_to_follow_up - optProbs.loss_to_follow_up).toFixed(1)),
      total_success_gain_pct: Number((optProbs.treatment_success - baseProbs.treatment_success).toFixed(1)),
      modifiable_levers: levers
    };
  },

  // Feature 3 Client-Side Fallback: Longitudinal 6-Month Survival & LTFU Hazard
  predictSurvivalHazard: function(p, baseRes) {
    const probs = baseRes.probabilities;
    const baseDeath = probs.mortality_death / 100.0;
    const baseLtfu = probs.loss_to_follow_up / 100.0;

    const adherence = Number(p.adherence_pct ?? 92.0);
    const missedDays = Number(p.consecutive_missed_days ?? 4);
    const sputumM2 = String(p.month2_sputum_status || "converted").toLowerCase();

    let ltfuMult = 1.0, deathMult = 1.0;
    if (adherence < 80) { ltfuMult *= 1.85; deathMult *= 1.25; }
    else if (adherence < 90) { ltfuMult *= 1.35; }
    if (missedDays >= 14) ltfuMult *= 2.40;
    else if (missedDays >= 7) ltfuMult *= 1.55;
    if (sputumM2 === "positive") { deathMult *= 1.50; ltfuMult *= 1.30; }

    const adjDeath = Math.min(0.65, baseDeath * deathMult);
    const adjLtfu = Math.min(0.75, baseLtfu * ltfuMult);

    const dWeights = [0.0, 0.28, 0.462, 0.64, 0.78, 0.90, 1.00];
    const lWeights = [0.0, 0.14, 0.35, 0.62, 0.82, 0.93, 1.00];
    const months = ["M0 (Reg)", "M1 (30d)", "M2 (Intensive)", "M3 (90d)", "M4 (120d)", "M5 (150d)", "M6 (End)"];

    const retention = [], mortCurve = [], ltfuCurve = [];
    for (let i = 0; i < 7; i++) {
      const cd = Number((adjDeath * dWeights[i] * 100).toFixed(1));
      const cl = Number((adjLtfu * lWeights[i] * 100).toFixed(1));
      mortCurve.push(cd);
      ltfuCurve.push(cl);
      retention.push(Number(Math.max(5.0, 100.0 - cd - cl).toFixed(1)));
    }

    const daysLeft = Math.max(0, 60 - missedDays);
    let code = "GREEN_ON_TRACK";
    let msg = `ON TRACK: ${adherence}% adherence (${daysLeft}d safety buffer to 60-day LTFU threshold).`;
    if (missedDays >= 14 || adjLtfu >= 0.25) {
      code = "RED_PREEMPTIVE_LTFU_ALERT";
      msg = `CRITICAL: ${missedDays} consecutive missed days (${daysLeft}d before 60-day LTFU cutoff). Dispatch STS/ASHA home visit within 24h.`;
    } else if (missedDays >= 5 || adherence < 85) {
      code = "AMBER_ADHERENCE_DRIFT";
      msg = `WARNING: Adherence ${adherence}% (${missedDays}d missed). Trigger automated 99DOTS IVR call & family counsellor check.`;
    }

    return {
      months: months,
      retention_survival_pct: retention,
      cumulative_mortality_hazard_pct: mortCurve,
      cumulative_ltfu_hazard_pct: ltfuCurve,
      dynamic_ltfu_hazard_ratio: Number(ltfuMult.toFixed(2)),
      dynamic_mortality_hazard_ratio: Number(deathMult.toFixed(2)),
      days_to_60d_ltfu_threshold: daysLeft,
      interruption_alert_code: code,
      interruption_alert_message: msg
    };
  },

  // Objective 3 Client-Side Fallback: O/E Anomaly Detector across 31 Districts
  detectProgramAnomalies: function(districts) {
    if (!districts || districts.length === 0) return { summary: {}, district_anomalies: [] };
    const results = [];
    let crit = 0, warn = 0, under = 0, bench = 0;

    districts.forEach(d => {
      const pop = Number(d.pop || 1500000);
      const obsNotif = Number(d.notifications || 1800);
      const obsTsr = Number(d.tsr || 90.0);
      const obsMort = Number(d.mortality_rate || 5.5);
      const hivPct = Number(d.hiv_pct || 2.2);
      const dmPct = Number(d.dm_pct || 15.0);
      const cbnaatCov = Number(d.cbnaat_coverage || 83.0);

      let expMort = 4.65 + 0.58 * (hivPct - 2.0) + 0.04 * (dmPct - 15.0) - 0.045 * (cbnaatCov - 83.0);
      expMort = Math.max(3.8, Math.min(7.2, expMort));
      const oeMort = obsMort / expMort;
      const mortZ = (obsMort - expMort) / 0.42;

      let expTsr = 90.8 + 0.14 * (cbnaatCov - 83.0) - 0.85 * (hivPct - 2.0);
      expTsr = Math.max(86.0, Math.min(94.5, expTsr));
      const tsrGap = obsTsr - expTsr;

      const obsNotifRate = (obsNotif / pop) * 100000.0;
      const zone = d.zone || "South";
      const zoneBase = (zone === "North" || zone === "Central") ? 105.0 : (zone === "South" ? 98.0 : 82.0);
      const expNotifRate = zoneBase + 0.65 * (cbnaatCov - 83.0) + 4.5 * (hivPct - 2.0);
      const oeNotif = obsNotifRate / Math.max(50.0, expNotifRate);

      const rawDist = Math.sqrt((mortZ ** 2) + ((tsrGap / 1.1) ** 2) + (((oeNotif - 1.0) / 0.18) ** 2));
      const anomalyScore = Number(Math.min(0.99, 1.0 - Math.exp(-0.45 * rawDist)).toFixed(3));

      let status = "NORMAL_EXPECTED";
      let discType = "Consistent with Epidemiological Baseline";
      let aiDiag = `Observed metrics align with expected model bounds (Mortality O/E=${oeMort.toFixed(2)}, TSR=${obsTsr}%).`;
      let action = "Maintain standard NTEP surveillance and expand household contact TPT (3HP).";

      if (oeMort >= 1.10 || (mortZ >= 1.25 && tsrGap <= -0.8)) {
        status = "CRITICAL_ANOMALY";
        discType = "Excess Mortality & Care-Cascade Leak";
        aiDiag = `Observed mortality (${obsMort}/100k) exceeds model expectation (${expMort.toFixed(2)}/100k, O/E=${oeMort.toFixed(2)}). Driven by delayed CBNAAT linkage (${cbnaatCov}%).`;
        action = "Deploy emergency clinical audit team; mandate upfront Truenat/CBNAAT and inpatient nutritional stabilization.";
        crit++;
      } else if (tsrGap <= -1.0 || oeMort >= 1.05) {
        status = "WARNING_DISCREPANCY";
        discType = "Sub-Optimal TSR / LTFU Drift";
        aiDiag = `Observed TSR (${obsTsr}%) trails expected benchmark (${expTsr.toFixed(1)}% by ${Math.abs(tsrGap).toFixed(1)}%).`;
        action = "Activate 99DOTS missed-dose survival alerts and audit TU-level pre-treatment address records.";
        warn++;
      } else if (oeNotif <= 0.85) {
        status = "UNDER_NOTIFICATION_GAP";
        discType = "Hidden Unnotified Reservoir (Low O/E Notification)";
        aiDiag = `Notification rate (${obsNotifRate.toFixed(1)}/100k) is ${((1.0 - oeNotif) * 100).toFixed(1)}% below expected burden (${expNotifRate.toFixed(1)}/100k).`;
        action = "Intensify Active Case Finding (ACF mobile X-ray vans) and enforce private pharmacy Schedule-H1 Nikshay reporting.";
        under++;
      } else if (oeMort <= 0.90 && obsTsr >= 92.0) {
        status = "OPTIMAL_BENCHMARK";
        discType = "Positive Deviance Outperformer";
        aiDiag = `Mortality (${obsMort}/100k) is ${((1.0 - oeMort) * 100).toFixed(1)}% below expectation with ${obsTsr}% TSR.`;
        action = "Document district best practices as a reference workflow for high-burden northern districts.";
        bench++;
      }

      results.push({
        district_id: d.id,
        district_name: d.name,
        zone: zone,
        observed_mortality: Number(obsMort.toFixed(2)),
        expected_mortality: Number(expMort.toFixed(2)),
        oe_mortality_ratio: Number(oeMort.toFixed(3)),
        mortality_z_score: Number(mortZ.toFixed(2)),
        observed_tsr: Number(obsTsr.toFixed(1)),
        expected_tsr: Number(expTsr.toFixed(1)),
        tsr_gap: Number(tsrGap.toFixed(2)),
        observed_notif_per_100k: Number(obsNotifRate.toFixed(1)),
        expected_notif_per_100k: Number(expNotifRate.toFixed(1)),
        oe_notification_ratio: Number(oeNotif.toFixed(3)),
        isolation_anomaly_score: anomalyScore,
        anomaly_status: status,
        discrepancy_type: discType,
        ai_diagnosis: aiDiag,
        recommended_action: action
      });
    });

    const rank = s => s === "CRITICAL_ANOMALY" ? 0 : s === "WARNING_DISCREPANCY" ? 1 : s === "UNDER_NOTIFICATION_GAP" ? 2 : s === "OPTIMAL_BENCHMARK" ? 3 : 4;
    results.sort((a, b) => rank(a.anomaly_status) - rank(b.anomaly_status) || b.isolation_anomaly_score - a.isolation_anomaly_score);

    return {
      summary: {
        total_districts_audited: results.length,
        critical_anomalies_count: crit,
        warning_discrepancies_count: warn,
        under_notification_gaps_count: under,
        optimal_benchmarks_count: bench
      },
      district_anomalies: results
    };
  },

  getPretreatmentBarriers: function() {
    return {
      total_5yr_real_untreated: 6918,
      total_5yr_pretreatment_deaths: 2709,
      average_untreated_cfr_pct: 39.16,
      wrongly_diagnosed_excluded_total: 846,
      barrier_categories: [
        {
          id: "incorrect_address",
          barrier: "Untraceable — Incorrect / Incomplete Address",
          five_year_total: 1478,
          annual_range: "258–332 cases/yr",
          share_of_traceable_barriers_pct: 43.2,
          ai_intervention: "Mandatory Aadhaar/ABHA OTP mobile verification & geo-tagged home pin at diagnostic registration (DMC/CBNAAT)."
        },
        {
          id: "treatment_refusal",
          barrier: "Treatment Refusal & Social Stigma",
          five_year_total: 949,
          annual_range: "151–233 cases/yr",
          share_of_traceable_barriers_pct: 27.8,
          ai_intervention: "Immediate deployment of TB Champion peer-survivor counsellor & clinical pharmacist within 24 hours of refusal."
        },
        {
          id: "migrated",
          barrier: "Untraceable — Out-Migration / Seasonal Labor",
          five_year_total: 519,
          annual_range: "73–136 cases/yr",
          share_of_traceable_barriers_pct: 15.2,
          ai_intervention: "Automated cross-district/inter-state Nikshay transfer token & portable 30-day FDC buffer kit."
        },
        {
          id: "not_on_treatment",
          barrier: "Not on Treatment (2025 Diagnostic-to-Initiation Lag)",
          five_year_total: 315,
          annual_range: "315 cases (2025)",
          share_of_traceable_barriers_pct: 13.8,
          ai_intervention: "Same-day starter FDC pack dispensed directly at diagnostic laboratory upon positive CBNAAT/Truenat result."
        }
      ]
    };
  },

  predictPretreatmentDropoff: function(profile) {
    const addr = profile.address_verified !== false;
    const phone = profile.phone_verified !== false;
    const migrant = Boolean(profile.is_migrant_worker);
    const stigma = Boolean(profile.stigma_or_refusal_history);
    const priv = String(profile.sector || "public").toLowerCase() === "private";
    const delay = Number(profile.diagnostic_delay_days || 5);

    let logit = -3.79;
    const scores = {
      "Untraceable — Incorrect / Unverified Address": 0.1,
      "Treatment Refusal / Stigma": 0.1,
      "Untraceable — Migrant Mobility": 0.1,
      "Diagnostic-to-Initiation Referral Lag": 0.1
    };

    if (!addr) { logit += 1.95; scores["Untraceable — Incorrect / Unverified Address"] += 0.65; }
    if (!phone) { logit += 1.40; scores["Untraceable — Incorrect / Unverified Address"] += 0.45; }
    if (migrant) { logit += 1.65; scores["Untraceable — Migrant Mobility"] += 0.70; }
    if (stigma) { logit += 1.85; scores["Treatment Refusal / Stigma"] += 0.75; }
    if (priv) { logit += 0.85; scores["Diagnostic-to-Initiation Referral Lag"] += 0.40; }
    if (delay > 14) { logit += 0.65; scores["Diagnostic-to-Initiation Referral Lag"] += 0.35; }

    const prob = 1.0 / (1.0 + Math.exp(-logit));
    const deathProb = prob * 0.4859;
    const primaryBarrier = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];

    let tier = "Low Drop-Off Risk";
    let protocol = "STANDARD LINKAGE: Routine Nikshay registration and DOTS initiation.";
    if (prob >= 0.25) {
      tier = "Critical Drop-Off Risk";
      protocol = "IMMEDIATE SAME-DAY STARTER FDC: Dispense 7-day starter pack at lab before patient leaves + GPS home pin + TB Champion peer escort.";
    } else if (prob >= 0.10) {
      tier = "High Drop-Off Risk";
      protocol = "URGENT 24-HOUR LINKAGE: Verify Aadhaar/mobile OTP at registration + assign ASHA home visit within 24 hours.";
    } else if (prob >= 0.04) {
      tier = "Moderate Drop-Off Risk";
      protocol = "ENHANCED TRACING: Confirm secondary family contact phone number + schedule 48-hour STS tele-confirmation.";
    }

    return {
      dropoff_probability_pct: Number((prob * 100).toFixed(1)),
      untreated_mortality_if_dropped_pct: 48.59,
      joint_preventable_death_risk_pct: Number((deathProb * 100).toFixed(2)),
      risk_tier: tier,
      primary_predicted_barrier: primaryBarrier,
      prescribed_linkage_protocol: protocol
    };
  }
};

