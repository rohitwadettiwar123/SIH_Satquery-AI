import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Generate random points for a starfield/debris effect
const generateStars = (count: number) => {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
  }
  return positions;
};

export default function Globe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);
  const stars = generateStars(1000);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
    if (starsRef.current) {
      starsRef.current.rotation.y -= 0.0005;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 3, 5]} intensity={2} color="#00dc82" />
      <pointLight position={[-5, -5, -5]} intensity={2} color="#06b6d4" />
      
      {/* Holographic Wireframe Globe */}
      <Sphere ref={meshRef} args={[2.5, 64, 64]} scale={1.2}>
        <meshStandardMaterial 
          color="#06b6d4"
          wireframe={true}
          emissive="#00dc82"
          emissiveIntensity={0.5}
          transparent
          opacity={0.15}
        />
      </Sphere>
      
      {/* Inner Core */}
      <Sphere args={[2.45, 32, 32]} scale={1.2}>
        <meshBasicMaterial color="#030712" />
      </Sphere>

      {/* Orbiting particles */}
      <Points ref={starsRef} positions={stars} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#00dc82" size={0.05} sizeAttenuation={true} depthWrite={false} opacity={0.4} />
      </Points>
    </group>
  );
}
