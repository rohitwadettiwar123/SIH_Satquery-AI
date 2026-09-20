import React, { useState, useEffect } from 'react';
import { client } from './api/client';
import { UploadResponse, AnalysisResult } from './types';
import UploadPanel from './components/UploadPanel';
import QueryPanel from './components/QueryPanel';
import MapViewer from './components/MapViewer';
import IntelligenceTrace from './components/IntelligenceTrace';
import MissionIntel from './components/MissionIntel';
import LoginPage from './components/LoginPage';
import CesiumGlobe from './components/CesiumGlobe';
import Copilot from './components/Copilot';
import { Satellite, ShieldCheck, Globe2 } from 'lucide-react';

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [uploads, setUploads] = useState<UploadResponse[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'tactical' | 'godseye'>('tactical');

  useEffect(() => {
    client.checkHealth().catch(console.error);
  }, []);

  const handleAnalyze = async (query: string, hint?: string) => {
    if (uploads.length === 0) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const res = await client.analyze(uploads.map(u => u.file_id), query, hint);
      setResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const loadDemo = () => {
    setUploads([{
      file_id: 'demo_image.png',
      filename: 'sentinel2_l2a_bay_area.tif',
      content_type: 'image/tiff',
      size_bytes: 14500000,
      upload_time: new Date().toISOString()
    } as any]);

    setResult({
      query_id: 'sih-demo-2026-0913-ab7f',
      task_type: 'CHANGE_DETECTION',
      query: 'Analyze terrain changes and detect anomalies between T0 and T1.',
      answer: 'Change detected between T0 and T1. Significant structural changes observed. 35.5% of the analyzed scene changed, corresponding to 5,038,900 m² (503.9 ha). Breakdown: New built-up area: 12,954,800 m². NDBI Δ = +0.38. Registration RMSE: 1.42 m. Mean CVM: 2.198. Mean Mahalanobis distance: 5.14. Overall evidence quality: 84.1%. 95% analytical uncertainty interval: 3,098,452–6,979,347 m². Evidence includes detected change mask, spatial polygons, measurements and provenance hash.',
      confidence: 0.94,
      detected_objects: [
        { class_name: 'New Built-up / Ground Disturbance', confidence: 0.96, bbox: { x1: 0.10, y1: 0.12, x2: 0.35, y2: 0.38 }, area_hectares: 124.0 },
        { class_name: 'New Built-up / Ground Disturbance', confidence: 0.91, bbox: { x1: 0.40, y1: 0.20, x2: 0.60, y2: 0.45 }, area_hectares: 33.3 },
        { class_name: 'New Built-up / Ground Disturbance', confidence: 0.87, bbox: { x1: 0.65, y1: 0.30, x2: 0.80, y2: 0.55 }, area_hectares: 11.0 },
        { class_name: 'New Built-up / Ground Disturbance', confidence: 0.85, bbox: { x1: 0.15, y1: 0.60, x2: 0.38, y2: 0.82 }, area_hectares: 11.0 },
      ],
      change_metrics: {
        ssim_score: 0.714,
        change_ratio_pct: 35.55,
        affected_area_km2: 5.04,
        mean_delta: 0.38,
        confidence_interval_95: [3098452, 6979347],
      } as any,
      ndvi_stats: {
        mean: 0.065,
        median: 0.068,
        std: 0.112,
        class_percentages: {
          'Vegetation & Canopy':    13.2,
          'Water Bodies & Hydrology': 22.0,
          'Built-up & Infrastructure': 1.5,
          'Bare Soil & Terrain':    63.3,
          'Atmosphere & Clouds':    0.0,
        },
        delta_ndvi: {
          'Vegetation & Canopy':     { t0: 360.16, t1: 186.96, delta: -173.2,  pct: -12.2 },
          'Water Bodies & Hydrology':{ t0: 943.73, t1: 312.35, delta: -631.38, pct: -44.6 },
          'Built-up & Infrastructure':{ t0: 30.4,  t1: 21.17,  delta: -9.23,   pct: -0.6  },
          'Bare Soil & Terrain':     { t0: 83.03,  t1: 896.92, delta: +813.89, pct: +57.4 },
          'Atmosphere & Clouds':     { t0: 0.08,   t1: 0.0,    delta: -0.08,   pct: 0     },
        }
      },
      cloud_reconstruction: {
        triggered: true,
        coverage_pct: 18.4,
        method: 'spatial_inpainting',
        avg_confidence: 88.5,
        disclosure_text: '18.4% cloud cover reconstructed via spatial inpainting with 88.5% pixel-level confidence.',
        original_url: '/uploads/demo_image.png',
        reconstructed_url: '/uploads/demo_image.png'
      },
      execution_trace: [
        'Step 1: Subpixel coregistration passed (RMSE: 1.42m) — 91%',
        'Step 2: Standardized CVM & Mahalanobis analysis (Mean CVM: 2.198) — 83%',
        'Step 3: Segmented 4 distinct changed regions — 82%',
        'Step 4: Nyquist spatial limit PASS — 97%',
        'Step 5: NDVI deterministic pipeline executed (G4) — 88%',
        'Step 6: SHA-256 cryptographic audit hash generated — 100%',
      ],
      gate_verdicts: {
        'G0_format_check':       'PASS',
        'G1_coregistration':     'PASS (RMSE=1.42m)',
        'G2_nyquist_limit':      'PASS',
        'G4_deterministic_math': 'PASS',
        'G5_escalation_check':   'PASS',
        'G7_audit_hash':         'PASS',
        'G8_cloud_screen':       'PASS (18.4% reconstructed)',
      },
      requires_expert_escalation: false,
      escalation_reason: '',
      audit_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      processing_time_ms: 1847,
    } as any);
  };

  if (!isAuth) {
    return <LoginPage onLogin={() => setIsAuth(true)} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-space overflow-hidden relative">
      {/* Ambient background */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neon-cyan/5 via-space to-space pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50 pointer-events-none" />

      {/* Header */}
      <header className="h-14 border-b border-panel-border bg-panel/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Satellite className="text-neon-cyan h-6 w-6" />
          <h1 className="font-mono text-xl tracking-wider font-bold">
            SATQUERY<span className="text-neon-cyan">.AI</span>
          </h1>
          <span className="ml-4 px-2 py-0.5 text-xs font-mono bg-panel-border text-gray-400 rounded">v2.0 MISSION CONTROL</span>
          <button
            onClick={loadDemo}
            className="ml-4 px-3 py-1 text-xs font-mono font-bold bg-neon-green/20 text-neon-green border border-neon-green/50 rounded hover:bg-neon-green/40 transition-colors animate-pulse"
          >
            RUN SIH DEMO
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm font-mono font-bold">
          <button
            onClick={() => setViewMode('tactical')}
            className={`px-4 py-1.5 rounded transition-colors ${viewMode === 'tactical' ? 'bg-neon-cyan text-black' : 'text-gray-400 hover:bg-gray-800 border border-gray-700'}`}
          >
            2D TACTICAL
          </button>
          <button
            onClick={() => setViewMode('godseye')}
            className={`px-4 py-1.5 flex items-center gap-2 rounded transition-colors ${viewMode === 'godseye' ? 'bg-neon-green text-black' : 'text-gray-400 hover:bg-gray-800 border border-gray-700'}`}
          >
            <Globe2 className="w-4 h-4" /> GOD'S EYE 3D
          </button>
        </div>
      </header>

      {/* Main Grid — 4 columns */}
      <main className="flex-1 overflow-hidden p-3 relative z-10">
        <div className="h-full grid grid-cols-12 gap-3">

          {/* Col 1 — Upload & Query (3 cols) */}
          <div className="col-span-3 flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex-shrink-0" style={{ maxHeight: '50%', overflowY: 'auto' }}>
              <UploadPanel uploads={uploads} setUploads={setUploads} />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <QueryPanel onAnalyze={handleAnalyze} isProcessing={isProcessing} disabled={uploads.length === 0} />
            </div>
          </div>

          {/* Col 2 — Map Viewer & Trace (6 cols) */}
          <div className="col-span-6 flex flex-col gap-3 min-h-0">
            <div className="flex-[2] mission-panel flex flex-col min-h-0">
              <div className="h-8 bg-panel-border/50 flex items-center justify-between px-3 font-mono text-xs text-gray-400 shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" />
                  {viewMode === 'tactical' ? 'TACTICAL VIEW' : "GOD'S EYE VIEW"}
                </div>
                {result && (
                  <span className="text-[10px] text-neon-green font-mono animate-pulse">● LIVE</span>
                )}
              </div>
              <div className="flex-1 relative overflow-hidden bg-black min-h-0">
                {viewMode === 'tactical' ? (
                  <MapViewer images={uploads} result={result} />
                ) : (
                  <CesiumGlobe />
                )}
              </div>
            </div>
            
            {/* Horizontal Intelligence Trace below Map */}
            <div className="h-56 shrink-0 min-h-0 overflow-hidden">
              <IntelligenceTrace result={result} isProcessing={isProcessing} />
            </div>
          </div>

          {/* Col 3 — Mission Intel (3 cols) */}
          <div className="col-span-3 min-h-0 overflow-hidden">
            <MissionIntel result={result} isProcessing={isProcessing} />
          </div>

        </div>
      </main>

      {/* Floating Copilot */}
      <Copilot />
    </div>
  );
}

export default App;
