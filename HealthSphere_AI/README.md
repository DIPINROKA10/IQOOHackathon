# HealthSphere AI 🫀

**AI-Powered Family Health & Preventive Care Management Platform**
Built from the *CareGraph AI* Product Requirements Document (v1.0) — implemented as a complete, live, working MVP.

> Your family's health history is scattered across generations, hospitals and documents.
> HealthSphere AI brings it together, understands your health journey over time, analyzes
> your medical reports, identifies meaningful trends, and helps you take informed
> preventive-health actions.

---

## ▶️ Run it (zero dependencies)

```bash
cd HealthSphere_AI
npm start          # or: node server.js
```

Open **http://localhost:3000**

| | |
|---|---|
| **Demo login** | `demo@healthsphere.ai` / `demo1234` |
| **Or** | Click "⚡ Try the live demo" on the sign-in screen |

Requires only Node.js ≥ 18. No `npm install`. No external APIs. Works fully offline.
Reset demo data: `npm run reset` · Run test suites: `npm test`

The demo account is pre-loaded with 2 years of realistic data: family history,
37 health metrics (HbA1c 5.4 → 5.7 → 6.0 rising exactly as in the PRD scenario),
processed lab reports, lifestyle logs, care team and emergency contacts.

---

## 🧠 How it works — the Hybrid AI architecture (PRD §10)

HealthSphere deliberately does **not** rely on an LLM. Every request flows through
**Rules + ML-style analytics + explanation layer**, then a **Safety Layer**:

```
HEALTH DATA (profile · family · reports · metrics · logs)
        │
   ┌────┼─────────┐
 Rules │ Analytics│ Explainer
   └────┼─────────┘
        ▼
 RECOMMENDATION ENGINE  →  SAFETY LAYER  →  USER
```

### Model 1 — Document Intelligence (`lib/extraction.js`, `lib/pdftext.js`)
Upload → file validation → text extraction → entity extraction → value normalization →
reference-range evaluation → structured data → plain-language explanation.
- Digital PDFs are parsed with a dependency-free PDF text miner (built on Node's `zlib`).
- ~25 analytes recognized (HbA1c, lipids, CBC, thyroid, kidney, liver, electrolytes…)
  with sex-specific reference bands where applicable.
- Handles `120/80` blood-pressure pairs, unit harmonization (`10^3/µL`, lakhs), multiple
  date formats, lab-name detection.
- **Prompt-injection guard**: instruction-like lines embedded in documents are detected
  and ignored (PRD §15 requirement).
- Photos/scans go through a human-in-the-loop review flow that feeds the same pipeline.

### Model 2 — Health Trend Engine (`lib/trends.js`)
Least-squares slopes per metric, trend classification (increasing/decreasing/stable),
sudden-change detection (≥15% jump between last two readings), z-score anomaly
detection, repeated-abnormal detection and missing-data staleness flags.

### Model 3 — Risk & Recommendation Engine (`lib/rules.js`, `lib/recommend.js`)
Evidence-informed clinical rules combine **family history + age + personal health +
report values + trends + lifestyle** into risk *signals* (never diagnoses), each with a
"Why am I seeing this?" factor list. Maps signals to specialties worth *discussing*
(Endocrinology, Cardiology…) plus an age/sex/family-aware screening checklist.

### Safety Layer
Strips diagnostic/prescription language from all AI output, enforces explainability
(no factors → no signal), attaches disclaimers, and frames every action as
*"discuss with a qualified healthcare professional."*

### Model 4 — Lifestyle AI (`lib/lifestyle.js`)
Mifflin-St Jeor BMR/TDEE estimates, goal-adjusted calorie targets, 4-week progressive
activity plans, 7-day vegetarian/non-veg/vegan meal grids filtered by recorded allergies,
hydration targets derived from body weight, and week-over-week lifestyle insights.

---

## ✨ Feature map (PRD coverage)

| PRD section | Where to see it |
|---|---|
| 8.1 Auth & account mgmt | Register/login/logout, password change, delete account |
| 8.2 Personal profile + metrics | **My Profile** |
| 8.3 Family health tree | **Family History** (11 relationships, conditions w/ diagnosis ages) |
| 8.4–8.6 Report upload + processing + explanation | **Medical Reports** (animated pipeline) |
| 8.7 Longitudinal analysis | Trends everywhere; `/api/trends/:key` |
| 8.8 Health timeline w/ filters | **Timeline** |
| 8.9 Risk & preventive-care engine | **Insights & Risks** |
| 8.10 Doctor specialty recommendation | Insights page, with reasons |
| 8.11 Test/screening guidance | Insights page checklist |
| 8.12 Reminders (auto + manual, snooze/complete/reschedule/disable) | **Reminders** |
| 8.13–8.15 Exercise/diet/lifestyle engines | **Lifestyle Hub** |
| 8.16–8.18 Emergency contacts + consent-gated import + care team | **Care Team** |
| 8.19 Nearby healthcare discovery | **Nearby Care** (geo-permission or city fallback) |
| 8.20 Emergency mode | Red full-screen mode: call buttons + emergency card |
| §14 Security & privacy | scrypt password hashing, httpOnly sessions, audit log, consent toggles, JSON export, one-click deletion |
| §16 Explainability | "Why am I seeing this?" on every signal |

## 🏗 System architecture

```
Browser SPA (vanilla JS, hash router, hand-rolled SVG charts — no CDNs)
   │ REST + cookie sessions
Node HTTP server (server.js)  ── lib/api.js route table (~40 endpoints)
   │
lib/* services: auth · extraction · trends · rules · recommend ·
                lifestyle · reminders · timeline · hospitals · seed
   │
JSON persistence (data/db.json, atomic writes) + uploads/ storage
```

Zero npm dependencies = instant startup, offline-capable, nothing to break during a demo.
Swap points for production: PostgreSQL via the same service layer, S3 for uploads,
real OCR (e.g. Textract/Textract-class API) behind `processDocument()`, maps/places API
behind `searchFacilities()`.

## ⚠️ Medical disclaimer

HealthSphere AI organizes and explains health information. It does not diagnose
diseases, prescribe medication, or replace healthcare professionals. Every insight is
informational and encourages professional evaluation.
