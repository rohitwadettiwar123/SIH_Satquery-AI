import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import FloatingSatellite from './Globe';
import { OrbitControls } from '@react-three/drei';
import { Satellite, Lock, LogIn, Fingerprint, ScanEye } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 1500);
  };

  return (
    <div className="w-full h-screen relative bg-space overflow-hidden flex items-center justify-center">
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <FloatingSatellite />
          <OrbitControls 
            enableZoom={false} 
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.5}
          />
        </Canvas>
      </div>

      {/* CRT Scanline */}
      <div className="scanlines z-10 pointer-events-none"></div>

      {/* Auth UI */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-20 w-full max-w-md"
      >
        <div className="backdrop-blur-xl bg-panel/40 border border-neon-cyan/30 p-8 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-hidden group">
          
          {/* Decorative Corner Borders */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-neon-cyan/50 rounded-tl-2xl"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-neon-cyan/50 rounded-tr-2xl"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-neon-cyan/50 rounded-bl-2xl"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-neon-cyan/50 rounded-br-2xl"></div>

          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-neon-cyan/10 border border-neon-cyan rounded-full flex items-center justify-center mb-4 relative">
              <Satellite className="w-8 h-8 text-neon-cyan animate-pulse-glow" />
              {/* Spinning ring */}
              <div className="absolute inset-0 border border-t-neon-cyan border-r-transparent border-b-transparent border-l-transparent rounded-full animate-[spin_3s_linear_infinite]"></div>
            </div>
            <h1 className="text-3xl font-mono font-bold tracking-[0.2em] text-white flex items-center">
              SATQUERY<span className="text-neon-cyan">.AI</span>
            </h1>
            <p className="text-neon-green/80 font-mono text-xs mt-2 tracking-widest uppercase">
              Secure Terminal Access
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div className="relative">
              <ScanEye className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-cyan/50" />
              <input 
                type="text" 
                required
                placeholder="Agent ID / Operator Clear"
                className="w-full bg-space/50 border border-panel-border text-white text-sm font-mono rounded-lg px-10 py-3 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neon-cyan/50" />
              <input 
                type="password" 
                required
                placeholder="Biometric Passkey"
                className="w-full bg-space/50 border border-panel-border text-white text-sm font-mono rounded-lg px-10 py-3 focus:outline-none focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan text-neon-cyan font-mono font-bold text-sm tracking-widest rounded-lg py-3 mt-4 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-pulse flex items-center gap-2">
                  <Fingerprint className="w-4 h-4" /> AUTHENTICATING...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> 
                  INITIALIZE LINK
                </span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-[10px] font-mono text-gray-500 uppercase flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-alert-red rounded-full animate-pulse"></div>
            <span>Restricted Access: Authorized Personnel Only</span>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
