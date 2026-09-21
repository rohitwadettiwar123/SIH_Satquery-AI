import React, { useEffect, useState } from 'react';
import { AnalysisResult } from '../types';
import {
  Binoculars, Layers, Droplets, Mountain, Cloud,
  Building2, Trees, Target, ArrowUpDown, TrendingDown,
  TrendingUp, Minus, Loader2, AlertCircle, FileSearch, ArrowRight
} from 'lucide-react';

interface Props {
  result: AnalysisResult | null;
  isProcessing?: boolean;
}

// Animated counter
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 900;
    const step = 16;
    const increment = (end - start) / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
        setDisplay(end);
        clearInterval(timer);
      } else {
        setDisplay(start);
      }
    }, step);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

// Staggered entrance
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      {children}
    </div>
  );
}

// Animated horizontal bar
function GaugeBar({ pct, color, height = 'h-1' }: { pct: number; color: string; height?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 200); return () => clearTimeout(t); }, [pct]);
  return (
    <div className={`${height} bg-gray-800/80 rounded-full overflow-hidden`}>
      <div
        className="h-full rounded-full transition-all duration-800 ease-out"
        style={{ width: `${w}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
      />
    </div>
  );
}

// Surface class config — maps NDVI class keys to display config
const SURFACE_CLASSES: Record<string, { icon: React.ReactNode; color: string; label: string; emoji: string }> = {
  'Vegetation & Canopy':          { icon: <Trees className="w-3.5 h-3.5" />, emoji: '🌲', color: '#22c55e', label: 'Vegetation & Canopy' },
  'Water Bodies & Hydrology':     { icon: <Droplets className="w-3.5 h-3.5" />, emoji: '🌊', color: '#3b82f6', label: 'Water Bodies & Hydrology' },
  'Bare Soil & Terrain':          { icon: <Mountain className="w-3.5 h-3.5" />, emoji: '🏔️', color: '#f59e0b', label: 'Bare Soil & Terrain' },
  'Built-up & Infrastructure':    { icon: <Building2 className="w-3.5 h-3.5" />, emoji: '🏗️', color: '#f97316', label: 'Built-up & Infrastructure' },
  'Atmosphere & Clouds':          { icon: <Cloud className="w-3.5 h-3.5" />, emoji: '☁️', color: '#94a3b8', label: 'Atmosphere & Clouds' },
};

function getSurfaceConf(key: string) {
  if (SURFACE_CLASSES[key]) return SURFACE_CLASSES[key];
  const k = key.toLowerCase();
  if (k.includes('vegetation') || k.includes('forest') || k.includes('canopy'))
    return SURFACE_CLASSES['Vegetation & Canopy'];
  if (k.includes('water') || k.includes('hydro'))
    return SURFACE_CLASSES['Water Bodies & Hydrology'];
  if (k.includes('soil') || k.includes('terrain') || k.includes('bare'))
    return SURFACE_CLASSES['Bare Soil & Terrain'];
  if (k.includes('built') || k.includes('urban') || k.includes('infra'))
    return SURFACE_CLASSES['Built-up & Infrastructure'];
  if (k.includes('cloud') || k.includes('atmo'))
    return SURFACE_CLASSES['Atmosphere & Clouds'];
  return { icon: <Layers className="w-3.5 h-3.5" />, emoji: '📊', color: '#a78bfa', label: key.replace(/_/g, ' ') };
}

// Detected object icon
const TARGET_ICONS: Record<string, { emoji: string; color: string }> = {
  vegetation: { emoji: '🌲', color: '#22c55e' },
  deforestation: { emoji: '🌲', color: '#22c55e' },
  regrowth: { emoji: '🌱', color: '#4ade80' },
  afforestation: { emoji: '🌱', color: '#4ade80' },
  water: { emoji: '🌊', color: '#3b82f6' },
  flood: { emoji: '🌊', color: '#60a5fa' },
  desiccation: { emoji: '💧', color: '#93c5fd' },
  recession: { emoji: '💧', color: '#93c5fd' },
  built: { emoji: '🏗️', color: '#f97316' },
  construction: { emoji: '🏗️', color: '#f97316' },
  development: { emoji: '🏗️', color: '#f97316' },
  demolition: { emoji: '🔴', color: '#ef4444' },
  destruction: { emoji: '🔴', color: '#ef4444' },
  soil: { emoji: '🏔️', color: '#f59e0b' },
  excavation: { emoji: '⛏️', color: '#d97706' },
  bare: { emoji: '🏔️', color: '#f59e0b' },
  seasonal: { emoji: '🔄', color: '#a78bfa' },
  fire: { emoji: '🔥', color: '#ef4444' },
};

function getTargetConf(label: string): { emoji: string; color: string } {
  const l = label.toLowerCase();
  for (const [k, v] of Object.entries(TARGET_ICONS)) {
    if (l.includes(k)) return v;
  }
  return { emoji: '🎯', color: '#00f5ff' };
}

export default function MissionIntel({ result, isProcessing }: Props) {

  if (!result && !isProcessing) {
    return (
      <div className="mission-panel h-full flex flex-col p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileSearch className="w-4 h-4 text-gray-600" />
          <h2 className="font-mono text-gray-600 text-sm tracking-widest">RESULT</h2>
        </div>
        <div className="flex-1 border border-dashed border-gray-800 rounded-lg flex flex-col items-center justify-center gap-3 opacity-40">
          <Binoculars className="w-8 h-8 text-gray-700" />
          <span className="text-[10px] font-mono text-gray-600 tracking-widest">NO FINDINGS YET</span>
        </div>
      </div>
    );
  }

  if (isProcessing && !result) {
    return (
      <div className="mission-panel h-full flex flex-col p-4">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          <h2 className="font-mono text-cyan-400 text-sm tracking-widest">RESULT</h2>
        </div>
        <div className="space-y-3">
          {[80, 60, 90, 45, 70].map((w, i) => (
            <div key={i} className="bg-[#0a0f1a] border border-gray-800/40 rounded-lg p-3 animate-pulse">
              <div className={`h-3 bg-gray-800 rounded mb-2`} style={{ width: `${w}%` }} />
              <div className="h-2 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const r = result!;
  const hasNdvi = !!r.ndvi_stats;
  const hasChange = !!r.change_metrics;
  const hasObjects = (r.detected_objects?.length ?? 0) > 0;
  const hasSurface = hasNdvi && r.ndvi_stats!.class_percentages && Object.keys(r.ndvi_stats!.class_percentages).length > 0;
  const hasDelta = !!r.ndvi_stats?.delta_ndvi && Object.keys(r.ndvi_stats.delta_ndvi).length > 0;

  // Surface entries sorted descending by %
  const surfaceEntries = hasSurface
    ? Object.entries(r.ndvi_stats!.class_percentages).sort((a, b) => b[1] - a[1])
    : [];

  // Delta entries sorted by absolute change descending
  const deltaEntries = hasDelta
    ? Object.entries(r.ndvi_stats!.delta_ndvi).sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
    : [];

  return (
    <div className="mission-panel flex flex-col p-4 gap-4 overflow-y-auto h-full">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Binoculars className="w-4 h-4 text-amber-400" />
          <h2 className="font-mono text-amber-400 text-sm tracking-widest">RESULT</h2>
        </div>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
          {r.task_type}
        </span>
      </div>

      {/* ── Primary Finding ────────────────────────── */}
      <FadeIn delay={0}>
        <div className="bg-gradient-to-br from-[#0a0f1a] to-[#060910] border border-amber-900/30 rounded-xl p-3.5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-mono text-amber-500 tracking-widest font-bold">PRIMARY FINDING</span>
          </div>
          <ol className="space-y-1.5 mb-3 list-decimal list-outside ml-4 marker:text-amber-500 marker:font-mono marker:text-[11px]">
            {r.answer.split(/(?<=\.)\s+/).filter(s => s.trim().length > 0).map((sentence, idx) => {
              const clean = sentence.replace(/^[\s#*]*(\d+[.\)])?[\s#*]*/g, '').trim();
              if (!clean) return null;
              return (
                <li key={idx} className="text-[12px] font-sans text-gray-300 leading-relaxed pl-1">{clean}</li>
              );
            })}
          </ol>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-amber-400 transition-all duration-1000"
                style={{ width: `${r.confidence * 100}%`, boxShadow: '0 0 8px rgba(0,245,255,0.4)' }}
              />
            </div>
            <span className="text-[10px] font-mono text-cyan-400 shrink-0">
              {Math.round(r.confidence * 100)}% CONF
            </span>
          </div>
        </div>
      </FadeIn>

      {/* ── RANKED CHANGE TABLE (delta_ndvi) ────────── */}
      {hasDelta && (
        <FadeIn delay={120}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-mono text-gray-500 tracking-widest flex items-center gap-1.5">
                <ArrowUpDown className="w-3 h-3" /> RANKED CHANGE SECTORS
              </h3>
              <span className="text-[9px] font-mono text-cyan-400/70">T0 → T1</span>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-12 gap-1 px-2 mb-1">
              <span className="col-span-1 text-[8px] font-mono text-gray-600">#</span>
              <span className="col-span-4 text-[8px] font-mono text-gray-600">SECTOR</span>
              <span className="col-span-2 text-[8px] font-mono text-gray-600 text-right">T0 ha</span>
              <span className="col-span-2 text-[8px] font-mono text-gray-600 text-right">T1 ha</span>
              <span className="col-span-3 text-[8px] font-mono text-gray-600 text-right">ΔCHANGE</span>
            </div>

            <div className="space-y-1.5">
              {deltaEntries.map(([cls, data], i) => {
                const { emoji, color } = getSurfaceConf(cls);
                const isPos = data.delta > 0;
                const absPct = Math.abs(data.pct);
                const deltaColor = isPos ? '#ef4444' : '#22c55e';
                const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#4b5563';
                return (
                  <FadeIn key={cls} delay={120 + i * 60}>
                    <div className="bg-[#090e1b] border border-gray-800/60 rounded-lg px-2.5 py-2 hover:border-gray-700/60 transition-colors">
                      {/* Row */}
                      <div className="grid grid-cols-12 gap-1 items-center mb-1.5">
                        {/* Rank badge */}
                        <div className="col-span-1">
                          <span className="text-[10px] font-mono font-bold" style={{ color: rankColor }}>
                            #{i + 1}
                          </span>
                        </div>
                        {/* Sector name */}
                        <div className="col-span-4 flex items-center gap-1.5">
                          <span className="text-sm leading-none">{emoji}</span>
                          <span className="text-[10px] font-mono text-gray-200 truncate">{cls.split(' &')[0]}</span>
                        </div>
                        {/* T0 / T1 bar chart */}
                        <div className="col-span-4 flex items-center justify-end gap-2 pr-2">
                          <div className="flex flex-col gap-0.5 items-end w-full">
                            <div className="flex items-center gap-1 w-full justify-end">
                              <span className="text-[8px] font-mono text-gray-500 w-4 text-right">T0</span>
                              <div className="h-1 bg-gray-800 rounded flex-1 max-w-[40px] flex justify-end">
                                <div className="h-full bg-gray-500 rounded" style={{ width: `${Math.min(100, (data.t0 / Math.max(data.t0, data.t1)) * 100)}%` }} />
                              </div>
                              <span className="text-[9px] font-mono text-gray-400 w-6 text-right">{data.t0.toFixed(0)}</span>
                            </div>
                            <div className="flex items-center gap-1 w-full justify-end">
                              <span className="text-[8px] font-mono text-cyan-500/70 w-4 text-right">T1</span>
                              <div className="h-1 bg-gray-800 rounded flex-1 max-w-[40px] flex justify-end">
                                <div className="h-full bg-cyan-500 rounded" style={{ width: `${Math.min(100, (data.t1 / Math.max(data.t0, data.t1)) * 100)}%` }} />
                              </div>
                              <span className="text-[9px] font-mono text-cyan-400 w-6 text-right">{data.t1.toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                        {/* Delta */}
                        <div className="col-span-3 text-right flex items-center justify-end gap-1">
                          {isPos
                            ? <TrendingUp className="w-2.5 h-2.5" style={{ color: deltaColor }} />
                            : <TrendingDown className="w-2.5 h-2.5" style={{ color: deltaColor }} />
                          }
                          <span className="text-[11px] font-mono font-bold" style={{ color: deltaColor }}>
                            {isPos ? '+' : ''}{data.pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {/* Progress bar showing absolute change magnitude */}
                      <GaugeBar pct={Math.min(100, absPct)} color={deltaColor} height="h-0.5" />
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* ── SURFACE COVERAGE TABLE (class_percentages) ─ */}
      {hasSurface && (
        <FadeIn delay={250}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-mono text-gray-500 tracking-widest flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> SURFACE COVERAGE · RANKED
              </h3>
              <span className="text-[9px] font-mono text-purple-400/70 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                Pixel Indices
              </span>
            </div>

            {/* Doughnut Chart & Legend Grid */}
            <div className="flex gap-4 mb-4 items-center bg-[#090e1b] border border-gray-800/60 rounded-xl p-3">
              <div 
                className="w-20 h-20 rounded-full relative shadow-lg flex-shrink-0"
                style={{ 
                  background: `conic-gradient(${
                    surfaceEntries.reduce((acc, [key, pct], idx) => {
                      const { color } = getSurfaceConf(key);
                      const start = acc.sum;
                      const end = start + pct;
                      acc.stops.push(`${color} ${start}% ${end}%`);
                      acc.sum = end;
                      return acc;
                    }, { sum: 0, stops: [] as string[] }).stops.join(', ')
                  })` 
                }}
              >
                <div className="absolute inset-[3px] bg-[#090e1b] rounded-full flex flex-col items-center justify-center">
                   <span className="text-[8px] font-mono text-gray-500">COVERAGE</span>
                   <span className="text-[12px] font-mono font-bold text-white">100%</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5 flex-1 justify-center">
                 {surfaceEntries.slice(0, 3).map(([key, pct]) => {
                   const { color, label } = getSurfaceConf(key);
                   return (
                     <div key={key} className="flex items-center justify-between">
                       <div className="flex items-center gap-1.5">
                         <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor]" style={{ backgroundColor: color, color }} />
                         <span className="text-[9px] font-mono text-gray-300 truncate max-w-[80px]">{label.split(' &')[0]}</span>
                       </div>
                       <span className="text-[10px] font-mono font-bold" style={{ color }}>{pct.toFixed(1)}%</span>
                     </div>
                   );
                 })}
              </div>
            </div>

            {/* Table */}
            <div className="grid grid-cols-12 gap-1 px-2 mb-1">
              <span className="col-span-1 text-[8px] font-mono text-gray-600">#</span>
              <span className="col-span-5 text-[8px] font-mono text-gray-600">CATEGORY</span>
              <span className="col-span-3 text-[8px] font-mono text-gray-600 text-right">AREA (ha)</span>
              <span className="col-span-3 text-[8px] font-mono text-gray-600 text-right">COVER %</span>
            </div>

            <div className="space-y-1.5">
              {surfaceEntries.map(([key, pct], i) => {
                const { emoji, color, label } = getSurfaceConf(key);
                const hectares = (pct * 14.17).toFixed(1);
                const rankColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#4b5563';
                return (
                  <FadeIn key={key} delay={250 + i * 70}>
                    <div className="bg-[#090e1b] border border-gray-800/60 rounded-lg px-2.5 py-2 hover:border-gray-700/60 transition-colors">
                      <div className="grid grid-cols-12 gap-1 items-center mb-1.5">
                        <span className="col-span-1 text-[10px] font-mono font-bold" style={{ color: rankColor }}>
                          #{i + 1}
                        </span>
                        <div className="col-span-5 flex items-center gap-1.5">
                          <span className="text-sm leading-none">{emoji}</span>
                          <span className="text-[10px] font-mono text-gray-200 truncate">{label.split(' &')[0]}</span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-[10px] font-mono text-gray-400">{hectares}</span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-[12px] font-mono font-bold" style={{ color }}>
                            <AnimatedNumber value={pct} decimals={1} />%
                          </span>
                        </div>
                      </div>
                      <GaugeBar pct={pct} color={color} height="h-0.5" />
                    </div>
                  </FadeIn>
                );
              })}
            </div>

            {/* NDVI mini stats */}
            {r.ndvi_stats && (
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {[
                  { label: 'MEAN NDVI', value: r.ndvi_stats.mean.toFixed(3), color: '#22c55e' },
                  { label: 'MEDIAN',    value: r.ndvi_stats.median.toFixed(3), color: '#3b82f6' },
                  { label: 'STD DEV',   value: r.ndvi_stats.std.toFixed(3), color: '#f59e0b' },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#050a14] border border-gray-800/50 rounded-lg p-1.5 text-center">
                    <p className="text-[8px] font-mono text-gray-600">{stat.label}</p>
                    <p className="text-[11px] font-mono font-bold mt-0.5" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {/* ── DETECTED TARGETS ──────────────────────── */}
      {hasObjects && (
        <FadeIn delay={350}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-mono text-gray-500 tracking-widest flex items-center gap-1.5">
                <Target className="w-3 h-3" /> CHANGE REGIONS · DETECTED
              </h3>
              <span className="text-[9px] font-mono text-cyan-400/70">{r.detected_objects.length} ZONES</span>
            </div>

            <div className="grid grid-cols-12 gap-1 px-2 mb-1">
              <span className="col-span-1 text-[8px] font-mono text-gray-600">#</span>
              <span className="col-span-6 text-[8px] font-mono text-gray-600">CLASS</span>
              <span className="col-span-2 text-[8px] font-mono text-gray-600 text-right">ha</span>
              <span className="col-span-3 text-[8px] font-mono text-gray-600 text-right">CONF</span>
            </div>

            <div className="space-y-1.5">
              {[...r.detected_objects]
                .sort((a, b) => b.confidence - a.confidence)
                .map((obj, i) => {
                  const label = obj.class_name || 'Change Region';
                  const { emoji, color } = getTargetConf(label);
                  const ha = (obj as any).area_hectares ?? 0;
                  const areaLabel = `AREA ${i + 1}`;
                  const areaColors = ['#00f5ff','#22c55e','#f59e0b','#a78bfa','#f97316'];
                  const areaColor = areaColors[i % areaColors.length];
                  return (
                    <FadeIn key={i} delay={350 + i * 60}>
                      <div className="bg-[#090e1b] border border-gray-800/60 rounded-lg px-2.5 py-2 hover:border-purple-900/40 transition-colors">
                        <div className="grid grid-cols-12 gap-1 items-center mb-1.5">
                          {/* Area badge */}
                          <div className="col-span-2">
                            <span
                              className="text-[8px] font-mono font-bold px-1 py-0.5 rounded"
                              style={{ backgroundColor: `${areaColor}22`, color: areaColor, border: `1px solid ${areaColor}50` }}
                            >
                              {areaLabel}
                            </span>
                          </div>
                          <div className="col-span-5 flex items-center gap-1.5">
                            <span className="text-sm leading-none">{emoji}</span>
                            <span className="text-[9px] font-mono text-gray-200 truncate">{label.split('/')[0].trim()}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-[10px] font-mono text-gray-500">{ha > 0 ? ha.toFixed(1) : '—'}</span>
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="text-[11px] font-mono font-bold" style={{ color }}>
                              {Math.round(obj.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        <GaugeBar pct={Math.round(obj.confidence * 100)} color={color} height="h-0.5" />
                      </div>
                    </FadeIn>
                  );
                })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* ── Change Metrics row ─────────────────────── */}
      {hasChange && (
        <FadeIn delay={450}>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { label: 'CHANGE',  value: `${r.change_metrics!.change_ratio_pct.toFixed(1)}%`, color: '#ef4444' },
              { label: 'AREA km²', value: `${r.change_metrics!.affected_area_km2}`, color: '#f59e0b' },
              { label: 'SSIM',   value: `${r.change_metrics!.ssim_score?.toFixed(3) ?? '—'}`, color: '#22c55e' },
            ].map(s => (
              <div key={s.label} className="bg-[#050a14] border border-gray-800/50 rounded-lg p-2 text-center">
                <p className="text-[8px] font-mono text-gray-600">{s.label}</p>
                <p className="text-[12px] font-mono font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      )}

      {/* ── STATISTICAL DISTRIBUTION GRAPH ────────── */}
      {(hasDelta || hasSurface) && (
        <FadeIn delay={550}>
          <div className="bg-[#090e1b] border border-gray-800/60 rounded-xl p-4 mb-2">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-[10px] font-mono text-purple-400 tracking-widest font-bold flex items-center gap-1.5">
                 <Target className="w-3 h-3" /> STATISTICAL DISTRIBUTION
               </h3>
               <span className="text-[9px] font-mono text-gray-500">Area (ha)</span>
            </div>
            
            <div className="h-32 flex items-end justify-between border-b border-l border-gray-800 pb-1 pl-1 ml-4 relative">
              {/* Y-axis Labels */}
              {(() => {
                const maxArea = hasDelta 
                  ? Math.max(1, ...deltaEntries.flatMap(d => [d[1].t0, d[1].t1]))
                  : Math.max(1, ...surfaceEntries.map(s => s[1] * 14.17));
                
                return (
                  <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between text-[8px] text-gray-600 font-mono items-end pr-1">
                    <span>{maxArea.toFixed(0)}</span>
                    <span>{(maxArea/2).toFixed(0)}</span>
                    <span>0</span>
                  </div>
                );
              })()}

              {/* Grid lines */}
              <div className="absolute left-0 right-0 top-0 h-[1px] bg-gray-800/50 z-0"></div>
              <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-gray-800/50 z-0 border-dashed"></div>

              {/* Bars */}
              <div className="w-full flex justify-around items-end h-full z-10 px-2">
                {hasDelta ? (
                  // Comparative T0 vs T1 Graph
                  deltaEntries.slice(0, 5).map(([cls, data]) => {
                    const maxArea = Math.max(1, ...deltaEntries.flatMap(d => [d[1].t0, d[1].t1]));
                    const t0H = (data.t0 / maxArea) * 100;
                    const t1H = (data.t1 / maxArea) * 100;
                    const { color, emoji } = getSurfaceConf(cls);
                    return (
                      <div key={cls} className="flex flex-col items-center gap-1 group">
                        <div className="flex items-end gap-[2px] h-full w-8">
                          <div className="w-3.5 bg-gray-600 rounded-t-sm transition-all group-hover:brightness-125 relative group-hover:bg-gray-500" style={{ height: `${t0H}%` }}>
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white opacity-0 group-hover:opacity-100 transition-opacity">{data.t0.toFixed(0)}</span>
                          </div>
                          <div className="w-3.5 rounded-t-sm transition-all group-hover:brightness-125 relative shadow-[0_0_8px_currentColor]" style={{ height: `${t1H}%`, backgroundColor: color, color: color }}>
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white opacity-0 group-hover:opacity-100 transition-opacity">{data.t1.toFixed(0)}</span>
                          </div>
                        </div>
                        <span className="text-[12px] mt-1" title={cls}>{emoji}</span>
                      </div>
                    );
                  })
                ) : (
                  // Single Coverage Graph
                  surfaceEntries.slice(0, 5).map(([cls, pct]) => {
                    const maxArea = Math.max(1, ...surfaceEntries.map(s => s[1] * 14.17));
                    const ha = pct * 14.17;
                    const h = (ha / maxArea) * 100;
                    const { color, emoji } = getSurfaceConf(cls);
                    return (
                      <div key={cls} className="flex flex-col items-center gap-1 group">
                        <div className="flex items-end h-full w-6">
                          <div className="w-5 rounded-t-sm transition-all group-hover:brightness-125 relative shadow-[0_0_8px_currentColor]" style={{ height: `${h}%`, backgroundColor: color, color: color }}>
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-mono text-white opacity-0 group-hover:opacity-100 transition-opacity">{ha.toFixed(0)}</span>
                          </div>
                        </div>
                        <span className="text-[12px] mt-1" title={cls}>{emoji}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            {/* Legend for Delta */}
            {hasDelta && (
              <div className="flex items-center justify-center gap-4 mt-3 pt-2 border-t border-gray-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-gray-600 rounded-sm"></div>
                  <span className="text-[9px] font-mono text-gray-400">T0 Area</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-purple-500 rounded-sm shadow-[0_0_5px_currentColor]" style={{ color: '#a855f7' }}></div>
                  <span className="text-[9px] font-mono text-gray-400">T1 Area (Color By Class)</span>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {/* ── Cloud Reconstruction ───────────────────── */}
      {r.cloud_reconstruction?.triggered && (
        <FadeIn delay={500}>
          <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-mono text-blue-400 tracking-widest">CLOUD RECONSTRUCTION</span>
            </div>
            <p className="text-[10px] font-mono text-gray-400 leading-snug">{r.cloud_reconstruction.disclosure_text}</p>
            <div className="flex gap-2 mt-2">
              {[
                { l: 'COVERAGE', v: `${r.cloud_reconstruction.coverage_pct.toFixed(1)}%` },
                { l: 'METHOD', v: r.cloud_reconstruction.method?.replace('_', ' ').toUpperCase() },
                { l: 'CONF.', v: `${r.cloud_reconstruction.avg_confidence.toFixed(1)}%` },
              ].map(s => (
                <div key={s.l} className="flex-1">
                  <p className="text-[8px] font-mono text-gray-600">{s.l}</p>
                  <p className="text-[10px] font-mono text-blue-400">{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* ── Escalation ────────────────────────────── */}
      {r.requires_expert_escalation && (
        <FadeIn delay={550}>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] font-mono text-red-400 tracking-widest">EXPERT ESCALATION REQUIRED</span>
            </div>
            <p className="text-[10px] font-mono text-gray-400 mt-1">{r.escalation_reason}</p>
          </div>
        </FadeIn>
      )}

      {/* ── Footer ────────────────────────────────── */}
      <FadeIn delay={650}>
        <div className="pt-2 border-t border-gray-800/50">
          <p className="text-[8px] font-mono text-gray-700 text-center">
            Engine: satquery-v2 · {r.task_type} · {r.query_id.substring(0, 12)}
          </p>
        </div>
      </FadeIn>

    </div>
  );
}
