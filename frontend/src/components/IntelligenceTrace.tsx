import React, { useEffect, useState } from 'react';
import { AnalysisResult } from '../types';
import {
  ShieldCheck, Hash, Clock, CheckCircle2, XCircle,
  ChevronRight, Loader2, Activity, Lock, Zap
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
    <div className="h-1 bg-gray-800 rounded-full overflow-hidden mt-2">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
      />
    </div>
  );
}

// Pulsing step card
function TraceStep({ step, index, total }: { step: string; index: number; total: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 120);
    return () => clearTimeout(t);
  }, [index]);

  // Parse confidence from step text if present
  const confMatch = step.match(/(\d{2,3})%/);
  const conf = confMatch ? parseInt(confMatch[1]) : null;
  const isPass = step.toLowerCase().includes('pass') || step.toLowerCase().includes('verified') || step.toLowerCase().includes('complete');
  const isFail = step.toLowerCase().includes('fail') || step.toLowerCase().includes('error');

  const barColor = isFail ? '#ff4444' : conf && conf < 70 ? '#f59e0b' : '#00f5ff';

  return (
    <div
      className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      <div className="bg-[#0a0f1a] border border-gray-800/60 rounded-lg p-3 hover:border-cyan-900/60 transition-colors group">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[10px] font-mono text-cyan-600 tracking-widest">STEP {index + 1}</span>
          {isPass && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
          {isFail && <XCircle className="w-3 h-3 text-red-400 shrink-0" />}
        </div>
        <p className="text-xs font-mono text-gray-300 leading-snug">{step}</p>
        {conf !== null && (
          <ProgressBar
            value={conf}
            color={barColor}
          />
        )}
        {conf !== null && (
          <div className="text-right mt-1">
            <span className="text-[10px] font-mono" style={{ color: barColor }}>{conf}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntelligenceTrace({ result, isProcessing }: Props) {
  const [hashVisible, setHashVisible] = useState(false);

  useEffect(() => {
    if (result) {
      const t = setTimeout(() => setHashVisible(true), 800);
      return () => clearTimeout(t);
    }
    setHashVisible(false);
  }, [result]);

  // Empty / loading state
  if (!result && !isProcessing) {
    return (
      <div className="mission-panel h-full flex flex-col p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-gray-600" />
          <h2 className="font-mono text-gray-600 text-sm tracking-widest">INTELLIGENCE TRACE</h2>
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
      <div className="mission-panel h-full flex flex-col p-4">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          <h2 className="font-mono text-cyan-400 text-sm tracking-widest">INTELLIGENCE TRACE</h2>
        </div>
        <div className="flex-1 flex flex-col gap-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#0a0f1a] border border-gray-800/40 rounded-lg p-3 animate-pulse">
              <div className="h-2 bg-gray-800 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-800 rounded w-4/5" />
              <div className="h-1 bg-gray-800 rounded mt-2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const passCount = Object.values(result!.gate_verdicts).filter(v => v.startsWith('PASS')).length;
  const totalGates = Object.keys(result!.gate_verdicts).length;

  return (
    <div className="mission-panel flex flex-col p-4 h-full gap-4 overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <h2 className="font-mono text-cyan-400 text-sm tracking-widest">INTELLIGENCE TRACE</h2>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400">
          {passCount}/{totalGates} VERIFIED
        </span>
      </div>

      {/* Pipeline Steps */}
      <div className="shrink-0">
        <h3 className="text-[10px] text-gray-500 font-mono mb-2 tracking-widest flex items-center gap-1">
          <ChevronRight className="w-3 h-3" /> PIPELINE STEPS
          <span className="ml-auto text-cyan-600">{result!.execution_trace.length} GROUNDED</span>
        </h3>
        <div className="flex flex-col gap-2">
          {result!.execution_trace.map((step, i) => (
            <TraceStep key={i} step={step} index={i} total={result!.execution_trace.length} />
          ))}
        </div>
      </div>

      {/* Validation Gates */}
      <div className="shrink-0">
        <h3 className="text-[10px] text-gray-500 font-mono mb-2 tracking-widest flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> VALIDATION GATES
        </h3>
        <div className="grid grid-cols-1 gap-1.5">
          {Object.entries(result!.gate_verdicts).map(([gate, verdict], i) => {
            const isPass = verdict.startsWith('PASS');
            const isSkip = verdict.startsWith('SKIP');
            const label = gate.replace(/_/g, ' ').replace(/^G\d+ /, '');
            return (
              <div
                key={gate}
                className={`flex justify-between items-center px-2.5 py-1.5 rounded border transition-colors
                  ${isPass
                    ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                    : isSkip
                    ? 'bg-gray-800/20 border-gray-800/40'
                    : 'bg-red-500/5 border-red-500/20'}`}
              >
                <span className="text-[10px] font-mono text-gray-400 truncate">{label}</span>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {isPass
                    ? <CheckCircle2 className="w-3 h-3 text-green-400" />
                    : isSkip
                    ? <span className="text-[9px] font-mono text-gray-600">SKIP</span>
                    : <XCircle className="w-3 h-3 text-red-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Hash */}
      <div className={`shrink-0 pt-3 border-t border-gray-800 transition-all duration-700 ${hashVisible ? 'opacity-100' : 'opacity-0'}`}>
        <h3 className="text-[10px] text-gray-500 font-mono mb-1.5 flex items-center gap-1">
          <Lock className="w-3 h-3" /> SHA-256 PROVENANCE HASH
        </h3>
        <div className="bg-[#050a14] border border-cyan-900/40 p-2.5 rounded-lg">
          <p className="text-[9px] font-mono text-cyan-400 break-all leading-relaxed">{result!.audit_hash}</p>
        </div>

        {/* Stats row */}
        <div className="flex gap-2 mt-2">
          <div className="flex-1 bg-[#0a0f1a] border border-gray-800/50 rounded p-2 text-center">
            <Zap className="w-3 h-3 text-yellow-400 mx-auto mb-0.5" />
            <p className="text-[10px] font-mono text-yellow-400 font-bold">{result!.processing_time_ms}ms</p>
            <p className="text-[9px] font-mono text-gray-600">LATENCY</p>
          </div>
          <div className="flex-1 bg-[#0a0f1a] border border-gray-800/50 rounded p-2 text-center">
            <ShieldCheck className="w-3 h-3 text-cyan-400 mx-auto mb-0.5" />
            <p className="text-[10px] font-mono text-cyan-400 font-bold">{Math.round(result!.confidence * 100)}%</p>
            <p className="text-[9px] font-mono text-gray-600">CONFIDENCE</p>
          </div>
        </div>

        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `satquery_report_${result!.query_id.substring(0, 8)}.json`;
            a.click();
          }}
          className="mt-2 w-full py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/60 text-cyan-400 text-xs font-mono font-bold rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
        >
          <Hash className="w-3.5 h-3.5" /> EXPORT AUDIT REPORT
        </button>
      </div>
    </div>
  );
}
