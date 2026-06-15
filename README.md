# Glaucoma Detection System

**End-to-end AI-powered glaucoma screening from retinal fundus images.**

| | |
|---|---|
| **Status** | Production-ready full-stack integration |
| **Last updated** | June 12, 2026 |
| **Stack** | React + FastAPI + ResNet-50 + K-Strange segmentation |

---

## What This Project Does

Upload a fundus photograph → AI analyzes optic disc/cup → returns glaucoma prediction, CDR, full pipeline visuals (preprocessing, segmentation, CDR charts, diagnostic composite), and a downloadable **PDF medical report**.

---

## Quick Start (One Command)

From the **`GLUCOMA`** folder root:

```powershell
powershell -ExecutionPolicy Bypass -File START_PROJECT.ps1
```

Or shorter:

```powershell
.\START_PROJECT.ps1
```

Or double-click **`start.bat`**.

This automatically:
1. Starts **FastAPI** on http://localhost:8000
2. Starts **React frontend** on http://localhost:5173
3. Opens your browser

Press **Ctrl+C** in each terminal window to stop.

### First-time setup

```powershell
# Python environment
python -m venv .venv
.\.venv\Scripts\pip install -r glaucoma_project\requirements.txt

# Frontend
cd glaucoma-app
npm install
cd ..
```

Ensure model weights exist at:
`glaucoma_project/outputs/models/best_model.pth`

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  glaucoma-app/          React frontend (:5173)              │
│    Landing → Upload → Results → PDF download                │
└────────────────────────────┬────────────────────────────────┘
                             │ POST /predict  (field: file)
                             │ GET  /reports/{id}.pdf
┌────────────────────────────▼────────────────────────────────┐
│  glaucoma_project/src/api.py    FastAPI (:8000)             │
│    prediction_service.py  →  AI pipeline                     │
│    pdf_service.py         →  PDF reports                    │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
 preprocessing.py    segmentation.py         model.py
 (CLAHE, Gaussian)   (K-Strange disc/cup)   (ResNet-50)
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
                        cdr.py (CDR + risk)
                             ▼
                   outputs/reports/*.pdf
```

**Single canonical backend:** `glaucoma_project/src/api.py`  
No separate Flask server — the old `glaucoma-app/flask-api/` wrapper has been removed.

---

## Repository Layout

```
GLUCOMA/
├── start.ps1 / start.bat       ← One-click launcher (API + frontend)
├── README.md                   ← This file
├── ARCHITECTURE.md             ← Detailed architecture diagram
├── DEPLOYMENT.md               ← Production & Docker guide
├── TEST_REPORT.md              ← Integration test results
├── AUDIT_REPORT.md             ← Full project audit
├── docker-compose.yml
│
├── glaucoma_project/           ← AI + Backend (Python)
│   ├── src/
│   │   ├── api.py              ← FastAPI (canonical backend)
│   │   ├── prediction_service.py
│   │   ├── pdf_service.py
│   │   ├── preprocessing.py
│   │   ├── segmentation.py     ← K-Strange clustering
│   │   ├── cdr.py
│   │   ├── model.py            ← ResNet-50
│   │   ├── predict.py
│   │   └── pipeline.py
│   ├── outputs/models/best_model.pth
│   ├── run_api.bat / run_api.ps1
│   ├── API_INSTRUCTIONS.md
│   └── README.md
│
└── glaucoma-app/               ← Frontend (React + Vite)
    ├── src/pages/              Landing, Upload, Results
    ├── src/api/client.js       FastAPI client
    └── README.md
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server and model status |
| POST | `/predict` | Upload fundus image (`file` field) |
| GET | `/results/{job_id}` | Reload full analysis with pipeline images |
| GET | `/reports/{report_id}.pdf` | Download PDF report |
| GET | `/eval/{filename}` | Model evaluation plots (ROC, confusion matrix) |
| GET | `/docs` | Swagger UI |

### Example

```bash
curl -X POST "http://localhost:8000/predict" \
  -F "file=@fundus.jpg" \
  -F "patient_name=John Doe" \
  -F "patient_age=45" \
  -F "patient_id=P001"
```

### Response includes

- `prediction` — Glaucoma / Normal
- `confidence_score` — 0–100%
- `cup_disc_ratio` — CDR value
- `risk_level` — Low / Medium / High
- `segmentation_images` — base64 disc/cup overlay on fundus
- `preprocessing_image` — 5-stage preprocessing panel
- `segmentation_panel_image` — K-Strange 4-panel segmentation
- `cdr_report_image` — CDR bar chart + clinical report
- `pipeline_summary_image` — 3-panel pipeline summary
- `final_composite_image` — complete 12-panel diagnostic output
- `recommendations` — clinical guidance
- `pdf_url` — link to generated report
- `job_id` — use `GET /results/{job_id}` to reload full results

---

## Manual Start (Two Terminals)

**Terminal 1 — API:**
```powershell
cd glaucoma_project
..\.venv\Scripts\python.exe -m uvicorn src.api:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```powershell
cd glaucoma-app
npm run dev
```

Open http://localhost:5173

---

## User Workflow

1. **Landing page** — project overview and features
2. **Upload** — drag & drop fundus image (JPG/PNG), optional patient details
3. **Analysis** — AI pipeline runs (preprocess → segment → CDR → ResNet-50)
4. **Results** — diagnosis, confidence, CDR, risk level, image tabs, charts
5. **PDF** — download hospital-style screening report

---

## AI Pipeline & Core Algorithms

The system uses a 7-stage processing pipeline that combines traditional computer vision algorithms and deep learning.

### 1. Image Preprocessing & ROI Extraction
* **Green Channel Isolation**: Isolates the green channel of the RGB fundus image to maximize contrast of blood vessels and optic nerve structures against the background.
* **CLAHE Enhancement**: Contrast Limited Adaptive Histogram Equalization (clip limit `2.0`, `8x8` tile grid) resolves uneven lighting.
* **Gaussian Filtering**: A `5x5` kernel ($\sigma=1.0$) smooths sensor noise.
* **Optic Disc ROI**: Detects and extracts a $200 \times 200$ pixel bounding box centered on the optic nerve head, with edge padding for shape consistency.

### 2. Enhanced K-Strange Segmentation
Unlike basic thresholding, a custom **K-Strange Clustering** algorithm runs in two distinct stages:
* **Stage 1 (Disc vs Background)**: Segments the outer optic disc boundary from surrounding retinal tissue.
* **Stage 2 (Cup vs Disc)**: Localizes the inner optic cup within the disc area by analyzing relative light reflections.
* **Boundary Optimization**: Custom morphological operators (opening and closing) remove noise, and a **least-squares ellipse fitting** algorithm generates smooth, geometrically robust boundaries to compute diameters.

### 3. Vertical Cup-to-Disc Ratio (CDR)
* Vertical diameters of both masks are calculated (the vertical standard is more sensitive to glaucomatous changes than area-based measurements).
* **Clinical Thresholds**:
  * $\text{CDR} < 0.5$: Low Risk (Normal)
  * $0.5 \le \text{CDR} < 0.6$: Moderate Risk (Borderline)
  * $0.6 \le \text{CDR} < 0.8$: High Risk (Glaucoma Suspected)
  * $\text{CDR} \ge 0.8$: Very High Risk (Advanced Glaucoma Suspected)

### 4. Optimized ResNet-50 Deep Learning
* **Backbone**: ResNet-50 pre-trained model with a custom classification head ($2048 \rightarrow 512 \rightarrow 1$ node output).
* **Focal Loss**: Utilized during training to handle high class imbalance ($66.7\%$ glaucoma vs $33.3\%$ normal images).
* **Optimization Details**:
  * Trained in **two phases** (Phase 1: warm-up head with frozen backbone; Phase 2: fine-tuning `layer4` + head).
  * Uses a cosine annealing learning rate scheduler and gradient clipping (max norm `1.0`) to avoid exploding gradients.
  * Validation accuracy achieves **over 90.44%**.

### 5. Multi-Modal Decision Fusion & Clinical Tolerance Rules
To minimize false-positive borderline flags and increase clinical accuracy, the system integrates a **decision fusion engine** with custom rules:
* **Rule A (Minor Structural Anomalies)**: If the CDR is slightly elevated ($0.6 \le \text{CDR} < 0.65$) but the ResNet-50 model is highly confident it is normal (probability $< 0.35$), the diagnosis is classified as **Normal**.
* **Rule B (Low-Confidence CNN Outliers)**: If the CDR is normal ($\text{CDR} < 0.6$) but the ResNet-50 model predicts glaucoma with very low confidence (probability $< 0.55$), the diagnosis is classified as **Normal**.
* **Mismatch Handling**: All other conflicting results between CDR and CNN predictions are outputted as **Borderline - Manual Review Needed** to mandate human oversight.

---

## Interactive Dashboard & Caching
* **Interactive UI**: The React frontend uses Tailwind CSS, Framer Motion, and Recharts to render interactive tabs (Preprocessed steps, Disc/Cup overlays, and full 12-panel composite layouts).
* **PDF Report Compilation**: Server-side report generator (`pdf_service.py`) automatically maps patient records and pixel analysis metrics (disc/cup/rim area) into professional medical reports.
* **Backend Cache**: Results are saved locally under job IDs. The frontend utilizes the `GET /results/{job_id}` endpoint to reload entire screening runs without exceeding browser storage limits.

---

## Testing

```powershell
cd glaucoma_project
..\.venv\Scripts\python.exe -m pytest tests/test_api_integration.py -v
```

---

## Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000

---

## Recent Changes (June 2026)

| Change | Details |
|--------|---------|
| **Visual Enhancement** | Home page background image (`eye-bg.jpg`) set to 40% opacity with blend-multiply overlay for high clarity and readability. |
| **Grid & Spacing Fixes** | Removed redundant flex-1 rules from Upload page columns, restoring proper 55%/45% layout constraints. |
| **Single-page Layout** | Adjusted container margins and dropzone constraints on `/upload` to fit entirely on a single screen without scrollbars. |
| **Canonical FastAPI backend** | Single backend in `glaucoma_project/src/api.py` |
| **Flask removed** | `glaucoma-app/flask-api/` deprecated — no duplicate server |
| **Frontend integrated** | React app connects directly to FastAPI on port 8000 |
| **PDF in API** | Server-side medical reports via `pdf_service.py` |
| **prediction_service.py** | Single source of truth for inference orchestration |
| **One-start launcher** | `start.ps1` / `start.bat` runs API + frontend together |
| **UI redesign** | Landing, Upload, Results pages with Tailwind CSS |
| **Full pipeline outputs** | Preprocessing, segmentation, CDR, composite panels in UI + PDF |
| **Results API** | `GET /results/{job_id}` reloads images from disk (no sessionStorage limits) |
| **Integration tests** | `tests/test_api_integration.py` — end-to-end verified |

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| **[MASTER_GUIDE.md](MASTER_GUIDE.md)** | **★ Everything in one place — start here for full map** |
| [glaucoma_project/README.md](glaucoma_project/README.md) | ML pipeline, training, model details |
| [glaucoma_project/API_INSTRUCTIONS.md](glaucoma_project/API_INSTRUCTIONS.md) | API reference |
| [glaucoma-app/README.md](glaucoma-app/README.md) | Frontend setup |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System diagrams |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment |
| [TEST_REPORT.md](TEST_REPORT.md) | Test results |
| [AUDIT_REPORT.md](AUDIT_REPORT.md) | Integration audit |

---

## Requirements

- **Python** 3.9+
- **Node.js** 18+
- **RAM** 8 GB minimum (16 GB recommended)
- **GPU** optional (`GLAUCOMA_DEVICE=cuda`)

---

## Disclaimer

This system is for **educational and screening purposes only**. It is not a substitute for professional medical diagnosis. All findings must be reviewed by a qualified ophthalmologist.

**Mangalore Institute of Technology & Engineering — ISE Dept — Academic Project 2025–26**
