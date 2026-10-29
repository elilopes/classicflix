import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, useCursor, ContactShadows, OrbitControls, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { XCircle, Trophy, Skull, Zap, Pause, Play, RefreshCw, Heart, Save } from 'lucide-react';
import { updateUserScore } from '../services/scoreService';

interface NosferatuGameProps {
  onClose: () => void;
  currentUser?: any;
  onOpenLogin: () => void;
}

const OBSTACLES = [
  { id: 1, type: 'rock', position: [3, 0.5, 2] as [number, number, number], scale: 1.2, radius: 1.2 },
  { id: 2, type: 'rock', position: [-3, 0.6, 1] as [number, number, number], scale: 1.0, radius: 1.0 },
  { id: 3, type: 'cross', position: [2, 0, -3] as [number, number, number], scale: 1.0, radius: 0.6 },
  { id: 4, type: 'rock', position: [-2, 0.8, -4] as [number, number, number], scale: 1.1, radius: 1.1 },
  { id: 5, type: 'tree', position: [-5, 0, -5] as [number, number, number], scale: 1.0, radius: 0.6 },
  { id: 6, type: 'tree', position: [5, 0, 3] as [number, number, number], scale: 1.0, radius: 0.6 },
  { id: 7, type: 'tree', position: [-2, 0, 7] as [number, number, number], scale: 1.0, radius: 0.6 },
  { id: 8, type: 'tree', position: [7, 0, -4] as [number, number, number], scale: 1.0, radius: 0.6 },
  { id: 9, type: 'tombstone', position: [-6, 0, 3] as [number, number, number], scale: 1.0, radius: 0.8 },
];

const checkLineOfSight = (start: THREE.Vector3, end: THREE.Vector3, obstacles: typeof OBSTACLES) => {
  let closestHit: THREE.Vector3 | null = null;
  let minDistance = Infinity;

  const A = new THREE.Vector2(start.x, start.z);
  const B = new THREE.Vector2(end.x, end.z);
  const AB = new THREE.Vector2().subVectors(B, A);
  const lenAB2 = AB.lengthSq();

  if (lenAB2 === 0) return null;

  for (const obs of obstacles) {
    const C = new THREE.Vector2(obs.position[0], obs.position[2]);
    const r = obs.radius;

    const AC = new THREE.Vector2().subVectors(C, A);
    let t = AC.dot(AB) / lenAB2;

    if (t >= 0 && t <= 1) {
      const P = new THREE.Vector2().copy(A).add(AB.clone().multiplyScalar(t));
      const distSq = P.distanceToSquared(C);
      const rSq = r * r;

      if (distSq < rSq) {
        const d = Math.sqrt(rSq - distSq);
        const tHit = t - d / Math.sqrt(lenAB2);
        
        if (tHit >= 0 && tHit <= 1) {
          const hitPoint2D = new THREE.Vector2().copy(A).add(AB.clone().multiplyScalar(tHit));
          const hitDist = A.distanceToSquared(hitPoint2D);
          if (hitDist < minDistance) {
            minDistance = hitDist;
            closestHit = new THREE.Vector3(hitPoint2D.x, 1.0, hitPoint2D.y);
          }
        }
      }
    }
  }
  return closestHit;
};

const Player = ({ targetPosition, playerRef, isDead, isPaused, isInvulnerable }: { targetPosition: THREE.Vector3, playerRef: React.MutableRefObject<THREE.Group | null>, isDead: boolean, isPaused: boolean, isInvulnerable: boolean }) => {
  const [isMoving, setIsMoving] = useState(false);
  const lastPos = useRef(new THREE.Vector3());
  const stuckFrames = useRef(0);
  const capeRef = useRef<THREE.Group>(null);
  const [visible, setVisible] = useState(true);

  useFrame((state, delta) => {
    if (!playerRef.current || isDead || isPaused) return;
    
    // Flashing effect when invulnerable
    if (isInvulnerable) {
      setVisible(Math.floor(state.clock.elapsedTime * 10) % 2 === 0);
    } else {
      setVisible(true);
    }

    const currentPos = playerRef.current.position;
    const distance = currentPos.distanceTo(targetPosition);
    
    if (distance > 0.2) {
      setIsMoving(true);
      const direction = new THREE.Vector3().subVectors(targetPosition, currentPos).normalize();
      const speed = 7 * delta;
      
      const lookAtPos = new THREE.Vector3(targetPosition.x, currentPos.y, targetPosition.z);
      playerRef.current.lookAt(lookAtPos);
      
      const nextPos = currentPos.clone().add(direction.multiplyScalar(speed));
      
      // Nosferatu is a ghost/vampire, so he passes through obstacles
      playerRef.current.position.copy(nextPos);

      // Sinister floating effect while walking
      playerRef.current.position.y = Math.sin(state.clock.elapsedTime * 10) * 0.05;

      // Cape swaying animation
      if (capeRef.current) {
        capeRef.current.rotation.x = 0.2 + Math.sin(state.clock.elapsedTime * 15) * 0.15;
        capeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 10) * 0.05;
      }
    } else {
      setIsMoving(false);
      playerRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1; // Idle float
      
      // Subtle idle cape sway
      if (capeRef.current) {
        capeRef.current.rotation.x = 0.1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
        capeRef.current.rotation.z = 0;
      }
    }
  });

  return (
    <group ref={playerRef} position={[0, 0, 0]} visible={!isDead && visible}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        {/* Nosferatu Body - Low Poly Coat */}
        <mesh position={[0, 1, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.4, 2, 6]} />
          <meshStandardMaterial color="#050505" roughness={1} flatShading />
        </mesh>
        
        {/* Pale Head - Rounded Low Poly */}
        <mesh position={[0, 2.1, 0]} castShadow>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color="#d1d1d1" emissive="#00ff00" emissiveIntensity={0.2} flatShading />
          
          {/* Glowing Red Eyes - Small Boxes */}
          <mesh position={[0.08, 0.05, 0.18]}>
            <boxGeometry args={[0.04, 0.04, 0.04]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
          </mesh>
          <mesh position={[-0.08, 0.05, 0.18]}>
            <boxGeometry args={[0.04, 0.04, 0.04]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
          </mesh>
          
          {/* Pointed Ears - Low Poly Cones */}
          <mesh position={[0.22, 0.1, 0]} rotation={[0, 0, -0.5]}>
            <coneGeometry args={[0.05, 0.2, 3]} />
            <meshStandardMaterial color="#d1d1d1" flatShading />
          </mesh>
          <mesh position={[-0.22, 0.1, 0]} rotation={[0, 0, 0.5]}>
            <coneGeometry args={[0.05, 0.2, 3]} />
            <meshStandardMaterial color="#d1d1d1" flatShading />
          </mesh>
        </mesh>
        
        {/* Triangular Swaying Cape */}
        <group ref={capeRef} position={[0, 1.9, -0.15]}>
          <mesh position={[0, -0.9, -0.05]} castShadow>
            {/* Using a flattened cone for triangular shape */}
            <coneGeometry args={[0.6, 1.8, 4]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.9} flatShading />
          </mesh>
        </group>

        {/* Hands for Lightning Origin */}
        <group position={[0.3, 1.2, 0.2]} name="hand_right" />
        <group position={[-0.3, 1.2, 0.2]} name="hand_left" />
        
        {/* Shadow Aura (Particles) */}
        {isMoving && <Sparkles count={30} scale={2.5} size={3} speed={0.6} color="#44ff44" opacity={0.6} />}
        {/* Constant Green Glow */}
        <pointLight position={[0, 1, 0]} intensity={0.5} color="#00ff00" distance={3} />
      </Float>
    </group>
  );
};

const Lightning = ({ start, end, onComplete, isSpecial }: { start: THREE.Vector3, end: THREE.Vector3, onComplete: () => void, isSpecial?: boolean }) => {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const segments = 8;
    const newPoints = [];
    for (let i = 0; i <= segments; i++) {
      const p = new THREE.Vector3().lerpVectors(start, end, i / segments);
      if (i > 0 && i < segments) {
        p.x += (Math.random() - 0.5) * 0.5;
        p.y += (Math.random() - 0.5) * 0.5;
        p.z += (Math.random() - 0.5) * 0.5;
      }
      newPoints.push(p);
    }
    setPoints(newPoints);

    const timer = setTimeout(() => {
      onComplete();
    }, 200);

    const fadeTimer = setInterval(() => {
      setOpacity(prev => Math.max(0, prev - 0.2));
    }, 30);

    return () => {
      clearTimeout(timer);
      clearInterval(fadeTimer);
    };
  }, [start, end, onComplete]);

  if (points.length === 0) return null;

  return (
    <group>
      <line>
        <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints(points)} />
        <lineBasicMaterial attach="material" color={isSpecial ? "#ff00ff" : "#00ffff"} linewidth={isSpecial ? 3 : 2} transparent opacity={opacity} />
      </line>
      {!isSpecial && <pointLight position={end} color="#00ffff" intensity={2} distance={5} />}
    </group>
  );
};

const SmokeEffect = ({ position, onComplete }: { position: THREE.Vector3, onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <group position={position}>
      <Sparkles count={40} scale={1.5} size={6} speed={2} color="#888888" opacity={0.8} />
      <pointLight color="#ffffff" intensity={0.5} distance={3} />
    </group>
  );
};

const Enemy = ({ position, playerRef, onHit, onPlayerHit, wave, isPaused, enemyPositionsRef, id }: { position: THREE.Vector3, playerRef: React.MutableRefObject<THREE.Group | null>, onHit: (pos: THREE.Vector3, kill: () => void) => void, onPlayerHit: (kill: () => void) => void, wave: number, isPaused: boolean, enemyPositionsRef?: React.MutableRefObject<Record<number, THREE.Vector3>>, id?: number }) => {
  const ref = useRef<THREE.Group>(null);
  const visualRef = useRef<THREE.Group>(null); // Separate reference to animate the body
  const [isDead, setIsDead] = useState(false);
  // Reduced initial speed: starts at 0.8 instead of 1.4
  const speed = 0.8 + (wave * 0.2); 
  
  useFrame((state, delta) => {
    if (!ref.current || isDead || !playerRef.current || isPaused) return;
    
    const currentPos = ref.current.position;
    const playerPosition = playerRef.current.position;
    const distanceToPlayer = currentPos.distanceTo(playerPosition);
    
    if (distanceToPlayer < 0.8) {
      onPlayerHit(() => setIsDead(true));
    } else if (distanceToPlayer < 12) {
      // Chase logic
      const direction = new THREE.Vector3().subVectors(playerPosition, currentPos).normalize();
      direction.y = 0;
      
      const lookAtPos = new THREE.Vector3(playerPosition.x, currentPos.y, playerPosition.z);
      ref.current.lookAt(lookAtPos);
      
      const nextPos = currentPos.clone().add(direction.multiplyScalar(speed * delta));
      
      // Collision resolution with obstacles for villagers
      for (const obs of OBSTACLES) {
        const obsPos = new THREE.Vector3(obs.position[0], 0, obs.position[2]);
        const dist = nextPos.distanceTo(obsPos);
        const minDistance = obs.radius + 0.6; // Obstacle radius + enemy radius
        if (dist < minDistance) {
          let pushDir = new THREE.Vector3().subVectors(nextPos, obsPos);
          if (pushDir.lengthSq() === 0) {
            pushDir.set(1, 0, 0); // Default push direction if exactly at center
          }
          pushDir.normalize();
          nextPos.copy(obsPos).add(pushDir.multiplyScalar(minDistance));
        }
      }
      
      ref.current.position.copy(nextPos);

      // Procedural Walk Animation (Waddle)
      if (visualRef.current) {
        const walkCycle = state.clock.elapsedTime * speed * 5;
        visualRef.current.position.y = Math.abs(Math.sin(walkCycle)) * 0.15; // Little jump
        visualRef.current.rotation.z = Math.sin(walkCycle) * 0.1; // Shoulder sway
      }
      
      if (enemyPositionsRef && id !== undefined) {
        enemyPositionsRef.current[id] = nextPos.clone();
      }
    }
  });

  if (isDead) return null;

  return (
    <group 
      ref={ref} 
      position={position}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (ref.current) onHit(ref.current.position.clone(), () => setIsDead(true));
      }}
      onPointerOver={() => document.body.style.cursor = 'crosshair'}
      onPointerOut={() => document.body.style.cursor = 'auto'}
    >
      {/* Invisible Hitbox to increase aim area */}
      <mesh visible={false} position={[0, 1, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 3, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Visual Wrapper for animation without affecting base rotation */}
      <group ref={visualRef}>
        
        {/* Body (Old European peasant style coat) */}
        <mesh position={[0, 0.6, 0]} castShadow>
          {/* Cylinder with only 6 segments creates a rustic, faceted look */}
          <cylinderGeometry args={[0.2, 0.35, 1.2, 6]} /> 
          <meshStandardMaterial color="#3a2a18" flatShading roughness={0.9} />
        </mesh>
        
        {/* Head (More square for PS1/Indie style) */}
        <mesh position={[0, 1.35, 0]} castShadow>
          <boxGeometry args={[0.3, 0.35, 0.3]} />
          <meshStandardMaterial color="#eec39a" flatShading />
          
          {/* Scared Eyes (White with pupils) */}
          <mesh position={[0.08, 0.05, 0.16]}>
            <boxGeometry args={[0.06, 0.06, 0.02]} />
            <meshStandardMaterial color="#ffffff" />
            <mesh position={[0, 0, 0.01]}>
              <boxGeometry args={[0.02, 0.02, 0.01]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
          </mesh>
          <mesh position={[-0.08, 0.05, 0.16]}>
            <boxGeometry args={[0.06, 0.06, 0.02]} />
            <meshStandardMaterial color="#ffffff" />
            <mesh position={[0, 0, 0.01]}>
              <boxGeometry args={[0.02, 0.02, 0.01]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
          </mesh>
        </mesh>

        {/* Peasant Hat */}
        <group position={[0, 1.55, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.05, 8]} />
            <meshStandardMaterial color="#1f1a14" flatShading />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 0.3, 6]} />
            <meshStandardMaterial color="#1f1a14" flatShading />
          </mesh>
        </group>

        {/* Arms with improvised Pitchfork */}
        <group position={[0.25, 0.8, 0.2]} rotation={[-0.5, 0, 0]}>
          {/* Arm */}
          <mesh>
            <boxGeometry args={[0.08, 0.5, 0.08]} />
            <meshStandardMaterial color="#3a2a18" flatShading />
          </mesh>
          {/* Pitchfork Handle */}
          <mesh position={[0, -0.2, 0.3]} rotation={[1.5, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 4]} />
            <meshStandardMaterial color="#4a3b2c" />
          </mesh>
          {/* Torch Light (moved to villager's hand) */}
          <pointLight position={[0, -0.2, 1]} intensity={0.6} color="#ffaa00" distance={5} />
        </group>
        
        <group position={[-0.25, 0.8, 0.1]} rotation={[0.2, 0, 0]}>
          {/* Free Left Arm */}
          <mesh>
            <boxGeometry args={[0.08, 0.5, 0.08]} />
            <meshStandardMaterial color="#3a2a18" flatShading />
          </mesh>
        </group>

      </group>
    </group>
  );
};

const Rock = ({ position, scale }: { position: [number, number, number], scale: number }) => (
  <mesh position={position} castShadow receiveShadow scale={scale}>
    <dodecahedronGeometry args={[1, 0]} />
    <meshStandardMaterial color="#444444" roughness={0.9} flatShading />
  </mesh>
);

const WoodenCross = ({ position }: { position: [number, number, number] }) => (
  <group position={position} rotation={[0, -Math.PI / 6, 0]}>
    {/* Vertical Beam */}
    <mesh position={[0, 1.75, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.3, 3.5, 0.3]} />
      <meshStandardMaterial color="#3a2a18" roughness={1} flatShading />
    </mesh>
    {/* Horizontal Beam */}
    <mesh position={[0, 2.4, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.8, 0.3, 0.3]} />
      <meshStandardMaterial color="#3a2a18" roughness={1} flatShading />
    </mesh>
  </group>
);

const Tombstone = ({ position }: { position: [number, number, number] }) => (
  <group position={position} rotation={[0, Math.PI / 8, 0]}>
    {/* Base */}
    <mesh position={[0, 0.035, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.7, 0.07, 0.3]} />
      <meshStandardMaterial color="#4a4a4a" roughness={0.9} />
    </mesh>
    {/* Main Stone */}
    <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.6, 0.49, 0.15]} />
      <meshStandardMaterial color="#555555" roughness={0.8} />
    </mesh>
    {/* Rounded Top */}
    <mesh position={[0, 0.525, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.3, 0.3, 0.105, 16]} />
      <meshStandardMaterial color="#555555" roughness={0.8} />
    </mesh>
    {/* Crack 1 */}
    <mesh position={[-0.1, 0.42, 0.08]} rotation={[0, 0, Math.PI / 4]}>
      <boxGeometry args={[0.28, 0.017, 0.017]} />
      <meshStandardMaterial color="#2a2a2a" roughness={1} />
    </mesh>
    {/* Crack 2 */}
    <mesh position={[0.05, 0.245, 0.08]} rotation={[0, 0, -Math.PI / 6]}>
      <boxGeometry args={[0.175, 0.014, 0.017]} />
      <meshStandardMaterial color="#2a2a2a" roughness={1} />
    </mesh>
    {/* Engraving R.I.P */}
    <group position={[0, 0.35, 0.08]}>
      {/* R */}
      <mesh position={[-0.15, 0, 0]}>
        <boxGeometry args={[0.075, 0.07, 0.01]} />
        <meshStandardMaterial color="#222222" roughness={1} />
      </mesh>
      {/* I */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.025, 0.07, 0.01]} />
        <meshStandardMaterial color="#222222" roughness={1} />
      </mesh>
      {/* P */}
      <mesh position={[0.15, 0, 0]}>
        <boxGeometry args={[0.075, 0.07, 0.01]} />
        <meshStandardMaterial color="#222222" roughness={1} />
      </mesh>
    </group>
  </group>
);

const Bat = ({ isPaused }: { isPaused: boolean }) => {
  const batRef = useRef<THREE.Group>(null);
  const leftWingRef = useRef<THREE.Group>(null);
  const rightWingRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (isPaused) return;
    const t = state.clock.elapsedTime;
    if (batRef.current) {
      batRef.current.position.x = Math.cos(t * 0.8) * 10;
      batRef.current.position.z = Math.sin(t * 0.8) * 10;
      batRef.current.position.y = 6 + Math.sin(t * 3) * 0.5;
      batRef.current.rotation.y = -t * 0.8;
    }
    if (leftWingRef.current && rightWingRef.current) {
      const flap = Math.sin(t * 20) * 0.6;
      leftWingRef.current.rotation.z = flap;
      rightWingRef.current.rotation.z = -flap;
    }
  });
  
  return (
    <group ref={batRef}>
      <mesh castShadow>
        <boxGeometry args={[0.2, 0.2, 0.4]} />
        <meshStandardMaterial color="#660000" flatShading />
      </mesh>
      <group ref={leftWingRef} position={[0.1, 0, 0]}>
        <mesh position={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.6, 0.05, 0.3]} />
          <meshStandardMaterial color="#660000" flatShading />
        </mesh>
      </group>
      <group ref={rightWingRef} position={[-0.1, 0, 0]}>
        <mesh position={[-0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.6, 0.05, 0.3]} />
          <meshStandardMaterial color="#660000" flatShading />
        </mesh>
      </group>
    </group>
  );
};

const Torch = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Torch Stick */}
    <mesh position={[0, 0.5, 0]} castShadow>
      <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
      <meshStandardMaterial color="#221100" />
    </mesh>
    {/* Torch Flame (Visual) */}
    <mesh position={[0, 1.1, 0]}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="#ffaa00" emissive="#ff4400" emissiveIntensity={2} />
    </mesh>
    {/* Torch Light */}
    <pointLight position={[0, 1.2, 0]} intensity={6} color="#ff6600" distance={15} decay={1.5} castShadow />
    <Sparkles count={5} scale={0.5} size={2} speed={0.5} color="#ffaa00" />
  </group>
);

const BloodPuddle = ({ position, scale = 1 }: { position: [number, number, number], scale?: number }) => {
  // Use a few overlapping circles to create an irregular puddle shape
  const splatters = useMemo(() => {
    return {
      rotation: Math.random() * Math.PI,
      parts: Array.from({ length: 5 }).map(() => ({
        x: (Math.random() - 0.5) * 0.8,
        y: (Math.random() - 0.5) * 0.8,
        r: 0.3 + Math.random() * 0.7,
        scaleX: 0.6 + Math.random() * 0.8,
        scaleY: 0.6 + Math.random() * 0.8,
        rot: Math.random() * Math.PI
      }))
    };
  }, []);

  return (
    <group position={position} rotation={[-Math.PI / 2, 0, splatters.rotation]} scale={[scale, scale, 1]}>
      {splatters.parts.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0]} rotation={[0, 0, s.rot]} scale={[s.scaleX, s.scaleY, 1]} receiveShadow>
          <circleGeometry args={[s.r, 16]} />
          <meshStandardMaterial color="#4a0000" roughness={0.1} metalness={0.2} transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

const DeadTree = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Trunk */}
    <mesh position={[0, 2, 0]} castShadow>
      <cylinderGeometry args={[0.15, 0.3, 4, 5]} />
      <meshStandardMaterial color="#1a120b" flatShading />
    </mesh>
    
    {/* Twisted "Z" Branch 1 */}
    <group position={[0, 3.5, 0]} rotation={[0, Math.PI / 4, 0]}>
      {/* Top segment */}
      <mesh position={[0.4, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 1, 4]} />
        <meshStandardMaterial color="#1a120b" flatShading />
      </mesh>
      {/* Middle diagonal segment */}
      <mesh position={[0, -0.3, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1.2, 4]} />
        <meshStandardMaterial color="#1a120b" flatShading />
      </mesh>
      {/* Bottom segment */}
      <mesh position={[-0.4, -0.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 1, 4]} />
        <meshStandardMaterial color="#1a120b" flatShading />
      </mesh>
    </group>

    {/* Twisted "Z" Branch 2 (Opposite side) */}
    <group position={[0, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[-0.5, 0.3, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 1.2, 4]} />
        <meshStandardMaterial color="#1a120b" flatShading />
      </mesh>
      <mesh position={[0, -0.2, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 1.4, 4]} />
        <meshStandardMaterial color="#1a120b" flatShading />
      </mesh>
      <mesh position={[0.5, -0.7, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 1.2, 4]} />
        <meshStandardMaterial color="#1a120b" flatShading />
      </mesh>
    </group>
  </group>
);

const Scene = ({ onScore, wave, setWave, onWaveStart, isPaused, isInvulnerable, onPlayerHit, gameOver, specialTrigger, onEnemyKill }: { onScore: (s: number) => void, wave: number, setWave: React.Dispatch<React.SetStateAction<number>>, onWaveStart: (w: number) => void, isPaused: boolean, isInvulnerable: boolean, onPlayerHit: () => void, gameOver: boolean, specialTrigger: number, onEnemyKill: () => void }) => {
  const [targetPosition, setTargetPosition] = useState(new THREE.Vector3(0, 0, 0));
  const playerRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [vfx, setVfx] = useState<{ id: number, type: 'lightning' | 'smoke', start?: THREE.Vector3, end: THREE.Vector3, isSpecial?: boolean }[]>([]);
  
  useCursor(hovered, 'crosshair', 'auto');

  const [enemies, setEnemies] = useState<{ id: number, pos: THREE.Vector3 }[]>([]);
  const enemyPositionsRef = useRef<Record<number, THREE.Vector3>>({});
  const spawningRef = useRef(false);

  const handlePointerDown = (e: any) => {
    if (isPaused || gameOver) return;
    e.stopPropagation();
    setTargetPosition(e.point.clone().setY(0));
  };

  const handleEnemyHit = (id: number, pos: THREE.Vector3, killEnemy: () => void) => {
    if (isPaused || gameOver) return;
    const startPos = playerRef.current ? playerRef.current.position.clone().add(new THREE.Vector3(0, 1.2, 0)) : new THREE.Vector3(0, 1.2, 0);
    const vfxId = Date.now();

    killEnemy();
    onEnemyKill();
    
    let totalScore = 10 * wave;
    const newVfx: { id: number, type: 'lightning' | 'smoke', start?: THREE.Vector3, end: THREE.Vector3 }[] = [
      { id: vfxId, type: 'lightning', start: startPos, end: pos.clone() },
      { id: vfxId + 1, type: 'smoke', end: pos.clone() }
    ];
    
    let killedIds = [id];
      
      // Chain Lightning Logic (Wave 10+)
      if (wave >= 10) {
        const chainRadius = 4;
        let currentPos = pos.clone();
        
        // Chain up to 2 additional enemies
        for (let i = 0; i < 2; i++) {
          const remainingEnemies = enemies.filter(e => !killedIds.includes(e.id));
          if (remainingEnemies.length === 0) break;
          
          let closestEnemy = null;
          let minDistance = Infinity;
          for (const e of remainingEnemies) {
            const dist = currentPos.distanceTo(e.pos);
            if (dist < minDistance && dist <= chainRadius) {
              minDistance = dist;
              closestEnemy = e;
            }
          }
          
          if (closestEnemy) {
            killedIds.push(closestEnemy.id);
            totalScore += 10 * wave;
            
            newVfx.push(
              { id: vfxId + 10 + i, type: 'lightning', start: currentPos.clone().add(new THREE.Vector3(0, 1, 0)), end: closestEnemy.pos.clone() },
              { id: vfxId + 20 + i, type: 'smoke', end: closestEnemy.pos.clone() }
            );
            currentPos = closestEnemy.pos.clone();
          } else {
            break;
          }
        }
      }

      setEnemies(prev => prev.filter(e => !killedIds.includes(e.id)));
      onScore(totalScore);
      setVfx(prev => [...prev, ...newVfx]);
  };

  const handleEnemyCollision = (id: number, killEnemy: () => void) => {
    if (isInvulnerable || gameOver) return;
    
    // Kill the enemy that hit us
    killEnemy();
    setEnemies(prev => prev.filter(e => e.id !== id));
    
    // Trigger damage logic in parent
    onPlayerHit();
  };

  useEffect(() => {
    if (specialTrigger > 0 && !isPaused && !gameOver) {
      const startPos = playerRef.current ? playerRef.current.position.clone().add(new THREE.Vector3(0, 1.2, 0)) : new THREE.Vector3(0, 1.2, 0);
      const targets = enemies.slice(0, 12); // Limit targets to avoid lag
      if (targets.length === 0) return;

      const vfxIdBase = Date.now();
      const newVfx: typeof vfx = [];
      const killedIds: number[] = [];

      targets.forEach((enemy, index) => {
        const targetPos = enemyPositionsRef.current[enemy.id] || enemy.pos;
        killedIds.push(enemy.id);
        newVfx.push({
          id: vfxIdBase + index,
          type: 'lightning',
          start: startPos,
          end: targetPos.clone(),
          isSpecial: true
        });
        newVfx.push({
          id: vfxIdBase + 100 + index,
          type: 'smoke',
          end: targetPos.clone()
        });
      });

      setEnemies(prev => prev.filter(e => !killedIds.includes(e.id)));
      onScore(targets.length * 10 * wave);
      setVfx(prev => [...prev, ...newVfx]);
    }
  }, [specialTrigger]);

  useEffect(() => {
    if (gameOver) {
      const pos = playerRef.current ? playerRef.current.position.clone() : new THREE.Vector3();
      setVfx(prev => [...prev, { id: Date.now(), type: 'smoke' as const, end: pos }]);
    }
  }, [gameOver]);

  useEffect(() => {
    if (enemies.length === 0 && !spawningRef.current && !isPaused && !gameOver) {
      spawningRef.current = true;
      
      setWave(prev => {
        const nextWave = prev + 1;
        
        // Announce wave start immediately
        onWaveStart(nextWave);
        
        setTimeout(() => {
          // If the game is paused, we'll delay the actual spawning
          const spawnEnemies = () => {
            const newEnemies = [];
            const numEnemies = nextWave === 1 ? 2 : 3 + nextWave * 2;
            for (let i = 0; i < numEnemies; i++) {
              const angle = Math.random() * Math.PI * 2;
              const radius = 7 + Math.random() * 5;
              newEnemies.push({
                id: Date.now() + i + Math.random(),
                pos: new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
              });
            }
            setEnemies(newEnemies);
            spawningRef.current = false;
          };

          spawnEnemies();
        }, 3000);
        
        return nextWave;
      });
    }
  }, [enemies.length, isPaused, gameOver, onWaveStart]);

  return (
    <>
      <OrthographicCamera makeDefault position={[15, 15, 15]} zoom={50} near={-100} far={100} />
      <OrbitControls target={[0, 0, 0]} enableRotate={false} enableZoom={false} enablePan={false} />
      <ambientLight intensity={3.0} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={1.2} 
        color="#6677aa"
        castShadow 
        shadow-mapSize={[2048, 2048]}
      />
      
      <Bat isPaused={isPaused} />

      <Player targetPosition={targetPosition} playerRef={playerRef} isDead={gameOver} isPaused={isPaused} isInvulnerable={isInvulnerable} />
      
      {enemies.map((enemy) => (
        <Enemy 
          key={enemy.id} 
          position={enemy.pos} 
          playerRef={playerRef} 
          wave={wave}
          isPaused={isPaused}
          onHit={(pos, kill) => handleEnemyHit(enemy.id, pos, kill)} 
          onPlayerHit={(kill) => handleEnemyCollision(enemy.id, kill)} 
          enemyPositionsRef={enemyPositionsRef}
          id={enemy.id}
        />
      ))}

      {/* VFX Rendering */}
      {vfx.map(effect => (
        effect.type === 'lightning' ? (
          <Lightning 
            key={effect.id} 
            start={effect.start!} 
            end={effect.end} 
            isSpecial={effect.isSpecial}
            onComplete={() => setVfx(prev => prev.filter(v => v.id !== effect.id))} 
          />
        ) : (
          <SmokeEffect 
            key={effect.id} 
            position={effect.end} 
            onComplete={() => setVfx(prev => prev.filter(v => v.id !== effect.id))} 
          />
        )
      ))}

      {/* Fixed Torches for Visibility */}
      <Torch position={[6, 0, 6]} />
      <Torch position={[-6, 0, 6]} />
      <Torch position={[6, 0, -6]} />
      <Torch position={[-6, 0, -6]} />
      <Torch position={[0, 0, 10]} />
      <Torch position={[0, 0, -10]} />

      {/* Blood Puddles */}
      <BloodPuddle position={[2, 0.01, -2]} scale={1.5} />
      <BloodPuddle position={[-3, 0.01, 4]} scale={2} />
      <BloodPuddle position={[1, 0.01, 5]} scale={1.2} />
      <BloodPuddle position={[-4, 0.01, -1]} scale={2.5} />

      {/* Graveyard Obstacles */}
      {OBSTACLES.map(obs => {
        if (obs.type === 'rock') return <Rock key={obs.id} position={obs.position} scale={obs.scale} />;
        if (obs.type === 'tree') return <DeadTree key={obs.id} position={obs.position} />;
        if (obs.type === 'tombstone') return <Tombstone key={obs.id} position={obs.position} />;
        return <WoodenCross key={obs.id} position={obs.position} />;
      })}

      {/* Ground */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]} 
        receiveShadow
        onPointerDown={handlePointerDown}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#111111" roughness={0.8} />
      </mesh>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.6} scale={40} blur={2.5} far={4.5} />
    </>
  );
};

export default function NosferatuGame({ onClose, currentUser, onOpenLogin }: NosferatuGameProps) {
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(0);
  const [health, setHealth] = useState(2);
  const [energy, setEnergy] = useState(0);
  const [specialTrigger, setSpecialTrigger] = useState(0);
  const [isInvulnerable, setIsInvulnerable] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [waveAnnouncement, setWaveAnnouncement] = useState<string | null>(null);
  const [gameId, setGameId] = useState(0);

  const handleWaveStart = useCallback((w: number) => {
    setWaveAnnouncement(`Onda ${w} iniciada`);
    setTimeout(() => setWaveAnnouncement(null), 3000);
  }, []);

  const handleEnemyKill = useCallback(() => {
    setEnergy(prev => Math.min(100, prev + 10)); // 10 kills to fill energy
  }, []);

  const handleSpecial = useCallback(() => {
    if (energy >= 100 && !isPaused && !gameOver) {
      setSpecialTrigger(prev => prev + 1);
      setEnergy(0);
    }
  }, [energy, isPaused, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleSpecial();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSpecial]);

  const handlePlayerDamage = () => {
    if (isInvulnerable || gameOver) return;
    
    const newHealth = health - 1;
    setHealth(newHealth);
    
    if (newHealth <= 0) {
      setGameOver(true);
    } else {
      setIsInvulnerable(true);
      setTimeout(() => setIsInvulnerable(false), 2000); // 2 seconds of invulnerability
    }
  };

  const handleReincarnate = () => {
    setScore(0);
    setHealth(2);
    setEnergy(0);
    setIsInvulnerable(false);
    setGameOver(false);
    setSaved(false);
    setIsPaused(false);
    setWave(0);
    setGameId(prev => prev + 1);
  };

  const handleRestartWave = () => {
    setHealth(2);
    setEnergy(0);
    setIsInvulnerable(false);
    setGameOver(false);
    setSaved(false);
    setIsPaused(false);
    setWave(prev => Math.max(0, prev - 1));
    setGameId(prev => prev + 1);
  };

  const handleSaveScore = () => {
    if (!currentUser) {
      onOpenLogin();
    } else {
      updateUserScore('nosferatuscore', score).then(() => setSaved(true)).catch(console.error);
    }
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3" style={{ zIndex: 10000, background: 'radial-gradient(circle, #1a0000 0%, #000 100%)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-black border border-danger border-opacity-25 w-100 h-100 rounded-4 overflow-hidden shadow-2xl position-relative d-flex flex-column" style={{ maxWidth: '1200px', maxHeight: '800px' }}>
        
        {/* Blood Harvest HUD */}
        <div className="p-4 border-bottom border-danger border-opacity-10 d-flex justify-content-between align-items-center bg-gradient-to-b from-black to-transparent" style={{ zIndex: 10 }}>
          <div className="d-flex gap-4">
            <div>
              <p className="text-danger small mb-0 font-monospace text-uppercase" style={{ letterSpacing: '2px' }}>Blood Harvest</p>
              <h2 className="text-white h3 mb-0" style={{ fontFamily: 'serif', letterSpacing: '1px' }}>{score.toLocaleString()}</h2>
            </div>
            <div className="border-start border-secondary border-opacity-25 ps-4 d-flex align-items-center gap-2">
              <p className="text-danger small mb-0 font-monospace text-uppercase d-none d-md-block" style={{ letterSpacing: '2px' }}>Vitality</p>
              <div className="d-flex gap-1">
                {[...Array(2)].map((_, i) => (
                  <Heart 
                    key={i} 
                    size={20} 
                    className={i < health ? "text-danger" : "text-secondary opacity-25"} 
                    fill={i < health ? "currentColor" : "none"} 
                  />
                ))}
              </div>
            </div>
            <div className="border-start border-secondary border-opacity-25 ps-4 d-flex align-items-center gap-2">
              <p className="text-info small mb-0 font-monospace text-uppercase d-none d-md-block" style={{ letterSpacing: '2px' }}>Energy</p>
              <div className="d-flex align-items-center gap-2">
                <div className="bg-dark rounded-pill overflow-hidden border border-secondary" style={{ width: '100px', height: '12px' }}>
                  <div 
                    className={`h-100 ${energy >= 100 ? 'bg-info animate-pulse' : 'bg-info opacity-75'}`} 
                    style={{ width: `${energy}%`, transition: 'width 0.3s ease' }}
                  ></div>
                </div>
                <button 
                  onClick={handleSpecial}
                  disabled={energy < 100}
                  className={`btn btn-sm rounded-circle p-1 d-flex align-items-center justify-content-center ${energy >= 100 ? 'btn-info animate-pulse shadow-lg' : 'btn-outline-secondary'}`}
                  style={{ width: '32px', height: '32px' }}
                  title="Special Power (Space)"
                >
                  <Zap size={16} fill={energy >= 100 ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </div>
          <div className="d-flex gap-3 align-items-center">
            <button 
              onClick={() => setIsPaused(!isPaused)} 
              className="btn btn-outline-danger px-3 py-2 d-flex align-items-center justify-content-center transition-all gap-2"
              title={isPaused ? "Continuar" : "Pausar"}
            >
              {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
              <span className="fw-bold d-none d-sm-inline">{isPaused ? "CONTINUAR" : "PAUSAR"}</span>
            </button>
            <button 
              onClick={handleRestartWave} 
              className="btn btn-outline-danger px-3 py-2 d-flex align-items-center justify-content-center transition-all gap-2"
              title="Reiniciar Onda"
            >
              <RefreshCw size={20} />
              <span className="fw-bold d-none d-sm-inline">REINICIAR</span>
            </button>
            <button 
              onClick={handleReincarnate} 
              className="btn btn-outline-danger px-3 py-2 d-flex align-items-center justify-content-center transition-all gap-2"
              title="Reencarnar (Novo Jogo)"
            >
              <Skull size={20} />
              <span className="fw-bold d-none d-sm-inline">REENCARNAR</span>
            </button>
            <button onClick={onClose} className="btn btn-link text-danger p-2 hover-white transition-all" title="Fechar">
              <XCircle size={32} />
            </button>
          </div>
        </div>

        {/* Game Canvas */}
        <div className="flex-grow-1 position-relative" style={{ minHeight: '500px', height: '100%' }}>
          <React.Suspense fallback={
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center bg-black" style={{ zIndex: 1000 }}>
              <div className="spinner-border text-danger mb-3" role="status"></div>
              <h2 className="text-danger fw-bold font-monospace animate-pulse">LOADING...</h2>
            </div>
          }>
            <Canvas shadows camera={{ position: [15, 15, 15], zoom: 50 }} style={{ background: '#050505' }}>
              {!gameOver && (
                <Scene 
                  key={gameId}
                  wave={wave}
                  setWave={setWave}
                  onWaveStart={handleWaveStart}
                  onScore={(s) => setScore(prev => prev + s)} 
                  isPaused={isPaused}
                  isInvulnerable={isInvulnerable}
                  onPlayerHit={handlePlayerDamage}
                  gameOver={gameOver}
                  specialTrigger={specialTrigger}
                  onEnemyKill={handleEnemyKill}
                />
              )}
            </Canvas>
          </React.Suspense>

          {/* Pause Overlay */}
          {isPaused && !gameOver && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 150 }}>
              <Pause className="text-danger mb-4" size={80} />
              <h2 className="display-4 text-white fw-bold mb-4" style={{ fontFamily: 'serif' }}>PAUSADO</h2>
              <div className="d-flex gap-4">
                <button 
                  className="btn btn-danger px-5 py-3 fw-bold rounded-0 shadow-lg"
                  onClick={() => setIsPaused(false)}
                >
                  CONTINUAR
                </button>
                <button 
                  className="btn btn-outline-light px-5 py-3 fw-bold rounded-0 shadow-lg"
                  onClick={handleRestartWave}
                >
                  REINICIAR ONDA
                </button>
                <button 
                  className="btn btn-outline-danger px-5 py-3 fw-bold rounded-0 shadow-lg"
                  onClick={handleReincarnate}
                >
                  REENCARNAR
                </button>
              </div>
            </div>
          )}

          {/* Wave Announcement */}
          {waveAnnouncement && (
            <div className="position-absolute top-50 start-50 translate-middle text-center animate-pulse" style={{ zIndex: 200 }}>
              <h1 className="display-1 text-danger fw-bold text-uppercase" style={{ fontFamily: 'serif', textShadow: '0 0 20px rgba(255,0,0,0.5)' }}>
                {waveAnnouncement}
              </h1>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameOver && (
            <div className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center" style={{ backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100 }}>
              <Skull className="text-danger mb-4" size={80} />
              <h2 className="display-3 text-white fw-bold mb-1" style={{ fontFamily: 'serif' }}>MORTO</h2>
              <p className="text-danger lead mb-5 font-monospace">Your lineage ended on wave {wave}</p>
              
              <div className="d-flex flex-column gap-3 w-100 px-5" style={{ maxWidth: '400px' }}>
                <button 
                  className="btn btn-danger py-3 fw-bold rounded-0 shadow-lg d-flex align-items-center justify-content-center gap-2"
                  onClick={handleRestartWave}
                >
                  <RefreshCw size={20} />
                  REINICIAR ONDA
                </button>
                <button 
                  className="btn btn-outline-danger py-3 fw-bold rounded-0 shadow-lg d-flex align-items-center justify-content-center gap-2"
                  onClick={handleReincarnate}
                >
                  <Skull size={20} />
                  REENCARNAR (ONDA 1)
                </button>
                {score > 0 && !saved && (
                  <button 
                    className="btn btn-outline-light py-3 fw-bold rounded-0 shadow-lg d-flex align-items-center justify-content-center gap-2"
                    onClick={handleSaveScore}
                  >
                    <Save size={20} />
                    SALVAR PONTUAÇÃO
                  </button>
                )}
                {saved && (
                  <div className="text-success text-center fw-bold animate-bounce mt-2">
                    PONTUAÇÃO SALVA!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Instructions Overlay */}
          {!gameOver && score === 0 && wave <= 1 && (
            <div className="position-absolute bottom-0 start-50 translate-middle-x mb-5 text-center pointer-events-none" style={{ zIndex: 50 }}>
              <div className="bg-black bg-opacity-80 text-white px-5 py-3 rounded-pill border border-danger border-opacity-30 shadow-2xl">
                <span className="fw-bold text-danger">CLICK</span> TO MOVE • <span className="fw-bold text-danger">CLICK</span> VILLAGERS TO HUNT
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
