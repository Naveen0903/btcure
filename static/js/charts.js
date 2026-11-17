/**
 * BEYOND THE CURE: High-Performance Canvas & SVG Interactive Visualization Engine
 * Zero external library dependencies - fully native, retina-crisp, and interactive.
 */

window.Charts = {
  // Utility for High DPI Canvas
  _setupCanvas: function(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { ctx, width: rect.width, height: rect.height };
  },

  // 1. Multi-line SITRD Epidemic Trajectory Chart
  renderTrajectoryChart: function(canvasId, timeline, series) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, width, height } = this._setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);
    const padLeft = 65, padRight = 30, padTop = 30, padBottom = 45;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Palette
    const colors = {
      Infectious: "#ef4444",
      Treated: "#38bdf8",
      Recovered: "#22c55e",
      CumulativeDeaths: "#f59e0b"
    };

    // Calculate Max Value (excluding Susceptible for scale visibility)
    let maxVal = 10000;
    Object.keys(colors).forEach(key => {
      if (series[key]) {
        const m = Math.max(...series[key]);
        if (m > maxVal) maxVal = m;
      }
    });
    maxVal = Math.ceil(maxVal * 1.15);

    // Draw Grid Lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.lineWidth = 1;
    const ySteps = 5;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.textAlign = "right";

    for (let i = 0; i <= ySteps; i++) {
      const yVal = (maxVal / ySteps) * i;
      const yPos = padTop + chartH - (i / ySteps) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(width - padRight, yPos);
      ctx.stroke();
      ctx.fillText(Math.round(yVal).toLocaleString(), padLeft - 8, yPos + 4);
    }

    // X Axis Labels
    ctx.textAlign = "center";
    const xSteps = timeline.length;
    const stepInterval = Math.max(1, Math.floor(xSteps / 6));
    for (let i = 0; i < xSteps; i += stepInterval) {
      const xPos = padLeft + (i / (xSteps - 1)) * chartW;
      ctx.fillText(timeline[i].toFixed(1), xPos, height - padBottom + 18);
    }

    // Draw Curves
    Object.keys(colors).forEach(key => {
      const data = series[key];
      if (!data || data.length === 0) return;

      ctx.strokeStyle = colors[key];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = padLeft + (i / (data.length - 1)) * chartW;
        const y = padTop + chartH - (data[i] / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // End point circle
      const lastX = padLeft + chartW;
      const lastY = padTop + chartH - (data[data.length - 1] / maxVal) * chartH;
      ctx.fillStyle = colors[key];
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Legend
    let legendX = padLeft;
    ctx.font = "11px sans-serif";
    Object.keys(colors).forEach(key => {
      ctx.fillStyle = colors[key];
      ctx.fillRect(legendX, 10, 12, 12);
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(key, legendX + 16, 20);
      legendX += ctx.measureText(key).width + 35;
    });
  },

  // 2. Normalized Sensitivity Tornado Chart
  renderSensitivityChart: function(canvasId, sensitivities) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, width, height } = this._setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);
    const padLeft = 140, padRight = 60, padTop = 35, padBottom = 20;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const data = [
      { name: "Beta (Transmission)", val: sensitivities.Gamma_beta || 1.0, color: "#ef4444" },
      { name: "Gamma (Notification)", val: sensitivities.Gamma_gamma || -0.67, color: "#38bdf8" },
      { name: "Mu_i (Untreated Death)", val: sensitivities.Gamma_mu_i || -0.32, color: "#f59e0b" },
      { name: "Mu (Natural Death)", val: sensitivities.Gamma_mu || -0.01, color: "#94a3b8" }
    ];

    const barH = 24;
    const zeroX = padLeft + chartW * 0.6; // Center zero around 60%

    // Draw Zero Axis
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(zeroX, padTop - 10);
    ctx.lineTo(zeroX, height - padBottom);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("0.0 (Zero Elasticity)", zeroX, padTop - 14);

    data.forEach((item, idx) => {
      const y = padTop + idx * (barH + 16);

      // Label
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(item.name, padLeft - 10, y + 16);

      // Bar
      const pxPerUnit = (chartW * 0.35);
      const barW = item.val * pxPerUnit;
      ctx.fillStyle = item.color;

      if (barW >= 0) {
        ctx.fillRect(zeroX, y, barW, barH);
        ctx.textAlign = "left";
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(`+${item.val.toFixed(4)}`, zeroX + barW + 6, y + 16);
      } else {
        ctx.fillRect(zeroX + barW, y, -barW, barH);
        ctx.textAlign = "right";
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(`${item.val.toFixed(4)}`, zeroX + barW - 6, y + 16);
      }
    });
  },

  // 3. Counterfactual Lives Saved Comparison Chart
  renderLivesSavedChart: function(canvasId, years, actualDeaths, cfDeaths, averted) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const { ctx, width, height } = this._setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);
    const padLeft = 60, padRight = 30, padTop = 30, padBottom = 40;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const maxVal = 40000;
    const numBars = years.length;
    const groupW = chartW / numBars;
    const barW = Math.min(32, groupW * 0.35);

    // Draw Grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const yVal = (maxVal / 4) * i;
      const yPos = padTop + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(width - padRight, yPos);
      ctx.stroke();
      ctx.fillText(Math.round(yVal).toLocaleString(), padLeft - 6, yPos + 4);
    }

    years.forEach((yr, i) => {
      const centerX = padLeft + i * groupW + groupW / 2;

      // Untreated Counterfactual Bar (Red)
      const cfH = (cfDeaths[i] / maxVal) * chartH;
      ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
      ctx.fillRect(centerX - barW, padTop + chartH - cfH, barW, cfH);

      // Actual Treated Bar (Sky Blue)
      const actH = (actualDeaths[i] / maxVal) * chartH;
      ctx.fillStyle = "#0284c7";
      ctx.fillRect(centerX, padTop + chartH - actH, barW, actH);

      // Label
      ctx.fillStyle = "#cbd5e1";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(yr, centerX, height - padBottom + 18);

      // Averted callout
      ctx.fillStyle = "#4ade80";
      ctx.font = "10px monospace";
      ctx.fillText(`+${(averted[i] / 1000).toFixed(1)}k`, centerX, padTop + chartH - cfH - 6);
    });

    // Legend
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
    ctx.fillRect(padLeft, 10, 10, 10);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("Without Treatment (Counterfactual)", padLeft + 15, 18);

    ctx.fillStyle = "#0284c7";
    ctx.fillRect(padLeft + 220, 10, 10, 10);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("NTEP Observed Deaths", padLeft + 235, 18);
  },

  // 4. SHAP Waterfall Attribution List
  renderSHAPWaterfall: function(containerId, attributions) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!attributions || attributions.length === 0) {
      container.innerHTML = `<div class="text-gray-400 text-sm italic">No risk attribution factors loaded.</div>`;
      return;
    }

    let html = `<div class="space-y-3">`;
    attributions.forEach(item => {
      const impact = item.impact_death || 0;
      const isRisk = impact > 0;
      const pctWidth = Math.min(100, Math.abs(impact) * 240);
      const color = isRisk ? "bg-red-500" : "bg-emerald-500";
      const textColor = isRisk ? "text-red-400" : "text-emerald-400";
      const sign = isRisk ? "+" : "-";

      html += `
        <div class="bg-slate-900/60 p-2.5 rounded border border-slate-800">
          <div class="flex justify-between items-center mb-1 text-xs">
            <span class="font-medium text-slate-200">${item.factor}</span>
            <span class="font-mono font-bold ${textColor}">${sign}${(Math.abs(impact) * 100).toFixed(1)}%</span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
            <div class="${color} h-full rounded-full transition-all duration-300" style="width: ${pctWidth}%"></div>
          </div>
          ${item.evidence ? `<p class="text-[11px] text-slate-400 mt-1.5 leading-tight">${item.evidence}</p>` : ''}
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  },

  // 5. 31-District Interactive Geospatial Hotspot Grid
  renderDistrictGrid: function(containerId, districts, onSelectDistrict) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">`;

    districts.forEach(d => {
      let badgeClass = "badge-low";
      if (d.risk_tier === "Critical") badgeClass = "badge-critical pulse-critical";
      else if (d.risk_tier === "High") badgeClass = "badge-high";
      else if (d.risk_tier === "Moderate") badgeClass = "badge-moderate";

      html += `
        <div class="district-card glass-card p-3.5 flex flex-col justify-between" onclick="window.onDistrictClick('${d.id}')">
          <div>
            <div class="flex justify-between items-start mb-1.5">
              <h4 class="font-semibold text-slate-100 text-sm">${d.name}</h4>
              <span class="text-[10px] px-2 py-0.5 rounded font-mono ${badgeClass}">${d.risk_tier}</span>
            </div>
            <div class="text-xs text-slate-400 mb-2">${d.zone} Zone • Pop ${(d.pop / 100000).toFixed(1)}L</div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/80">
            <div>
              <div class="text-[10px] text-slate-400 uppercase">Annual Notif</div>
              <div class="font-mono font-bold text-sky-400">${d.notifications.toLocaleString()}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 uppercase">TSR Rate</div>
              <div class="font-mono font-bold ${d.tsr >= 90 ? 'text-emerald-400' : 'text-amber-400'}">${d.tsr}%</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 uppercase">Mortality /100k</div>
              <div class="font-mono font-bold ${d.mortality_rate >= 6.5 ? 'text-red-400' : 'text-slate-300'}">${d.mortality_rate}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 uppercase">DM Co-morb</div>
              <div class="font-mono font-bold text-slate-300">${d.dm_pct}%</div>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  // 6. AI Expected-vs-Observed (O/E) Control & Anomaly Chart (Objective 3)
  renderOEAnomalyChart: function(canvasId, anomalies) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !anomalies || anomalies.length === 0) return;
    const { ctx, width, height } = this._setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);
    const padLeft = 55, padRight = 25, padTop = 30, padBottom = 40;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const minVal = 3.8, maxVal = 7.6;
    const toX = val => padLeft + ((val - minVal) / (maxVal - minVal)) * chartW;
    const toY = val => padTop + chartH - ((val - minVal) / (maxVal - minVal)) * chartH;

    // Grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    for (let v = 4.0; v <= 7.5; v += 0.7) {
      const y = toY(v);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(v.toFixed(1), padLeft - 6, y + 3);

      const x = toX(v);
      ctx.textAlign = "center";
      ctx.fillText(v.toFixed(1), x, height - padBottom + 16);
    }

    // Axis titles
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AI Model Expected Mortality (/100k)", padLeft + chartW / 2, height - 6);

    // Draw O/E = 1.0 Parity Line
    ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(minVal), toY(minVal));
    ctx.lineTo(toX(maxVal), toY(maxVal));
    ctx.stroke();

    // Draw Upper Anomaly Threshold Line (O/E = 1.10)
    ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
    ctx.beginPath();
    ctx.moveTo(toX(minVal), toY(minVal * 1.10));
    ctx.lineTo(toX(maxVal / 1.10), toY(maxVal));
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot each of the 31 districts
    anomalies.forEach(d => {
      const x = toX(d.expected_mortality);
      const y = toY(d.observed_mortality);
      let color = "#38bdf8";
      if (d.anomaly_status === "CRITICAL_ANOMALY") color = "#ef4444";
      else if (d.anomaly_status === "WARNING_DISCREPANCY") color = "#f97316";
      else if (d.anomaly_status === "UNDER_NOTIFICATION_GAP") color = "#eab308";
      else if (d.anomaly_status === "OPTIMAL_BENCHMARK") color = "#22c55e";

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, d.anomaly_status === "CRITICAL_ANOMALY" ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Label notable outliers
      if (d.anomaly_status === "CRITICAL_ANOMALY" || d.anomaly_status === "OPTIMAL_BENCHMARK") {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(d.district_name.split(" ")[0], x + 7, y + 3);
      }
    });

    // Legend
    const leg = [
      { label: "Critical (O/E>=1.10)", color: "#ef4444" },
      { label: "Warning", color: "#f97316" },
      { label: "Under-Notif", color: "#eab308" },
      { label: "Benchmark", color: "#22c55e" }
    ];
    let lx = padLeft;
    ctx.font = "10px sans-serif";
    leg.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(lx + 4, 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "left";
      ctx.fillText(item.label, lx + 11, 17);
      lx += ctx.measureText(item.label).width + 24;
    });
  },

  // 7. Feature 3: Longitudinal 6-Month Survival & LTFU Hazard Curve
  renderSurvivalHazardChart: function(canvasId, survival) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !survival || !survival.months) return;
    const { ctx, width, height } = this._setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);
    const padLeft = 48, padRight = 25, padTop = 30, padBottom = 38;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Grid (0% to 100%)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    for (let i = 0; i <= 5; i++) {
      const pct = i * 20;
      const y = padTop + chartH - (pct / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(`${pct}%`, padLeft - 6, y + 3);
    }

    const months = survival.months;
    ctx.textAlign = "center";
    months.forEach((m, idx) => {
      const x = padLeft + (idx / (months.length - 1)) * chartW;
      ctx.fillText(m.split(" ")[0], x, height - padBottom + 16);
    });

    const drawSeries = (arr, color) => {
      if (!arr) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      arr.forEach((v, idx) => {
        const x = padLeft + (idx / (arr.length - 1)) * chartW;
        const y = padTop + chartH - (v / 100) * chartH;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      arr.forEach((v, idx) => {
        const x = padLeft + (idx / (arr.length - 1)) * chartW;
        const y = padTop + chartH - (v / 100) * chartH;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    drawSeries(survival.retention_survival_pct, "#22c55e");
    drawSeries(survival.cumulative_ltfu_hazard_pct, "#f59e0b");
    drawSeries(survival.cumulative_mortality_hazard_pct, "#ef4444");

    // Legend
    const leg = [
      { label: "Event-Free Retention S(t)", color: "#22c55e" },
      { label: "LTFU Hazard", color: "#f59e0b" },
      { label: "Mortality Hazard", color: "#ef4444" }
    ];
    let lx = padLeft;
    ctx.font = "10px sans-serif";
    leg.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, 10, 10, 10);
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(item.label, lx + 14, 18);
      lx += ctx.measureText(item.label).width + 26;
    });
  },

  // 8. Feature 4: Multi-Model Time-Series Forecast & Structural Break Chart (2021-2030)
  renderForecastChart: function(canvasId, fc) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !fc || !fc.years) return;
    const { ctx, width, height } = this._setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);
    const padLeft = 65, padRight = 25, padTop = 32, padBottom = 38;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const allVals = [
      ...(fc.ols_trajectory || []),
      ...(fc.piecewise_trajectory || []),
      ...(fc.ci_95_upper || []),
      ...(fc.ci_95_lower || []),
      ...(fc.observed_2021_2025 || []).filter(v => v !== null)
    ];
    const minVal = Math.max(0, Math.floor(Math.min(...allVals) * 0.85));
    const maxVal = Math.ceil(Math.max(...allVals) * 1.10);
    const range = Math.max(100, maxVal - minVal);

    const toX = idx => padLeft + (idx / (fc.years.length - 1)) * chartW;
    const toY = val => padTop + chartH - ((val - minVal) / range) * chartH;

    // Grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    for (let i = 0; i <= 4; i++) {
      const v = minVal + (range / 4) * i;
      const y = toY(v);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(Math.round(v).toLocaleString(), padLeft - 6, y + 3);
    }

    // X Axis Years
    ctx.textAlign = "center";
    fc.years.forEach((yr, idx) => {
      ctx.fillText(yr, toX(idx), height - padBottom + 16);
    });

    // 2024 Structural Break Vertical Marker
    const breakX = toX(3);
    ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(breakX, padTop);
    ctx.lineTo(breakX, padTop + chartH);
    ctx.stroke();
    ctx.setLineDash([]);

    // 95% Confidence Band (2025-2030)
    if (fc.ci_95_upper && fc.ci_95_lower) {
      ctx.fillStyle = "rgba(34, 197, 94, 0.14)";
      ctx.beginPath();
      for (let i = 4; i < fc.years.length; i++) {
        const x = toX(i);
        const y = toY(fc.ci_95_upper[i]);
        if (i === 4) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let i = fc.years.length - 1; i >= 4; i--) {
        ctx.lineTo(toX(i), toY(fc.ci_95_lower[i]));
      }
      ctx.closePath();
      ctx.fill();
    }

    // OLS Dashed Line
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    fc.ols_trajectory.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v));
      else ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Piecewise Structural Break Line
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    fc.piecewise_trajectory.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v));
      else ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    // Holt-ARIMA Damped Line
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    fc.arima_trajectory.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v));
      else ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    // Observed 2021-2025 Points
    fc.observed_2021_2025.forEach((v, i) => {
      if (v === null) return;
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(toX(i), toY(v), 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Legend
    const leg = [
      { label: "Observed (21-25)", color: "#f8fafc" },
      { label: "Standard OLS", color: "#94a3b8" },
      { label: "Piecewise (2024 Break)", color: "#38bdf8" },
      { label: "ARIMA + 95% CI", color: "#22c55e" }
    ];
    let lx = padLeft;
    ctx.font = "10px sans-serif";
    leg.forEach(item => {
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, 10, 10, 10);
      ctx.fillStyle = "#e2e8f0";
      ctx.textAlign = "left";
      ctx.fillText(item.label, lx + 14, 18);
      lx += ctx.measureText(item.label).width + 24;
    });
  },

  // 9. Feature 5: 10-Bin Reliability Calibration Diagram
  renderCalibrationChart: function(canvasId, bins) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !bins || bins.length === 0) return;
    const { ctx, width, height } = this._setupCanvas(canvas);

    ctx.clearRect(0, 0, width, height);
    const padLeft = 50, padRight = 25, padTop = 28, padBottom = 38;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const toX = p => padLeft + p * chartW;
    const toY = p => padTop + chartH - p * chartH;

    // Grid & Diagonal Ideal Calibration Line (y = x)
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    for (let i = 0; i <= 5; i++) {
      const p = i * 0.2;
      ctx.beginPath();
      ctx.moveTo(padLeft, toY(p));
      ctx.lineTo(width - padRight, toY(p));
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(p.toFixed(1), padLeft - 6, toY(p) + 3);
      ctx.textAlign = "center";
      ctx.fillText(p.toFixed(1), toX(p), height - padBottom + 16);
    }

    // Diagonal Ideal Line
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(0));
    ctx.lineTo(toX(1), toY(1));
    ctx.stroke();
    ctx.setLineDash([]);

    // Calibration Curve
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    bins.forEach((b, i) => {
      const x = toX(b.predicted_prob);
      const y = toY(b.observed_freq);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    bins.forEach(b => {
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(toX(b.predicted_prob), toY(b.observed_freq), 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
};

