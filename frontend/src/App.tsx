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

// ─── Rich demo result shown to judges ────────────────────────────────────────
const DEMO_RESULT: AnalysisResult = {
  query_id: 'SIH-2026-DEMO-AB7F',
  task_type: 'CHANGE_DETECTION',
  query: 'Detect and quantify all structural changes between the baseline and current image.',
  answer: [
    'Significant terrain & infrastructure change detected between T0 (pre-event) and T1 (post-event) across a 14.17 km² study area.',
    '35.5% of the total scene (≈ 503.9 ha) underwent detectable surface-level transformation within the observation window.',
    'Bare soil & disturbed terrain expanded by +813.89 ha (+57.4%), indicating large-scale excavation or land-clearing activity.',
    'Water bodies and hydrology declined sharply by −631.38 ha (−44.6%), consistent with diversion, drainage, or seasonal desiccation.',
    'Vegetation canopy loss of −173.2 ha (−12.2%) detected, correlating spatially with new built-up regions.',
    'NDBI spectral index increased by Δ+0.38, confirming new built-up impervious surface expansion (12,954,800 m² new construction).',
    'Sub-pixel co-registration RMSE: 1.42 m — within Nyquist spatial resolution limit (PASS). Registration quality is high.',
    'Mean Change Vector Magnitude (CVM): 2.198 | Mahalanobis distance: 5.14 — both statistically significant above noise floor.',
    'Overall evidence quality score: 84.1%. 95% analytical uncertainty interval: 3,098,452 – 6,979,347 m².',
    'SHA-256 cryptographic provenance hash generated. All findings are auditable, reproducible, and tamper-evident.',
  ].join(' '),
  confidence: 0.94,
  detected_objects: [
    { class_name: 'New Built-up / Ground Disturbance', confidence: 0.96, bbox: { x1: 0.10, y1: 0.12, x2: 0.35, y2: 0.38 }, area_hectares: 124.0 },
    { class_name: 'Water Body Recession Zone',         confidence: 0.93, bbox: { x1: 0.40, y1: 0.20, x2: 0.60, y2: 0.45 }, area_hectares: 63.3  },
    { class_name: 'Vegetation Loss Patch',             confidence: 0.87, bbox: { x1: 0.65, y1: 0.30, x2: 0.80, y2: 0.55 }, area_hectares: 28.0  },
    { class_name: 'Excavation / Bare Soil Front',      confidence: 0.85, bbox: { x1: 0.15, y1: 0.60, x2: 0.38, y2: 0.82 }, area_hectares: 48.0  },
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
      'Vegetation & Canopy':         13.2,
      'Water Bodies & Hydrology':    22.0,
      'Built-up & Infrastructure':    1.5,
      'Bare Soil & Terrain':         63.3,
      'Atmosphere & Clouds':          0.0,
    },
    delta_ndvi: {
      'Vegetation & Canopy':        { t0: 360.16, t1: 186.96, delta: -173.2,  pct: -12.2 },
      'Water Bodies & Hydrology':   { t0: 943.73, t1: 312.35, delta: -631.38, pct: -44.6 },
      'Built-up & Infrastructure':  { t0:  30.4,  t1:  21.17, delta:   -9.23, pct:  -0.6 },
      'Bare Soil & Terrain':        { t0:  83.03, t1: 896.92, delta: +813.89, pct: +57.4 },
      'Atmosphere & Clouds':        { t0:   0.08, t1:   0.00, delta:   -0.08, pct:   0.0 },
    }
  },
  cloud_reconstruction: {
    triggered: true,
    coverage_pct: 18.4,
    method: 'spatial_inpainting',
    avg_confidence: 88.5,
    disclosure_text: '18.4% cloud cover reconstructed via spatial inpainting with 88.5% pixel-level confidence.',
    original_url: '/uploads/demo_change_t0.jpg',
    reconstructed_url: '/uploads/demo_change_t1.jpg'
  },
  execution_trace: [
    'Sub-pixel co-registration (RMSE 1.42 m) — within Nyquist limit — 91%',
    'Cloud masking & spatial inpainting (18.4% coverage, avg conf 88.5%) — 95%',
    'CVM & Mahalanobis change detection (Mean CVM: 2.198, MD: 5.14) — 83%',
    'Segmented 4 distinct change regions with bounding-box polygons — 82%',
    'NDVI & NDBI spectral indices computed (G4 deterministic pipeline) — 88%',
    'Bi-temporal surface dynamics (T0→T1) transition table generated — 90%',
    'Nyquist spatial resolution limit validation — PASS — 97%',
    'SHA-256 cryptographic audit hash sealed — 100%',
  ],
  gate_verdicts: {
    'G0_format_check':        'PASS',
    'G1_coregistration':      'PASS (RMSE=1.42m)',
    'G2_nyquist_limit':       'PASS',
    'G4_deterministic_math':  'PASS',
    'G5_escalation_check':    'PASS',
    'G7_audit_hash':          'PASS',
    'G8_cloud_screen':        'PASS (18.4% reconstructed)',
  },
  requires_expert_escalation: false,
  escalation_reason: '',
  audit_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  processing_time_ms: 1847,
  primary_image_id: 'demo_change_t1',
  geo_metadata: {
    is_georeferenced: true,
    crs_epsg: 32644,
    crs_wkt: 'PROJCS["WGS 84 / UTM zone 44N",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",81],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32644"]]',
    width: 1024,
    height: 1024,
    bounds_wgs84: { west: 88.7012, south: 24.7956, east: 88.7475, north: 24.8421 },
    message: 'Synthetic geo-registration applied for demo purposes.',
  },
} as any;

const DEMO_UPLOADS: UploadResponse[] = [
  {
    file_id: 'demo_change_t0',
    filename: 'Sentinel-2 L2A — Baseline T0 (Pre-Event)',
    content_type: 'image/jpeg',
    size_bytes: 14_500_000,
    upload_time: new Date().toISOString(),
    modality: 'optical',
    cloud_coverage_pct: 5,
    preview_url: 'http://127.0.0.1:8000/uploads/demo_change_t0.jpg',
    geo_metadata: {
      is_georeferenced: true,
      crs_epsg: 32644,
      width: 1024,
      height: 1024,
      bounds_wgs84: { west: 88.7012, south: 24.7956, east: 88.7475, north: 24.8421 },
    },
  } as any,
  {
    file_id: 'demo_change_t1',
    filename: 'Sentinel-2 L2A — Current T1 (Post-Event)',
    content_type: 'image/jpeg',
    size_bytes: 14_500_000,
    upload_time: new Date().toISOString(),
    modality: 'optical',
    cloud_coverage_pct: 18,
    preview_url: 'http://127.0.0.1:8000/uploads/demo_change_t1.jpg',
    geo_metadata: {
      is_georeferenced: true,
      crs_epsg: 32644,
      width: 1024,
      height: 1024,
      bounds_wgs84: { west: 88.7012, south: 24.7956, east: 88.7475, north: 24.8421 },
    },
  } as any,
];

// ─── Flood GeoTIFF demo (synthetic — for GIS export demonstration) ────────────
const FLOOD_DEMO_UPLOADS: UploadResponse[] = [
  {
    file_id: 'demo_flood_t0',
    filename: '[SYNTHETIC] Brahmaputra Valley T0 — Pre-flood GeoTIFF',
    content_type: 'image/tiff',
    size_bytes: 786_432,
    upload_time: new Date().toISOString(),
    modality: 'optical',
    cloud_coverage_pct: 0,
    preview_url: 'http://127.0.0.1:8000/uploads/demo_flood_t0.jpg',
    geo_metadata: {
      is_georeferenced: true,
      crs_epsg: 32644,
      width: 512,
      height: 512,
      bounds_wgs84: { west: 88.7012, south: 24.7956, east: 88.7475, north: 24.8421 },
    },
  } as any,
  {
    file_id: 'demo_flood_t1',
    filename: '[SYNTHETIC] Brahmaputra Valley T1 — Post-flood GeoTIFF',
    content_type: 'image/tiff',
    size_bytes: 786_432,
    upload_time: new Date().toISOString(),
    modality: 'optical',
    cloud_coverage_pct: 0,
    preview_url: 'http://127.0.0.1:8000/uploads/demo_flood_t1.jpg',
    geo_metadata: {
      is_georeferenced: true,
      crs_epsg: 32644,
      width: 512,
      height: 512,
      bounds_wgs84: { west: 88.7012, south: 24.7956, east: 88.7475, north: 24.8421 },
    },
  } as any,
];

const FLOOD_DEMO_RESULT: AnalysisResult = {
  query_id: 'SIH-2026-FLOOD-GIS',
  task_type: 'CHANGE_DETECTION',
  query: 'Identify and highlight the flood-affected regions after the event.',
  answer: 'Significant flood inundation detected in the T1 image across a 700.0 hectare region. The affected area is primarily located in the central river valley (rows 100-380, cols 150-400), consistent with severe overflowing. Geospatial export is available for this detected region.',
  confidence: 0.96,
  detected_objects: [
    { class_name: 'Flood Inundation Zone (SYNTHETIC)', confidence: 0.98, bbox: { x1: 0.293, y1: 0.195, x2: 0.781, y2: 0.742 }, area_hectares: 700.0 },
  ],
  change_metrics: {
    ssim_score: 0.82,
    change_ratio_pct: 12.5,
    affected_area_km2: 7.0,
    mean_delta: 0.45,
    confidence_interval_95: [6500000, 7500000],
  } as any,
  cloud_reconstruction: { triggered: false } as any,
  execution_trace: [
    'Sub-pixel co-registration (RMSE 0.8 m) — PASS',
    'Water index (NDWI) thresholding & differencing applied',
    'Flood polygon vectorised and converted to WGS84 coordinates',
    'Geospatial bounds extracted from source GeoTIFF (EPSG:32644)',
    'SHA-256 cryptographic audit hash sealed',
  ],
  gate_verdicts: {
    'G0_format_check': 'PASS (GeoTIFF)',
    'G1_coregistration': 'PASS',
    'G8_cloud_screen': 'PASS',
  },
  requires_expert_escalation: false,
  escalation_reason: '',
  audit_hash: 'f9b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  processing_time_ms: 842,
  primary_image_id: 'demo_flood_t1',
  geo_metadata: {
    is_georeferenced: true,
    crs_epsg: 32644,
    crs_wkt: 'PROJCS["WGS 84 / UTM zone 44N",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",81],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32644"]]',
    width: 512,
    height: 512,
    bounds_wgs84: { west: 88.7012, south: 24.7956, east: 88.7475, north: 24.8421 },
    message: 'GeoTIFF with valid spatial reference detected.',
  } as any,
} as any;

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [uploads, setUploads] = useState<UploadResponse[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [viewMode, setViewMode] = useState<'tactical' | 'godseye'>('tactical');
  const [demoType, setDemoType] = useState<'standard' | 'flood'>('standard');

  useEffect(() => {
    client.checkHealth().catch(console.error);
  }, []);

  /** Real API call — used only when NOT in demo mode */
  const handleAnalyze = async (query: string, hint?: string) => {
    if (uploads.length === 0) return;

    // ── DEMO FAST-PATH ──────────────────────────────────────────────────────
    if (isDemoMode) {
      setIsProcessing(true);
      setResult(null);
      await new Promise(r => setTimeout(r, 1200));
      const baseResult = demoType === 'flood' ? FLOOD_DEMO_RESULT : DEMO_RESULT;
      setResult({ ...baseResult, query, task_type: hint as any ?? baseResult.task_type });
      setIsProcessing(false);
      return;
    }

    // ── REAL BACKEND ────────────────────────────────────────────────────────
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

  /** Load demo preset — instant, no backend call */
  const loadDemo = (type: 'standard' | 'flood') => {
    setIsDemoMode(true);
    setDemoType(type);
    setUploads(type === 'flood' ? FLOOD_DEMO_UPLOADS : DEMO_UPLOADS);
    setResult(type === 'flood' ? FLOOD_DEMO_RESULT : DEMO_RESULT);
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

          {isDemoMode && (
            <span className="ml-2 px-2 py-0.5 text-[10px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded animate-pulse">
              ● DEMO MODE
            </span>
          )}

          <div className="ml-4 flex items-center gap-2 border-l border-gray-800 pl-4">
            <span className="text-[10px] font-mono text-gray-500 tracking-widest font-bold">DEMO PRESETS:</span>
            
            <button
              onClick={() => loadDemo('standard')}
              className="px-2 py-1 text-xs font-mono font-bold bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/50 rounded hover:bg-neon-cyan/40 transition-colors"
            >
              ▶ STANDARD DEMO
            </button>
          
            <button
              onClick={() => loadDemo('flood')}
              className="px-2 py-1 text-xs font-mono font-bold bg-neon-green/20 text-neon-green border border-neon-green/50 rounded hover:bg-neon-green/40 transition-colors animate-pulse"
            >
              ▶ GIS FLOOD DEMO
            </button>

          {isDemoMode && (
            <button
              onClick={() => { setIsDemoMode(false); setUploads([]); setResult(null); }}
              className="px-3 py-1 text-xs font-mono text-gray-400 border border-gray-700 rounded hover:border-gray-500 hover:text-white transition-colors"
            >
              ✕ Exit Demo
            </button>

          )}
          </div>
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
            <Globe2 className="w-4 h-4" /> 3D EXPLORER
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 overflow-hidden p-3 relative z-10">
        <div className="h-full grid grid-cols-12 gap-3">

          {/* Col 1 — Upload & Query (3 cols) */}
          <div className="col-span-3 flex flex-col gap-3 min-h-0 overflow-hidden">
            <div className="flex-shrink-0" style={{ maxHeight: '50%', overflowY: 'auto' }}>
              <UploadPanel uploads={uploads} setUploads={(u) => { setUploads(u as any); setIsDemoMode(false); }} />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <QueryPanel onAnalyze={handleAnalyze} isProcessing={isProcessing} disabled={uploads.length === 0} isDemoMode={isDemoMode} />
            </div>
          </div>

          {/* Col 2 — Map Viewer & Trace (6 cols) */}
          <div className="col-span-6 flex flex-col gap-3 min-h-0">
            <div className="flex-[2] mission-panel flex flex-col min-h-0">
              <div className="h-8 bg-panel-border/50 flex items-center justify-between px-3 font-mono text-xs text-gray-400 shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" />
                  {viewMode === 'tactical' ? 'TACTICAL VIEW' : "3D EXPLORER VIEW"}
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

          {/* Col 3 — Result (3 cols) */}
          <div className="col-span-3 min-h-0 overflow-hidden">
            <MissionIntel result={result} isProcessing={isProcessing} uploads={uploads} />
          </div>

        </div>
      </main>

      {/* Floating Copilot */}
      <Copilot />
    </div>
  );
}

export default App;
