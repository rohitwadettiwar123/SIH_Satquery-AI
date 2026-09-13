import React from 'react';
import { AnalysisResult } from '../types';
import { MessageSquare, AlertTriangle, Layers, Percent, Box } from 'lucide-react';

interface Props {
  result: AnalysisResult | null;
}

export default function ResultPanel({ result }: Props) {
  if (!result) {
    return (
      <div className="mission-panel h-full flex items-center justify-center text-gray-500 font-mono text-xs">
        [ WAITING FOR TELEMETRY DATA ]
      </div>
    );
  }

  return (
    <div className="mission-panel flex flex-col p-4 h-full overflow-y-auto">
      <div className="flex justify-between items-start mb-4">
        <h2 className="font-mono text-neon-green flex items-center gap-2 text-sm">
          <MessageSquare className="w-4 h-4" /> ANALYSIS OUTPUT
        </h2>
        <span className="text-[10px] bg-panel-border px-2 py-1 rounded font-mono text-gray-300">
          TASK: {result.task_type}
        </span>
      </div>

      <div className="bg-space/50 p-4 rounded border border-gray-800 text-sm font-sans leading-relaxed text-gray-200 mb-4 whitespace-pre-wrap">
        {result.answer}
      </div>

      {result.cloud_reconstruction?.triggered && (
        <div className="bg-blue-900/20 border border-blue-900 rounded p-3 mb-4 flex items-start gap-2">
          <Layers className="w-4 h-4 text-neon-blue shrink-0 mt-0.5" />
          <div className="text-xs text-blue-200 font-mono">
            <span className="font-bold text-neon-blue block mb-1">CLOUD RECONSTRUCTION ENGAGED</span>
            {result.cloud_reconstruction.disclosure_text}
          </div>
        </div>
      )}

      {result.requires_expert_escalation && (
        <div className="bg-alert-red/10 border border-alert-red/30 rounded p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-alert-red shrink-0 mt-0.5" />
          <div className="text-xs text-red-200 font-mono">
            <span className="font-bold text-alert-red block mb-1">EXPERT ESCALATION REQUIRED</span>
            Confidence score ({Math.round(result.confidence * 100)}%) is below safety threshold. {result.escalation_reason}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-auto">
        <div className="bg-space border border-gray-800 rounded p-3">
          <div className="text-[10px] text-gray-500 font-mono mb-1 flex items-center gap-1">
            <Percent className="w-3 h-3" /> CONFIDENCE SCORE
          </div>
          <div className="text-xl font-mono text-neon-cyan">
            {Math.round(result.confidence * 100)}%
          </div>
        </div>
        
        {result.change_metrics && (
          <div className="bg-space border border-gray-800 rounded p-3">
            <div className="text-[10px] text-gray-500 font-mono mb-1 flex items-center gap-1">
              <Box className="w-3 h-3" /> AFFECTED AREA
            </div>
            <div className="text-xl font-mono text-alert-yellow">
              {result.change_metrics.affected_area_km2} km²
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
