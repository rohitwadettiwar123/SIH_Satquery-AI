import React from 'react';
import { AnalysisResult } from '../types';
import { ShieldCheck, Hash, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  result: AnalysisResult | null;
}

export default function EvidencePanel({ result }: Props) {
  if (!result) {
    return (
      <div className="mission-panel h-full p-4 flex flex-col opacity-50">
        <h2 className="font-mono text-gray-500 flex items-center gap-2 text-sm mb-4">
          <ShieldCheck className="w-4 h-4" /> EVIDENCE & AUDIT
        </h2>
        <div className="flex-1 border border-dashed border-gray-800 rounded flex items-center justify-center">
          <span className="text-[10px] font-mono text-gray-600">NO DATA</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mission-panel flex flex-col p-4 h-full">
      <h2 className="font-mono text-neon-green flex items-center gap-2 text-sm mb-4">
        <ShieldCheck className="w-4 h-4" /> EVIDENCE & AUDIT
      </h2>

      {/* Gates */}
      <div className="mb-6">
        <h3 className="text-[10px] text-gray-500 font-mono mb-2 uppercase">G0-G8 Validation Gates</h3>
        <div className="space-y-1.5">
          {Object.entries(result.gate_verdicts).map(([gate, verdict]) => {
            const isPass = verdict.startsWith('PASS');
            const isSkip = verdict.startsWith('SKIP');
            return (
              <div key={gate} className="flex justify-between items-center bg-space/50 px-2 py-1.5 rounded border border-gray-800/50">
                <span className="text-xs font-mono text-gray-400">{gate.split('_').slice(0,2).join(' ')}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-mono ${isPass ? 'text-neon-green' : isSkip ? 'text-gray-500' : 'text-alert-red'}`}>
                    {verdict}
                  </span>
                  {isPass ? <CheckCircle2 className="w-3 h-3 text-neon-green" /> : 
                   isSkip ? null : <XCircle className="w-3 h-3 text-alert-red" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trace */}
      <div className="mb-6 flex-1">
        <h3 className="text-[10px] text-gray-500 font-mono mb-2 uppercase flex items-center gap-1">
          <Clock className="w-3 h-3" /> Execution Trace
        </h3>
        <div className="bg-space rounded border border-gray-800 p-2 h-48 overflow-y-auto font-mono text-[9px] text-gray-400 space-y-1">
          {result.execution_trace.map((step, i) => (
            <div key={i} className="leading-tight border-b border-gray-800/50 pb-1">{step}</div>
          ))}
        </div>
      </div>

      {/* Audit Hash & Export */}
      <div className="mt-auto pt-4 border-t border-gray-800 flex flex-col gap-3">
        <div>
          <h3 className="text-[10px] text-gray-500 font-mono mb-1 flex items-center gap-1">
            <Hash className="w-3 h-3" /> SHA-256 PROVENANCE HASH
          </h3>
          <div className="bg-space/80 border border-gray-700 p-2 rounded text-[10px] font-mono text-neon-cyan break-all">
            {result.audit_hash}
          </div>
          <p className="text-[9px] text-gray-600 mt-2 font-mono">Processing Time: {result.processing_time_ms}ms</p>
        </div>

        <button 
          onClick={() => {
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `satquery_report_${result.query_id.substring(0,8)}.json`;
            a.click();
          }}
          className="w-full py-2 bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan text-xs font-mono font-bold rounded flex items-center justify-center gap-2 transition-colors"
        >
          <ShieldCheck className="w-4 h-4" /> EXPORT FULL AUDIT REPORT
        </button>
      </div>
    </div>
  );
}
