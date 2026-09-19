import React, { useState, useEffect } from 'react';
import { client } from './api/client';
import { UploadResponse, AnalysisResult } from './types';
import UploadPanel from './components/UploadPanel';
import QueryPanel from './components/QueryPanel';
import ResultPanel from './components/ResultPanel';
import MapViewer from './components/MapViewer';
import EvidencePanel from './components/EvidencePanel';
import LoginPage from './components/LoginPage';
import CesiumGlobe from './components/CesiumGlobe';
import Copilot from './components/Copilot';
import { Satellite, Activity, Server, ShieldCheck, Globe2 } from 'lucide-react';

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const [uploads, setUploads] = useState<UploadResponse[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'tactical' | 'godseye'>('tactical');

  useEffect(() => {
    client.checkHealth().then(setHealth).catch(console.error);
  }, []);

  const handleAnalyze = async (query: string, hint?: string) => {
    if (uploads.length === 0) return;
    setIsProcessing(true);
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
    }]);
    
    setResult({
      query_id: 'sih-demo-2026-0913',
      task_type: 'VQA',
      query: 'Analyze the terrain and detect anomalies.',
      answer: 'Analysis complete. Detected 3 anomalous infrastructure clusters within the designated zone. The vegetation index indicates healthy foliage surrounding the primary facility. The optical sensor was partially obscured by 18% cloud cover, which was successfully reconstructed using spatial inpainting.',
      confidence: 0.94,
      detected_objects: [
        { label: 'Infrastructure Alpha', confidence: 0.96, bbox: { x1: 0.2, y1: 0.3, x2: 0.4, y2: 0.5 } },
        { label: 'Anomalous Vehicle', confidence: 0.89, bbox: { x1: 0.6, y1: 0.7, x2: 0.65, y2: 0.75 } },
        { label: 'Command Center', confidence: 0.98, bbox: { x1: 0.45, y1: 0.45, x2: 0.55, y2: 0.55 } }
      ],
      change_metrics: null,
      ndvi_stats: {
        mean: 0.65,
        median: 0.68,
        std: 0.12,
        class_percentages: { "healthy_vegetation": 75.4, "water": 12.1, "bare_soil": 12.5 },
        delta_ndvi: null
      },
      cloud_reconstruction: {
        triggered: true,
        coverage_pct: 18.4,
        method: 'spatial_inpainting',
        avg_confidence: 88.5,
        disclosure_text: '18.4% cloud cover reconstructed via spatial inpainting.',
        original_url: '/uploads/demo_image.png',
        reconstructed_url: '/uploads/demo_image.png'
      },
      execution_trace: [
        'Step 1: Input registered and CRS validated (G0).',
        'Step 2: Nyquist spatial limit verified (G2).',
        'Step 3: Cloud reconstruction applied (18.4% coverage).',
        'Step 4: Deterministic NDVI calculated (G4).',
        'Step 5: VLM object detection executed.',
        'Step 6: Cryptographic SHA-256 audit hash generated (G7).'
      ],
      gate_verdicts: {
        'G0_format_check': 'PASS',
        'G2_nyquist_limit': 'PASS',
        'G4_deterministic_math': 'PASS',
        'G5_escalation_check': 'PASS',
        'G7_audit_hash': 'PASS'
      },
      requires_expert_escalation: false,
      audit_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      processing_time_ms: 1245
    });
  };

  if (!isAuth) {
    return <LoginPage onLogin={() => setIsAuth(true)} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-space overflow-hidden relative">
      {/* High-end ambient background overlay */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neon-cyan/5 via-space to-space pointer-events-none"></div>
      <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50 pointer-events-none"></div>
      
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

      {/* Main Grid */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden p-4 relative z-10">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 h-full">
          
          {/* Left Col: Upload & Query */}
          <div className="lg:col-span-3 flex flex-col gap-3 h-full overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: '55%' }}>
              <UploadPanel uploads={uploads} setUploads={setUploads} />
            </div>
            <div className="flex-1 overflow-hidden">
              <QueryPanel onAnalyze={handleAnalyze} isProcessing={isProcessing} disabled={uploads.length === 0} />
            </div>
          </div>

          {/* Center Col: Map & Primary Results */}
          <div className="lg:col-span-6 flex flex-col gap-4 overflow-hidden min-h-[600px] lg:min-h-0">
            <div className="h-[60%] lg:h-[60%] min-h-[300px] mission-panel flex flex-col">
              <div className="h-8 bg-panel-border/50 flex items-center justify-between px-3 font-mono text-xs text-gray-400 shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" /> {viewMode === 'tactical' ? 'TACTICAL VIEW' : "GOD'S EYE VIEW"}
                </div>
              </div>
              <div className="flex-1 relative overflow-hidden bg-black">
                {viewMode === 'tactical' ? (
                  <MapViewer images={uploads} result={result} />
                ) : (
                  <CesiumGlobe />
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
               <ResultPanel result={result} />
            </div>
          </div>

          {/* Right Col: Evidence & Trace */}
          <div className="lg:col-span-3 overflow-y-auto min-h-[400px]">
            <EvidencePanel result={result} />
          </div>

        </div>
      </main>

      {/* Floating Copilot */}
      <Copilot />

    </div>
  );
}

export default App;
