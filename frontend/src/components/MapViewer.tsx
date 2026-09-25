import React, { useEffect, useState } from 'react';
import { AnalysisResult, UploadResponse } from '../types';
import BeforeAfterSlider from './BeforeAfterSlider';

interface Props {
  images: UploadResponse[];
  result: AnalysisResult | null;
  isSelectionMode?: boolean;
  onSelectionChange?: (selection: {x1:number, y1:number, x2:number, y2:number} | null) => void;
}

export default function MapViewer({ images, result, isSelectionMode, onSelectionChange }: Props) {
  const [activeImage, setActiveImage] = useState<string>('');
  

  // Evidence State
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState<number | null>(null);
  const [viewRegionIndex, setViewRegionIndex] = useState<number | null>(null);

  // Area Selection State
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStart, setSelStart] = useState({ x: 0, y: 0 });
  const [selEnd, setSelEnd] = useState({ x: 0, y: 0 });
  const [committedSelection, setCommittedSelection] = useState<{x1:number, y1:number, x2:number, y2:number} | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(committedSelection);
    }
  }, [committedSelection, onSelectionChange]);

  useEffect(() => {
    if (images.length > 0) {
      setActiveImage(images[0].preview_url ?? '');
    } else {
      setActiveImage('');
    }
  }, [images]);

  useEffect(() => {
    if (!isSelectionMode) {
      setCommittedSelection(null);
      setIsSelecting(false);
    }
  }, [isSelectionMode]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isSelectionMode || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setSelStart({ x, y });
    setSelEnd({ x, y });
    setIsSelecting(true);
    setCommittedSelection(null);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isSelecting || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setSelEnd({ x, y });
  };
  
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isSelecting) return;
    setIsSelecting(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (selStart.x !== selEnd.x && selStart.y !== selEnd.y) {
      setCommittedSelection({
        x1: Math.min(selStart.x, selEnd.x),
        y1: Math.min(selStart.y, selEnd.y),
        x2: Math.max(selStart.x, selEnd.x),
        y2: Math.max(selStart.y, selEnd.y),
      });
    }
  };

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
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <div 
        ref={containerRef} onClick={() => { setSelectedEvidenceIndex(null); setViewRegionIndex(null); }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative aspect-square h-full max-w-full group ${isSelectionMode ? 'cursor-crosshair' : ''} touch-none`}
      >
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

      {/* Dynamic Selection Box */}
      {(isSelecting || committedSelection) && isSelectionMode && (() => {
        const box = isSelecting ? {
          x1: Math.min(selStart.x, selEnd.x),
          y1: Math.min(selStart.y, selEnd.y),
          x2: Math.max(selStart.x, selEnd.x),
          y2: Math.max(selStart.y, selEnd.y),
        } : committedSelection!;

        if (box.x1 === box.x2 || box.y1 === box.y2) return null;

        let centroidText = "Calculating...";
        let areaText = "-- ha";

        if (images.length > 0 && images[0].geo_metadata?.bounds_wgs84) {
          const b = images[0].geo_metadata.bounds_wgs84;
          const cx = (box.x1 + box.x2) / 2;
          const cy = (box.y1 + box.y2) / 2;
          const lng = b.west + cx * (b.east - b.west);
          const lat = b.north - cy * (b.north - b.south);
          centroidText = `${Math.abs(lat).toFixed(6)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(6)}° ${lng >= 0 ? 'E' : 'W'}`;
          
          const latDist = (b.north - b.south) * 111000;
          const lngDist = (b.east - b.west) * 111000 * Math.cos(b.north * Math.PI / 180);
          const totalAreaHa = (latDist * lngDist) / 10000;
          const boxAreaHa = totalAreaHa * ((box.x2 - box.x1) * (box.y2 - box.y1));
          areaText = `${boxAreaHa.toFixed(3)} ha`;
        }

        return (
          <div
            className={`absolute z-50 transition-colors ${!isSelecting ? 'pointer-events-auto cursor-pointer hover:bg-cyan-500/20' : 'pointer-events-none'}`}
            onClick={(e) => {
              if (!isSelecting) {
                e.stopPropagation();
                setCommittedSelection(null);
              }
            }}
            style={{
              left: `${box.x1 * 100}%`,
              top: `${box.y1 * 100}%`,
              width: `${(box.x2 - box.x1) * 100}%`,
              height: `${(box.y2 - box.y1) * 100}%`,
              border: '1.5px dashed #00f5ff',
              backgroundColor: isSelecting ? 'rgba(0, 245, 255, 0.1)' : 'rgba(0, 245, 255, 0.05)',
              boxShadow: '0 0 15px rgba(0,245,255,0.2)'
            }}
          >
            {!isSelecting && (
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-[#050b14]/90 backdrop-blur-sm border border-cyan-500/50 rounded-lg p-2 whitespace-nowrap shadow-xl flex flex-col items-center pointer-events-none">
                 <div className="flex flex-col gap-0.5 items-center">
                   <span className="text-[10px] font-sans font-bold text-gray-200">SELECTED AREA: <span className="text-cyan-400 font-mono">{areaText}</span></span>
                   <span className="text-[9px] font-mono text-gray-400">{centroidText}</span>
                 </div>
                 <span className="text-[8px] font-sans text-gray-500 mt-1 uppercase tracking-wider">Click box to clear</span>
                 {/* arrow pointer */}
                 <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#050b14] border-b border-r border-cyan-500/50 rotate-45"></div>
              </div>
            )}
          </div>
        );
      })()}

      
      {/* 📍 AI EVIDENCE PINS & REGIONS */}
      {result && [...(result.detected_objects || [])]
        .filter(obj => obj.bbox)
        .sort((a, b) => b.confidence - a.confidence)
        .map((obj, i) => {
          const pinNumber = ["①","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"][i] || `(${i+1})`;
          const c = { border: '#00f5ff', bg: 'rgba(0,245,255,0.08)', text: '#000', badge: '#00f5ff' };
          
          const cx = obj.bbox!.x1 + (obj.bbox!.x2 - obj.bbox!.x1) / 2;
          const cy = obj.bbox!.y1 + (obj.bbox!.y2 - obj.bbox!.y1) / 2;
          
          const isSelected = selectedEvidenceIndex === i;
          const isViewRegion = viewRegionIndex === i;
          
          let lat = "--", lng = "--";
          if (images.length > 0 && images[0].geo_metadata?.bounds_wgs84) {
            const b = images[0].geo_metadata.bounds_wgs84;
            lat = (b.south + (1 - cy) * (b.north - b.south)).toFixed(4);
            lng = (b.west + cx * (b.east - b.west)).toFixed(4);
          }

          return (
            <React.Fragment key={i}>
              {/* Region Highlight */}
              {isViewRegion && (
                <div
                  className="absolute flex items-start z-10 pointer-events-none transition-all duration-500"
                  style={{
                    left: `${obj.bbox!.x1 * 100}%`,
                    top: `${obj.bbox!.y1 * 100}%`,
                    width: `${(obj.bbox!.x2 - obj.bbox!.x1) * 100}%`,
                    height: `${(obj.bbox!.y2 - obj.bbox!.y1) * 100}%`,
                    border: `2px solid ${c.border}`,
                    background: 'rgba(0,245,255,0.15)',
                    boxShadow: `0 0 25px rgba(0,245,255,0.4), inset 0 0 15px rgba(0,245,255,0.2)`,
                  }}
                >
                  <span className="absolute -top-px -left-px w-3 h-3 border-t-2 border-l-2 border-cyan-300" />
                  <span className="absolute -top-px -right-px w-3 h-3 border-t-2 border-r-2 border-cyan-300" />
                  <span className="absolute -bottom-px -left-px w-3 h-3 border-b-2 border-l-2 border-cyan-300" />
                  <span className="absolute -bottom-px -right-px w-3 h-3 border-b-2 border-r-2 border-cyan-300" />
                </div>
              )}

              {/* Glowing Pin */}
              <div 
                className="absolute z-20 cursor-pointer transform -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}
                onClick={(e) => { e.stopPropagation(); setSelectedEvidenceIndex(isSelected ? null : i); setViewRegionIndex(null); }}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white transition-all shadow-[0_0_15px_rgba(0,245,255,0.5)] border ${isSelected ? 'bg-cyan-500/40 border-cyan-300 scale-110' : 'bg-[#050b14]/80 border-cyan-500/50 hover:bg-cyan-500/20 hover:border-cyan-400'}`}>
                  {pinNumber}
                </div>
                {/* Ping animation */}
                <div className="absolute inset-0 rounded-full border border-cyan-400/50 animate-ping pointer-events-none" style={{ animationDuration: '3s' }}></div>
              </div>

              {/* Evidence Card */}
              {isSelected && (
                <div className="absolute z-30 transform -translate-x-1/2 mt-6 pointer-events-auto" style={{ left: `${cx * 100}%`, top: `${cy * 100}%` }}>
                  <div className="w-56 bg-[#0a1118]/90 backdrop-blur-md border border-cyan-500/40 rounded-lg p-3 font-mono shadow-[0_0_20px_rgba(0,245,255,0.15)] flex flex-col gap-2">
                    <div className="flex justify-between items-center border-b border-cyan-500/30 pb-1 mb-1">
                      <div className="text-[10px] text-cyan-400 font-bold tracking-widest">EVIDENCE #{String(i+1).padStart(2, '0')}</div>
                      <button className="text-gray-500 hover:text-white" onClick={(e) => { e.stopPropagation(); setSelectedEvidenceIndex(null); setViewRegionIndex(null); }}>×</button>
                    </div>
                    <div className="text-sm font-bold text-white">{obj.class_name}</div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <div className="text-[9px] text-gray-500 tracking-wider">LOCATION</div>
                        <div className="text-[10px] text-gray-300">{lat}° N<br/>{lng}° E</div>
                      </div>
                      <div>
                        <div className="text-[9px] text-gray-500 tracking-wider">CONFIDENCE</div>
                        <div className="text-[10px] text-green-400 font-bold">{Math.round(obj.confidence * 100)}%</div>
                      </div>
                    </div>
                    
                    <div className="mt-1">
                        <div className="text-[9px] text-gray-500 tracking-wider">SOURCE</div>
                        <div className="text-[10px] text-gray-300">Satellite Analysis Pipeline</div>
                    </div>

                    <button 
                      className={`mt-2 w-full py-1.5 border text-xs tracking-wider transition-colors ${isViewRegion ? 'border-cyan-300 bg-cyan-500/20 text-cyan-200 shadow-[0_0_10px_rgba(0,245,255,0.3)]' : 'border-cyan-800 bg-[#0a1628] hover:bg-cyan-900/40 text-cyan-400'}`}
                      onClick={(e) => { e.stopPropagation(); setViewRegionIndex(isViewRegion ? null : i); }}
                    >
                      [ VIEW REGION ]
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
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
    </div>
  );
}
