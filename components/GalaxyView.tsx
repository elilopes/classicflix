import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Instances, Instance, OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Movie } from '../types';
import { X, ZoomIn, ZoomOut, Award } from 'lucide-react';

interface GalaxyViewProps {
  movies: Movie[];
  onMovieClick: (movie: Movie) => void;
  onClose: () => void;
}

const MovieCard = ({ data, hoveredMovie, setHoveredMovie, onMovieClick }: any) => {
  const ref = useRef<THREE.Group>(null);
  const isHovered = hoveredMovie?.movie.id === data.movie.id;
  
  useFrame((state) => {
    if (!ref.current) return;
    
    if (isHovered) {
      // Stop orbiting and face camera
      ref.current.quaternion.slerp(state.camera.quaternion, 0.1);
    } else {
      // Orbit around director
      const time = state.clock.getElapsedTime();
      const currentAngle = data.angle + time * data.speed;
      
      const x = data.directorPos.x + Math.cos(currentAngle) * data.orbitRadius;
      const z = data.directorPos.z + Math.sin(currentAngle) * data.orbitRadius;
      
      ref.current.position.set(x, data.worldPos.y, z);
      
      // Rotate card slightly
      ref.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={ref} position={data.worldPos}>
      <Instance 
        color={isHovered ? "white" : "#aaaaaa"} 
        scale={isHovered ? 1.5 : 1}
      />
      {/* Hitbox for interaction - more reliable than InstancedMesh events for small moving items */}
      <mesh 
        onPointerDown={(e) => {
          e.stopPropagation();
          onMovieClick(data.movie);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredMovie(data);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredMovie(null);
        }}
      >
        <boxGeometry args={[3, 4.5, 0.5]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {isHovered && (
        <Html distanceFactor={15} position={[0, 0, 0.1]} transform center>
          <div className="bg-dark text-white p-2 rounded shadow-lg border border-secondary" style={{ width: '150px', pointerEvents: 'none' }}>
            <img src={data.movie.posterUrl} alt={data.movie.title} className="w-100 rounded mb-2" style={{ height: '200px', objectFit: 'cover' }} />
            <div className="fw-bold text-truncate">{data.movie.title}</div>
            <div className="small text-secondary">{data.movie.year}</div>
          </div>
        </Html>
      )}
    </group>
  );
};

const CameraController = ({ 
  target, 
  mode, 
  onReached 
}: { 
  target: THREE.Vector3 | null, 
  mode: 'idle' | 'director' | 'overview',
  onReached: () => void 
}) => {
  const { camera, controls } = useThree();
  
  useFrame(() => {
    if (!controls || typeof (controls as any).target === 'undefined') return;
    
    if (mode === 'director' && target) {
      const targetPos = target.clone();
      const cameraPos = target.clone().add(new THREE.Vector3(0, 5, 20));
      
      camera.position.lerp(cameraPos, 0.05);
      (controls as any).target.lerp(targetPos, 0.05);
      
      if (camera.position.distanceTo(cameraPos) < 0.5) {
        onReached();
      }
    } else if (mode === 'overview') {
      const targetPos = new THREE.Vector3(0, 0, 0);
      const cameraPos = new THREE.Vector3(0, 300, 600);
      
      camera.position.lerp(cameraPos, 0.05);
      (controls as any).target.lerp(targetPos, 0.05);
      
      if (camera.position.distanceTo(cameraPos) < 0.5) {
        onReached();
      }
    }
  });
  
  return null;
};

const ZoomController = ({ zoomInTrigger, zoomOutTrigger }: { zoomInTrigger: number, zoomOutTrigger: number }) => {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    if (zoomInTrigger > 0 && controls) {
      const target = (controls as any).target;
      const dir = new THREE.Vector3().subVectors(target, camera.position);
      camera.position.add(dir.multiplyScalar(0.2));
      (controls as any).update();
    }
  }, [zoomInTrigger, camera, controls]);

  useEffect(() => {
    if (zoomOutTrigger > 0 && controls) {
      const target = (controls as any).target;
      const dir = new THREE.Vector3().subVectors(camera.position, target);
      camera.position.add(dir.multiplyScalar(0.2));
      (controls as any).update();
    }
  }, [zoomOutTrigger, camera, controls]);

  return null;
};

export const GalaxyView: React.FC<GalaxyViewProps & { t: any }> = ({ movies, onMovieClick, onClose, t }) => {
  const [hoveredMovie, setHoveredMovie] = useState<any>(null);
  const [targetDirector, setTargetDirector] = useState<THREE.Vector3 | null>(null);
  const [cameraMode, setCameraMode] = useState<'idle' | 'director' | 'overview'>('idle');
  const [zoomInTrigger, setZoomInTrigger] = useState(0);
  const [zoomOutTrigger, setZoomOutTrigger] = useState(0);

  const { directorPositions, movieInstances } = useMemo(() => {
    const map = new Map<string, Movie[]>();
    movies.forEach(m => {
      if (!m.director || m.director === 'Unknown') return;
      const dir = m.director.split(',')[0].trim();
      if (!map.has(dir)) map.set(dir, []);
      map.get(dir)!.push(m);
    });
    
    const dirs = Array.from(map.entries())
      .filter(([name, dirMovies]) => dirMovies.some(m => m.awards && m.awards.length > 0))
      .map(([name, movies]) => ({ name, movies }));
    
    const dirPositions = dirs.map((d, i) => {
      // Use a logarithmic spiral distribution for better galaxy structure
      const angle = i * 0.8;
      const radius = 100 + (angle * 35) + Math.random() * 40;
      const y = (Math.random() - 0.5) * 100;
      return {
        ...d,
        position: new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      };
    });

    const minYear = Math.min(...movies.map(m => m.year || 1900));
    const maxYear = Math.max(...movies.map(m => m.year || 2024));

    const instances: any[] = [];
    dirPositions.forEach(dir => {
      dir.movies.forEach((movie, mIdx) => {
        const yearNormalized = ((movie.year || 1900) - minYear) / (maxYear - minYear || 1);
        const orbitRadius = 10 + yearNormalized * 30; // Larger orbits
        const angleOffset = (mIdx / dir.movies.length) * Math.PI * 2;
        
        const localPos = new THREE.Vector3(
          Math.cos(angleOffset) * orbitRadius,
          (Math.random() - 0.5) * 4,
          Math.sin(angleOffset) * orbitRadius
        );
        
        const worldPos = dir.position.clone().add(localPos);
        
        instances.push({
          movie,
          directorPos: dir.position,
          worldPos,
          orbitRadius,
          angle: angleOffset,
          speed: 0.1 / orbitRadius
        });
      });
    });

    return { directorPositions: dirPositions, movieInstances: instances };
  }, [movies]);

  const bumpMap = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128; // Smaller for speed
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      const imageData = context.createImageData(128, 128);
      for (let i = 0; i < imageData.data.length; i += 4) {
        const val = Math.random() * 255;
        imageData.data[i] = val;
        imageData.data[i + 1] = val;
        imageData.data[i + 2] = val;
        imageData.data[i + 3] = 255;
      }
      context.putImageData(imageData, 0, 0);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }, []);

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-black" style={{ zIndex: 1050 }}>
      <button 
        onClick={onClose}
        className="btn btn-dark position-absolute top-0 end-0 m-4 rounded-circle p-2 shadow border border-secondary"
        style={{ zIndex: 1060 }}
      >
        <X size={24} className="text-white" />
      </button>
      
      <div className="position-absolute top-0 start-0 m-4 text-white" style={{ zIndex: 1060, pointerEvents: 'none' }}>
        <h2 className="fw-bold text-info">{t.galaxyOfDirectors || "Galáxia de Diretores"}</h2>
        <p className="text-secondary">{t.galaxySubtitle || "Explore filmes orbitando seus diretores. O ano define a distância da órbita."}</p>
        
        <div className="d-flex align-items-center gap-2 mt-3">
            <div className="d-flex align-items-center gap-2 small">
                <div className="rounded-circle" style={{ width: 12, height: 12, background: '#ffaa00' }}></div>
                <span>{t.directorLabel || "Diretor"}</span>
            </div>
            <div className="d-flex align-items-center gap-2 small ms-3">
                <div className="rounded-circle" style={{ width: 12, height: 12, background: '#00ccff' }}></div>
                <span>{t.movieLabel || "Filme"}</span>
            </div>
        </div>

        {targetDirector && (
          <button 
            className="btn btn-sm btn-info mt-3 shadow-lg px-3" 
            style={{ pointerEvents: 'auto' }}
            onClick={() => {
              setTargetDirector(null);
              setCameraMode('overview');
            }}
          >
            {t.backToOverview || "Voltar à visão geral"}
          </button>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="position-absolute bottom-0 end-0 m-4 d-flex flex-column gap-3" style={{ zIndex: 1060 }}>
        <button 
          className="btn btn-dark rounded-circle p-3 shadow-lg border border-info"
          onClick={() => setZoomInTrigger(prev => prev + 1)}
          title="Zoom In"
        >
          <ZoomIn size={28} className="text-info" />
        </button>
        <button 
          className="btn btn-dark rounded-circle p-3 shadow-lg border border-secondary"
          onClick={() => setZoomOutTrigger(prev => prev + 1)}
          title="Zoom Out"
        >
          <ZoomOut size={28} className="text-white" />
        </button>
      </div>

      <Canvas camera={{ position: [0, 500, 1000], fov: 60 }}>
        <color attach="background" args={['#020205']} />
        <ambientLight intensity={0.4} />
        <pointLight position={[500, 500, 500]} intensity={1.5} color="#0088ff" />
        <pointLight position={[-500, -500, -500]} intensity={1} color="#ffaa00" />
        
        {/* Stars background - dimmer and blue-tinted */}
        <Instances limit={3000} range={3000}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#4477ff" transparent opacity={0.3} />
          {Array.from({ length: 3000 }).map((_, i) => (
            <Instance 
              key={`star-${i}`} 
              position={[
                (Math.random() - 0.5) * 4000, 
                (Math.random() - 0.5) * 4000, 
                (Math.random() - 0.5) * 4000
              ]} 
              scale={Math.random() * 0.5}
            />
          ))}
        </Instances>

        {/* Directors */}
        {directorPositions.map((dir, i) => (
          <group key={`dir-${i}`} position={dir.position}>
            <mesh 
              onPointerDown={(e) => { 
                e.stopPropagation(); 
                setTargetDirector(dir.position); 
                setCameraMode('director');
              }}
              onPointerOver={() => document.body.style.cursor = 'pointer'}
              onPointerOut={() => document.body.style.cursor = 'auto'}
            >
              <sphereGeometry args={[5, 24, 24]} />
              <meshStandardMaterial 
                color="#ffaa00" 
                emissive="#ffaa00" 
                emissiveIntensity={3} 
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
            <Text 
              position={[0, 10, 0]} 
              fontSize={5} 
              color="white" 
              anchorX="center" 
              anchorY="middle"
              outlineWidth={0.4}
              outlineColor="#000000"
            >
              {dir.name}
            </Text>
          </group>
        ))}

        {/* Movies */}
        <Instances limit={movieInstances.length} range={movieInstances.length}>
          <boxGeometry args={[1.5, 2.2, 0.1]} />
          <meshStandardMaterial 
            roughness={0.5} 
            metalness={0.5} 
            color="#00ccff"
            emissive="#00ccff"
            emissiveIntensity={0.5}
            bumpMap={bumpMap}
            bumpScale={0.05}
          />
          {movieInstances.map((data, i) => (
            <MovieCard 
              key={`movie-${i}`} 
              data={data} 
              hoveredMovie={hoveredMovie} 
              setHoveredMovie={setHoveredMovie}
              onMovieClick={onMovieClick}
            />
          ))}
        </Instances>

        <OrbitControls 
          makeDefault 
          enableDamping 
          dampingFactor={0.1} 
          maxDistance={3000}
        />
        <CameraController 
          target={targetDirector} 
          mode={cameraMode} 
          onReached={() => setCameraMode('idle')} 
        />
        <ZoomController 
          zoomInTrigger={zoomInTrigger} 
          zoomOutTrigger={zoomOutTrigger} 
        />
      </Canvas>

      {hoveredMovie && (
        <div 
          className="position-absolute p-3 bg-dark border border-info rounded shadow-lg text-white"
          style={{ 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 1070,
            maxWidth: '300px'
          }}
        >
          <div className="fw-bold text-info h5">{hoveredMovie.title}</div>
          <div className="small opacity-75">{hoveredMovie.year}</div>
          {hoveredMovie.awards && hoveredMovie.awards.length > 0 && (
              <div className="mt-2 xsmall text-warning d-flex align-items-start gap-2">
                  <Award size={14} className="mt-1 flex-shrink-0" />
                  <span>{hoveredMovie.awards[0]}</span>
              </div>
          )}
        </div>
      )}
    </div>
  );
};
