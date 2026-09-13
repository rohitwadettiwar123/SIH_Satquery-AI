import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, Sphere, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Generate random points for a starfield/debris effect
const generateStars = (count: number) => {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  return positions;
};

export default function FloatingSatellite() {
  const satRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Points>(null);
  const stars = generateStars(1500);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime * 0.3; // Orbit speed
    
    if (satRef.current) {
      // Wide sweeping orbit across the screen
      satRef.current.position.x = Math.sin(t) * 7; 
      satRef.current.position.y = Math.sin(t * 0.7) * 4; 
      satRef.current.position.z = Math.cos(t) * 5; 
      
      // Dynamic rotation as it flies
      satRef.current.rotation.y += delta * 0.4;
      satRef.current.rotation.z = Math.sin(t * 2) * 0.2;
      satRef.current.rotation.x = Math.cos(t * 2) * 0.2;
    }
    
    if (starsRef.current) {
      starsRef.current.rotation.y -= 0.0002;
      starsRef.current.rotation.x -= 0.0001;
    }
  });

  // Materials
  const bodyMaterial = <meshStandardMaterial color="#27272a" roughness={0.3} metalness={0.8} />;
  const panelMaterial = <meshStandardMaterial color="#000000" emissive="#00f0ff" emissiveIntensity={0.2} roughness={0.1} metalness={0.9} />;
  const panelGridMaterial = <meshStandardMaterial color="#00f0ff" wireframe={true} opacity={0.3} transparent={true} />;
  const goldFoil = <meshStandardMaterial color="#facc15" roughness={0.5} metalness={1} />;

  return (
    <group>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={3} color="#ffffff" />
      <pointLight position={[-5, -5, -5]} intensity={2} color="#00f0ff" />
      <pointLight position={[5, -5, 5]} intensity={2} color="#39ff14" />
      
      {/* The Satellite Group */}
      <group ref={satRef} scale={1.5}>
        
        {/* Main Body (Bus) */}
        <Box args={[1, 1.5, 1]} castShadow>
          {goldFoil}
        </Box>
        
        {/* Top Antenna / Sensor Payload */}
        <Cylinder args={[0.3, 0.3, 0.8, 16]} position={[0, 1.15, 0]}>
          {bodyMaterial}
        </Cylinder>
        <Sphere args={[0.2, 16, 16]} position={[0, 1.6, 0]}>
          <meshStandardMaterial color="#39ff14" emissive="#39ff14" emissiveIntensity={0.8} />
        </Sphere>
        
        {/* Dish Antenna (Bottom) */}
        <Cylinder args={[0.6, 0.1, 0.3, 32]} position={[0, -0.9, 0]} rotation={[Math.PI, 0, 0]}>
          {bodyMaterial}
        </Cylinder>
        <Sphere args={[0.1, 8, 8]} position={[0, -1.1, 0]}>
          <meshStandardMaterial color="#ff003c" emissive="#ff003c" emissiveIntensity={0.5} />
        </Sphere>

        {/* Left Solar Panel Array */}
        <group position={[-2, 0, 0]}>
          <Cylinder args={[0.05, 0.05, 1]} rotation={[0, 0, Math.PI / 2]} position={[1, 0, 0]}>
            {bodyMaterial}
          </Cylinder>
          <Box args={[2.5, 0.8, 0.05]}>
            {panelMaterial}
          </Box>
          <Box args={[2.51, 0.81, 0.06]}>
            {panelGridMaterial}
          </Box>
        </group>

        {/* Right Solar Panel Array */}
        <group position={[2, 0, 0]}>
          <Cylinder args={[0.05, 0.05, 1]} rotation={[0, 0, Math.PI / 2]} position={[-1, 0, 0]}>
            {bodyMaterial}
          </Cylinder>
          <Box args={[2.5, 0.8, 0.05]}>
            {panelMaterial}
          </Box>
          <Box args={[2.51, 0.81, 0.06]}>
            {panelGridMaterial}
          </Box>
        </group>

      </group>

      {/* Orbiting starfield/debris */}
      <Points ref={starsRef} positions={stars} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#ffffff" size={0.03} sizeAttenuation={true} depthWrite={false} opacity={0.6} />
      </Points>
    </group>
  );
}
