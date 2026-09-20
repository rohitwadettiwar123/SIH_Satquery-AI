import React, { useState, useRef, useEffect } from 'react';

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
    <div 
      ref={containerRef}
      className="relative w-full h-full flex-1 overflow-hidden select-none"
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {/* After Image (Background, Right Side) */}
      <img src={afterUrl} alt="After" className="absolute inset-0 w-full h-full object-contain bg-black" />

      {/* Before Image (Clipped Foreground, Left Side) */}
      <div 
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img src={beforeUrl} alt="Before" className="absolute inset-0 w-full h-full object-contain bg-black" />
      </div>

      {/* Slider Divider Line */}
      <div 
        className="absolute top-0 bottom-0 w-[3px] bg-neon-cyan shadow-[0_0_15px_rgba(0,245,255,1)] z-10 cursor-ew-resize"
        style={{ left: `calc(${sliderPosition}% - 1px)` }}
      >
        {/* HUD Concentric Circle Overlay */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-white/20 rounded-full pointer-events-none flex items-center justify-center">
        </div>
        
        {/* Center Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-black border-2 border-neon-cyan rounded-full shadow-[0_0_15px_rgba(0,245,255,0.8)] flex items-center justify-center cursor-ew-resize">
          {/* Pause symbol inside */}
          <div className="flex gap-[3px]">
            <div className="w-[3px] h-3.5 bg-neon-cyan rounded-sm"></div>
            <div className="w-[3px] h-3.5 bg-neon-cyan rounded-sm"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
