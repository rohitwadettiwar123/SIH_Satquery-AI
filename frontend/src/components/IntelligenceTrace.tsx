import React, { useEffect, useState } from 'react';
import { AnalysisResult } from '../types';
import {
  ShieldCheck, Loader2, Activity, CheckCircle2, Lock
} from 'lucide-react';

interface Props {
  result: AnalysisResult | null;
  isProcessing?: boolean;
}

// Animated progress bar
function ProgressBar({ value, color = '#00f5ff' }: { value: number; color?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 80);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="h-1 bg-gray-800 rounded-full overflow-hidden flex-1">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
      />
    </div>
  );
}

// Pulsing step card
function TraceStepCard({ step, index }: { step: string; index: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 120);
    return () => clearTimeout(t);
  }, [index]);

  // Parse confidence from step text if present
  const confMatch = step.match(/(\d{2,3})%/);
  const conf = confMatch ? parseInt(confMatch[1]) : 100;
  
  // Clean up step text to remove the percentage from the main display since we show it below
  const stepText = step.replace(/—\s*\d{2,3}%/, '').replace(/Step \d+:\s*/, '');
  
  const isFail = step.toLowerCase().includes('fail') || step.toLowerCase().includes('error');
  const barColor = isFail ? '#ff4444' : conf < 70 ? '#f59e0b' : '#00f5ff';

  return (
    <div
      className={`min-w-[280px] w-[280px] flex-shrink-0 transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
    >
      <div className="bg-[#0f1522] border border-gray-800/60 rounded-xl p-4 h-full flex flex-col justify-between hover:border-cyan-900/60 transition-colors">
        <div>
          <span className="text-[10px] font-sans text-gray-500 mb-2 block">Step {index + 1}</span>
          <p className="text-sm font-sans text-gray-200 leading-snug line-clamp-3">
            {stepText}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={conf} color={barColor} />
          <span className="text-xs font-mono text-gray-500">{conf}%</span>
        </div>
      </div>
    </div>
  );
}

export default function IntelligenceTrace({ result, isProcessing }: Props) {
  // Empty / loading state
  if (!result && !isProcessing) {
    return (
      <div className="mission-panel h-full flex flex-col p-4 bg-[#0a0f1a]">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-sans font-bold text-gray-200 text-sm tracking-wide">INTELLIGENCE TRACE</h2>
        </div>
        <div className="flex-1 border border-dashed border-gray-800 rounded-lg flex flex-col items-center justify-center gap-3 opacity-40">
          <ShieldCheck className="w-8 h-8 text-gray-700" />
          <span className="text-[10px] font-mono text-gray-600 tracking-widest">AWAITING ANALYSIS</span>
        </div>
      </div>
    );
  }

  if (isProcessing && !result) {
    return (
      <div className="mission-panel h-full flex flex-col p-4 bg-[#0a0f1a]">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-sans font-bold text-gray-200 text-sm tracking-wide">INTELLIGENCE TRACE</h2>
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin ml-2" />
        </div>
        <div className="flex-1 flex gap-3 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="min-w-[280px] bg-[#0f1522] border border-gray-800/40 rounded-xl p-4 animate-pulse flex flex-col justify-between">
              <div>
                <div className="h-2 bg-gray-800 rounded w-16 mb-4" />
                <div className="h-3 bg-gray-800 rounded w-full mb-2" />
                <div className="h-3 bg-gray-800 rounded w-4/5" />
              </div>
              <div className="mt-4 flex gap-3 items-center">
                <div className="h-1 flex-1 bg-gray-800 rounded-full" />
                <div className="h-2 w-6 bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mission-panel flex flex-col p-4 h-full bg-[#0a0f1a] relative border-t border-gray-800/40">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-4">
        <h2 className="font-sans font-bold text-gray-200 text-sm tracking-wide">INTELLIGENCE TRACE</h2>
        
        <div className="flex gap-3">
          <span className="text-[10px] font-sans px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 font-medium">
            {result!.execution_trace.length} Steps Grounded
          </span>
        </div>
      </div>

      {/* Horizontal Scrolling Pipeline Steps */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden hide-scrollbar">
        <div className="flex gap-3 h-full pb-2">
          {result!.execution_trace.map((step, i) => (
            <TraceStepCard key={i} step={step} index={i} />
          ))}

          {/* Audit Hash Card (appears at the end) */}
          <div className="min-w-[280px] w-[280px] flex-shrink-0 animate-in fade-in slide-in-from-right-8 duration-700 delay-700 fill-mode-both">
            <div className="bg-[#0f1522] border border-cyan-900/30 rounded-xl p-4 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-3.5 h-3.5 text-cyan-500" />
                  <span className="text-[10px] font-sans text-cyan-500 font-medium">Provenance Secured</span>
                </div>
                <p className="text-[10px] font-mono text-gray-400 break-all leading-relaxed line-clamp-3">
                  {result!.audit_hash}
                </p>
              </div>
              
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                  <Activity className="w-3 h-3" />
                  {result!.processing_time_ms}ms
                </div>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `audit_${result!.query_id.substring(0, 8)}.json`;
                    a.click();
                  }}
                  className="text-[10px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded transition-colors border border-cyan-500/20"
                >
                  Export Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
