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
function ProgressBar({ value, color = '#2dd4bf' }: { value: number; color?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 80);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden flex-1 shadow-inner">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}80` }}
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
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 h-full flex flex-col justify-between hover:border-[#374151] transition-colors shadow-lg">
        <div>
          <span className="text-[11px] font-medium text-gray-500 mb-2 block">Step {index + 1}</span>
          <p className="text-[13px] font-sans text-gray-200 leading-snug line-clamp-3">
            {stepText}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <ProgressBar value={conf} color={barColor} />
          <span className="text-[11px] font-mono text-gray-500">{conf}%</span>
        </div>
      </div>
    </div>
  );
}

export default function IntelligenceTrace({ result, isProcessing }: Props) {
  // Empty / loading state
  if (!result && !isProcessing) {
    return (
      <div className="mission-panel h-full flex flex-col p-5 bg-[#030712]">
        <div className="flex items-center gap-2 mb-4 px-1">
          <h2 className="font-sans font-bold text-gray-100 text-[15px] tracking-wide">Evidence & Traceability</h2>
        </div>
        <div className="flex-1 border border-dashed border-[#1f2937] rounded-lg flex flex-col items-center justify-center gap-3 opacity-50">
          <ShieldCheck className="w-8 h-8 text-gray-600" />
          <span className="text-[11px] font-mono text-gray-500 tracking-widest">AWAITING ANALYSIS</span>
        </div>
      </div>
    );
  }

  if (isProcessing && !result) {
    return (
      <div className="mission-panel h-full flex flex-col p-5 bg-[#030712]">
        <div className="flex items-center gap-2 mb-4 px-1">
          <h2 className="font-sans font-bold text-gray-100 text-[15px] tracking-wide">Evidence & Traceability</h2>
          <Loader2 className="w-4 h-4 text-[#2dd4bf] animate-spin ml-2" />
        </div>
        <div className="flex-1 flex gap-3 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="min-w-[280px] bg-[#111827] border border-[#1f2937] rounded-xl p-5 animate-pulse flex flex-col justify-between shadow-lg">
              <div>
                <div className="h-2.5 bg-[#1f2937] rounded w-16 mb-4" />
                <div className="h-3 bg-[#1f2937] rounded w-full mb-3" />
                <div className="h-3 bg-[#1f2937] rounded w-4/5" />
              </div>
              <div className="mt-4 flex gap-4 items-center">
                <div className="h-1.5 flex-1 bg-[#1e293b] rounded-full shadow-inner" />
                <div className="h-2.5 w-6 bg-[#1f2937] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mission-panel flex flex-col p-5 h-full bg-[#030712] relative border-t border-gray-800/40">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 mb-4 px-1">
        <h2 className="font-sans font-bold text-gray-100 text-[15px] tracking-wide">Evidence & Traceability</h2>
        
        <div className="flex gap-3">
          <span className="text-[11px] font-sans px-3 py-1 rounded-full border border-[#065f46] bg-[#064e3b]/40 text-[#34d399] font-medium shadow-sm">
            {result!.execution_trace.length} Steps Grounded
          </span>
        </div>
      </div>

      {/* Horizontal Scrolling Pipeline Steps */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-trace-scroll pb-1">
        <div className="flex gap-3 h-full pb-3">
          {result!.execution_trace.map((step, i) => (
            <TraceStepCard key={i} step={step} index={i} />
          ))}

          {/* Audit Hash Card (appears at the end) */}
          <div className="min-w-[280px] w-[280px] flex-shrink-0 animate-in fade-in slide-in-from-right-8 duration-700 delay-700 fill-mode-both">
            <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 h-full flex flex-col justify-between shadow-lg">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-3.5 h-3.5 text-[#2dd4bf]" />
                  <span className="text-[11px] font-sans text-[#2dd4bf] font-medium">Provenance Secured</span>
                </div>
                <p className="text-[10px] font-mono text-gray-400 break-all leading-relaxed line-clamp-3">
                  {result!.audit_hash}
                </p>
              </div>
              
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono">
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
                  className="text-[10px] bg-[#134e4a]/30 hover:bg-[#134e4a]/60 text-[#2dd4bf] px-3 py-1.5 rounded transition-colors border border-[#115e59]"
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
