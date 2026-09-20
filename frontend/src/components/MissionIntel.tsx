import React, { useEffect, useState } from 'react';
import { AnalysisResult } from '../types';
import {
  Binoculars, Layers, Droplets, Mountain, Cloud,
  Building2, Trees, Target, ArrowRight, TrendingDown,
  TrendingUp, Minus, Loader2, AlertCircle, FileSearch
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
    const duration = 800;
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

// Surface class config
const SURFACE_CLASSES: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  healthy_vegetation: { icon: <Trees className="w-4 h-4" />, color: '#22c55e', label: 'Vegetation & Canopy' },
  vegetation:         { icon: <Trees className="w-4 h-4" />, color: '#22c55e', label: 'Vegetation & Canopy' },
  water:              { icon: <Droplets className="w-4 h-4" />, color: '#3b82f6', label: 'Water Bodies & Hydrology' },
  bare_soil:          { icon: <Mountain className="w-4 h-4" />, color: '#f59e0b', label: 'Bare Soil & Terrain' },
  urban:              { icon: <Building2 className="w-4 h-4" />, color: '#f97316', label: 'Built-up & Infrastructure' },
  cloud:              { icon: <Cloud className="w-4 h-4" />, color: '#94a3b8', label: 'Atmosphere & Clouds' },
};

function getSurfaceConf(key: string) {
  const k = key.toLowerCase();
  for (const [pattern, conf] of Object.entries(SURFACE_CLASSES)) {
    if (k.includes(pattern)) return conf;
  }
  return { icon: <Layers className="w-4 h-4" />, color: '#a78bfa', label: key.replace(/_/g, ' ') };
}

// Detected target config
const TARGET_ICONS: Record<string, { icon: string; color: string }> = {
  infrastructure: { icon: '🏗️', color: '#f97316' },
  anomal: { icon: '⚠️', color: '#ef4444' },
  vehicle: { icon: '🚢', color: '#3b82f6' },
  command: { icon: '📡', color: '#a78bfa' },
  vegetation: { icon: '🌲', color: '#22c55e' },
  water: { icon: '💧', color: '#3b82f6' },
  building: { icon: '🏢', color: '#f97316' },
  forest: { icon: '🌲', color: '#22c55e' },
  soil: { icon: '🏔️', color: '#f59e0b' },
};

function getTargetIcon(label: string) {
  const l = label.toLowerCase();
  for (const [pattern, cfg] of Object.entries(TARGET_ICONS)) {
    if (l.includes(pattern)) return cfg;
  }
  return { icon: '🎯', color: '#00f5ff' };
}

// Compact horizontal gauge bar
function GaugeBar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 150); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${w}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}80` }}
      />
    </div>
  );
}

// Change delta indicator
function DeltaBadge({ value }: { value: number }) {
  const isPos = value > 0;
  const isNeg = value < 0;
  return (
    <span className={`text-xs font-mono font-bold ${isPos ? 'text-red-400' : isNeg ? 'text-green-400' : 'text-gray-400'}`}>
      {isPos ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : isNeg ? <TrendingDown className="w-3 h-3 inline mr-0.5" /> : <Minus className="w-3 h-3 inline mr-0.5" />}
      Δ{Math.abs(value).toFixed(1)}
    </span>
  );
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
  const objectCount = r.detected_objects?.length ?? 0;
  const hasNdvi = !!r.ndvi_stats;
  const hasChange = !!r.change_metrics;
  const hasObjects = objectCount > 0;
  const hasSurface = hasNdvi && r.ndvi_stats!.class_percentages && Object.keys(r.ndvi_stats!.class_percentages).length > 0;

  // Compute total area percentage for multi-bar
  const surfaceEntries = hasSurface
    ? Object.entries(r.ndvi_stats!.class_percentages).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="mission-panel flex flex-col p-4 gap-5 overflow-y-auto h-full">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Binoculars className="w-4 h-4 text-amber-400" />
          <h2 className="font-mono text-amber-400 text-sm tracking-widest">RESULT</h2>
        </div>
        {objectCount > 0 && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
            {objectCount} REGIONS
          </span>
        )}
      </div>

      {/* Primary Finding Summary */}
      <FadeIn delay={0}>
        <div className="bg-gradient-to-br from-[#0a0f1a] to-[#060910] border border-amber-900/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-mono text-amber-500 tracking-widest font-bold">PRIMARY FINDING</span>
            <span className="ml-auto text-[9px] font-mono text-gray-500 border border-gray-800 px-2 py-0.5 rounded">TASK: {r.task_type}</span>
          </div>
          
          <ol className="space-y-2 mb-4 list-decimal list-outside ml-4 marker:text-amber-500 marker:font-mono marker:text-[12px]">
            {r.answer.split(/(?<=\.)\s+/).filter(s => s.trim().length > 0).map((sentence, idx) => {
              // Strip out markdown list artifacts like "### 1.", "**1.**", "1.", "###", "**"
              const cleanSentence = sentence.replace(/^[\s#*]*(\d+[\.\)]?)?[\s#*]*/g, '').trim();
              if (!cleanSentence) return null;
              return (
                <li key={idx} className="text-[13px] font-sans text-gray-200 leading-relaxed pl-1">
                  {cleanSentence}
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-amber-400 transition-all duration-1000"
                style={{ width: `${r.confidence * 100}%`, boxShadow: '0 0 8px rgba(0,245,255,0.5)' }}
              />
            </div>
            <span className="text-[10px] font-mono text-cyan-400 shrink-0">
              {Math.round(r.confidence * 100)}% CONF
            </span>
          </div>
        </div>
      </FadeIn>

      {/* Change Metrics */}
      {hasChange && (
        <FadeIn delay={100}>
          <div>
            <h3 className="text-[10px] font-mono text-gray-500 tracking-widest mb-2 flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> CHANGED SECTORS · RANKED BY AREA
            </h3>
            <div className="space-y-2">
              {/* Show change metrics as a change region card */}
              <div className="bg-[#0a0f1a] border border-gray-800/60 rounded-lg p-3 hover:border-red-900/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-red-400">CR-01</span>
                    <p className="text-xs font-mono text-gray-200 mt-0.5">Surface Change Detected</p>
                    <p className="text-[10px] font-mono text-gray-500 mt-0.5">
                      Area: {r.change_metrics!.affected_area_km2} km²
                    </p>
                  </div>
                  <div className="text-right">
                    <DeltaBadge value={r.change_metrics!.change_ratio_pct} />
                    <p className="text-[9px] text-gray-600 font-mono mt-0.5">
                      SSIM: {r.change_metrics!.ssim_score?.toFixed(3)}
                    </p>
                  </div>
                </div>
                <GaugeBar pct={Math.min(100, r.change_metrics!.change_ratio_pct * 2)} color="#ef4444" />
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Detected Objects / Targets */}
      {hasObjects && (
        <FadeIn delay={200}>
          <div>
            <h3 className="text-[10px] font-mono text-gray-500 tracking-widest mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" /> DETECTED TARGETS & FEATURES
              <span className="ml-auto text-[9px] font-mono text-purple-400">{objectCount} CATEGORIES</span>
            </h3>
            <div className="space-y-2">
              {r.detected_objects.map((obj, i) => {
                const label = obj.class_name || (obj as any).label || 'Unknown Target';
                const { icon, color } = getTargetIcon(label);
                const area_px = obj.bbox
                  ? Math.round(Math.abs(obj.bbox.x2 - obj.bbox.x1) * Math.abs(obj.bbox.y2 - obj.bbox.y1) * 10000)
                  : 0;
                return (
                  <div
                    key={i}
                    className="bg-[#0a0f1a] border border-gray-800/60 rounded-lg p-3 hover:border-purple-900/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{icon}</span>
                        <div>
                          <p className="text-xs font-mono text-gray-200">{label}</p>
                          {area_px > 0 && (
                            <p className="text-[9px] font-mono text-gray-600">
                              {area_px.toLocaleString()} px² (~{(area_px / 100).toFixed(1)} ha)
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono shrink-0" style={{ color }}>
                        {Math.round(obj.confidence * 100)}% conf
                      </span>
                    </div>
                    <GaugeBar pct={Math.round(obj.confidence * 100)} color={color} />
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Surface Classification */}
      {hasSurface && (
        <FadeIn delay={300}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-mono text-gray-500 tracking-widest flex items-center gap-1">
                <Layers className="w-3 h-3" /> SURFACE CLASSIFICATION
              </h3>
              <span className="text-[9px] font-mono text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                Pixel-Level Indices
              </span>
            </div>

            {/* Multi-color stacked bar */}
            <div className="flex h-2 rounded-full overflow-hidden mb-3 gap-0.5">
              {surfaceEntries.map(([key, pct]) => {
                const { color } = getSurfaceConf(key);
                return (
                  <div
                    key={key}
                    className="h-full transition-all duration-1000 rounded-sm"
                    style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}60` }}
                    title={`${key}: ${pct.toFixed(1)}%`}
                  />
                );
              })}
            </div>

            <div className="space-y-2">
              {surfaceEntries.map(([key, pct], i) => {
                const { icon, color, label } = getSurfaceConf(key);
                const hectares = (pct * 14.17).toFixed(2); // estimated from 1417.4 ha total
                return (
                  <FadeIn key={key} delay={300 + i * 80}>
                    <div className="bg-[#0a0f1a] border border-gray-800/60 rounded-lg px-3 py-2.5 hover:border-gray-700/60 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span style={{ color }}>{icon}</span>
                          <div>
                            <p className="text-xs font-mono text-gray-200">{label}</p>
                            <p className="text-[9px] font-mono text-gray-600">
                              ~{hectares} ha
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-mono font-bold" style={{ color }}>
                          <AnimatedNumber value={pct} decimals={1} />%
                        </span>
                      </div>
                      <GaugeBar pct={pct} color={color} />
                    </div>
                  </FadeIn>
                );
              })}
            </div>

            {/* NDVI summary */}
            {r.ndvi_stats && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { label: 'MEAN NDVI', value: r.ndvi_stats.mean.toFixed(3), color: '#22c55e' },
                  { label: 'MEDIAN', value: r.ndvi_stats.median.toFixed(3), color: '#3b82f6' },
                  { label: 'STD DEV', value: r.ndvi_stats.std.toFixed(3), color: '#f59e0b' },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#050a14] border border-gray-800/50 rounded-lg p-2 text-center">
                    <p className="text-[9px] font-mono text-gray-600">{stat.label}</p>
                    <p className="text-xs font-mono font-bold mt-0.5" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {/* Cloud Reconstruction disclosure */}
      {r.cloud_reconstruction?.triggered && (
        <FadeIn delay={400}>
          <div className="bg-blue-900/10 border border-blue-800/30 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-mono text-blue-400 tracking-widest">CLOUD RECONSTRUCTION</span>
            </div>
            <p className="text-[10px] font-mono text-gray-400 leading-snug">{r.cloud_reconstruction.disclosure_text}</p>
            <div className="flex gap-2 mt-2">
              <div className="flex-1">
                <p className="text-[9px] font-mono text-gray-600">COVERAGE</p>
                <p className="text-xs font-mono text-blue-400">{r.cloud_reconstruction.coverage_pct.toFixed(1)}%</p>
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-mono text-gray-600">METHOD</p>
                <p className="text-xs font-mono text-blue-400">{r.cloud_reconstruction.method?.replace('_', ' ').toUpperCase()}</p>
              </div>
              <div className="flex-1">
                <p className="text-[9px] font-mono text-gray-600">CONF.</p>
                <p className="text-xs font-mono text-blue-400">{r.cloud_reconstruction.avg_confidence.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Escalation warning */}
      {r.requires_expert_escalation && (
        <FadeIn delay={500}>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[10px] font-mono text-red-400 tracking-widest">EXPERT ESCALATION REQUIRED</span>
            </div>
            <p className="text-[10px] font-mono text-gray-400 mt-1">{r.escalation_reason}</p>
          </div>
        </FadeIn>
      )}

      {/* Bi-Temporal Surface Dynamics */}
      {r.ndvi_stats?.delta_ndvi && Object.keys(r.ndvi_stats.delta_ndvi).length > 0 && (
        <FadeIn delay={480}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-mono text-gray-500 tracking-widest flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> BI-TEMPORAL DYNAMICS
              </h3>
              <span className="text-[9px] font-mono text-gray-600">T0 → T1</span>
            </div>
            <div className="space-y-1.5">
              {Object.entries(r.ndvi_stats.delta_ndvi).map(([cls, data], i) => {
                const { icon, color } = getSurfaceConf(cls);
                const isPos = data.delta > 0;
                const isNeg = data.delta < 0;
                const deltaColor = isPos ? '#ef4444' : isNeg ? '#22c55e' : '#9ca3af';
                return (
                  <FadeIn key={cls} delay={480 + i * 60}>
                    <div className="bg-[#0a0f1a] border border-gray-800/50 rounded-lg px-3 py-2 hover:border-gray-700/40 transition-colors">
                      <div className="flex items-center gap-2">
                        <span style={{ color }} className="shrink-0 text-sm">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-mono text-gray-300 truncate">{cls}</p>
                          <p className="text-[9px] font-mono text-gray-600">
                            {data.t0.toFixed(1)} ha → {data.t1.toFixed(1)} ha
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono font-bold" style={{ color: deltaColor }}>
                            {isPos ? '+' : ''}{data.delta.toFixed(2)} ha
                          </p>
                          <p className="text-[9px] font-mono" style={{ color: deltaColor }}>
                            ({isPos ? '+' : ''}{data.pct.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Engine footer */}
      <FadeIn delay={700}>
        <div className="pt-2 border-t border-gray-800/50">
          <p className="text-[9px] font-mono text-gray-700 text-center">
            Engine: satquery-v2 · {r.task_type} · {r.query_id.substring(0, 12)}
          </p>
        </div>
      </FadeIn>

    </div>
  );
}
