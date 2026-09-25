import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Viewer as ResiumViewer, Entity, CameraFlyTo, ImageryLayer } from 'resium';
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
  UrlTemplateImageryProvider,
} from 'cesium';

const WAYBACK_URLS: Record<number, string> = {
  2010: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2017_3857/default/g/{z}/{y}/{x}.jpg',
  2011: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2017_3857/default/g/{z}/{y}/{x}.jpg',
  2012: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2017_3857/default/g/{z}/{y}/{x}.jpg',
  2013: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2017_3857/default/g/{z}/{y}/{x}.jpg',
  2014: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2017_3857/default/g/{z}/{y}/{x}.jpg',
  2015: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2017_3857/default/g/{z}/{y}/{x}.jpg',
  2016: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2017_3857/default/g/{z}/{y}/{x}.jpg',
  2017: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2017_3857/default/g/{z}/{y}/{x}.jpg',
  2018: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/{z}/{y}/{x}.jpg',
  2019: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2019_3857/default/g/{z}/{y}/{x}.jpg',
  2020: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
  2021: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/{z}/{y}/{x}.jpg',
  2022: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2022_3857/default/g/{z}/{y}/{x}.jpg',
  2023: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg',
  2024: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg',
  2025: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'
};
import {
  MapPin, Search, Satellite, ZoomIn, ZoomOut,
  Navigation, Layers, Copy, Trash2, ChevronRight,
  Activity, User, Globe, BarChart3, X, MousePointer2,
  Target, Crosshair, Sparkles, ArrowRight, CheckCircle,
  Maximize2, Info, Send
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

  const waybackProvider = React.useMemo(() => {
    return new UrlTemplateImageryProvider({
      url: WAYBACK_URLS[selectedYear] || WAYBACK_URLS[2024],
      maximumLevel: 19
    });
  }, [selectedYear]);



  // AI Query Panel States
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);

  const sendAiQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    
    if (!displayAoi) {
      setAiMessages(prev => [...prev, 
        { role: 'user', content: queryText },
        { role: 'assistant', content: "No area selected. Draw an area on the map first." }
      ]);
      setAiInput('');
      return;
    }

    const newMsg = { role: 'user' as const, content: queryText };
    setAiMessages(prev => [...prev, newMsg]);
    setAiInput('');
    setIsAiLoading(true);

    try {
      const fullQuery = aiMessages.length > 1 
        ? aiMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\\n') + `\\nUSER: ${queryText}` 
        : queryText;

      const res = await fetch('http://127.0.0.1:8000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: fullQuery,
          image_ids: [],
          bbox: displayAoi ? [displayAoi.west, displayAoi.south, displayAoi.east, displayAoi.north] : undefined,
          aoi_metadata: displayAoi ? {
             centerLat: displayAoi.centerLat,
             centerLng: displayAoi.centerLng,
             areaKm2: displayAoi.areaKm2,
             geojson: {
                type: "Feature",
                geometry: {
                   type: "Polygon",
                   coordinates: [[
                     [displayAoi.west, displayAoi.north],
                     [displayAoi.east, displayAoi.north],
                     [displayAoi.east, displayAoi.south],
                     [displayAoi.west, displayAoi.south],
                     [displayAoi.west, displayAoi.north]
                   ]]
                }
             }
          } : undefined
        })
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, { role: 'assistant', content: data.answer || data.detail || "Error retrieving response." }]);
    } catch (e) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: "AI provider request failed. Please try again." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAskAiClick = () => {
    setShowAiPanel(true);
    if (aiMessages.length === 0) {
      setAiMessages([{ role: 'assistant', content: 'Hello! I am ready to analyze this area. What would you like to know?' }]);
    }
  };

  // AI Recon States
  const [isScanning, setIsScanning] = useState(false);
  const [reconResults, setReconResults] = useState<any[]>([]);
  const [hoveredRecon, setHoveredRecon] = useState<any | null>(null);

  const activateAIRecon = () => {
    if (isScanning) return;
    setIsScanning(true);
    setReconResults([]);
    setAoi(null);
    setHoveredRecon(null);
    
    setTimeout(() => {
      const centerLat = flyTarget?.lat || currentLocation?.lat || 22.54;
      const centerLng = flyTarget?.lng || currentLocation?.lng || 88.38;
      const results = [
        { id: 1, lat: centerLat + 0.005, lng: centerLng - 0.004, type: 'Urban Change', conf: 87, label: 'HIGH INTEREST', color: '#ef4444' },
        { id: 2, lat: centerLat - 0.003, lng: centerLng + 0.006, type: 'Vegetation Loss', conf: 92, label: 'VEGETATION', color: '#22c55e' },
        { id: 3, lat: centerLat + 0.002, lng: centerLng + 0.002, type: 'Water Expansion', conf: 76, label: 'WATER', color: '#3b82f6' },
        { id: 4, lat: centerLat - 0.006, lng: centerLng - 0.003, type: 'SAR Anomaly', conf: 94, label: 'SAR ANOMALY', color: '#a855f7' },
      ];
      setReconResults(results);
      setIsScanning(false);
    }, 2500);
  };

  const handleSelectRecon = (r: any) => {
    const latDelta = 0.0045;
    const lngDelta = 0.005;
    const newAoi: any = {
      centerLat: r.lat,
      centerLng: r.lng,
      north: r.lat + latDelta,
      south: r.lat - latDelta,
      east: r.lng + lngDelta,
      west: r.lng - lngDelta,
      areaKm2: 1.0,
      reconInterest: r.label,
    };
    setAoi(newAoi);
    setLiveAoi(null);
    setFlyTarget({ lat: r.lat, lng: r.lng, alt: 3000 });
  };

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


          {/* AI Recon */}
          <div className="flex items-center gap-3">
            <button
              onClick={activateAIRecon}
              disabled={isScanning}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-mono font-bold text-xs transition-all ${
                isScanning || reconResults.length > 0 
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                  : 'bg-transparent text-gray-400 border border-gray-700/50 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/40'
              }`}
            >
              <span className={isScanning ? 'animate-pulse text-cyan-400' : 'text-cyan-500'}>⚡</span>
              {isScanning ? 'SCANNING AOI...' : 'AI RECON'}
            </button>

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
            <ImageryLayer imageryProvider={waybackProvider} />
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
            
            {/* AI Recon Points */}
            {reconResults.map((r, i) => (
              <Entity
                key={`recon-${i}`}
                position={Cartesian3.fromDegrees(r.lng, r.lat, 100)}
                point={{
                  pixelSize: 14,
                  color: Color.fromCssColorString(r.color).withAlpha(0.9),
                  outlineColor: Color.WHITE,
                  outlineWidth: 2,
                }}
                label={{
                  text: r.label,
                  font: 'bold 11px monospace',
                  fillColor: Color.WHITE,
                  showBackground: true,
                  backgroundColor: Color.fromCssColorString(r.color).withAlpha(0.8),
                  backgroundPadding: { x: 6, y: 4 } as any,
                  pixelOffset: { x: 0, y: -20 } as any
                }}
              />
            ))}

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
        
        
        {/* AI QUERY PANEL (ASK AI) */}
        {showAiPanel && panelVisible && (
          <div className="absolute top-24 right-[22rem] w-[26rem] bg-[#0a1118]/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-4 shadow-[0_0_30px_rgba(0,245,255,0.15)] flex flex-col z-30 pointer-events-auto">
            <div className="flex justify-between items-center border-b border-cyan-500/30 pb-3 mb-3">
              <span className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2"><Sparkles className="w-4 h-4"/> AI ANALYSIS</span>
              <button onClick={() => setShowAiPanel(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-80 mb-3 space-y-3 font-mono text-xs pr-1 custom-scrollbar">
              {aiMessages.map((msg, idx) => (
                <div key={idx} className={`p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-cyan-900/20 text-cyan-100 ml-6 border border-cyan-800/50' : 'bg-[#101b2b] text-gray-300 mr-6 border border-gray-800'}`}>
                  {msg.content}
                </div>
              ))}
              {isAiLoading && (
                <div className="text-cyan-400 animate-pulse text-[10px] tracking-widest flex items-center gap-2 mt-2">
                  <div className="w-3 h-3 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                  ANALYZING TELEMETRY...
                </div>
              )}
            </div>
            
            {aiMessages.length <= 1 && (
              <div className="grid grid-cols-1 gap-2 mb-4 font-mono">
                <button onClick={() => sendAiQuery("What is happening in this region?")} className="text-left text-[11px] text-gray-400 hover:text-cyan-300 bg-[#0d1624] p-2 rounded-lg border border-gray-800 hover:border-cyan-800 transition-colors">"What is happening in this region?"</button>
                <button onClick={() => sendAiQuery("Are there signs of flooding?")} className="text-left text-[11px] text-gray-400 hover:text-cyan-300 bg-[#0d1624] p-2 rounded-lg border border-gray-800 hover:border-cyan-800 transition-colors">"Are there signs of flooding?"</button>
                <button onClick={() => sendAiQuery("What type of land cover is present?")} className="text-left text-[11px] text-gray-400 hover:text-cyan-300 bg-[#0d1624] p-2 rounded-lg border border-gray-800 hover:border-cyan-800 transition-colors">"What type of land cover is present?"</button>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); sendAiQuery(aiInput); }} className="flex gap-2">
              <input 
                value={aiInput} 
                onChange={e => setAiInput(e.target.value)} 
                placeholder="Ask something about this selected area..." 
                className="flex-1 bg-[#050b14] border border-cyan-800/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono transition-colors" 
                disabled={isAiLoading}
              />
              <button 
                type="submit" 
                disabled={!aiInput.trim() || isAiLoading} 
                className="bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 px-4 py-2 rounded-lg hover:bg-cyan-500/20 disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                <Send className="w-4 h-4"/>
              </button>
            </form>
          </div>
        )}

        {/* RIGHT PANEL: SMART AOI + INTELLIGENCE CARD */}
        {panelVisible && (
          <div className="w-80 flex-shrink-0 flex flex-col overflow-y-auto z-20 absolute right-20 top-24 pointer-events-none">
            {displayAoi ? (
              <div className="bg-[#0a1118]/85 backdrop-blur-md border border-cyan-500/30 rounded-xl shadow-[0_0_20px_rgba(0,245,255,0.1)] p-4 font-mono pointer-events-auto flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-cyan-500/30 pb-2">
                  <Target className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400 font-bold tracking-widest text-sm">◈ SELECTED AOI</span>
                  <span className="ml-auto text-xs text-gray-400">AOI-01</span>
                </div>
                
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-[10px] text-gray-500 tracking-wider mb-0.5">CENTER</div>
                    <div className="text-gray-200 text-xs">{displayAoi.centerLat.toFixed(4)}° N, {displayAoi.centerLng.toFixed(4)}° E</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 tracking-wider mb-0.5">AREA</div>
                    <div className="text-cyan-300 text-xs">{displayAoi.areaKm2.toFixed(2)} km²</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 tracking-wider mb-0.5">BOUNDS</div>
                    <div className="text-gray-300 text-xs">{displayAoi.south.toFixed(2)}° — {displayAoi.north.toFixed(2)}° N</div>
                    <div className="text-gray-300 text-xs">{displayAoi.west.toFixed(2)}° — {displayAoi.east.toFixed(2)}° E</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 tracking-wider mb-0.5">CRS</div>
                    <div className="text-gray-400 text-xs">EPSG:4326</div>
                  </div>
                  
                  {(displayAoi as any).reconInterest && (
                    <div>
                      <div className="text-[10px] text-gray-500 tracking-wider mb-0.5">AI INTEREST</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-red-400 font-bold">███████████████░░ HIGH</div>
                        <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded">{(displayAoi as any).reconInterest}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <button onClick={handleAskAiClick} className="w-full py-2.5 border border-cyan-800/50 bg-[#0a1628] hover:bg-cyan-900/30 text-cyan-300 text-xs font-bold tracking-widest transition-colors">
                    [ ASK AI ]
                  </button>
                  <button onClick={handleAnalyzeClick} disabled={isExporting} className="w-full py-2.5 border border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold tracking-widest transition-colors shadow-[0_0_10px_rgba(0,245,255,0.2)]">
                    {isExporting ? '[ PROCESSING... ]' : '[ ANALYZE THIS VIEW → ]'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#0a1118]/85 backdrop-blur-md border border-cyan-700/50 rounded-xl p-6 text-center pointer-events-auto flex flex-col items-center gap-3 shadow-[0_0_20px_rgba(0,245,255,0.05)]">
                <Crosshair className="w-6 h-6 text-cyan-500/80" />
                <div className="text-sm text-cyan-400 font-bold tracking-widest">SELECT AN AREA</div>
                <div className="text-xs text-gray-500 font-mono">Draw an area on the map to begin investigation.</div>
                <button onClick={startDrawing} className="mt-2 px-4 py-1.5 border border-cyan-800 hover:bg-cyan-900/30 hover:border-cyan-500 text-cyan-400 text-xs tracking-wider transition-colors">
                  [ DRAW AREA ]
                </button>
              </div>
            )}
            
            {reconResults.length > 0 && !displayAoi && (
               <div className="mt-4 flex flex-col gap-2 pointer-events-auto">
                 <div className="text-[10px] text-cyan-400 font-mono font-bold tracking-widest text-center mb-1">DEVELOPMENT / DEMO DATA</div>
                 {reconResults.map((r, i) => (
                   <div key={i} className="bg-[#0a1118]/90 border border-gray-700/50 hover:border-cyan-500/50 p-3 rounded-xl flex flex-col gap-1 cursor-pointer transition-colors backdrop-blur-md" onClick={() => handleSelectRecon(r)}>
                     <div className="text-xs font-bold" style={{ color: r.color }}>{r.type}</div>
                     <div className="text-[10px] text-gray-400">Confidence: {r.conf}%</div>
                     <div className="text-[10px] text-gray-500">{r.lat.toFixed(4)}° N, {r.lng.toFixed(4)}° E</div>
                     <div className="text-[10px] text-cyan-400 mt-1 hover:underline">[SELECT AREA]</div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        )}


        {/* Earth Observation Timeline */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-4 pointer-events-auto">
             <div className="bg-[#0b101e] border border-[#1a253a] rounded-lg p-3 shadow-2xl flex flex-col gap-3 font-mono">
               {/* Header */}
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="text-[#ff9800] text-sm">🌍</div>
                   <div className="text-cyan-400 font-bold text-sm tracking-wide">
                     EARTH OBSERVATION TIMELINE
                     <span className="text-gray-400 font-normal ml-3 text-xs">
                       Active Globe Layer: <span className="text-gray-200">Sentinel-2 Cloudless ({selectedYear})</span>
                     </span>
                   </div>
                 </div>
                 <div className="flex items-center gap-2 text-xs">
                   <button className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#102a35] border border-cyan-800 text-cyan-400 transition-colors hover:bg-cyan-900/40">
                     📡 Sentinel-2 Mosaic (Active)
                   </button>
                   <button className={`px-3 py-1 rounded border transition-colors ${timelineFilter === 'ALL' ? 'bg-[#102a35] border-cyan-800 text-cyan-400' : 'bg-transparent border-[#1a253a] text-gray-500 hover:text-gray-300'}`} onClick={() => setTimelineFilter('ALL')}>ALL</button>
                   <button className={`px-3 py-1 rounded border transition-colors ${timelineFilter === 'SENTINEL-2' ? 'bg-[#102a35] border-cyan-800 text-cyan-400' : 'bg-transparent border-[#1a253a] text-gray-500 hover:text-gray-300'}`} onClick={() => setTimelineFilter('SENTINEL-2')}>SENTINEL-2</button>
                   <button className={`px-3 py-1 rounded border transition-colors ${timelineFilter === 'SENTINEL-1' ? 'bg-[#102a35] border-cyan-800 text-cyan-400' : 'bg-transparent border-[#1a253a] text-gray-500 hover:text-gray-300'}`} onClick={() => setTimelineFilter('SENTINEL-1')}>SENTINEL-1</button>
                 </div>
               </div>

               {/* Slider */}
               <div className="flex items-center gap-4 mt-2">
                 <span className="text-gray-500 text-xs font-bold">2010</span>
                 <div className="relative flex-1 h-3 bg-[#111827] rounded-full flex items-center">
                    <input 
                      type="range" 
                      min="2010" 
                      max="2025" 
                      value={selectedYear} 
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      className="w-full absolute z-10 opacity-0 cursor-pointer"
                    />
                    <div className="absolute left-0 h-full bg-cyan-400 rounded-full" style={{ width: `${((selectedYear - 2010) / 15) * 100}%` }} />
                    <div className="absolute w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.6)] transform -translate-x-1/2" style={{ left: `${((selectedYear - 2010) / 15) * 100}%` }} />
                 </div>
                 <span className="text-gray-500 text-xs font-bold">2025</span>
                 <div className="px-3 py-1 rounded bg-[#102a35] border border-cyan-800 text-cyan-400 text-xs font-bold ml-2">
                   YEAR: {selectedYear}
                 </div>
               </div>

               {/* Footer text */}
               <div className="text-[10px] text-gray-400 tracking-wider flex gap-2">
                 <span>VERIFIED OBSERVATIONS:</span>
                 <span className="text-[#ffb74d]">⚠️ EOX Sentinel-2 Global Mosaics are available from 2017 to 2024. Years outside this range will display the nearest available mosaic.</span>
               </div>
             </div>
          </div>

      </div>
    </div>
  );
}
