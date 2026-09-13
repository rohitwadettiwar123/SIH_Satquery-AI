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
      setActiveImage(images[0].preview_url);
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
      {result?.cloud_reconstruction?.triggered && result.cloud_reconstruction.original_url && result.cloud_reconstruction.reconstructed_url ? (
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

      {/* Detected Bounding Boxes */}
      {result?.detected_objects.map((obj, i) => (
        <div 
          key={i}
          className="absolute border-2 border-neon-green bg-neon-green/10 flex items-start z-20"
          style={{
            left: `${obj.bbox.x1 * 100}%`,
            top: `${obj.bbox.y1 * 100}%`,
            width: `${(obj.bbox.x2 - obj.bbox.x1) * 100}%`,
            height: `${(obj.bbox.y2 - obj.bbox.y1) * 100}%`,
          }}
        >
          <span className="bg-neon-green text-black text-[9px] font-mono px-1 transform -translate-y-full shrink-0 truncate max-w-full">
            {obj.class_name} ({Math.round(obj.confidence * 100)}%)
          </span>
        </div>
      ))}

      {/* Controls Overlay */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-panel/80 backdrop-blur border border-panel-border rounded p-1 flex gap-1 z-10">
          {images.map((img, i) => (
            <button
              key={img.file_id}
              onClick={() => setActiveImage(img.preview_url)}
              className={`px-3 py-1 font-mono text-[10px] rounded transition-colors ${
                activeImage === img.preview_url ? 'bg-neon-cyan text-black' : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              {img.modality === 'sar' ? 'SAR (T1)' : i === 0 ? 'OPTICAL (T0)' : 'OPTICAL (T1)'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
