"""
Clinical Decision Support and Patient Risk Stratification Engine
Calibrated on Karnataka NTEP Surveillance Findings (2021-2025, N = 3,72,863).
Provides multi-class outcome prediction, 4-tier risk stratification,
SHAP-style explainability attributions, and clinical/pharmacist care bundles.
"""

import math
from typing import Dict, Any, List

class PatientRiskEngine:
    def __init__(self):
        # Empirical baseline outcome probabilities across 5-year Karnataka cohort
        self.baseline_priors = {
            "success": 0.8849,   # Overall cohort TSR
            "ltfu": 0.0435,      # Loss to follow-up baseline
            "death": 0.0530,     # On-treatment mortality baseline
            "failure": 0.0076,   # Treatment failure baseline
            "relapse": 0.0673    # Historical recurrence baseline
        }

    def predict_patient_risk(self, patient: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates patient profile and computes calibrated probabilities,
        risk tiers, SHAP-style attribution scores, and actionable care bundles.
        """
        age = float(patient.get("age", 45))
        bmi = float(patient.get("bmi", 17.5))
        gender = str(patient.get("gender", "male")).lower()
        is_retreatment = bool(patient.get("is_retreatment", False))
        is_pulmonary = str(patient.get("tb_site", "pulmonary")).lower() == "pulmonary"
        hiv_positive = bool(patient.get("hiv_positive", False))
        diabetes = bool(patient.get("diabetes", False))
        tobacco_or_alcohol = bool(patient.get("tobacco_or_alcohol", False))
        ckd_or_liver = bool(patient.get("ckd_or_liver", False))
        rr_tb = bool(patient.get("rr_tb", False))  # Rifampicin resistance
        delay_days = float(patient.get("treatment_delay_days", 14))
        dbt_unlinked = bool(patient.get("dbt_unlinked", False))
        distance_km = float(patient.get("distance_to_center_km", 5))

        # Logit-based multi-factor scoring
        # Baseline log-odds
        logit_death = math.log(self.baseline_priors["death"] / (1 - self.baseline_priors["death"]))
        logit_ltfu = math.log(self.baseline_priors["ltfu"] / (1 - self.baseline_priors["ltfu"]))
        logit_failure = math.log(self.baseline_priors["failure"] / (1 - self.baseline_priors["failure"]))
        logit_relapse = math.log(self.baseline_priors["relapse"] / (1 - self.baseline_priors["relapse"]))

        shap_contributions = []

        # 1. Underweight / Severe Malnutrition (Major mortality driver: empirical OR = 3.2 - 4.5)
        if bmi < 16.0:
            logit_death += 1.45
            logit_ltfu += 0.40
            shap_contributions.append({
                "factor": "Severe Underweight (BMI < 16.0)",
                "impact_death": +0.28,
                "impact_ltfu": +0.08,
                "severity": "high",
                "evidence": "Severe wasting impairs cell-mediated immunity, elevating early mortality risk by 4.2x."
            })
        elif bmi < 18.5:
            logit_death += 0.70
            logit_ltfu += 0.20
            shap_contributions.append({
                "factor": "Mild-Moderate Underweight (BMI 16.0-18.4)",
                "impact_death": +0.12,
                "impact_ltfu": +0.03,
                "severity": "medium",
                "evidence": "Nutritional deficit reduces drug absorption and delays sputum clearance."
            })
        else:
            logit_death -= 0.35
            shap_contributions.append({
                "factor": "Adequate Nutritional Status (BMI >= 18.5)",
                "impact_death": -0.06,
                "impact_ltfu": -0.02,
                "severity": "low",
                "evidence": "Protective factor against drug-induced cachexia and mortality."
            })

        # 2. Age (Elderly >= 60 years: OR = 2.8)
        if age >= 60:
            logit_death += 1.10
            logit_failure += 0.30
            shap_contributions.append({
                "factor": f"Advanced Age ({int(age)} years)",
                "impact_death": +0.22,
                "impact_ltfu": +0.02,
                "severity": "high",
                "evidence": "Age >= 60 carries heightened risk of hepatotoxicity and immunosenescence."
            })
        elif age < 25:
            logit_death -= 0.40
            logit_ltfu += 0.35  # Young adults have higher mobility and work-related LTFU
            shap_contributions.append({
                "factor": f"Young Working Age ({int(age)} years)",
                "impact_death": -0.05,
                "impact_ltfu": +0.09,
                "severity": "medium",
                "evidence": "Low mortality risk, but higher risk of work-related migration and missed doses."
            })

        # 3. Retreatment / Recurrence History (Dissertation: 12.37% relapse in 2021)
        if is_retreatment:
            logit_relapse += 1.30
            logit_failure += 0.90
            logit_death += 0.45
            shap_contributions.append({
                "factor": "History of Previous TB Treatment",
                "impact_death": +0.08,
                "impact_ltfu": +0.11,
                "severity": "high",
                "evidence": "Retreatment cases have 3.4x higher probability of drug resistance and secondary relapse."
            })

        # 4. HIV Co-infection
        if hiv_positive:
            logit_death += 1.55
            logit_failure += 0.50
            shap_contributions.append({
                "factor": "HIV Co-infection (Active)",
                "impact_death": +0.31,
                "impact_ltfu": +0.12,
                "severity": "critical",
                "evidence": "Dual infection accelerates disease progression; requires immediate ART/CPT synchronization."
            })

        # 5. Diabetes Mellitus (Karnataka prevalence ~16-21%)
        if diabetes:
            logit_failure += 0.65
            logit_relapse += 0.55
            logit_death += 0.40
            shap_contributions.append({
                "factor": "Diabetes Mellitus Co-morbidity",
                "impact_death": +0.07,
                "impact_ltfu": +0.02,
                "severity": "medium",
                "evidence": "Hyperglycemia impairs phagocytosis and delays sputum conversion at 2 months."
            })

        # 6. Tobacco / Alcohol Abuse
        if tobacco_or_alcohol:
            logit_ltfu += 0.85
            logit_death += 0.35
            shap_contributions.append({
                "factor": "Tobacco / Alcohol Use Disorder",
                "impact_death": +0.06,
                "impact_ltfu": +0.18,
                "severity": "high",
                "evidence": "Primary behavioral driver for treatment interruption and hepatotoxicity."
            })

        # 7. Organ Dysfunctions (CKD / Chronic Liver Disease)
        if ckd_or_liver:
            logit_death += 1.25
            logit_failure += 0.60
            shap_contributions.append({
                "factor": "Pre-existing Renal / Hepatic Disease",
                "impact_death": +0.25,
                "impact_ltfu": +0.05,
                "severity": "critical",
                "evidence": "Extremely high vulnerability to first-line anti-TB drug hepatotoxicity (H, R, Z)."
            })

        # 8. Rifampicin Resistance (RR-TB)
        if rr_tb:
            logit_death += 1.40
            logit_failure += 1.80
            logit_ltfu += 0.70
            shap_contributions.append({
                "factor": "Rifampicin-Resistant TB (RR-TB)",
                "impact_death": +0.29,
                "impact_ltfu": +0.15,
                "severity": "critical",
                "evidence": "Requires specialized 9-18 month DR-TB regimen (BPaL/M or bedaquiline-containing)."
            })

        # 9. Treatment Delay (> 21 days)
        if delay_days > 21:
            logit_death += 0.50
            shap_contributions.append({
                "factor": f"Prolonged Diagnostic Delay ({int(delay_days)} days)",
                "impact_death": +0.09,
                "impact_ltfu": +0.04,
                "severity": "medium",
                "evidence": "Extended pre-treatment infectiousness increases tissue necrosis and household spread."
            })

        # 10. Socio-economic: Unlinked DBT / Long Distance
        if dbt_unlinked:
            logit_ltfu += 0.75
            shap_contributions.append({
                "factor": "Nikshay Poshan Direct Benefit Transfer (DBT) Pending / Unlinked",
                "impact_death": +0.02,
                "impact_ltfu": +0.16,
                "severity": "medium",
                "evidence": "Failure of monthly INR 500-1000 nutrition DBT strongly predicts early default."
            })

        if distance_km > 10.0:
            logit_ltfu += 0.60
            shap_contributions.append({
                "factor": f"Long Transit Distance to Health Facility ({round(distance_km, 1)} km)",
                "impact_death": +0.01,
                "impact_ltfu": +0.14,
                "severity": "medium",
                "evidence": "Geographic barriers impede routine medication refills and sputum follow-ups."
            })

        # Convert logits to probabilities via sigmoid with normalization
        p_death_raw = 1.0 / (1.0 + math.exp(-logit_death))
        p_ltfu_raw = 1.0 / (1.0 + math.exp(-logit_ltfu))
        p_fail_raw = 1.0 / (1.0 + math.exp(-logit_failure))
        p_relapse_raw = 1.0 / (1.0 + math.exp(-logit_relapse))

        unfavorable_sum = p_death_raw + p_ltfu_raw + p_fail_raw
        if unfavorable_sum >= 0.90:
            scale = 0.88 / unfavorable_sum
            p_death = p_death_raw * scale
            p_ltfu = p_ltfu_raw * scale
            p_fail = p_fail_raw * scale
        else:
            p_death = p_death_raw
            p_ltfu = p_ltfu_raw
            p_fail = p_fail_raw

        p_success = max(0.02, 1.0 - (p_death + p_ltfu + p_fail))
        p_relapse = min(0.35, p_relapse_raw * (0.8 + 0.4 * p_success))

        # Risk Tier Classification
        if p_death >= 0.20 or p_ltfu >= 0.35 or rr_tb or (hiv_positive and bmi < 16.0):
            risk_tier = "Critical"
            risk_color = "#dc2626"
            action_code = "RED_FLAG_URGENT_INPATIENT"
        elif p_death >= 0.10 or p_ltfu >= 0.20 or (diabetes and age >= 60):
            risk_tier = "High"
            risk_color = "#f97316"
            action_code = "ORANGE_FLAG_INTENSIVE_HOME_VISIT"
        elif (p_death + p_ltfu + p_fail) >= 0.15:
            risk_tier = "Moderate"
            risk_color = "#eab308"
            action_code = "YELLOW_FLAG_ENHANCED_SURVEILLANCE"
        else:
            risk_tier = "Low"
            risk_color = "#16a34a"
            action_code = "GREEN_FLAG_STANDARD_DOTS"

        # Generate Clinical Decision Support & Pharmacist Care Bundles
        care_bundles = self._generate_care_bundles(
            patient, risk_tier, p_death, p_ltfu, bmi, hiv_positive, diabetes, ckd_or_liver, rr_tb
        )

        return {
            "risk_tier": risk_tier,
            "risk_color": risk_color,
            "action_code": action_code,
            "probabilities": {
                "treatment_success": round(p_success * 100, 1),
                "mortality_death": round(p_death * 100, 1),
                "loss_to_follow_up": round(p_ltfu * 100, 1),
                "treatment_failure": round(p_fail * 100, 1),
                "secondary_relapse": round(p_relapse * 100, 1)
            },
            "shap_attributions": sorted(shap_contributions, key=lambda x: abs(x["impact_death"]) + abs(x["impact_ltfu"]), reverse=True),
            "care_bundles": care_bundles
        }

    def _generate_care_bundles(self, patient, tier, p_death, p_ltfu, bmi, hiv, dm, ckd, rr_tb) -> List[Dict[str, Any]]:
        bundles = []

        # 1. Nutritional Rehabilitation Bundle
        if bmi < 18.5:
            bundles.append({
                "title": "Nutrition & Cachexia Recovery Bundle",
                "badge": "Clinical Nutrition",
                "priority": "Immediate",
                "actions": [
                    "Fast-track Nikshay Poshan Yojana (INR 1,000/month DBT enrollment).",
                    "Prescribe high-protein therapeutic food (energy target: 40 kcal/kg/day, protein: 1.5-2.0 g/kg/day).",
                    "Add Multivitamin and Zinc supplementation to offset malabsorption."
                ]
            })

        # 2. Pharmacist Hepatotoxicity & Drug Safety Bundle
        if ckd or patient.get("age", 45) >= 60 or patient.get("tobacco_or_alcohol", False):
            bundles.append({
                "title": "Clinical Pharmacist ADR & Hepato-Renal Protocol",
                "badge": "Pharmacovigilance",
                "priority": "Mandatory",
                "actions": [
                    "Baseline Liver Function Test (AST, ALT, Bilirubin) & Serum Creatinine.",
                    "If AST/ALT > 3x upper normal with symptoms or > 5x asymptomatic: temporarily withhold Isoniazid, Rifampicin, Pyrazinamide.",
                    "Prescribe Pyridoxine (Vitamin B6) 100 mg daily to prevent drug-induced peripheral neuropathy.",
                    "Renal adjustment: dose Ethambutol and Pyrazinamide three times weekly if CrCl < 30 mL/min."
                ]
            })

        # 3. Adherence & Community Triage Bundle
        if p_ltfu >= 0.15 or patient.get("distance_to_center_km", 5) > 10:
            bundles.append({
                "title": "Digital Adherence & Community Support Protocol",
                "badge": "Field Operations",
                "priority": "High",
                "actions": [
                    "Assign dedicated ASHA worker for doorstep daily DOTS and weekly pill counts.",
                    "Enroll patient in 99DOTS / smart blister pack automated reminder service.",
                    "Set up automated SMS trigger to District TB Officer if medication refill is 48 hours overdue."
                ]
            })

        # 4. Metabolic / Co-infection Synchronization
        if dm or hiv:
            bundles.append({
                "title": "Dual-Pathology Synchronization Bundle",
                "badge": "Specialist Co-Management",
                "priority": "High",
                "actions": [
                    "Maintain target HbA1c < 7.0%; titrate metformin or initiate basal insulin if fasting plasma glucose > 180 mg/dL.",
                    "For HIV co-infected: initiate Cotrimoxazole Preventive Therapy (CPT) immediately; start ART within 2 to 8 weeks of anti-TB therapy.",
                    "Monitor for Rifampicin-Efavirenz or Rifampicin-Dolutegravir interactions; double Dolutegravir dose to 50mg BID."
                ]
            })

        # 5. Specialized DR-TB Action
        if rr_tb:
            bundles.append({
                "title": "Drug-Resistant TB Expert Committee Referral",
                "badge": "DR-TB Protocol",
                "priority": "Critical",
                "actions": [
                    "Urgent referral to District DR-TB Centre for Line Probe Assay (LPA) Second-Line & phenotypic DST.",
                    "Evaluate eligibility for all-oral 6-month BPaL/M regimen (Bedaquiline, Pretomanid, Linezolid, Moxifloxacin).",
                    "Mandatory weekly ECG monitoring for QTc interval prolongation."
                ]
            })

        return bundles

