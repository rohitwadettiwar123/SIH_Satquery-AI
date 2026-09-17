import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, Sphere, Points, PointMaterial, Ring } from '@react-three/drei';
import * as THREE from 'three';

// ─── Twinkling 3-layer Starfield ───────────────────────────────
function StarField() {
  const r1 = useRef<THREE.Points>(null);
  const r2 = useRef<THREE.Points>(null);
  const r3 = useRef<THREE.Points>(null);

  const makeSphere = (n: number, rMin: number, rMax: number) =>
    useMemo(() => {
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = rMin + Math.random() * (rMax - rMin);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        p[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        p[i * 3 + 2] = r * Math.cos(phi);
      }
      return p;
    }, []);

  const bright = makeSphere(300, 35, 60);
  const medium = makeSphere(900, 20, 50);
  const dim    = makeSphere(2000, 15, 55);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (r1.current) {
      r1.current.rotation.y = t * 0.00015;
      (r1.current.material as THREE.PointsMaterial).opacity = 0.75 + Math.sin(t * 2.1) * 0.25;
    }
    if (r2.current) {
      r2.current.rotation.y = -t * 0.0001;
      (r2.current.material as THREE.PointsMaterial).opacity = 0.45 + Math.sin(t * 1.7 + 1) * 0.2;
    }
    if (r3.current) {
      r3.current.rotation.y = t * 0.00005;
      (r3.current.material as THREE.PointsMaterial).opacity = 0.25 + Math.sin(t * 2.5 + 2) * 0.12;
    }
  });

  return (
    <>
      <Points ref={r1} positions={bright} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#ffffff" size={0.13} sizeAttenuation depthWrite={false} opacity={0.9} />
      </Points>
      <Points ref={r2} positions={medium} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#aaccff" size={0.07} sizeAttenuation depthWrite={false} opacity={0.55} />
      </Points>
      <Points ref={r3} positions={dim} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#8899cc" size={0.04} sizeAttenuation depthWrite={false} opacity={0.3} />
      </Points>
    </>
  );
}

// ─── Earth with atmosphere glow ────────────────────────────────
function Earth() {
  const earthRef  = useRef<THREE.Mesh>(null);
  const cloudRef  = useRef<THREE.Mesh>(null);
  const atmosRef  = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    if (earthRef.current)  earthRef.current.rotation.y  += delta * 0.07;
    if (cloudRef.current)  cloudRef.current.rotation.y  += delta * 0.11;
    if (atmosRef.current) {
      (atmosRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.25 + Math.sin(clock.elapsedTime * 0.5) * 0.08;
    }
  });

  return (
    <group position={[-6, -3, -9]}>
      {/* Atmosphere */}
      <Sphere ref={atmosRef} args={[2.18, 64, 64]}>
        <meshStandardMaterial color="#1a6aff" emissive="#1a6aff" emissiveIntensity={0.25}
          transparent opacity={0.16} side={THREE.BackSide} />
      </Sphere>
      {/* Ocean + land */}
      <Sphere ref={earthRef} args={[2, 64, 64]}>
        <meshStandardMaterial color="#1a5fcc" roughness={0.65} metalness={0}
          emissive="#002244" emissiveIntensity={0.1} />
      </Sphere>
      {/* Cloud layer */}
      <Sphere ref={cloudRef} args={[2.05, 48, 48]}>
        <meshStandardMaterial color="#ffffff" transparent opacity={0.18} roughness={1} metalness={0} />
      </Sphere>
    </group>
  );
}

// ─── Orbiting Moon ─────────────────────────────────────────────
function Moon() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.045;
    if (ref.current) {
      ref.current.position.x = -6 + Math.cos(t) * 3.4;
      ref.current.position.y = -3 + Math.sin(t) * 1.6;
      ref.current.position.z = -9 + Math.sin(t) * 1.2;
    }
  });
  return (
    <group ref={ref}>
      <Sphere args={[0.52, 32, 32]}>
        <meshStandardMaterial color="#aaaaaa" roughness={0.95} metalness={0} />
      </Sphere>
    </group>
  );
}

// ─── Ringed Planet (Saturn-like) ───────────────────────────────
function RingedPlanet() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.035;
      ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.08) * 0.04;
    }
  });
  return (
    <group ref={ref} position={[8.5, 4.5, -13]} rotation={[0.28, 0, 0.18]}>
      <Sphere args={[1.1, 48, 48]}>
        <meshStandardMaterial color="#c8a060" roughness={0.8} metalness={0.1}
          emissive="#5a3010" emissiveIntensity={0.05} />
      </Sphere>
      {/* Inner ring */}
      <Ring args={[1.28, 1.52, 64]} rotation={[Math.PI / 2.1, 0, 0]}>
        <meshStandardMaterial color="#8a6030" transparent opacity={0.72}
          side={THREE.DoubleSide} roughness={1} />
      </Ring>
      {/* Outer ring */}
      <Ring args={[1.55, 2.25, 64]} rotation={[Math.PI / 2.1, 0, 0]}>
        <meshStandardMaterial color="#b89055" transparent opacity={0.48}
          side={THREE.DoubleSide} roughness={1} />
      </Ring>
    </group>
  );
}

// ─── Nebula dust cloud ─────────────────────────────────────────
function NebulaDust() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const p = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      p[i * 3]     = (Math.random() - 0.5) * 22 + 4;
      p[i * 3 + 1] = (Math.random() - 0.5) * 14;
      p[i * 3 + 2] = (Math.random() - 0.5) * 12 - 6;
    }
    return p;
  }, []);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.00022;
      (ref.current.material as THREE.PointsMaterial).opacity =
        0.09 + Math.sin(clock.elapsedTime * 0.3) * 0.05;
    }
  });
  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial transparent color="#6622ee" size={0.28} sizeAttenuation depthWrite={false} opacity={0.1} />
    </Points>
  );
}

// ─── Realistic Satellite ───────────────────────────────────────
function RealisticSatellite() {
  const satRef    = useRef<THREE.Group>(null);
  const panelLRef = useRef<THREE.Group>(null);
  const panelRRef = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime * 0.27;
    if (satRef.current) {
      satRef.current.position.x = Math.sin(t)        * 6.5;
      satRef.current.position.y = Math.sin(t * 0.63) * 3.5;
      satRef.current.position.z = Math.cos(t * 0.78) * 4.2;
      satRef.current.rotation.y += delta * 0.28;
      satRef.current.rotation.z  = Math.sin(t * 1.4) * 0.14;
    }
    const flex = Math.sin(clock.elapsedTime * 0.5) * 0.035;
    if (panelLRef.current) panelLRef.current.rotation.z =  flex;
    if (panelRRef.current) panelRRef.current.rotation.z = -flex;
  });

  const gold   = <meshStandardMaterial color="#d4a017" roughness={0.25} metalness={0.95} />;
  const dark   = <meshStandardMaterial color="#111120" roughness={0.15} metalness={0.92} />;
  const silver = <meshStandardMaterial color="#cccccc"  roughness={0.18} metalness={1.0} />;
  const panel  = <meshStandardMaterial color="#080820" emissive="#0033ee" emissiveIntensity={0.4}
                    roughness={0.05} metalness={0.95} />;
  const grid   = <meshStandardMaterial color="#0066ff" wireframe transparent opacity={0.2} />;
  const cellLine = (pos: [number,number,number]) => (
    <Box args={[2.2, 0.012, 0.055]} position={pos}>
      <meshStandardMaterial color="#0044ff" emissive="#0033ff" emissiveIntensity={0.6} />
    </Box>
  );

  return (
    <group ref={satRef} scale={1.28}>
      {/* ─ Main Bus ─ */}
      <Box args={[0.9, 1.4, 0.7]} castShadow>{gold}</Box>
      {/* Thermal blanket strips */}
      <Box args={[0.91, 1.41, 0.06]} position={[0, 0, 0.37]}>
        <meshStandardMaterial color="#b8880d" roughness={0.55} metalness={0.6} />
      </Box>
      <Box args={[0.91, 1.41, 0.06]} position={[0, 0, -0.37]}>
        <meshStandardMaterial color="#b8880d" roughness={0.55} metalness={0.6} />
      </Box>

      {/* ─ Sensor Payload (top) ─ */}
      <Cylinder args={[0.22, 0.28, 0.52, 20]} position={[0, 0.97, 0]}>{dark}</Cylinder>
      <Cylinder args={[0.17, 0.22, 0.16, 20]} position={[0, 1.26, 0]}>{dark}</Cylinder>
      <Sphere args={[0.14, 20, 20]} position={[0, 1.36, 0]}>
        <meshStandardMaterial color="#000000" emissive="#00ddff" emissiveIntensity={1.0} metalness={1} roughness={0} />
      </Sphere>

      {/* ─ Dish Antenna (bottom) ─ */}
      <Cylinder args={[0.54, 0.08, 0.22, 36]} position={[0, -0.83, 0]} rotation={[Math.PI, 0, 0]}>{silver}</Cylinder>
      <Cylinder args={[0.03, 0.03, 0.28, 8]} position={[0, -1.09, 0]}>{silver}</Cylinder>
      <Sphere args={[0.07, 10, 10]} position={[0, -1.25, 0]}>
        <meshStandardMaterial color="#ff1133" emissive="#ff0022" emissiveIntensity={1.2} />
      </Sphere>

      {/* ─ Side Star Tracker ─ */}
      <Box args={[0.17, 0.17, 0.33]} position={[0.545, 0.38, 0]}>{dark}</Box>

      {/* ─ Omni Antennas ─ */}
      <Cylinder args={[0.013, 0.013, 0.88, 6]} position={[0.44, 0.78, 0]} rotation={[0, 0, 0.38]}>{silver}</Cylinder>
      <Cylinder args={[0.013, 0.013, 0.7, 6]}  position={[-0.44, 0.68, 0]} rotation={[0, 0, -0.34]}>{silver}</Cylinder>

      {/* ─ Left Solar Panel ─ */}
      <group ref={panelLRef} position={[-1.95, 0, 0]}>
        <Cylinder args={[0.032, 0.032, 1.1, 8]} rotation={[0, 0, Math.PI / 2]} position={[0.95, 0, 0]}>{silver}</Cylinder>
        <Box args={[2.2, 0.73, 0.038]}>{panel}</Box>
        <Box args={[2.21, 0.74, 0.044]}>{grid}</Box>
        {cellLine([0,  0.24, 0])}
        {cellLine([0, -0.24, 0])}
      </group>

      {/* ─ Right Solar Panel ─ */}
      <group ref={panelRRef} position={[1.95, 0, 0]}>
        <Cylinder args={[0.032, 0.032, 1.1, 8]} rotation={[0, 0, Math.PI / 2]} position={[-0.95, 0, 0]}>{silver}</Cylinder>
        <Box args={[2.2, 0.73, 0.038]}>{panel}</Box>
        <Box args={[2.21, 0.74, 0.044]}>{grid}</Box>
        {cellLine([0,  0.24, 0])}
        {cellLine([0, -0.24, 0])}
      </group>

      {/* ─ Engine nozzle ─ */}
      <Cylinder args={[0.19, 0.11, 0.24, 18]} position={[0, -0.58, 0]}>
        <meshStandardMaterial color="#222222" roughness={0.08} metalness={1} />
      </Cylinder>

      {/* ─ Status LEDs ─ */}
      <Sphere args={[0.038, 8, 8]} position={[0.46, -0.48, 0.37]}>
        <meshStandardMaterial color="#00ff44" emissive="#00ff44" emissiveIntensity={2.5} />
      </Sphere>
      <Sphere args={[0.038, 8, 8]} position={[-0.46, 0.22, 0.37]}>
        <meshStandardMaterial color="#ffaa00" emissive="#ffaa00" emissiveIntensity={2.0} />
      </Sphere>
    </group>
  );
}

// ─── Root export ───────────────────────────────────────────────
export default function FloatingSatellite() {
  return (
    <group>
      {/* Lighting */}
      <ambientLight intensity={0.12} />
      <directionalLight position={[15, 10, 8]} intensity={5} color="#fff8e0" castShadow />
      <pointLight position={[-6, -3, -7]} intensity={2} color="#2255ff" distance={22} />
      <pointLight position={[0, 8, -10]} intensity={0.7} color="#aaaaff" />
      <pointLight position={[-2.5, 0, 0]} intensity={0.9} color="#0055ff" distance={7} />
      <pointLight position={[2.5, 0, 0]}  intensity={0.9} color="#0055ff" distance={7} />

      {/* Space scene */}
      <StarField />
      <NebulaDust />
      <Earth />
      <Moon />
      <RingedPlanet />
      <RealisticSatellite />
    </group>
  );
}
