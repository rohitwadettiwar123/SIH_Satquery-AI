import React, { useState, useRef, useEffect } from 'react';
import { Layers } from 'lucide-react';

interface Props {
  beforeUrl: string;
  afterUrl: string;
}

export default function BeforeAfterSlider({ beforeUrl, afterUrl }: Props) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percent);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  const stopDragging = () => setIsDragging(false);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', stopDragging);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', stopDragging);
    };
  }, [isDragging]);

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex justify-between items-center text-[10px] font-mono text-neon-cyan uppercase">
        <span>Raw Optical (T0)</span>
        <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> Cloud-Free Reconstruction</span>
      </div>
      <div 
        ref={containerRef}
        className="relative w-full h-full flex-1 min-h-[250px] overflow-hidden rounded border border-panel-border select-none"
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          handleMove(e.touches[0].clientX);
        }}
      >
        {/* After Image (Background) */}
        <img src={afterUrl} alt="After" className="absolute inset-0 w-full h-full object-contain bg-black" />

        {/* Before Image (Clipped Foreground) */}
        <div 
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-contain bg-black" />
        </div>

        {/* Slider Handle */}
        <div 
          className="absolute top-0 bottom-0 w-[2px] bg-neon-cyan cursor-ew-resize shadow-[0_0_10px_rgba(6,182,212,0.8)] z-10"
          style={{ left: `${sliderPosition}%` }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-panel border-2 border-neon-cyan rounded-full flex items-center justify-center">
            <div className="flex gap-[2px]">
              <div className="w-[2px] h-3 bg-neon-cyan/50 rounded-full"></div>
              <div className="w-[2px] h-3 bg-neon-cyan/50 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
