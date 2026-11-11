import React, { useMemo, useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Instances, Instance, OrbitControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Movie } from '../types';
import { X, ZoomIn, ZoomOut, Award, Layers, Compass, Play, Film, Sparkles, Eye } from 'lucide-react';

interface GalaxyViewProps {
  movies: Movie[];
  onMovieClick: (movie: Movie) => void;
  onClose: () => void;
  t: any;
}

const MovieCard = ({ data, hoveredMovie, setHoveredMovie, onMovieClick }: any) => {
  const ref = useRef<THREE.Group>(null);
  const isHovered = hoveredMovie?.movie.id === data.movie.id;
  
  useFrame((state) => {
    if (!ref.current) return;
    
    if (isHovered) {
      ref.current.quaternion.slerp(state.camera.quaternion, 0.1);
    } else {
      const time = state.clock.getElapsedTime();
      const currentAngle = data.angle + time * data.speed;
      
      const x = data.directorPos.x + Math.cos(currentAngle) * data.orbitRadius;
      const z = data.directorPos.z + Math.sin(currentAngle) * data.orbitRadius;
      
      ref.current.position.set(x, data.worldPos.y, z);
      ref.current.rotation.y += 0.01;
    }
  });

  return (
    <group ref={ref} position={data.worldPos}>
      <Instance 
        color={isHovered ? "white" : "#aaaaaa"} 
        scale={isHovered ? 1.5 : 1}
      />
      {/* Hitbox for interaction - use onClick rather than onPointerDown so touch dragging does not trigger movie click */}
      <mesh 
        onClick={(e) => {
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
      {isHovered && data.movie && (
        <Html distanceFactor={15} position={[0, 0, 0.1]} transform center zIndexRange={[100, 0]}>
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

export const GalaxyView: React.FC<GalaxyViewProps> = ({ movies, onMovieClick, onClose, t }) => {
  const [hoveredMovie, setHoveredMovie] = useState<any>(null);
  const [targetDirector, setTargetDirector] = useState<THREE.Vector3 | null>(null);
  const [selectedDirectorName, setSelectedDirectorName] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'idle' | 'director' | 'overview'>('idle');
  const [zoomInTrigger, setZoomInTrigger] = useState(0);
  const [zoomOutTrigger, setZoomOutTrigger] = useState(0);
  const [viewMode2D, setViewMode2D] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // Check WebGL support on mount
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        setViewMode2D(true);
      }
    } catch {
      setWebglSupported(false);
      setViewMode2D(true);
    }
  }, []);

  const { directorPositions, movieInstances } = useMemo(() => {
    const map = new Map<string, Movie[]>();
    movies.forEach(m => {
      if (!m.director || m.director === 'Unknown') return;
      const dirNames = m.director.split(',').map(d => d.trim()).filter(Boolean);
      dirNames.forEach(dir => {
        if (!map.has(dir)) map.set(dir, []);
        map.get(dir)!.push(m);
      });
    });
    
    // Sort directors by awards first, then movie count
    const sorted = Array.from(map.entries())
      .map(([name, dirMovies]) => {
        const awardsCount = dirMovies.reduce((acc, m) => acc + (m.awards ? m.awards.length : 0), 0);
        return { name, movies: dirMovies, awardsCount };
      })
      .sort((a, b) => {
        if (b.awardsCount !== a.awardsCount) return b.awardsCount - a.awardsCount;
        return b.movies.length - a.movies.length;
      });

    // Ensure at least 40 top directors are represented
    const dirs = sorted.slice(0, 40);
    
    const dirPositions = dirs.map((d, i) => {
      const angle = i * 0.8;
      const radius = 100 + (angle * 35) + Math.random() * 40;
      const y = (Math.random() - 0.5) * 100;
      return {
        ...d,
        position: new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      };
    });

    const validYears = movies.map(m => m.year).filter((y): y is number => typeof y === 'number' && !isNaN(y));
    const minYear = validYears.length > 0 ? Math.min(...validYears) : 1900;
    const maxYear = validYears.length > 0 ? Math.max(...validYears) : 2024;

    const instances: any[] = [];
    dirPositions.forEach(dir => {
      dir.movies.forEach((movie, mIdx) => {
        const yearNormalized = ((movie.year || 1900) - minYear) / (maxYear - minYear || 1);
        const orbitRadius = 10 + yearNormalized * 30;
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
    canvas.width = 128;
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

  const handleSelectDirector = (dir: typeof directorPositions[0]) => {
    setSelectedDirectorName(dir.name);
    setTargetDirector(dir.position);
    setCameraMode('director');
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 bg-black" style={{ zIndex: 99999, touchAction: 'none', height: '100dvh' }}>
      {/* Close button */}
      <button 
        onClick={onClose}
        className="btn btn-dark position-absolute top-0 end-0 m-2 m-md-4 rounded-circle p-2 shadow border border-secondary"
        style={{ zIndex: 100005 }}
        aria-label="Fechar"
      >
        <X size={24} className="text-white" />
      </button>
      
      {/* Top Header & Info */}
      <div className="position-absolute top-0 start-0 m-2 m-md-4 text-white" style={{ zIndex: 100005, pointerEvents: 'none', maxWidth: '85%' }}>
        <h3 className="fw-bold text-info fs-5 fs-md-3 mb-1 d-flex align-items-center gap-2">
          <span>🌌</span> {t.galaxyOfDirectors || "Galáxia de Diretores"}
        </h3>
        <p className="text-secondary small mb-2 d-none d-md-block">{t.galaxySubtitle || "Explore filmes orbitando seus diretores. O ano define a distância da órbita."}</p>
        
        <div className="d-flex align-items-center gap-2 mt-1 mt-md-2 flex-wrap">
            <div className="d-flex align-items-center gap-1 small bg-black bg-opacity-70 px-2 py-1 rounded border border-secondary border-opacity-50">
                <div className="rounded-circle" style={{ width: 10, height: 10, background: '#ffaa00' }}></div>
                <span style={{ fontSize: '0.75rem' }}>{t.directorLabel || "Diretor"} ({directorPositions.length})</span>
            </div>
            <div className="d-flex align-items-center gap-1 small bg-black bg-opacity-70 px-2 py-1 rounded border border-secondary border-opacity-50">
                <div className="rounded-circle" style={{ width: 10, height: 10, background: '#00ccff' }}></div>
                <span style={{ fontSize: '0.75rem' }}>{t.movieLabel || "Filme"} ({movieInstances.length})</span>
            </div>
            
            {/* View Mode Toggle: 3D vs 2D */}
            <button 
              className="btn btn-sm btn-outline-secondary text-white py-0 px-2 rounded-pill"
              style={{ pointerEvents: 'auto', fontSize: '0.75rem' }}
              onClick={() => setViewMode2D(!viewMode2D)}
            >
              {viewMode2D ? '🪐 Ver em 3D' : '📋 Ver em Lista 2D'}
            </button>
        </div>

        {targetDirector && !viewMode2D && (
          <button 
            className="btn btn-sm btn-info mt-2 shadow-lg px-3" 
            style={{ pointerEvents: 'auto', fontSize: '0.8rem' }}
            onClick={() => {
              setTargetDirector(null);
              setSelectedDirectorName(null);
              setCameraMode('overview');
            }}
          >
            {t.backToOverview || "Voltar à visão geral"}
          </button>
        )}
      </div>

      {/* Mobile Touch Navigation Hint */}
      {!viewMode2D && (
        <div 
          className="position-absolute d-md-none text-center text-white-50 small bg-black bg-opacity-75 px-3 py-1 rounded-pill border border-secondary border-opacity-50"
          style={{ 
            top: '85px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            zIndex: 100004, 
            pointerEvents: 'none',
            fontSize: '0.7rem',
            whiteSpace: 'nowrap'
          }}
        >
          👆 Arraste para girar • ✌️ Pinça para zoom
        </div>
      )}

      {/* Bottom Director Quick-Picker Bar */}
      <div 
        className="position-absolute bottom-0 start-0 w-100 p-2 p-md-3 d-flex gap-2 overflow-x-auto no-scrollbar"
        style={{ 
          zIndex: 100005, 
          background: 'linear-gradient(to top, rgba(0,0,0,0.95), transparent)', 
          pointerEvents: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '24px'
        }}
      >
        <div className="text-white small fw-bold d-flex align-items-center gap-1 flex-shrink-0 px-2 text-info">
          <Compass size={14} /> <span className="d-none d-sm-inline">Focar:</span>
        </div>
        {directorPositions.map((dir, i) => (
          <button
            key={`quick-dir-${i}`}
            className={`btn btn-sm rounded-pill text-nowrap flex-shrink-0 px-3 py-1 border ${
              selectedDirectorName === dir.name 
                ? 'btn-info text-dark fw-bold border-info' 
                : 'btn-dark text-white border-secondary bg-opacity-75'
            }`}
            style={{ fontSize: '0.75rem' }}
            onClick={() => handleSelectDirector(dir)}
          >
            ⭐ {dir.name} ({dir.movies.length})
          </button>
        ))}
      </div>

      {/* Zoom Controls (3D only) */}
      {!viewMode2D && (
        <div className="position-absolute end-0 m-3 m-md-4 d-flex flex-column gap-2" style={{ bottom: '70px', zIndex: 100005 }}>
          <button 
            className="btn btn-dark rounded-circle p-2 p-md-3 shadow-lg border border-info"
            onClick={() => setZoomInTrigger(prev => prev + 1)}
            title="Zoom In"
          >
            <ZoomIn size={22} className="text-info" />
          </button>
          <button 
            className="btn btn-dark rounded-circle p-2 p-md-3 shadow-lg border border-secondary"
            onClick={() => setZoomOutTrigger(prev => prev + 1)}
            title="Zoom Out"
          >
            <ZoomOut size={22} className="text-white" />
          </button>
        </div>
      )}

      {/* 2D Fallback / Alternative View for Mobile */}
      {viewMode2D ? (
        <div 
          className="w-100 h-100 overflow-y-auto p-3 p-md-5"
          style={{ paddingTop: '100px', paddingBottom: '90px' }}
        >
          <div className="container" style={{ maxWidth: '960px' }}>
            <div className="row g-4">
              {directorPositions.map((dir, idx) => (
                <div key={idx} className="col-12 col-md-6">
                  <div className="card bg-dark bg-opacity-75 border-secondary rounded-4 p-3 h-100 shadow">
                    <div className="d-flex align-items-center justify-content-between mb-3 border-bottom border-secondary pb-2">
                      <div className="d-flex align-items-center gap-2">
                        <div className="rounded-circle" style={{ width: 14, height: 14, background: '#ffaa00' }}></div>
                        <h5 className="m-0 text-info fw-bold">{dir.name}</h5>
                      </div>
                      <span className="badge bg-secondary">{dir.movies.length} {t.movieLabel || 'filmes'}</span>
                    </div>

                    <div className="d-flex flex-column gap-2">
                      {dir.movies.map(movie => (
                        <div 
                          key={movie.id}
                          className="d-flex align-items-center justify-content-between p-2 rounded bg-black bg-opacity-40 border border-secondary border-opacity-25 hover-scale cursor-pointer"
                          onClick={() => onMovieClick(movie)}
                        >
                          <div className="d-flex align-items-center gap-2 overflow-hidden">
                            {movie.posterUrl ? (
                              <img src={movie.posterUrl} alt={movie.title} className="rounded" style={{ width: '32px', height: '45px', objectFit: 'cover' }} />
                            ) : (
                              <Film size={24} className="text-secondary" />
                            )}
                            <div className="text-truncate">
                              <div className="fw-bold small text-white text-truncate">{movie.titlePt || movie.title}</div>
                              <div className="text-white-50 xsmall">{movie.year}</div>
                            </div>
                          </div>
                          <button className="btn btn-sm btn-outline-info rounded-circle p-1 flex-shrink-0" title="Ver Detalhes">
                            <Play size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* 3D Canvas */
        <Canvas 
          camera={{ position: [0, 500, 1000], fov: 60 }}
          gl={{ powerPreference: 'high-performance', antialias: false, alpha: false }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <Suspense fallback={
            <Html center>
              <div className="text-center text-info p-3 rounded bg-dark border border-secondary shadow-lg">
                <div className="spinner-border text-info mb-2" role="status"></div>
                <div className="fw-bold small">Carregando Galáxia Cósmica...</div>
                <div className="text-secondary xsmall">Renderizando diretores e órbitas</div>
              </div>
            </Html>
          }>
            <color attach="background" args={['#020205']} />
            <ambientLight intensity={0.6} />
            <pointLight position={[500, 500, 500]} intensity={1.5} color="#0088ff" />
            <pointLight position={[-500, -500, -500]} intensity={1} color="#ffaa00" />
            
            {/* Stars background */}
            <Instances limit={800} range={800}>
              <boxGeometry args={[1.5, 1.5, 1.5]} />
              <meshBasicMaterial color="#4477ff" transparent opacity={0.4} />
              {Array.from({ length: 800 }).map((_, i) => (
                <Instance 
                  key={`star-${i}`} 
                  position={[
                    (Math.random() - 0.5) * 4000, 
                    (Math.random() - 0.5) * 4000, 
                    (Math.random() - 0.5) * 4000
                  ]} 
                  scale={Math.random() * 0.6 + 0.2}
                />
              ))}
            </Instances>

            {/* Directors */}
            {directorPositions.map((dir, i) => (
              <group key={`dir-${i}`} position={dir.position}>
                <mesh 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    handleSelectDirector(dir);
                  }}
                  onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                  onPointerOut={() => { document.body.style.cursor = 'auto'; }}
                >
                  <sphereGeometry args={[5, 20, 20]} />
                  <meshStandardMaterial 
                    color="#ffaa00" 
                    emissive="#ffaa00" 
                    emissiveIntensity={2.5} 
                    metalness={0.8}
                    roughness={0.2}
                  />
                </mesh>
                <Text 
                  position={[0, 9, 0]} 
                  fontSize={4.5} 
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
              dampingFactor={0.08} 
              maxDistance={3500}
              minDistance={10}
              touches={{
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_PAN
              }}
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
          </Suspense>
        </Canvas>
      )}

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
