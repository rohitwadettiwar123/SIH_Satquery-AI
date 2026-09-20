import React, { useEffect, useState } from 'react';
import { AnalysisResult, UploadResponse } from '../types';
import BeforeAfterSlider from './BeforeAfterSlider';

interface Props {
  images: UploadResponse[];
  result: AnalysisResult | null;
}

export default function MapViewer({ images, result }: Props) {
  // A simple static viewer for demonstration since real mapping requires actual georeferencing
  // We'll show the primary image with bounding boxes overlaid.

  const [activeImage, setActiveImage] = useState<string>('');

  useEffect(() => {
    if (images.length > 0) {
      setActiveImage(images[0].preview_url ?? '');
    } else {
      setActiveImage('');
    }
  }, [images]);

  if (images.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 font-mono text-xs bg-black">
        <div className="w-24 h-24 border border-gray-800 rounded-full flex items-center justify-center mb-4 animate-[spin_10s_linear_infinite]">
          <div className="w-20 h-20 border-t border-neon-cyan rounded-full"></div>
        </div>
        AWAITING SATELLITE FEED
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative overflow-hidden group">
      {images.length > 1 ? (
        <div className="absolute inset-0 z-0">
          <BeforeAfterSlider 
            beforeUrl={images[0].preview_url ?? ''} 
            afterUrl={images[1].preview_url ?? ''} 
          />
        </div>
      ) : result?.cloud_reconstruction?.triggered && result.cloud_reconstruction.original_url && result.cloud_reconstruction.reconstructed_url ? (
        <div className="absolute inset-0 z-0">
          <BeforeAfterSlider 
            beforeUrl={result.cloud_reconstruction.original_url} 
            afterUrl={result.cloud_reconstruction.reconstructed_url} 
          />
        </div>
      ) : (
        <img 
          src={activeImage} 
          alt="Satellite view" 
          className="absolute inset-0 w-full h-full object-contain z-0"
        />
      )}

      {/* Target Crosshairs styling */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-white/20 rounded-full pointer-events-none flex items-center justify-center z-10">
        <div className="w-1 h-1 bg-neon-cyan rounded-full"></div>
      </div>
      <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5 pointer-events-none z-10"></div>
      <div className="absolute top-0 left-1/2 w-[1px] h-full bg-white/5 pointer-events-none z-10"></div>

      {/* Detected Bounding Boxes — sorted by confidence, each labelled AREA N */}
      {result && [...result.detected_objects]
        .filter(obj => obj.bbox)
        .sort((a, b) => b.confidence - a.confidence)
        .map((obj, i) => {
          const areaLabel = `AREA ${i + 1}`;
          const boxColors = [
            { border: '#00f5ff', bg: 'rgba(0,245,255,0.08)', text: '#000', badge: '#00f5ff' }, // cyan
            { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',  text: '#000', badge: '#22c55e' }, // green
            { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', text: '#000', badge: '#f59e0b' }, // amber
            { border: '#a78bfa', bg: 'rgba(167,139,250,0.08)', text: '#000', badge: '#a78bfa' }, // purple
            { border: '#f97316', bg: 'rgba(249,115,22,0.08)', text: '#000', badge: '#f97316' }, // orange
          ];
          const c = boxColors[i % boxColors.length];
          const shortClass = (obj.class_name || obj.label || 'Region').split('/')[0].trim();
          return (
            <div
              key={i}
              className="absolute flex items-start z-20 group/box"
              style={{
                left: `${obj.bbox!.x1 * 100}%`,
                top: `${obj.bbox!.y1 * 100}%`,
                width: `${(obj.bbox!.x2 - obj.bbox!.x1) * 100}%`,
                height: `${(obj.bbox!.y2 - obj.bbox!.y1) * 100}%`,
                border: `2px solid ${c.border}`,
                background: c.bg,
                boxShadow: `0 0 10px ${c.border}50`,
              }}
            >
              {/* Corner brackets */}
              <span
                className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2"
                style={{ borderColor: c.border }}
              />
              <span
                className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2"
                style={{ borderColor: c.border }}
              />
              <span
                className="absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2"
                style={{ borderColor: c.border }}
              />
              <span
                className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2"
                style={{ borderColor: c.border }}
              />
              {/* Label badge */}
              <span
                className="absolute -top-5 left-0 text-[9px] font-mono font-bold px-1.5 py-0.5 flex items-center gap-1 whitespace-nowrap"
                style={{ backgroundColor: c.badge, color: '#000' }}
              >
                {areaLabel} · {shortClass} ({Math.round(obj.confidence * 100)}%)
              </span>
            </div>
          );
        })
      }

      {/* Controls Overlay */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1a1f2e]/80 backdrop-blur-md border border-gray-800 rounded-lg p-1 flex gap-1 z-10 shadow-xl">
          <button
            className="px-6 py-1.5 font-mono text-[11px] rounded transition-colors bg-neon-cyan text-black font-bold"
          >
            OPTICAL (T0)
          </button>
          <button
            className="px-6 py-1.5 font-mono text-[11px] rounded transition-colors text-gray-400 hover:text-white"
          >
            {images[1].modality === 'sar' ? 'SAR (T1)' : 'OPTICAL (T1)'}
          </button>
        </div>
      )}
    </div>
  );
}
