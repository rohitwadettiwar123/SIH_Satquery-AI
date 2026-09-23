import React, { useState } from 'react';
import { Terminal, Send, Zap, Eye, Map, Cloud, ShieldCheck } from 'lucide-react';

interface Props {
  onAnalyze: (query: string, hint?: string) => void;
  isProcessing: boolean;
  disabled: boolean;
  isDemoMode?: boolean;
}

export default function QueryPanel({ onAnalyze, isProcessing, disabled, isDemoMode }: Props) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !disabled && !isProcessing) {
      onAnalyze(query);
    }
  };

  const quickPrompts = [
    { label: "Change Detection", icon: <Map className="w-3 h-3" />, hint: "CHANGE_DETECTION", q: "Detect and describe all structural changes." },
    { label: "NDVI Monitor", icon: <Zap className="w-3 h-3" />, hint: "NDVI_MONITORING", q: "Analyze vegetation health and compute NDVI." },
    { label: "High precision Escalation", icon: <ShieldCheck className="w-3 h-3" />, hint: "ESCALATION", q: "Request high-precision expert escalation for complex analysis." },
    { label: "Scene VQA", icon: <Eye className="w-3 h-3" />, hint: "VQA", q: "What are the primary land cover types?" },
  ];

  return (
    <div className="mission-panel flex flex-col p-4 h-full">
      <h2 className="font-mono text-neon-cyan mb-3 flex items-center gap-2 shrink-0">
        <Terminal className="w-4 h-4" /> QUERY
      </h2>

      <div className="flex flex-wrap gap-2 mb-4 shrink-0">
        {quickPrompts.map(p => (
          <button
            key={p.label}
            disabled={disabled || isProcessing}
            onClick={() => { setQuery(p.q); onAnalyze(p.q, p.hint); }}
            className="text-[10px] font-mono flex items-center gap-1 bg-panel-border/50 hover:bg-panel-border border border-gray-700 rounded px-2 py-1 text-gray-300 transition-colors disabled:opacity-50"
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 flex-1">
        <textarea
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={disabled || isProcessing}
          placeholder={disabled ? "Select a demo preset or upload image..." : "Enter query or command..."}
          className="bg-space border border-panel-border rounded p-3 text-sm font-mono text-gray-200 resize-none flex-1 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!query.trim() || disabled || isProcessing}
          className="bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/50 hover:bg-neon-cyan/20 disabled:opacity-50 disabled:hover:bg-neon-cyan/10 p-2 rounded flex items-center justify-center gap-2 font-mono transition-all"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2 animate-pulse">
              <Zap className="w-4 h-4" /> PROCESSING TELEMETRY...
            </span>
          ) : isDemoMode ? (
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400">DEMO INSTANT ANALYSIS</span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send className="w-4 h-4" /> EXECUTE
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
