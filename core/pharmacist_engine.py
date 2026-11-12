"""
Clinical Pharmacist Decision Support, DDI, and ADR Engine
Specialized for TB Pharmacotherapy under NTEP Guidelines.
Designed for Dr. Mekkanti Manasa Rekha's Clinical Pharmacy Research Scope.
Provides Drug-Drug Interaction (DDI) checking, DILI (Drug-Induced Liver Injury)
management, renal dosage adjustments, and therapeutic drug monitoring (TDM).
"""

from typing import Dict, Any, List

class PharmacistEngine:
    def __init__(self):
        self.ddi_database = [
            {
                "drug_class": "Antiretroviral (Dolutegravir - DTG)",
                "target_tb_drug": "Rifampicin (R)",
                "severity": "Major",
                "effect": "Rifampicin induces UGT1A1 and CYP3A4, reducing DTG AUC by ~54%.",
                "management": "Double Dolutegravir dose to 50 mg twice daily (BID) instead of once daily; continue 50 mg BID until 2 weeks after stopping Rifampicin."
            },
            {
                "drug_class": "Antiretroviral (Protease Inhibitors: LPV/r, ATV/r)",
                "target_tb_drug": "Rifampicin (R)",
                "severity": "Contraindicated",
                "effect": "Severe reduction in protease inhibitor levels (>75%) leading to virological failure and high risk of hepatotoxicity.",
                "management": "Replace Rifampicin with Rifabutin (150 mg 3x weekly) or switch ART regimen to Dolutegravir-based therapy."
            },
            {
                "drug_class": "Oral Hypoglycemic (Metformin / Sulphonylureas)",
                "target_tb_drug": "Rifampicin (R)",
                "severity": "Moderate",
                "effect": "Rifampicin enhances hepatic metabolism of glimepiride/glipizide; Metformin clearance may be altered via OCT2 induction.",
                "management": "Intensify self-monitoring of blood glucose (SMBG). Dose adjustment of sulphonylureas required; consider temporary insulinization during intensive phase."
            },
            {
                "drug_class": "Antiepileptic (Phenytoin / Carbamazepine)",
                "target_tb_drug": "Isoniazid (H)",
                "severity": "Major",
                "effect": "Isoniazid is a potent CYP2C19/CYP2C9 inhibitor, raising Phenytoin levels into toxic range (ataxia, nystagmus, lethargy).",
                "management": "Monitor serum phenytoin levels closely. Reduce phenytoin dose by 30-50% upon starting Isoniazid."
            },
            {
                "drug_class": "Antacids (Aluminium / Magnesium Hydroxide)",
                "target_tb_drug": "Ethambutol (E) & Fluoroquinolones",
                "severity": "Moderate",
                "effect": "Divalent and trivalent cations chelate Ethambutol and Quinolones, severely impeding gastrointestinal absorption.",
                "management": "Administer anti-TB medications at least 2 hours before or 4 hours after antacids."
            },
            {
                "drug_class": "Cardiovascular (Amlodipine / Calcium Channel Blockers)",
                "target_tb_drug": "Rifampicin (R)",
                "severity": "Moderate",
                "effect": "CYP3A4 induction reduces Amlodipine bioavailability by up to 70%, leading to uncontrolled rebound hypertension.",
                "management": "Monitor blood pressure weekly; increase calcium channel blocker dose by 2x-3x or add a beta-blocker/ACE inhibitor."
            }
        ]

        self.renal_guidelines = {
            "Isoniazid": "300 mg once daily (no adjustment needed). Add Pyridoxine 50-100 mg/day.",
            "Rifampicin": "450-600 mg once daily (predominantly biliary excretion; no adjustment needed).",
            "Pyrazinamide": "Normal CrCl: 1500-2000 mg/day. If CrCl < 30 mL/min or on hemodialysis: reduce frequency to 25-35 mg/kg three times weekly (not daily).",
            "Ethambutol": "Normal CrCl: 800-1200 mg/day. If CrCl < 30 mL/min: reduce frequency to 15-25 mg/kg three times weekly. Monitor visual acuity."
        }

    def check_drug_interactions(self, co_medications: List[str]) -> List[Dict[str, Any]]:
        findings = []
        for med in co_medications:
            med_lower = med.lower()
            for ddi in self.ddi_database:
                if any(k.lower() in med_lower for k in ddi["drug_class"].split("(")[0].split("/")):
                    findings.append(ddi)
                elif any(term in med_lower for term in ["dtg", "dolutegravir", "metformin", "glimepiride", "phenytoin", "antacid", "amlodipine"]):
                    if any(term in ddi["drug_class"].lower() for term in ["dtg", "dolutegravir", "metformin", "glimepiride", "phenytoin", "antacid", "amlodipine"]):
                        if ddi not in findings:
                            findings.append(ddi)
        return findings

    def evaluate_dili(self, ast: float, alt: float, bilirubin: float, has_symptoms: bool) -> Dict[str, Any]:
        """
        Drug-Induced Liver Injury (DILI) Clinical Algorithm per WHO/NTEP.
        """
        # Upper Limit of Normal (ULN): AST ~ 40 U/L, ALT ~ 40 U/L, Bilirubin ~ 1.2 mg/dL
        ast_ratio = ast / 40.0
        alt_ratio = alt / 40.0
        is_severe = (ast_ratio >= 5.0 or alt_ratio >= 5.0) or (has_symptoms and (ast_ratio >= 3.0 or alt_ratio >= 3.0)) or (bilirubin >= 2.5)

        if is_severe:
            return {
                "dili_status": "CONFIRMED_DILI_ALERT",
                "severity": "High / Critical",
                "action": "IMMEDIATELY WITHHOLD all hepatotoxic anti-TB drugs: Isoniazid (H), Rifampicin (R), and Pyrazinamide (Z).",
                "bridging_regimen": "If patient is severely ill with infectious TB, initiate non-hepatotoxic bridging regimen: Ethambutol (E) + Levofloxacin (Lfx) + Amikacin/Streptomycin.",
                "reintroduction_protocol": [
                    "Step 1: Wait until transaminases fall below 2x ULN and symptoms resolve completely.",
                    "Step 2: Reintroduce Rifampicin first at low dose (150 mg/day), titrate to full dose (450-600 mg) over 3-7 days. Check LFT.",
                    "Step 3: If LFT stable after 1 week, reintroduce Isoniazid at low dose (100 mg), titrate to 300 mg. Check LFT.",
                    "Step 4: Pyrazinamide is the most hepatotoxic agent. If initial reaction was severe, DO NOT REINTRODUCE Pyrazinamide; extend treatment duration with HRE to 9 months."
                ]
            }
        else:
            return {
                "dili_status": "NORMAL_OR_MILD_ELEVATION",
                "severity": "Low / Monitoring",
                "action": "Continue current NTEP regimen. Repeat liver function test in 7 to 14 days.",
                "bridging_regimen": "None required.",
                "reintroduction_protocol": []
            }

    def get_pharmacist_summary(self, patient_profile: Dict[str, Any]) -> Dict[str, Any]:
        age = patient_profile.get("age", 45)
        bmi = patient_profile.get("bmi", 17.5)
        crcl = patient_profile.get("crcl", 80)
        co_meds = patient_profile.get("co_medications", [])
        ast = patient_profile.get("ast", 35)
        alt = patient_profile.get("alt", 32)
        bili = patient_profile.get("bilirubin", 0.9)
        symptoms = patient_profile.get("has_jaundice_or_nausea", False)

        ddi_alerts = self.check_drug_interactions(co_meds)
        dili_eval = self.evaluate_dili(ast, alt, bili, symptoms)

        # Pyridoxine recommendation
        pyridoxine_dose = "100 mg daily" if (bmi < 16.0 or patient_profile.get("diabetes") or patient_profile.get("hiv_positive") or patient_profile.get("tobacco_or_alcohol")) else "50 mg daily"

        renal_adjustments = {}
        if crcl < 30:
            renal_adjustments["Pyrazinamide"] = self.renal_guidelines["Pyrazinamide"]
            renal_adjustments["Ethambutol"] = self.renal_guidelines["Ethambutol"]

        return {
            "ddi_alerts": ddi_alerts,
            "dili_evaluation": dili_eval,
            "pyridoxine_recommendation": {
                "dose": pyridoxine_dose,
                "indication": "Prophylaxis against Isoniazid-induced peripheral neuropathy."
            },
            "renal_adjustments": renal_adjustments,
            "counseling_points": [
                "Warn patient that Rifampicin causes harmless reddish-orange discoloration of urine, tears, and sweat.",
                "Advise taking first-line FDC on an empty stomach (1 hour before or 2 hours after meals) with water for optimal absorption.",
                "Instruct patient to report immediately if yellowing of eyes (jaundice), persistent vomiting, or dark tea-colored urine occurs."
            ]
        }

