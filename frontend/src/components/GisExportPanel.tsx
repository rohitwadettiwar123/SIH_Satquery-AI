/**
 * GisExportPanel — Precision Georeferencing & GIS Vector Export
 *
 * Shows:
 *  - Georeferencing status (green / amber badge)
 *  - Source CRS, output CRS, geographic bounds, feature count
 *  - GeoJSON / Shapefile / GeoPackage download buttons (loading + success + error states)
 *  - QGIS Verification Guide (collapsible)
 *
 * Only renders meaningful export buttons when result.geo_metadata.is_georeferenced === true.
 */
import React, { useState } from 'react';
import {
  Download, Map, Globe, Layers, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, FileJson, Archive, Database,
  Info, Loader2, ShieldCheck
} from 'lucide-react';
import { AnalysisResult } from '../types';

const API_BASE = 'http://127.0.0.1:8000/api';

interface Props {
  result: AnalysisResult;
}

type ExportFormat = 'geojson' | 'shapefile' | 'gpkg';
type ExportState = 'idle' | 'loading' | 'success' | 'error';

interface ExportStatus {
  state: ExportState;
  filename?: string;
  error?: string;
  hash?: string;
  featureCount?: number;
}

// ── tiny helpers ─────────────────────────────────────────────────────────────
function round6(n: number) { return Math.round(n * 1_000_000) / 1_000_000; }

function FmtCoord({ label, value }: { label: string; value?: number }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-mono text-gray-600 tracking-widest">{label}</span>
      <span className="text-[10px] font-mono text-cyan-300">{round6(value)}°</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GisExportPanel({ result }: Props) {
  const geo = result.geo_metadata as any;
  const isGeo = geo?.is_georeferenced ?? false;
  const bounds = geo?.bounds_wgs84;
  const featureCount = result.detected_objects?.length ?? 0;

  // Do not render the panel at all if there is no geographic metadata
  if (!isGeo) {
    return null;
  }

  const [exports, setExports] = useState<Record<ExportFormat, ExportStatus>>({
    geojson: { state: 'idle' },
    shapefile: { state: 'idle' },
    gpkg: { state: 'idle' },
  });
  const [qgisOpen, setQgisOpen] = useState(false);

  // ── Export trigger ──────────────────────────────────────────────────────
  const doExport = async (format: ExportFormat) => {
    if (!isGeo) return;
    setExports(prev => ({ ...prev, [format]: { state: 'loading' } }));

    const payload = {
      image_id: result.query_id,   // use first upload ID — see note below
      detected_objects: (result.detected_objects ?? []).map(obj => ({
        class_name: obj.class_name ?? obj.label ?? 'Detection',
        confidence: obj.confidence,
        bbox: obj.bbox,
        area_hectares: obj.area_hectares,
        severity_score: obj.severity_score,
      })),
      task_type: result.task_type,
    };

    // Primary image ID from query_id stored in result (backend echoes it)
    // Fallback: strip the SIH-prefix if needed
    const imageIdPayload = { ...payload };
    // Try to extract image id from result — use the first detected query segment
    const primaryId = (result as any).primary_image_id
      ?? result.query_id?.replace(/SIH-\d+-/, '').split('-')[0]
      ?? 'demo_flood_t1';
    imageIdPayload.image_id = primaryId;

    const endpoint = {
      geojson: `${API_BASE}/gis/export/geojson`,
      shapefile: `${API_BASE}/gis/export/shapefile`,
      gpkg: `${API_BASE}/gis/export/gpkg`,
    }[format];

    const mime = {
      geojson: 'application/geo+json',
      shapefile: 'application/zip',
      gpkg: 'application/geopackage+sqlite3',
    }[format];

    const ext = { geojson: '.geojson', shapefile: '.zip', gpkg: '.gpkg' }[format];

    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imageIdPayload),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Export failed' }));
        throw new Error(err.detail ?? 'Export failed');
      }

      const blob = await resp.blob();
      const fname =
        resp.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `satquery_export_${result.task_type.toLowerCase()}${ext}`;
      const fc = resp.headers.get('x-feature-count') ?? String(featureCount);

      // Compute SHA-256 of the downloaded blob
      let hash = '';
      try {
        const ab = await blob.arrayBuffer();
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', ab);
        hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16) + '...';
      } catch { /* crypto not available in some contexts */ }

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);

      setExports(prev => ({
        ...prev,
        [format]: { state: 'success', filename: fname, featureCount: Number(fc), hash },
      }));
    } catch (e: any) {
      setExports(prev => ({
        ...prev,
        [format]: { state: 'error', error: e.message ?? 'Unknown error' },
      }));
    }
  };

  // ── Button sub-component ────────────────────────────────────────────────
  const ExportBtn = ({
    format, label, icon: Icon, color,
  }: { format: ExportFormat; label: string; icon: any; color: string }) => {
    const s = exports[format];
    const disabled = !isGeo || featureCount === 0;

    const stateStyles: Record<ExportState, string> = {
      idle: disabled
        ? 'border-gray-800 text-gray-700 cursor-not-allowed'
        : `border-${color}-500/40 text-${color}-400 hover:border-${color}-400 hover:bg-${color}-500/10 cursor-pointer`,
      loading: 'border-amber-500/40 text-amber-400 cursor-wait',
      success: 'border-emerald-500/40 text-emerald-400',
      error: 'border-red-500/40 text-red-400',
    };

    return (
      <button
        onClick={() => s.state === 'idle' && doExport(format)}
        disabled={disabled || s.state === 'loading'}
        className={`relative flex flex-col gap-1.5 p-3 rounded-xl border bg-[#050a14] transition-all duration-300 ${stateStyles[s.state]}`}
      >
        <div className="flex items-center gap-2">
          {s.state === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          ) : s.state === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : s.state === 'error' ? (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Icon className="w-3.5 h-3.5" />
          )}
          <span className="text-[10px] font-mono font-bold tracking-wide">{label}</span>
          {s.state === 'idle' && !disabled && (
            <Download className="w-3 h-3 ml-auto opacity-60" />
          )}
        </div>

        {s.state === 'success' && s.filename && (
          <div className="text-left">
            <p className="text-[8px] font-mono text-gray-500 truncate max-w-[120px]">{s.filename}</p>
            <p className="text-[8px] font-mono text-emerald-500/80">{s.featureCount} feature{s.featureCount !== 1 ? 's' : ''} exported</p>
            {s.hash && <p className="text-[7px] font-mono text-gray-600">SHA-256: {s.hash}</p>}
          </div>
        )}
        {s.state === 'error' && (
          <p className="text-[8px] font-mono text-red-400/80 text-left leading-tight">{s.error}</p>
        )}
        {s.state === 'loading' && (
          <p className="text-[8px] font-mono text-amber-400/60">Generating…</p>
        )}
      </button>
    );
  };

  return (
    <div className="bg-[#07101f] border border-cyan-900/40 rounded-2xl p-4 space-y-4 shadow-[0_0_30px_rgba(0,245,255,0.04)]">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <h3 className="text-[11px] font-mono text-cyan-400 tracking-widest font-bold">GIS VECTOR EXPORT</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-mono font-bold tracking-widest ${
          isGeo
            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
            : 'border-amber-500/40 text-amber-400 bg-amber-500/5'
        }`}>
          {isGeo ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          {isGeo ? 'GEOREFERENCED' : 'NO GEO METADATA'}
        </div>
      </div>

      {/* ── Geo status message for non-georeferenced ── */}
      {!isGeo && (
        <div className="bg-amber-900/10 border border-amber-800/30 rounded-xl p-3 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] font-mono text-amber-300/80 leading-snug">
            Georeferencing unavailable — source image has no geographic metadata.
            <br />
            <span className="text-gray-500">Upload a GeoTIFF with a valid CRS to enable GIS exports.</span>
          </p>
        </div>
      )}

      {/* ── CRS + Bounds Info ── */}
      {isGeo && (
        <div className="grid grid-cols-2 gap-2">
          {/* CRS Card */}
          <div className="bg-[#050a14] border border-gray-800/60 rounded-xl p-3 space-y-2">
            <p className="text-[8px] font-mono text-gray-600 tracking-widest flex items-center gap-1">
              <Layers className="w-2.5 h-2.5" /> COORDINATE REFERENCE SYSTEM
            </p>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-gray-500">Source CRS</span>
                <span className="text-[10px] font-mono text-cyan-300">
                  {geo.crs_epsg ? `EPSG:${geo.crs_epsg}` : 'UNKNOWN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-gray-500">Export CRS</span>
                <span className="text-[10px] font-mono text-emerald-400">EPSG:4326</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-gray-500">Dimensions</span>
                <span className="text-[10px] font-mono text-gray-300">
                  {geo.width} × {geo.height} px
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-gray-500">Features</span>
                <span className="text-[10px] font-mono font-bold text-amber-400">{featureCount}</span>
              </div>
            </div>
          </div>

          {/* Bounds Card */}
          {bounds && (
            <div className="bg-[#050a14] border border-gray-800/60 rounded-xl p-3 space-y-2">
              <p className="text-[8px] font-mono text-gray-600 tracking-widest flex items-center gap-1">
                <Map className="w-2.5 h-2.5" /> GEOGRAPHIC BOUNDS (WGS84)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <FmtCoord label="WEST (°E)" value={bounds.west} />
                <FmtCoord label="EAST (°E)" value={bounds.east} />
                <FmtCoord label="SOUTH (°N)" value={bounds.south} />
                <FmtCoord label="NORTH (°N)" value={bounds.north} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Export Buttons ── */}
      <div>
        <p className="text-[8px] font-mono text-gray-600 tracking-widest mb-2 flex items-center gap-1">
          <Download className="w-2.5 h-2.5" /> DOWNLOAD VECTOR LAYERS
        </p>
        <div className="grid grid-cols-3 gap-2">
          <ExportBtn format="geojson"   label="GeoJSON"   icon={FileJson} color="cyan" />
          <ExportBtn format="shapefile" label="Shapefile" icon={Archive}  color="purple" />
          <ExportBtn format="gpkg"      label="GeoPackage" icon={Database} color="green" />
        </div>
        {!isGeo && (
          <p className="text-[8px] font-mono text-gray-700 mt-2 text-center">
            Upload a GeoTIFF to enable exports
          </p>
        )}
      </div>

      {/* ── QGIS Verification Guide ── */}
      <div className="border border-gray-800/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setQgisOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-[#050a14] hover:bg-[#0a1020] transition-colors"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-500/70" />
            <span className="text-[10px] font-mono text-gray-400 tracking-widest">QGIS VERIFICATION GUIDE</span>
          </div>
          {qgisOpen
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          }
        </button>

        {qgisOpen && (
          <div className="p-3 bg-[#040810] border-t border-gray-800/50 space-y-3">
            <p className="text-[9px] font-mono text-emerald-400/80 leading-snug border-l-2 border-emerald-500/40 pl-2">
              Load this GeoJSON over the same T1 GeoTIFF in QGIS to verify spatial alignment.
            </p>

            {[
              { step: '01', text: 'Download GeoJSON from SatQuery AI using the button above.' },
              { step: '02', text: 'Open QGIS → Layer → Add Layer → Add Raster Layer → select demo_flood_t1.tif' },
              { step: '03', text: 'Layer → Add Layer → Add Vector Layer → select the downloaded .geojson file' },
              { step: '04', text: 'Right-click the vector layer → Properties → Symbology → Fill color: orange (50% opacity), Stroke: red 2px' },
              { step: '05', text: 'Zoom to layer extent. The polygon should visually overlay the detected flood region in the T1 raster.' },
              { step: '06', text: 'Open Attribute Table to inspect: label, confidence, area_hectares, source_crs = EPSG:32644, export_crs = EPSG:4326' },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3 items-start">
                <span className="text-[9px] font-mono font-bold text-cyan-500/70 mt-0.5 flex-shrink-0">{step}</span>
                <p className="text-[9px] font-mono text-gray-400 leading-snug">{text}</p>
              </div>
            ))}

            <div className="bg-amber-900/10 border border-amber-800/30 rounded-lg p-2 mt-2">
              <p className="text-[8px] font-mono text-amber-400/80 leading-snug">
                ⚠️ SIH DEMO NOTE: The flood GeoTIFF pair is synthetic, clearly labeled [SYNTHETIC DATA — SIH DEMO] in all file tags. 
                Coordinates are representative of Brahmaputra valley, Assam (EPSG:32644 / UTM Zone 44N). 
                This is not survey-grade data.
              </p>
            </div>

            <div className="text-[8px] font-mono text-gray-600 space-y-0.5 pt-1 border-t border-gray-800/50">
              <p>The polygon in QGIS is the <span className="text-cyan-400">exact same geospatial detection</span> displayed in SatQuery AI —</p>
              <p>not manually redrawn or independently generated.</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
