import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Viewer as ResiumViewer, Entity, CameraFlyTo } from 'resium';
import {
  Viewer as CesiumViewer,
  Cartesian3,
  Cartographic,
  Color,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Rectangle,
  CallbackProperty,
} from 'cesium';
import {
  MapPin, Search, Satellite, ZoomIn, ZoomOut,
  Navigation, Layers, Copy, Trash2, ChevronRight,
  Activity, User, Globe, BarChart3, X, MousePointer2,
  Target, Crosshair, Sparkles, ArrowRight, CheckCircle,
  Maximize2, Info,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
export interface ExplorerAOI {
  north: number;
  south: number;
  east: number;
  west: number;
  centerLat: number;
  centerLng: number;
  areaKm2: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

interface Props {
  onAnalyze: (aoi: ExplorerAOI, year: number) => void | Promise<void>;
  existingAoi?: ExplorerAOI | null;
}

// ── Location Presets (real verified coordinates) ─────────────────────────────
const PRESETS = [
  { label: 'Dubai Waterfront',      lat: 25.2048,  lng: 55.2708,  alt: 10000, emoji: '🏙️' },
  { label: 'Kolkata Metropolitan',  lat: 22.5726,  lng: 88.3639,  alt: 25000, emoji: '🌆' },
  { label: 'Delhi NCR',             lat: 28.7041,  lng: 77.1025,  alt: 30000, emoji: '🏛️' },
  { label: 'Mumbai Coastline',      lat: 19.0760,  lng: 72.8777,  alt: 22000, emoji: '🌊' },
  { label: 'Amazon Deforestation',  lat: -3.4653,  lng: -62.2159, alt: 40000, emoji: '🌿' },
  { label: 'Gangotri Glacier',      lat: 30.9249,  lng: 79.0670,  alt: 18000, emoji: '🏔️' },
] as const;

// ── Haversine area (km²) ─────────────────────────────────────────────────────
function calcAreaKm2(north: number, south: number, east: number, west: number): number {
  const R = 6371;
  const lat1 = south * Math.PI / 180;
  const lat2 = north * Math.PI / 180;
  const dLng = Math.abs(east - west) * Math.PI / 180;
  const dLat = Math.abs(lat2 - lat1);
  const hLat = Math.sin(dLat / 2) ** 2;
  const hLng = Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const ns = 2 * R * Math.asin(Math.sqrt(hLat));
  const ew = 2 * R * Math.asin(Math.sqrt(hLng));
  return Math.abs(ns * ew);
}

// ── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedValue({ value, decimals = 4 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    let frame: number;
    const start = display;
    const end = value;
    const duration = 600;
    const startTime = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - (1 - t) ** 3;
      setDisplay(start + (end - start) * ease);
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

// ── Pulse Ring ────────────────────────────────────────────────────────────────
function PulseRing() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping"
          style={{ animationDelay: `${i * 0.4}s`, animationDuration: '2s' }}
        />
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Explorer3D({ onAnalyze, existingAoi }: Props) {
  const viewerRef = useRef<{ cesiumElement: CesiumViewer } | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [aoi, setAoi] = useState<ExplorerAOI | null>(existingAoi ?? null);
  const [copied, setCopied] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lng: number; lat: number; alt: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [panelVisible, setPanelVisible] = useState(true);
  const [drawHint, setDrawHint] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [timelineFilter, setTimelineFilter] = useState<string>('ALL');

  // Live preview bounds during drag
  const drawStartRef = useRef<{ lat: number; lng: number } | null>(null);
  const liveAoiRef = useRef<ExplorerAOI | null>(null);
  const [liveAoi, setLiveAoi] = useState<ExplorerAOI | null>(null);

  // Suppress Ion token warning via CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = '.cesium-widget-errorPanel,.cesium-viewer-bottom,.cesium-credit-logoContainer{display:none!important}';
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ── Fly to preset ─────────────────────────────────────────────────────────
  const flyToPreset = useCallback((preset: (typeof PRESETS)[number]) => {
    setActivePreset(preset.label);
    setCurrentLocation({ name: preset.label, lat: preset.lat, lng: preset.lng });
    setFlyTarget({ lng: preset.lng, lat: preset.lat, alt: preset.alt });
  }, []);

  // ── Pick globe point ──────────────────────────────────────────────────────
  const pickGlobePoint = useCallback((viewer: CesiumViewer, pos: any) => {
    // 1. Try mathematical ellipsoid intersection (most reliable for top-down views)
    const cartesian = viewer.camera.pickEllipsoid(pos, viewer.scene.globe.ellipsoid);
    if (cartesian) {
      const carto = Cartographic.fromCartesian(cartesian);
      return {
        lat: CesiumMath.toDegrees(carto.latitude),
        lng: CesiumMath.toDegrees(carto.longitude),
      };
    }
    // 2. Fallback to raycast if ellipsoid fails (e.g., looking at mountains sideways)
    const ray = viewer.camera.getPickRay(pos);
    if (!ray) return null;
    const cart = viewer.scene.globe.pick(ray, viewer.scene);
    if (!cart) return null;
    const carto = Cartographic.fromCartesian(cart);
    return {
      lat: CesiumMath.toDegrees(carto.latitude),
      lng: CesiumMath.toDegrees(carto.longitude),
    };
  }, []);

  // ── Compute AOI from two corners ──────────────────────────────────────────
  const computeAOI = useCallback((start: { lat: number; lng: number }, end: { lat: number; lng: number }): ExplorerAOI => {
    const north = Math.max(start.lat, end.lat);
    const south = Math.min(start.lat, end.lat);
    const east  = Math.max(start.lng, end.lng);
    const west  = Math.min(start.lng, end.lng);
    const centerLat = (north + south) / 2;
    const centerLng = (east + west) / 2;
    const areaKm2 = calcAreaKm2(north, south, east, west);
    
    return {
      north, south, east, west, centerLat, centerLng, areaKm2,
      bbox: { x1: west, y1: north, x2: east, y2: south } // Return actual coordinates
    };
  }, []);

  // ── Start drawing ─────────────────────────────────────────────────────────
  const startDrawing = useCallback(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) {
      alert("Error: 3D Map not fully loaded yet. Please wait a moment.");
      return;
    }

    setIsDrawing(true);
    setAoi(null);
    setDrawHint('Click on the map to set the first corner');
    drawStartRef.current = null;
    liveAoiRef.current = null;

    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;

    if (handlerRef.current) { handlerRef.current.destroy(); handlerRef.current = null; }
    viewer.canvas.style.cursor = 'crosshair';

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((event: any) => {
      const pt = pickGlobePoint(viewer, event.position);
      if (!pt) {
        setDrawHint('Please click directly on the Earth surface.');
        return;
      }
      drawStartRef.current = pt;
      setDrawHint('Drag to draw your area of interest');
      
      // Initialize a zero-size draft to trigger the preview Entity
      liveAoiRef.current = computeAOI(pt, pt);
      
      // Only do ONE state update to mount the preview Entity
      // We don't update this on mouse-move to avoid 60fps React re-renders!
      setLiveAoi(liveAoiRef.current);
    }, ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((event: any) => {
      if (!drawStartRef.current) return;
      const pt = pickGlobePoint(viewer, event.endPosition);
      if (!pt) return;
      
      // Just update the REF, do NOT call setLiveAoi here!
      // The Cesium CallbackProperty will read from this ref on every frame.
      liveAoiRef.current = computeAOI(drawStartRef.current, pt);
    }, ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction((event: any) => {
      const startPt = drawStartRef.current;
      const pt = pickGlobePoint(viewer, event.position);
      
      // Always cleanup first
      viewer.scene.screenSpaceCameraController.enableRotate = true;
      viewer.scene.screenSpaceCameraController.enableTranslate = true;
      viewer.scene.screenSpaceCameraController.enableZoom = true;
      viewer.scene.screenSpaceCameraController.enableTilt = true;
      viewer.canvas.style.cursor = 'default';
      
      handler.destroy();
      handlerRef.current = null;
      setIsDrawing(false);
      setLiveAoi(null);
      liveAoiRef.current = null;
      setDrawHint('');
      drawStartRef.current = null;

      if (!startPt || !pt) return;

      const finalAoi = computeAOI(startPt, pt);
      if (Math.abs(finalAoi.north - finalAoi.south) < 0.0001 || Math.abs(finalAoi.east - finalAoi.west) < 0.0001) {
        return;
      }

      setAoi(finalAoi);
    }, ScreenSpaceEventType.LEFT_UP);

    handlerRef.current = handler;
  }, [pickGlobePoint, computeAOI]);

  const cancelDrawing = useCallback(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (viewer) {
      viewer.scene.screenSpaceCameraController.enableRotate = true;
      viewer.scene.screenSpaceCameraController.enableTranslate = true;
      viewer.scene.screenSpaceCameraController.enableZoom = true;
      viewer.scene.screenSpaceCameraController.enableTilt = true;
      viewer.canvas.style.cursor = 'default';
    }
    if (handlerRef.current) { handlerRef.current.destroy(); handlerRef.current = null; }
    setIsDrawing(false);
    setLiveAoi(null);
    setDrawHint('');
    drawStartRef.current = null;
  }, []);

  const clearAoi = useCallback(() => { setAoi(null); }, []);
  const [isExporting, setIsExporting] = useState(false);

  const handleAnalyzeClick = async () => {
    if (!aoi) return;
    setIsExporting(true);
    
    try {
      await onAnalyze(aoi, selectedYear);
    } finally {
      setIsExporting(false);
    }
  };

  const zoomIn = () => {
    const v = viewerRef.current?.cesiumElement;
    if (v) v.camera.zoomIn(v.camera.positionCartographic.height * 0.3);
  };
  const zoomOut = () => {
    const v = viewerRef.current?.cesiumElement;
    if (v) v.camera.zoomOut(v.camera.positionCartographic.height * 0.5);
  };
  const resetView = () => {
    const v = viewerRef.current?.cesiumElement;
    if (v) v.camera.flyTo({
      destination: Cartesian3.fromDegrees(78.9629, 20.5937, 6000000),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-45), roll: 0 },
      duration: 2,
    });
  };

  const copyCoords = () => {
    if (!aoi) return;
    const text = `N: ${aoi.north.toFixed(6)}° | S: ${aoi.south.toFixed(6)}° | E: ${aoi.east.toFixed(6)}° | W: ${aoi.west.toFixed(6)}°\nCenter: ${aoi.centerLat.toFixed(6)}°N, ${aoi.centerLng.toFixed(6)}°E\nArea: ${aoi.areaKm2.toFixed(2)} km²`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const data = await res.json();
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const latN = parseFloat(lat), lngN = parseFloat(lon);
        setCurrentLocation({ name: display_name.split(',')[0], lat: latN, lng: lngN });
        setFlyTarget({ lat: latN, lng: lngN, alt: 20000 });
        setActivePreset(null);
      }
    } catch { /* silent */ }
  };

  useEffect(() => () => { if (handlerRef.current) handlerRef.current.destroy(); }, []);

  const displayAoi = liveAoi || aoi;

  return (
    <div className="h-full w-full flex flex-col bg-[#020810] overflow-hidden relative">

      {/* ── Ambient background particles ───────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-400/20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
        {/* Gradient glows */}
        <div className="absolute -top-20 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div className="h-14 flex-shrink-0 relative z-30 border-b border-cyan-900/30"
           style={{ background: 'linear-gradient(135deg, #020c1b 0%, #040e20 50%, #020c1b 100%)' }}>
        {/* Animated top border */}
        <div className="absolute top-0 left-0 right-0 h-[1px]"
             style={{ background: 'linear-gradient(90deg, transparent 0%, #00f5ff40 30%, #00f5ff 50%, #00f5ff40 70%, transparent 100%)' }} />

        <div className="h-full flex items-center px-5 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 mr-3">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-xl border border-cyan-500/40 flex items-center justify-center animate-pulse">
                <Globe className="w-4.5 h-4.5 text-cyan-400" />
              </div>
              <PulseRing />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white font-mono tracking-wider leading-none">
                SatQuery<span className="text-cyan-400">.AI</span>
                <span className="ml-2 text-[10px] font-normal text-cyan-600 border border-cyan-800/60 rounded px-1.5 py-0.5">3D</span>
              </div>
              <div className="text-[9px] text-gray-500 font-sans tracking-[0.15em] mt-0.5">
                SATELLITE VIEW • EXPLORE • ANALYZE
              </div>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-lg relative group">
            <div className="absolute inset-0 rounded-xl bg-cyan-500/5 border border-cyan-900/30 group-focus-within:border-cyan-500/50 group-focus-within:bg-cyan-500/10 transition-all duration-300" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 group-focus-within:text-cyan-400 transition-colors z-10" />
            <input
              className="relative w-full bg-transparent pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:placeholder-gray-500 transition-all z-10"
              placeholder="Search location — city, region, landmark, or lat/lng..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </form>

          {/* Satellite + Status badges */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0a1628]/80 border border-gray-700/40">
              <Satellite className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-gray-300 font-mono">Sentinel-2</span>
              <span className="w-1 h-3 bg-gray-700 rounded" />
              <span className="text-[10px] text-gray-500">Multi-Year</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0a1a10]/80 border border-green-900/40">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]" />
              <span className="text-[11px] text-green-400 font-mono font-bold">LIVE</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#0a1628] border border-gray-700/40 flex items-center justify-center hover:border-cyan-600/50 transition-colors cursor-pointer">
              <User className="w-3.5 h-3.5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* ── PRESET CHIPS ────────────────────────────────────────────────────── */}
      <div className="h-11 flex-shrink-0 z-20 border-b border-cyan-900/20 overflow-x-auto flex items-center px-4 gap-2 scrollbar-hide"
           style={{ background: 'rgba(3,9,18,0.95)' }}>
        <span className="text-[9px] text-gray-600 font-mono tracking-widest mr-1 flex-shrink-0">QUICK ACCESS:</span>
        {PRESETS.map(preset => (
          <button
            key={preset.label}
            onClick={() => flyToPreset(preset)}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all duration-300 border flex-shrink-0 ${
              activePreset === preset.label
                ? 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200 shadow-[0_0_16px_rgba(0,245,255,0.25)]'
                : 'bg-[#0a1628]/60 border-gray-700/40 text-gray-500 hover:border-cyan-700/50 hover:text-gray-300 hover:bg-cyan-500/10'
            }`}
          >
            <span className="text-[11px]">{preset.emoji}</span>
            <MapPin className={`w-2.5 h-2.5 flex-shrink-0 ${activePreset === preset.label ? 'text-cyan-400' : 'text-gray-600 group-hover:text-cyan-600'}`} />
            <span className="font-medium">{preset.label}</span>
            {activePreset === preset.label && <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse ml-0.5" />}
          </button>
        ))}
      </div>

      {/* ── MAIN: MAP + PANEL ───────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 relative">

        {/* ── CESIUM MAP ─────────────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">

          {/* Drawing mode overlay */}
          {isDrawing && (
            <div className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute inset-0 border-2 border-cyan-500/30 animate-pulse" />
              {/* Corner indicators */}
              {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                <div key={i} className={`absolute ${pos} w-6 h-6 border-cyan-400`}
                     style={{
                       borderTopWidth: i < 2 ? 2 : 0,
                       borderBottomWidth: i >= 2 ? 2 : 0,
                       borderLeftWidth: i % 2 === 0 ? 2 : 0,
                       borderRightWidth: i % 2 === 1 ? 2 : 0,
                     }} />
              ))}
            </div>
          )}

          <ResiumViewer
            ref={viewerRef as any}
            full
            animation={false}
            timeline={false}
            infoBox={false}
            navigationHelpButton={false}
            homeButton={false}
            geocoder={false}
            baseLayerPicker={false}
            sceneModePicker={false}
            className="absolute inset-0 z-0"
          >
            {!flyTarget && (
              <CameraFlyTo
                duration={0}
                destination={Cartesian3.fromDegrees(78.9629, 20.5937, 6000000)}
                orientation={{ heading: 0, pitch: CesiumMath.toRadians(-45), roll: 0 }}
              />
            )}
            {flyTarget && (
              <CameraFlyTo
                key={`${flyTarget.lat}-${flyTarget.lng}`}
                duration={2.8}
                destination={Cartesian3.fromDegrees(flyTarget.lng, flyTarget.lat, flyTarget.alt)}
                orientation={{ heading: CesiumMath.toRadians(5), pitch: CesiumMath.toRadians(-38), roll: 0 }}
              />
            )}
            {currentLocation && (
              <Entity
                name={currentLocation.name}
                position={Cartesian3.fromDegrees(currentLocation.lng, currentLocation.lat, 50)}
                point={{ pixelSize: 14, color: Color.CYAN, outlineColor: Color.WHITE, outlineWidth: 2 }}
                label={{
                  text: currentLocation.name,
                  font: '13px monospace',
                  fillColor: Color.WHITE,
                  outlineColor: Color.fromCssColorString('#040c1a'),
                  outlineWidth: 2,
                  pixelOffset: { x: 0, y: -30 } as any,
                  showBackground: true,
                  backgroundColor: Color.fromCssColorString('#040c1a').withAlpha(0.9),
                  backgroundPadding: { x: 10, y: 5 } as any,
                }}
              />
            )}
            {/* Live preview (during drag) */}
            {liveAoi && (
              <Entity
                name="__preview__"
                rectangle={{
                  coordinates: new CallbackProperty(() => {
                    const current = liveAoiRef.current;
                    if (!current) return Rectangle.fromDegrees(0,0,0,0);
                    return Rectangle.fromDegrees(current.west, current.south, current.east, current.north);
                  }, false) as any,
                  material: Color.fromCssColorString('#00f5ff').withAlpha(0.12),
                  outline: true,
                  outlineColor: Color.fromCssColorString('#00f5ff').withAlpha(0.7),
                  outlineWidth: 1.5,
                  height: 0,
                }}
              />
            )}
            {/* Final AOI */}
            {aoi && (
              <Entity
                name="SelectedArea"
                rectangle={{
                  coordinates: Rectangle.fromDegrees(aoi.west, aoi.south, aoi.east, aoi.north),
                  material: Color.fromCssColorString('#00f5ff').withAlpha(0.18),
                  outline: true,
                  outlineColor: Color.fromCssColorString('#00f5ff').withAlpha(0.95),
                  outlineWidth: 2.5,
                  height: 0,
                }}
                label={{
                  text: `◈ Selected Area\n${aoi.areaKm2.toFixed(2)} km²`,
                  font: 'bold 12px monospace',
                  fillColor: Color.CYAN,
                  showBackground: true,
                  backgroundColor: Color.fromCssColorString('#040c1a').withAlpha(0.9),
                  backgroundPadding: { x: 10, y: 6 } as any,
                }}
                position={Cartesian3.fromDegrees(aoi.centerLng, aoi.centerLat, 200)}
              />
            )}
          </ResiumViewer>

          {/* ── Floating Controls ──────────────────────────────────────────── */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
            {[
              { icon: <ZoomIn className="w-4 h-4" />, action: zoomIn, tip: 'Zoom In' },
              { icon: <ZoomOut className="w-4 h-4" />, action: zoomOut, tip: 'Zoom Out' },
              { icon: <Navigation className="w-4 h-4" />, action: resetView, tip: 'Reset View' },
              { icon: <Layers className="w-4 h-4" />, action: () => {}, tip: 'Layers' },
              { icon: <Maximize2 className="w-4 h-4" />, action: () => setPanelVisible(!panelVisible), tip: panelVisible ? 'Hide Panel' : 'Show Panel' },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} title={btn.tip}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-cyan-300 transition-all duration-200 group relative"
                style={{ background: 'rgba(4,12,26,0.85)', border: '1px solid rgba(0,245,255,0.15)', backdropFilter: 'blur(8px)' }}>
                {btn.icon}
                <div className="absolute right-full mr-2 px-2 py-1 bg-[#040c1a] border border-cyan-900/40 rounded text-[10px] text-cyan-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {btn.tip}
                </div>
              </button>
            ))}
          </div>

          {/* ── Compass ───────────────────────────────────────────────────── */}
          <div className="absolute top-4 left-4 z-20">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-center relative"
                 style={{ background: 'rgba(4,12,26,0.85)', border: '1px solid rgba(0,245,255,0.2)', backdropFilter: 'blur(8px)' }}>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] font-bold text-red-400">N</span>
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-l-transparent border-r-transparent border-b-red-400" />
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-600" />
                <span className="text-[8px] font-bold text-gray-500">S</span>
              </div>
            </div>
          </div>

          {/* ── Drawing status banner ─────────────────────────────────────── */}
          {drawHint && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
              <div className="px-5 py-3 rounded-xl text-sm font-bold text-black font-mono shadow-2xl flex items-center gap-2"
                   style={{ background: 'linear-gradient(135deg, #00f5ff, #00c9b1)', boxShadow: '0 0 30px rgba(0,245,255,0.5)' }}>
                <Crosshair className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                {drawHint}
              </div>
            </div>
          )}

          {/* ── Location chip ─────────────────────────────────────────────── */}
          {currentLocation && !isDrawing && (
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl"
                 style={{ background: 'rgba(4,12,26,0.9)', border: '1px solid rgba(0,245,255,0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
              <div className="relative w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-600/30 flex items-center justify-center">
                <Globe className="w-5 h-5 text-cyan-500" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#040c1a] animate-pulse" />
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-none">{currentLocation.name}</div>
                <div className="text-[11px] text-gray-400 font-mono mt-1">
                  {Math.abs(currentLocation.lat).toFixed(4)}° {currentLocation.lat >= 0 ? 'N' : 'S'} &nbsp;·&nbsp;
                  {Math.abs(currentLocation.lng).toFixed(4)}° {currentLocation.lng >= 0 ? 'E' : 'W'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: AREA SELECTOR ──────────────────────────────────────── */}
        {panelVisible && (
          <div className="w-68 flex-shrink-0 flex flex-col overflow-y-auto z-20 relative"
               style={{
                 width: '272px',
                 background: 'linear-gradient(180deg, rgba(4,12,26,0.98) 0%, rgba(2,8,16,0.98) 100%)',
                 borderLeft: '1px solid rgba(0,245,255,0.12)',
               }}>
            {/* Panel top glow line */}
            <div className="absolute top-0 left-0 right-0 h-[1px]"
                 style={{ background: 'linear-gradient(90deg, transparent, #00f5ff40, transparent)' }} />

            {/* Panel Header */}
            <div className="px-4 py-4 border-b border-cyan-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                    <Target className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white font-mono tracking-widest">AREA SELECTOR</div>
                    <div className="text-[9px] text-gray-600 mt-0.5">Geographic Intelligence</div>
                  </div>
                </div>
                {aoi && (
                  <div className="flex items-center gap-1 text-[10px] text-green-400 font-mono px-2 py-1 rounded-full bg-green-500/10 border border-green-600/30">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Selected
                  </div>
                )}
              </div>
            </div>

            {/* Draw Area Controls */}
            <div className="p-3 border-b border-cyan-900/15">
              {!isDrawing ? (
                <div className="flex gap-2">
                  <button onClick={startDrawing}
                    className="flex-1 group relative overflow-hidden flex items-center gap-2.5 px-3 py-3 rounded-xl border border-cyan-600/40 bg-cyan-500/10 hover:bg-cyan-500/20 hover:border-cyan-500/70 transition-all duration-300 text-left">
                    {/* Animated gradient bg on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                    <div className="relative w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <MousePointer2 className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="relative">
                      <div className="text-sm font-bold text-cyan-200">Draw Area</div>
                      <div className="text-[10px] text-cyan-600 mt-0.5">Rectangle / Polygon</div>
                    </div>
                  </button>
                  {aoi && (
                    <button onClick={clearAoi}
                      className="px-2.5 py-2 rounded-xl border border-gray-700/40 text-gray-500 hover:border-red-600/50 hover:text-red-400 hover:bg-red-500/5 transition-all text-xs flex flex-col items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="text-[9px]">Clear</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-3 rounded-xl border border-cyan-400/50 bg-cyan-500/15 animate-pulse">
                    <Crosshair className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '2s' }} />
                    <div>
                      <div className="text-sm font-bold text-cyan-200">Drawing Mode Active</div>
                      <div className="text-[10px] text-cyan-500">{drawHint || 'Click on map to begin'}</div>
                    </div>
                  </div>
                  <button onClick={cancelDrawing}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all text-xs">
                    <X className="w-3 h-3" /> Cancel Drawing
                  </button>
                </div>
              )}
            </div>

            {/* Selected Area Details */}
            <div className="p-3 flex-1">
              {displayAoi ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-bold text-white tracking-wide">
                      {liveAoi ? 'LIVE PREVIEW' : 'SELECTED AREA'}
                    </span>
                    {liveAoi && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                  </div>

                  {/* Bounding box grid */}
                  <div className="rounded-xl overflow-hidden border border-gray-800/50"
                       style={{ background: 'rgba(6,15,30,0.8)' }}>
                    {[
                      { label: 'North Lat', val: displayAoi.north, suffix: '° N', color: 'text-cyan-300' },
                      { label: 'South Lat', val: displayAoi.south, suffix: '° N', color: 'text-cyan-300' },
                      { label: 'East Long', val: displayAoi.east,  suffix: '° E', color: 'text-teal-300' },
                      { label: 'West Long', val: displayAoi.west,  suffix: '° W', color: 'text-teal-300' },
                    ].map((row, i) => (
                      <div key={row.label} className={`flex items-center justify-between px-3 py-2.5 ${i < 3 ? 'border-b border-gray-800/40' : ''}`}>
                        <span className="text-[9px] text-gray-500 font-mono tracking-wide uppercase">{row.label}</span>
                        <span className={`text-[11px] font-mono font-bold ${row.color}`}>
                          {liveAoi
                            ? <AnimatedValue value={row.val} decimals={4} />
                            : row.val.toFixed(4)
                          }
                          {row.suffix}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Center + Area + CRS */}
                  <div className="rounded-xl overflow-hidden border border-gray-800/50"
                       style={{ background: 'rgba(6,15,30,0.8)' }}>
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800/40">
                      <span className="text-[9px] text-gray-500 font-mono">CENTER</span>
                      <span className="text-[10px] font-mono font-bold text-gray-200">
                        {displayAoi.centerLat.toFixed(4)}°N,{displayAoi.centerLng.toFixed(4)}°E
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800/40">
                      <span className="text-[9px] text-gray-500 font-mono">AREA</span>
                      <span className="text-[12px] font-mono font-bold text-cyan-400">
                        {liveAoi ? <AnimatedValue value={displayAoi.areaKm2} decimals={2} /> : displayAoi.areaKm2.toFixed(2)} km²
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-[9px] text-gray-500 font-mono">CRS</span>
                      <span className="text-[10px] font-mono text-gray-400">EPSG:4326 (WGS84)</span>
                    </div>
                  </div>

                  {/* Action buttons — only if final AOI */}
                  {aoi && !liveAoi && (
                    <div className="flex gap-2">
                      <button onClick={copyCoords}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-700/50 text-gray-400 hover:border-cyan-700/50 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all text-[11px]">
                        <Copy className="w-3 h-3" />
                        {copied ? '✓ Copied!' : 'Copy Coords'}
                      </button>
                      <button onClick={clearAoi}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-700/50 text-gray-400 hover:border-red-600/50 hover:text-red-400 hover:bg-red-500/5 transition-all text-[11px]">
                        <X className="w-3 h-3" /> Clear
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="relative w-16 h-16 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#0a1628]/80 border border-gray-800/60 flex items-center justify-center">
                      <MousePointer2 className="w-6 h-6 text-gray-700" />
                    </div>
                    <div className="absolute inset-0 rounded-2xl border border-gray-700/30 animate-ping" style={{ animationDuration: '3s' }} />
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed max-w-[180px] font-mono">
                    No area selected. Draw an area on the map to begin analysis.
                  </p>
                  <button onClick={startDrawing}
                    className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-cyan-400 border border-cyan-600/30 hover:bg-cyan-500/10 transition-all hover:border-cyan-500/60">
                    + Draw Now
                  </button>
                </div>
              )}
            </div>

            {/* Info bar */}
            {aoi && (
              <div className="px-3 py-2 border-t border-cyan-900/15">
                <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono">
                  <Info className="w-2.5 h-2.5 text-gray-700" />
                  Click map to redraw • Hover box to view details
                </div>
              </div>
            )}

            {/* Quick Presets accordion */}
            <div className="border-t border-cyan-900/20">
              <button className="w-full flex items-center justify-between px-4 py-3 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-800" />
                  <span className="font-mono tracking-wider">QUICK PRESETS</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ANALYZE THIS VIEW CTA */}
            <div className="p-3 border-t border-cyan-900/30 flex-shrink-0">
              <button
                onClick={handleAnalyzeClick}
                disabled={!aoi || isExporting}
                className={`w-full relative overflow-hidden flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-sm transition-all duration-300 ${
                  aoi && !isExporting
                    ? 'text-black cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-gray-800/40 border border-gray-700/30 text-gray-600 cursor-not-allowed'
                }`}
                style={aoi && !isExporting ? {
                  background: 'linear-gradient(135deg, #00f5ff 0%, #00c9b1 50%, #00a896 100%)',
                  boxShadow: '0 0 25px rgba(0,245,255,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                } : {}}>
                {aoi && !isExporting && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700" />
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </>
                )}
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-cyan-500">Retrieving Imagery...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>Analyze This View</span>
                    {aoi && <ArrowRight className="w-4 h-4" />}
                  </>
                )}
              </button>
              {!aoi && (
                <p className="text-[9px] text-gray-600 text-center mt-2 font-mono">SELECT AN AREA TO ENABLE</p>
              )}
            </div>
          </div>
        )}
        {/* ── Earth Observation Timeline ─────────────────────────────────────── */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-4 pointer-events-auto">
             <div className="bg-[#0b101e] border border-[#1a253a] rounded-lg p-3 shadow-2xl flex flex-col gap-3 font-mono">
               {/* Header */}
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="text-[#ff9800] text-sm">⏳</div>
                   <div className="text-cyan-400 font-bold text-sm tracking-wide">
                     EARTH OBSERVATION TIMELINE
                     <span className="text-gray-400 font-normal ml-3 text-xs">
                       Active Globe Layer: <span className="text-gray-200">Sentinel-2 Cloudless ({selectedYear})</span>
                     </span>
                   </div>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <button className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#102a35] border border-cyan-800 text-cyan-400 transition-colors hover:bg-cyan-900/40">
                     🛰️ Sentinel-2 Mosaic (Active)
                   </button>
                   <button className={`px-3 py-1 rounded border transition-colors ${timelineFilter === 'ALL' ? 'bg-[#102a35] border-cyan-800 text-cyan-400' : 'bg-transparent border-[#1a253a] text-gray-500 hover:text-gray-300'}`} onClick={() => setTimelineFilter('ALL')}>ALL</button>
                   <button className={`px-3 py-1 rounded border transition-colors ${timelineFilter === 'SENTINEL-2' ? 'bg-[#102a35] border-cyan-800 text-cyan-400' : 'bg-transparent border-[#1a253a] text-gray-500 hover:text-gray-300'}`} onClick={() => setTimelineFilter('SENTINEL-2')}>SENTINEL-2</button>
                   <button className={`px-3 py-1 rounded border transition-colors ${timelineFilter === 'SENTINEL-1' ? 'bg-[#102a35] border-cyan-800 text-cyan-400' : 'bg-transparent border-[#1a253a] text-gray-500 hover:text-gray-300'}`} onClick={() => setTimelineFilter('SENTINEL-1')}>SENTINEL-1</button>
                 </div>
               </div>

               {/* Slider */}
               <div className="flex items-center gap-4 mt-2">
                 <span className="text-gray-500 text-xs font-bold">2016</span>
                 <div className="relative flex-1 h-3 bg-[#111827] rounded-full flex items-center">
                    <input 
                      type="range" 
                      min="2016" 
                      max="2024" 
                      value={selectedYear} 
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full absolute z-10 opacity-0 cursor-pointer"
                    />
                    <div className="absolute left-0 h-full bg-cyan-400 rounded-full" style={{ width: `${((selectedYear - 2016) / 8) * 100}%` }} />
                    <div className="absolute w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.6)] transform -translate-x-1/2" style={{ left: `${((selectedYear - 2016) / 8) * 100}%` }} />
                 </div>
                 <span className="text-gray-500 text-xs font-bold">2024</span>
                 <div className="px-3 py-1 rounded bg-[#102a35] border border-cyan-800 text-cyan-400 text-xs font-bold ml-2">
                   YEAR: {selectedYear}
                 </div>
               </div>

               {/* Footer text */}
               <div className="text-[10px] text-gray-400 tracking-wider flex gap-2">
                 <span>VERIFIED OBSERVATIONS:</span>
                 <span className="text-[#ffb74d]">o No suitable open satellite observation was found for this location and date range. Satellite imagery coverage begins with mission launch dates.</span>
               </div>
             </div>
          </div>
      </div>
    </div>
  );
}
