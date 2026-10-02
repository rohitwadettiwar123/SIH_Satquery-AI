<div align="center">

<!-- 3D Neon Title Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c29,50:302b63,100:24243e&height=200&section=header&text=SatQuery%20AI&fontSize=80&fontColor=00ffff&animation=fadeIn&fontAlignY=38&desc=🛰️%20AI-Powered%20Satellite%20Intelligence%20Platform&descAlignY=55&descAlign=50&descColor=ffffff&descSize=20" width="100%"/>

<br/>

<!-- Animated Badges -->
<a href="https://sparkx-satquery-backend.onrender.com"><img src="https://img.shields.io/badge/🚀%20Backend-Live%20on%20Render-00C7B7?style=for-the-badge&logo=render&logoColor=white" /></a>
<a href="https://satquery-ai.vercel.app"><img src="https://img.shields.io/badge/🌐%20Frontend-Live%20on%20Vercel-black?style=for-the-badge&logo=vercel&logoColor=white" /></a>
<a href="https://github.com/rohitwadettiwar123/SIH_Satquery-AI"><img src="https://img.shields.io/github/stars/rohitwadettiwar123/SIH_Satquery-AI?style=for-the-badge&logo=github&color=yellow" /></a>

<br/><br/>

<img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/FastAPI-2.0-009688?style=flat-square&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Three.js-3D%20Globe-black?style=flat-square&logo=threedotjs&logoColor=white" />
<img src="https://img.shields.io/badge/Gemini%20AI-Vision-4285F4?style=flat-square&logo=google&logoColor=white" />
<img src="https://img.shields.io/badge/Groq-LLM-FF6B35?style=flat-square&logoColor=white" />
<img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" />

<br/><br/>

> **🏆 Built for Smart India Hackathon (SIH) — Satellite Image Intelligence**
>
> *An advanced AI platform for analysing satellite imagery, detecting geographical changes, performing multi-spectral analysis, and generating scientific intelligence reports — all in real time.*

</div>

---

## ✨ Feature Highlights

<table>
<tr>
<td width="50%">

### 🌍 3D Globe Explorer
- **Interactive 3D Earth** rendered with CesiumJS & Three.js
- Draw custom **Area of Interest (AOI)** boxes directly on the globe
- Select any coordinates and click **"Analyze This View"** to instantly pull real satellite imagery from the **Esri World Imagery** provider
- Seamlessly transitions to the 2D Tactical Dashboard

</td>
<td width="50%">

### 🗺️ 2D Tactical Intelligence View
- Side-by-side **Before / After image viewer**
- Interactive **Area Selector** to isolate sub-regions for analysis
- Live **bounding box detections** overlaid on the map
- Real-time **NDVI / Land Cover** analysis chart

</td>
</tr>
<tr>
<td width="50%">

### 🤖 AI Analysis Engine
- **Gemini Vision** (multi-model fallback with auto-retry for rate limits)
- **Change Detection** — bi-temporal SSIM + spectral cluster analysis
- **Optical + SAR Fusion** — cross-modal structural analysis
- **VQA (Visual Question Answering)** — ask any question about the imagery

</td>
<td width="50%">

### 📊 Scientific Validation Gates (G0–G8)
- **G0** — Input format & file integrity
- **G1** — Image co-registration quality
- **G2** — Nyquist spatial resolution limit
- **G3** — Cloud screening & radiometric quality
- **G4** — Deterministic mathematical confirmation
- **G5** — Expert escalation threshold check
- **G6** — XAI attribution & grounding
- **G7** — SHA-256 audit hash generation
- **G8** — Final response delivery

</td>
</tr>
<tr>
<td width="50%">

### 🛡️ Mission Intelligence Panel
- **AI Copilot chat** powered by Groq LLM
- Full **Evidence & Traceability** execution trace
- **Confidence scoring** and uncertainty quantification
- **PDF / GeoJSON / GeoTIFF** export with full audit trail

</td>
<td width="50%">

### ☁️ Cloud Reconstruction Pipeline
- Automatic **cloud cover detection** from optical images
- Temporal **inpainting** using reference imagery (up to 365-day gap)
- Configurable quality and confidence thresholds
- All decisions logged in the traceability trace

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SatQuery AI v2.0                            │
│                                                                     │
│  ┌──────────────────┐          ┌──────────────────────────────────┐ │
│  │   FRONTEND        │  HTTPS  │         BACKEND (FastAPI)        │ │
│  │   React + Vite   │◄───────►│                                  │ │
│  │   TypeScript      │         │  /api/analyze  /api/upload       │ │
│  │   Three.js 3D     │         │  /api/health   /api/report       │ │
│  │   CesiumJS Globe  │         │  /api/chat     /api/gis          │ │
│  │   TailwindCSS     │         │                                  │ │
│  └──────────────────┘         └──────────┬───────────────────────┘ │
│                                           │                         │
│              ┌────────────────────────────┼──────────────────────┐  │
│              │          AI PIPELINE       │                      │  │
│              │                           ▼                      │  │
│              │  ┌──────────┐  ┌──────────────────┐  ┌────────┐ │  │
│              │  │   VQA    │  │ Change Detection  │  │ Fusion │ │  │
│              │  │ Specialist│  │   Specialist      │  │  SAR   │ │  │
│              │  └────┬─────┘  └────────┬─────────┘  └───┬────┘ │  │
│              │       │                  │                │       │  │
│              │       └──────────────────▼────────────────┘       │  │
│              │                   VLM Client                       │  │
│              │         (Gemini Vision — 6 model fallback)         │  │
│              │                                                    │  │
│              │  ┌──────────────────────────────────────────────┐ │  │
│              │  │     Scientific Validation Gates G0-G8        │ │  │
│              │  │  Format→CoReg→Nyquist→Cloud→Math→XAI→Audit  │ │  │
│              │  └──────────────────────────────────────────────┘ │  │
│              └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |

### ⚡ Quick Start (Local)

**1. Clone the repository**
```bash
git clone https://github.com/rohitwadettiwar123/SIH_Satquery-AI.git
cd SIH_Satquery-AI
```

**2. Set up environment variables**
```bash
cp .env.example .env
```
Edit `.env` and add your API keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

**3. Install Python dependencies & start the backend**
```bash
pip install -r requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

**4. Install frontend dependencies & start the frontend**
```bash
cd frontend
npm install
npm run dev
```

**5. Open the app**
```
http://localhost:5173
```

---

## 🌐 Deployment

| Platform | Service | URL |
|----------|---------|-----|
| **Vercel** | Frontend | https://satquery-ai.vercel.app |
| **Render** | Backend | https://sparkx-satquery-backend.onrender.com |

### Deploy Frontend (Vercel)

```bash
# Set this environment variable in Vercel project settings:
VITE_API_URL = https://sparkx-satquery-backend.onrender.com/api
```

### Deploy Backend (Render)

```bash
# Set these environment variables in Render service settings:
GEMINI_API_KEY = your_gemini_api_key
GROQ_API_KEY   = your_groq_api_key
```

---

## 📁 Project Structure

```
SatQuery-AI/
│
├── 🖥️  backend/                    # FastAPI backend
│   ├── main.py                    # App entrypoint, CORS, routers
│   ├── routes/
│   │   ├── analyze.py             # Core analysis endpoint
│   │   ├── upload.py              # Image upload & AOI fetch
│   │   ├── chat.py                # Groq LLM copilot
│   │   ├── report.py              # PDF/GeoJSON export
│   │   ├── gis_export.py          # GeoTIFF export
│   │   └── benchmark.py           # Benchmark metrics
│   ├── models/schemas.py          # Pydantic data models
│   └── data/                      # Uploads, reports, audit logs
│
├── 🤖  ai/                         # AI specialist models
│   ├── orchestrator.py            # Query classifier & dispatcher
│   ├── models/
│   │   ├── vlm_client.py          # Gemini Vision (6-model fallback)
│   │   ├── vqa.py                 # Visual Question Answering
│   │   ├── change_detection.py    # Bi-temporal change analysis
│   │   └── fusion.py              # Optical + SAR fusion
│   └── specialists/               # Domain-specific analyzers
│
├── 🔬  pipeline/                   # Scientific processing pipeline
│   ├── preprocess/                # Radiometric correction, despeckle
│   ├── change_detect/             # SSIM, change vectors, clustering
│   ├── ndvi/                      # NDVI + land cover classification
│   ├── reconstruction/            # Cloud inpainting
│   ├── feature_extract/           # Salient feature detection
│   └── evidence/                  # G0–G8 validation gates
│
├── 🌐  frontend/                   # React + TypeScript SPA
│   └── src/
│       ├── App.tsx                # Main application state & routing
│       ├── api/client.ts          # Axios API client
│       └── components/
│           ├── Explorer3D.tsx     # CesiumJS 3D globe
│           ├── TacticalMap.tsx    # 2D image viewer + bbox overlay
│           ├── MissionIntel.tsx   # Results panel
│           ├── IntelligenceTrace.tsx # Execution trace viewer
│           ├── Copilot.tsx        # AI chat interface
│           └── UploadPanel.tsx    # Image uploader + drag & drop
│
├── 📋  config.yaml                 # Centralised pipeline configuration
├── 📦  requirements.txt            # Python dependencies
├── 🐳  Dockerfile                  # Backend Docker image
└── 🐳  docker-compose.yml          # Full stack orchestration
```

---

## 🔬 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Run AI analysis on uploaded images |
| `POST` | `/api/upload` | Upload satellite image file |
| `POST` | `/api/upload/aoi` | Fetch satellite imagery for geographic AOI |
| `POST` | `/api/chat` | Chat with the AI Copilot (Groq) |
| `GET`  | `/api/report/{id}` | Download PDF/GeoJSON analysis report |
| `GET`  | `/api/health` | Health check with API key status |
| `GET`  | `/docs` | Interactive Swagger API documentation |

---

## 🧠 AI Models Used

| Model | Purpose | Provider |
|-------|---------|----------|
| `gemini-3.6-flash` / `gemini-3.7-flash` | Vision analysis, change description | Google Gemini |
| `gemini-2.5-flash` | Fallback vision model | Google Gemini |
| `llama3-8b-8192` | Copilot chat, Q&A | Groq |
| Deterministic | Pixel-level NDVI, SSIM, change vectors | Custom pipeline |

---

## ⚙️ Configuration

All pipeline thresholds are tunable in [`config.yaml`](config.yaml):

```yaml
# Cloud Reconstruction
cloud_threshold: 0.15          # Trigger reconstruction if cloud > 15%

# Scientific Gates
g1_max_coregistration_rmse: 2.0  # Max pixel reprojection error
g5_escalation_threshold: 0.75    # Trigger human review if confidence < 75%

# AI Model
gemini_model: "gemini-3.6-flash"

# Image Processing
default_gsd_meters: 10.0       # Default Ground Sampling Distance (Sentinel-2)
max_image_size_px: 1024        # Resize threshold for memory optimization
```

---

## 📸 Screenshots

| 3D Globe Explorer | 2D Tactical View | AI Intelligence Report |
|:-----------------:|:----------------:|:---------------------:|
| Draw AOI on 3D Earth | Side-by-side satellite comparison | Full AI primary finding with traceability |

---

## 👨‍💻 Team

Built with ❤️ for **Smart India Hackathon (SIH)** by **Team SparkX**

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:24243e,50:302b63,100:0f0c29&height=100&section=footer" width="100%"/>

**⭐ Star this repo if you found it useful!**

`Made with 🛰️ satellite data and 🤖 AI by Team SparkX`

</div>
