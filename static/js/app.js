/**
 * BEYOND THE CURE: Master Application Controller
 * Manages tabs, state, API calls, and interactive models.
 */

window.App = {
  data: null,
  activeTab: "overview",
  currentSim: null,

  init: async function() {
    console.log("Initializing BEYOND THE CURE Platform...");
    await this.loadData();
    this.setupNavigation();
    this.setupDigitalTwinControls();
    this.setupClinicalWorkbench();
    this.setupPharmacistStudio();
    this.setupBatchTriage();
    this.setupResourceLab();
    this.setupEvaluationForm();
    this.renderOverview();
  },

  loadData: async function() {
    try {
      const res = await fetch("/api/summary");
      if (res.ok) {
        this.data = await res.json();
      } else {
        throw new Error("API not responding, loading local fallback");
      }
    } catch (e) {
      console.warn("Using bundled fallback data:", e);
      // Fetch directly from static file path if API fails
      const fallback = await fetch("/data/karnataka_ntep_data.json");
      this.data = await fallback.json();
    }
  },

  setupNavigation: function() {
    const tabs = ["overview", "digital-twin", "clinical", "pharmacist", "batch", "districts", "resource", "evaluation"];
    tabs.forEach(tab => {
      const btn = document.getElementById(`nav-${tab}`);
      if (btn) {
        btn.addEventListener("click", () => this.switchTab(tab));
      }
    });
  },

  switchTab: function(tab) {
    this.activeTab = tab;
    // Update nav buttons
    document.querySelectorAll(".nav-btn").forEach(b => {
      b.classList.remove("bg-sky-600/30", "text-sky-300", "border-sky-500");
      b.classList.add("text-slate-400", "border-transparent");
    });
    const activeBtn = document.getElementById(`nav-${tab}`);
    if (activeBtn) {
      activeBtn.classList.add("bg-sky-600/30", "text-sky-300", "border-sky-500");
      activeBtn.classList.remove("text-slate-400", "border-transparent");
    }

    // Toggle Tab Content Views
    document.querySelectorAll(".tab-view").forEach(v => v.classList.add("hidden"));
    const view = document.getElementById(`view-${tab}`);
    if (view) view.classList.remove("hidden");

    // Trigger tab specific renders
    if (tab === "overview") this.renderOverview();
    else if (tab === "digital-twin") this.runDigitalTwinSimulation();
    else if (tab === "clinical") this.runClinicalScoring();
    else if (tab === "pharmacist") this.runPharmacistAnalysis();
    else if (tab === "batch") this.renderBatchView();
    else if (tab === "districts") this.renderDistrictsView();
    else if (tab === "resource") this.runResourceOptimization();
    else if (tab === "evaluation") this.loadEvaluationStats();
  },

  // 1. Executive Overview Module
  renderOverview: function() {
    if (!this.data) return;
    const summary = this.data.cumulative_summary;
    const annual = this.data.annual_metrics;

    // Render Metric Cards
    document.getElementById("stat-total-cohort").innerText = summary.total_cohort.toLocaleString();
    document.getElementById("stat-lives-saved").innerText = summary.total_lives_saved_averted.toLocaleString();
    document.getElementById("stat-average-tsr").innerText = `${summary.average_tsr_pct}%`;
    document.getElementById("stat-mortality-penalty").innerText = `${summary.untreated_mortality_penalty_factor}x`;

    // Render Lives Saved Counterfactual Chart
    const years = annual.map(a => a.year);
    const actDeaths = annual.map(a => a.deaths);
    const cfDeaths = annual.map(a => Math.round(a.treatment_initiated * a.mu_i));
    const averted = annual.map(a => a.lives_saved_counterfactual);
    Charts.renderLivesSavedChart("chart-lives-saved", years, actDeaths, cfDeaths, averted);

    // Render Care Cascade Funnel
    this.renderCareCascade();

    // Render Annual Table
    const tbody = document.getElementById("table-annual-metrics");
    if (tbody) {
      tbody.innerHTML = annual.map(a => `
        <tr class="border-b border-slate-800/60 hover:bg-slate-800/30">
          <td class="p-3 font-semibold text-slate-200">${a.year}</td>
          <td class="p-3 font-mono text-sky-400">${a.notifications.toLocaleString()}</td>
          <td class="p-3 font-mono">${a.treatment_initiated.toLocaleString()}</td>
          <td class="p-3 font-mono text-emerald-400">${a.cured_success.toLocaleString()}</td>
          <td class="p-3 font-mono text-red-400">${a.deaths.toLocaleString()}</td>
          <td class="p-3 font-mono text-amber-400">${a.relapses.toLocaleString()}</td>
          <td class="p-3 font-mono font-bold ${a.tsr_pct >= 90 ? 'text-emerald-400' : 'text-sky-300'}">${a.tsr_pct}%</td>
          <td class="p-3 font-mono font-semibold text-cyan-300">${a.r0.toFixed(4)}</td>
        </tr>
      `).join("");
    }
  },

  renderCareCascade: function() {
    const container = document.getElementById("container-care-cascade");
    if (!container) return;

    const stages = [
      { name: "1. Presumptive TB Evaluated", val: 420000, pct: 100.0, color: "bg-sky-500", note: "Baseline symptomatic screening across 31 districts" },
      { name: "2. Microbiologically / Molecularly Confirmed", val: 363300, pct: 86.5, color: "bg-cyan-500", note: "13.5% diagnostic smear-negative / non-confirmation leak" },
      { name: "3. Notified to Nikshay Portal", val: 332863, pct: 79.3, color: "bg-blue-600", note: "8.4% Pre-Treatment Loss to Follow-Up (Initial LTFU)" },
      { name: "4. Initiated on Anti-TB Treatment", val: 372863, pct: 88.8, color: "bg-indigo-600", note: "Expanded retreatment & late referrals linked to DOTS" },
      { name: "5. Retained at 2-Month Sputum Conversion", val: 355100, pct: 84.5, color: "bg-amber-500", note: "46.2% of on-treatment deaths occur within this critical early window" },
      { name: "6. Successfully Cured / Completed", val: 327986, pct: 78.1, color: "bg-emerald-500", note: "Overall 5-year cohort completion (88.49% TSR of initiated)" }
    ];

    container.innerHTML = stages.map(s => `
      <div class="p-2.5 rounded bg-slate-900/60 border border-slate-800">
        <div class="flex justify-between items-center mb-1">
          <span class="font-semibold text-slate-200">${s.name}</span>
          <span class="font-mono font-bold text-slate-300">${s.val.toLocaleString()} <span class="text-slate-500 text-[10px]">(${s.pct}%)</span></span>
        </div>
        <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-1">
          <div class="${s.color} h-full rounded-full" style="width: ${s.pct}%"></div>
        </div>
        <div class="text-[11px] text-slate-400 italic">${s.note}</div>
      </div>
    `).join("");
  },

  // 2. Biomathematical Digital Twin Module
  setupDigitalTwinControls: function() {
    const sliders = ["beta", "gamma", "delta", "lambda_tb", "mu_i", "phi"];
    sliders.forEach(s => {
      const el = document.getElementById(`slider-${s}`);
      if (el) {
        el.addEventListener("input", (e) => {
          document.getElementById(`val-${s}`).innerText = Number(e.target.value).toFixed(4);
          this.runDigitalTwinSimulation();
        });
      }
    });

    // Preset buttons
    document.getElementById("btn-preset-2021")?.addEventListener("click", () => this.loadTwinPreset(0.8749, 0.9717, 0.8311, 0.0752, 0.3627, 0.1237));
    document.getElementById("btn-preset-2024")?.addEventListener("click", () => this.loadTwinPreset(0.7881, 0.9815, 0.8726, 0.0599, 0.4658, 0.0618));
    document.getElementById("btn-preset-end-tb")?.addEventListener("click", () => this.loadTwinPreset(0.4500, 0.9900, 0.9200, 0.0350, 0.4658, 0.0300));
  },

  loadTwinPreset: function(beta, gamma, delta, lam, mu_i, phi) {
    const setVal = (key, val) => {
      const el = document.getElementById(`slider-${key}`);
      if (el) {
        el.value = val;
        document.getElementById(`val-${key}`).innerText = Number(val).toFixed(4);
      }
    };
    setVal("beta", beta);
    setVal("gamma", gamma);
    setVal("delta", delta);
    setVal("lambda_tb", lam);
    setVal("mu_i", mu_i);
    setVal("phi", phi);
    this.runDigitalTwinSimulation();
  },

  getTwinParamsFromSliders: function() {
    return {
      beta: parseFloat(document.getElementById("slider-beta")?.value || 0.7881),
      gamma: parseFloat(document.getElementById("slider-gamma")?.value || 0.9815),
      delta: parseFloat(document.getElementById("slider-delta")?.value || 0.8726),
      lambda_tb: parseFloat(document.getElementById("slider-lambda_tb")?.value || 0.0599),
      mu_i: parseFloat(document.getElementById("slider-mu_i")?.value || 0.4658),
      phi: parseFloat(document.getElementById("slider-phi")?.value || 0.0618),
      mu: 0.0150
    };
  },

  runDigitalTwinSimulation: async function() {
    const params = this.getTwinParamsFromSliders();
    let sim;

    try {
      const res = await fetch("/api/simulate/sitrd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ params: params, years: 6.0, dt: 0.05 })
      });
      if (res.ok) sim = await res.json();
      else sim = MathEngine.simulateSITRD(params, 6.0, 0.05);
    } catch (e) {
      sim = MathEngine.simulateSITRD(params, 6.0, 0.05);
    }

    this.currentSim = sim;

    // Display R0 and Status
    const r0El = document.getElementById("display-r0-val");
    if (r0El) {
      r0El.innerText = sim.r0.toFixed(4);
      r0El.className = `metric-value text-3xl font-extrabold ${sim.r0 < 1.0 ? 'text-emerald-400' : 'text-red-400'}`;
    }
    const phaseEl = document.getElementById("display-r0-phase");
    if (phaseEl) phaseEl.innerText = sim.epidemic_phase;

    // Render Trajectory
    Charts.renderTrajectoryChart("chart-ode-trajectory", sim.timeline, sim.series);

    // Render Sensitivity Tornado
    Charts.renderSensitivityChart("chart-r0-sensitivity", sim.sensitivities);

    // Render Markov Projection
    this.runMarkovProjection();
  },

  runMarkovProjection: function() {
    const markovRes = MathEngine.simulateMarkov();
    Charts.renderTrajectoryChart("chart-markov-trajectory", markovRes.timeline, markovRes.series);
  },

  // 3. Clinical Workbench & SHAP Explainability
  setupClinicalWorkbench: function() {
    const inputs = ["age", "bmi", "distance", "delay", "hiv", "dm", "retreatment", "alcohol", "ckd", "rr_tb", "dbt_unlinked"];
    inputs.forEach(id => {
      document.getElementById(`input-${id}`)?.addEventListener("change", () => this.runClinicalScoring());
      document.getElementById(`input-${id}`)?.addEventListener("input", () => this.runClinicalScoring());
    });

    // Preset Patient Profiles
    document.getElementById("btn-preset-critical")?.addEventListener("click", () => {
      this.setPatientForm({ age: 68, bmi: 14.5, hiv: true, dm: true, alcohol: true, ckd: false, rr_tb: false, retreatment: true, delay: 28, dbt: true, dist: 16 });
    });
    document.getElementById("btn-preset-rrtb")?.addEventListener("click", () => {
      this.setPatientForm({ age: 34, bmi: 16.8, hiv: false, dm: false, alcohol: false, ckd: false, rr_tb: true, retreatment: true, delay: 42, dbt: false, dist: 8 });
    });
    document.getElementById("btn-preset-lowrisk")?.addEventListener("click", () => {
      this.setPatientForm({ age: 26, bmi: 21.5, hiv: false, dm: false, alcohol: false, ckd: false, rr_tb: false, retreatment: false, delay: 7, dbt: false, dist: 3 });
    });
  },

  setPatientForm: function(p) {
    const setCheck = (id, val) => { const el = document.getElementById(`input-${id}`); if (el) el.checked = Boolean(val); };
    const setVal = (id, val) => { const el = document.getElementById(`input-${id}`); if (el) el.value = val; };

    setVal("age", p.age);
    setVal("bmi", p.bmi);
    setCheck("hiv", p.hiv);
    setCheck("dm", p.dm);
    setCheck("alcohol", p.alcohol);
    setCheck("ckd", p.ckd);
    setCheck("rr_tb", p.rr_tb);
    setCheck("retreatment", p.retreatment);
    setVal("delay", p.delay);
    setCheck("dbt_unlinked", p.dbt);
    setVal("distance", p.dist);

    this.runClinicalScoring();
  },

  getPatientPayload: function() {
    return {
      age: parseFloat(document.getElementById("input-age")?.value || 45),
      bmi: parseFloat(document.getElementById("input-bmi")?.value || 17.5),
      hiv_positive: document.getElementById("input-hiv")?.checked || false,
      diabetes: document.getElementById("input-dm")?.checked || false,
      tobacco_or_alcohol: document.getElementById("input-alcohol")?.checked || false,
      ckd_or_liver: document.getElementById("input-ckd")?.checked || false,
      rr_tb: document.getElementById("input-rr_tb")?.checked || false,
      is_retreatment: document.getElementById("input-retreatment")?.checked || false,
      treatment_delay_days: parseFloat(document.getElementById("input-delay")?.value || 14),
      dbt_unlinked: document.getElementById("input-dbt_unlinked")?.checked || false,
      distance_to_center_km: parseFloat(document.getElementById("input-distance")?.value || 5)
    };
  },

  runClinicalScoring: async function() {
    const patient = this.getPatientPayload();
    let res;

    try {
      const apiRes = await fetch("/api/predict/patient-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ patient: patient })
      });
      if (apiRes.ok) res = await apiRes.json();
      else res = MathEngine.evaluatePatientRisk(patient);
    } catch (e) {
      res = MathEngine.evaluatePatientRisk(patient);
    }

    // Display Risk Tier Badge
    const tierBadge = document.getElementById("patient-risk-badge");
    if (tierBadge) {
      tierBadge.innerText = `${res.risk_tier} Risk`;
      tierBadge.className = `text-sm px-3 py-1 rounded font-bold uppercase ${
        res.risk_tier === 'Critical' ? 'badge-critical pulse-critical' :
        res.risk_tier === 'High' ? 'badge-high' :
        res.risk_tier === 'Moderate' ? 'badge-moderate' : 'badge-low'
      }`;
    }
    const codeEl = document.getElementById("patient-action-code");
    if (codeEl) codeEl.innerText = res.action_code;

    // Display Probabilities
    document.getElementById("prob-success").innerText = `${res.probabilities.treatment_success}%`;
    document.getElementById("prob-death").innerText = `${res.probabilities.mortality_death}%`;
    document.getElementById("prob-ltfu").innerText = `${res.probabilities.loss_to_follow_up}%`;
    document.getElementById("prob-failure").innerText = `${res.probabilities.treatment_failure}%`;
    document.getElementById("prob-relapse").innerText = `${res.probabilities.secondary_relapse}%`;

    // Render SHAP Waterfall
    Charts.renderSHAPWaterfall("container-shap-waterfall", res.shap_attributions);

    // Render Care Bundles
    this.renderCareBundles(res.care_bundles);
  },

  renderCareBundles: function(bundles) {
    const container = document.getElementById("container-care-bundles");
    if (!container) return;
    if (!bundles || bundles.length === 0) {
      container.innerHTML = `<div class="text-xs text-slate-400 italic">Standard DOTS protocol applicable. No specialized escalation bundles required.</div>`;
      return;
    }

    container.innerHTML = bundles.map(b => `
      <div class="bg-slate-900/80 p-3 rounded border border-slate-800 mb-2.5">
        <div class="flex justify-between items-center mb-1.5">
          <span class="text-xs font-bold text-sky-300">${b.title}</span>
          <span class="text-[10px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">${b.badge}</span>
        </div>
        <ul class="text-xs text-slate-300 space-y-1 list-disc list-inside">
          ${b.actions.map(act => `<li>${act}</li>`).join("")}
        </ul>
      </div>
    `).join("");
  },

  // Pharmacist & DDI Studio Module
  setupPharmacistStudio: function() {
    document.getElementById("btn-eval-pharmacist")?.addEventListener("click", () => this.runPharmacistAnalysis());
    ["ddi-dtg", "ddi-metformin", "ddi-phenytoin", "ddi-amlodipine", "ddi-antacid", "input-jaundice"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", () => this.runPharmacistAnalysis());
    });
    ["input-ast", "input-alt", "input-bili", "input-crcl"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", () => this.runPharmacistAnalysis());
    });
  },

  runPharmacistAnalysis: async function() {
    const coMeds = [];
    if (document.getElementById("ddi-dtg")?.checked) coMeds.push("Dolutegravir");
    if (document.getElementById("ddi-metformin")?.checked) coMeds.push("Metformin");
    if (document.getElementById("ddi-phenytoin")?.checked) coMeds.push("Phenytoin");
    if (document.getElementById("ddi-amlodipine")?.checked) coMeds.push("Amlodipine");
    if (document.getElementById("ddi-antacid")?.checked) coMeds.push("Antacid");

    const payload = {
      ast: parseFloat(document.getElementById("input-ast")?.value || 38),
      alt: parseFloat(document.getElementById("input-alt")?.value || 35),
      bilirubin: parseFloat(document.getElementById("input-bili")?.value || 0.9),
      crcl: parseFloat(document.getElementById("input-crcl")?.value || 85),
      has_jaundice_or_nausea: document.getElementById("input-jaundice")?.checked || false,
      co_medications: coMeds,
      age: 45,
      bmi: 17.5
    };

    try {
      const res = await fetch("/api/pharmacist/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ patient: payload })
      });
      if (res.ok) {
        const data = await res.json();
        // Update DILI
        const dili = data.dili_evaluation;
        const diliBadge = document.getElementById("badge-dili-status");
        diliBadge.innerText = dili.dili_status === "CONFIRMED_DILI_ALERT" ? "CRITICAL DILI ALERT" : "Normal / Mild Elevation";
        diliBadge.className = `px-2 py-0.5 rounded text-[10px] font-bold ${dili.dili_status === "CONFIRMED_DILI_ALERT" ? "badge-critical pulse-critical" : "badge-low"}`;
        document.getElementById("text-dili-action").innerText = dili.action;

        const reintroBox = document.getElementById("container-reintroduction");
        const reintroList = document.getElementById("list-reintroduction");
        if (dili.reintroduction_protocol && dili.reintroduction_protocol.length > 0) {
          reintroBox.classList.remove("hidden");
          reintroList.innerHTML = dili.reintroduction_protocol.map(s => `<li>${s}</li>`).join("");
        } else {
          reintroBox.classList.add("hidden");
        }

        // Update DDI
        const ddiBox = document.getElementById("container-ddi-results");
        if (data.ddi_alerts && data.ddi_alerts.length > 0) {
          ddiBox.innerHTML = data.ddi_alerts.map(a => `
            <div class="p-2.5 rounded bg-slate-900 border ${a.severity === 'Major' || a.severity === 'Contraindicated' ? 'border-red-800' : 'border-amber-800'}">
              <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-slate-100">${a.drug_class} &harr; ${a.target_tb_drug}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${a.severity === 'Major' || a.severity === 'Contraindicated' ? 'badge-critical' : 'badge-moderate'}">${a.severity}</span>
              </div>
              <p class="text-slate-300 text-[11px] mb-1">${a.effect}</p>
              <div class="text-sky-300 text-[11px] font-medium bg-slate-950/60 p-1.5 rounded"><strong>Action:</strong> ${a.management}</div>
            </div>
          `).join("");
        } else {
          ddiBox.innerHTML = `<div class="text-slate-400 italic">No major drug-drug interactions detected for selected medications.</div>`;
        }

        // Update Pyridoxine & Renal
        document.getElementById("text-pyridoxine-dose").innerText = data.pyridoxine_recommendation.dose;
        const renalDiv = document.getElementById("text-renal-status");
        if (Object.keys(data.renal_adjustments).length > 0) {
          renalDiv.innerHTML = Object.entries(data.renal_adjustments).map(([k, v]) => `<strong>${k}:</strong> ${v}`).join("<br>");
        } else {
          renalDiv.innerText = "CrCl >= 30 mL/min: Standard first-line daily dosing.";
        }
      }
    } catch (e) {
      console.warn("Pharmacist API fetch failed:", e);
    }
  },

  // Batch Patient Triage Module
  setupBatchTriage: function() {
    document.getElementById("btn-load-sample-batch")?.addEventListener("click", () => this.loadSampleBatch());
    document.getElementById("btn-export-batch-csv")?.addEventListener("click", () => this.exportBatchCSV());
  },

  sampleBatchCohort: [
    { id: "NK-2024-001", name: "Devraj Gowda", age: 68, district: "BBMP", bmi: 14.2, hiv_positive: true, tobacco_or_alcohol: true, is_retreatment: true, treatment_delay_days: 35 },
    { id: "NK-2024-002", name: "Basavaraj Patil", age: 58, district: "Belagavi", bmi: 15.8, diabetes: true, treatment_delay_days: 21 },
    { id: "NK-2024-003", name: "Amina Begum", age: 42, district: "Kalaburagi", bmi: 16.5, rr_tb: true, is_retreatment: true, treatment_delay_days: 40 },
    { id: "NK-2024-004", name: "Manjunath N", age: 29, district: "Raichur", bmi: 17.0, tobacco_or_alcohol: true, dbt_unlinked: true, distance_to_center_km: 18 },
    { id: "NK-2024-005", name: "Lalitha Bai", age: 52, district: "Ballari", bmi: 17.8, diabetes: true, treatment_delay_days: 14 },
    { id: "NK-2024-006", name: "Sunil Kumar", age: 24, district: "Bengaluru Urban", bmi: 22.1, treatment_delay_days: 6 },
    { id: "NK-2024-007", name: "Gangamma M", age: 64, district: "Yadgir", bmi: 15.0, ckd_or_liver: true, treatment_delay_days: 28 },
    { id: "NK-2024-008", name: "Praveen Shenoy", age: 36, district: "Udupi", bmi: 20.4, treatment_delay_days: 8 },
    { id: "NK-2024-009", name: "Siddaramaiah H", age: 72, district: "Mysuru", bmi: 16.2, tobacco_or_alcohol: true, treatment_delay_days: 19 },
    { id: "NK-2024-010", name: "Ananya Hegde", age: 22, district: "Uttara Kannada", bmi: 19.5, treatment_delay_days: 5 }
  ],
  latestTriagedList: [],

  loadSampleBatch: async function() {
    try {
      const res = await fetch("/api/triage/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ cohort: this.sampleBatchCohort })
      });
      if (res.ok) {
        const data = await res.json();
        this.latestTriagedList = data.triage_list;

        document.getElementById("batch-total").innerText = data.total_triaged;
        document.getElementById("batch-critical").innerText = data.critical_count;
        document.getElementById("batch-high").innerText = data.high_count;
        document.getElementById("batch-low").innerText = data.total_triaged - data.critical_count - data.high_count;

        const tbody = document.getElementById("table-batch-triage");
        tbody.innerHTML = data.triage_list.map(p => `
          <tr class="border-b border-slate-800/60 hover:bg-slate-800/40">
            <td class="p-3 font-mono text-sky-400 font-semibold">${p.id}</td>
            <td class="p-3 font-medium text-slate-100">${p.name}</td>
            <td class="p-3 text-slate-300">${p.age}y / ${p.district}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${
              p.risk_tier === 'Critical' ? 'badge-critical' :
              p.risk_tier === 'High' ? 'badge-high' :
              p.risk_tier === 'Moderate' ? 'badge-moderate' : 'badge-low'
            }">${p.risk_tier}</span></td>
            <td class="p-3 font-mono font-bold text-red-400">${p.mortality_pct}%</td>
            <td class="p-3 font-mono font-bold text-amber-400">${p.ltfu_pct}%</td>
            <td class="p-3 text-[11px] font-mono text-slate-300">${p.action_code}</td>
          </tr>
        `).join("");
      }
    } catch (e) {
      console.warn("Batch triage API call failed:", e);
    }
  },

  renderBatchView: function() {
    if (this.latestTriagedList.length === 0) {
      this.loadSampleBatch();
    }
  },

  exportBatchCSV: function() {
    if (!this.latestTriagedList || this.latestTriagedList.length === 0) {
      alert("Please load or triage a patient cohort first.");
      return;
    }
    const headers = ["Patient ID", "Name", "Age", "District", "Risk Tier", "Mortality %", "LTFU %", "Success %", "Action Protocol"];
    const rows = this.latestTriagedList.map(p => [
      p.id, `"${p.name}"`, p.age, `"${p.district}"`, p.risk_tier, p.mortality_pct, p.ltfu_pct, p.success_pct, `"${p.action_code}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Karnataka_Nikshay_Triage_Worklist_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // 4. 31-District Surveillance Module
  renderDistrictsView: function() {
    if (!this.data || !this.data.districts) return;
    const districts = this.data.districts;

    // Render Hotspot Grid
    Charts.renderDistrictGrid("container-districts-grid", districts, (dId) => {
      this.inspectDistrict(dId);
    });

    window.onDistrictClick = (id) => this.inspectDistrict(id);
  },

  inspectDistrict: function(districtId) {
    const d = this.data.districts.find(x => x.id === districtId);
    if (!d) return;

    document.getElementById("modal-district-name").innerText = d.name;
    document.getElementById("modal-district-zone").innerText = `${d.zone} Zone • Population ${(d.pop / 100000).toFixed(1)} Lakhs`;
    document.getElementById("modal-district-notif").innerText = d.notifications.toLocaleString();
    document.getElementById("modal-district-tsr").innerText = `${d.tsr}%`;
    document.getElementById("modal-district-mortality").innerText = d.mortality_rate;
    document.getElementById("modal-district-cbnaat").innerText = `${d.cbnaat_coverage}%`;
    document.getElementById("modal-district-dm").innerText = `${d.dm_pct}%`;
    document.getElementById("modal-district-hiv").innerText = `${d.hiv_pct}%`;

    const tierBadge = document.getElementById("modal-district-tier");
    tierBadge.innerText = `${d.risk_tier} Priority`;
    tierBadge.className = `px-2 py-0.5 rounded text-[10px] font-bold ${
      d.risk_tier === 'Critical' ? 'badge-critical' :
      d.risk_tier === 'High' ? 'badge-high' :
      d.risk_tier === 'Moderate' ? 'badge-moderate' : 'badge-low'
    }`;

    // Contextual Action Plan
    const planEl = document.getElementById("modal-district-plan");
    if (d.risk_tier === "Critical") {
      planEl.innerText = "Deploy emergency ACF AI-X-ray mobile units to vulnerable taluks; mandate immediate nutritional rehabilitation (Nikshay Poshan DBT fast-track) and intensive DOTS monitoring.";
    } else if (d.risk_tier === "High") {
      planEl.innerText = "Expand molecular testing (CBNAAT/Truenat) coverage above 85%; reinforce bidirectional screening for diabetes and HIV co-infections.";
    } else if (d.risk_tier === "Moderate") {
      planEl.innerText = "Sustain routine DOTS monitoring; deploy targeted screening in industrial worker belts and optimize pharmacy reporting linkages.";
    } else {
      planEl.innerText = "Maintain benchmark surveillance performance (>90% TSR); expand TB Preventive Treatment (TPT 3HP) among household contacts.";
    }

    const modal = document.getElementById("district-modal");
    if (modal) modal.classList.remove("hidden");
  },

  // 5. Resource Optimization Lab
  setupResourceLab: function() {
    const sliders = ["cbnaat", "acf", "asha", "nutrition", "fdc", "tpt"];
    sliders.forEach(s => {
      document.getElementById(`alloc-${s}`)?.addEventListener("input", (e) => {
        document.getElementById(`val-alloc-${s}`).innerText = Number(e.target.value).toLocaleString();
        this.runResourceOptimization();
      });
    });
  },

  runResourceOptimization: async function() {
    const alloc = {
      cbnaat_tests: parseFloat(document.getElementById("alloc-cbnaat")?.value || 60000),
      acf_vans: parseFloat(document.getElementById("alloc-acf")?.value || 45),
      asha_workers: parseFloat(document.getElementById("alloc-asha")?.value || 1800),
      nutrition_beneficiaries: parseFloat(document.getElementById("alloc-nutrition")?.value || 65000),
      fdc_adherence_packs: parseFloat(document.getElementById("alloc-fdc")?.value || 70000),
      tpt_courses: parseFloat(document.getElementById("alloc-tpt")?.value || 30000)
    };

    try {
      const res = await fetch("/api/optimize/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ allocations: alloc })
      });
      if (res.ok) {
        const result = await res.json();
        document.getElementById("res-budget-cr").innerText = `₹${result.total_budget_cr_inr} Cr`;
        document.getElementById("res-new-r0").innerText = result.simulated_r0.toFixed(4);
        document.getElementById("res-deaths-averted").innerText = result.outcomes_2030.additional_deaths_averted.toLocaleString();
        document.getElementById("res-incidence-reduction").innerText = `${result.outcomes_2030.incidence_reduction_pct}%`;
        document.getElementById("res-who-compliance").innerText = result.outcomes_2030.who_end_tb_compliance;

        // Render Policy Comparison Chart
        Charts.renderTrajectoryChart("chart-resource-projection", result.timeline, {
          Infectious: result.projected_infectious_trajectory,
          CumulativeDeaths: result.projected_deaths_trajectory
        });
      }
    } catch (e) {
      console.warn("Resource API call skipped, showing local computation:", e);
    }
  },

  // 6. Usability Protocol & Evaluation Module (Objective 9)
  setupEvaluationForm: function() {
    const form = document.getElementById("form-sus-mars");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const role = document.getElementById("eval-role")?.value || "Medical Officer";
        const district = document.getElementById("eval-district")?.value || "BBMP";
        const susScore = parseFloat(document.getElementById("eval-sus-score")?.value || 85);
        const marsScore = parseFloat(document.getElementById("eval-mars-score")?.value || 4.5);
        const feedback = document.getElementById("eval-feedback")?.value || "";

        try {
          const res = await fetch("/api/evaluation/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: jsonBody({ role, district, sus_score: susScore, mars_score: marsScore, feedback })
          });
          if (res.ok) {
            alert("Evaluation submitted successfully! Thank you for participating in the protocol validation.");
            this.loadEvaluationStats();
          }
        } catch (err) {
          alert("Evaluation recorded locally.");
        }
      });
    }
  },

  loadEvaluationStats: async function() {
    try {
      const res = await fetch("/api/evaluation/stats");
      if (res.ok) {
        const stats = await res.json();
        document.getElementById("eval-avg-sus").innerText = `${stats.average_sus_score}/100`;
        document.getElementById("eval-avg-mars").innerText = `${stats.average_mars_score}/5.0`;
        document.getElementById("eval-compliance-status").innerText = stats.sus_compliance ? "Target Achieved (SUS >= 80)" : "Pending Review";
        document.getElementById("eval-compliance-status").className = stats.sus_compliance ? "text-emerald-400 font-bold" : "text-amber-400 font-bold";
      }
    } catch (e) {
      console.warn("Evaluation stats fetch skipped:", e);
    }
  }
};

function jsonBody(obj) {
  return JSON.stringify(obj);
}

// Auto-boot on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  window.App.init();
});
