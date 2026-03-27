import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import './SpaceInvaders.css';

const ENEMY_UVIS = ['/red.png', '/yellow.png', '/green.png', '/red.png']; 
const ALIEN_LETTERS = ['A', 'B', 'C', 'D'];

function Player({ positionRef, isAnimating, keys }) {
  const texture = useTexture('/player.png');
  const spriteRef = useRef();
  
  useFrame((state, delta) => {
    if (!isAnimating.current || !spriteRef.current) return;
    const speed = 25; 
    let px = positionRef.current.x;
    
    // Check both standard and lowercase versions
    if (keys.current['ArrowLeft'] || keys.current['arrowleft'] || keys.current['a'] || keys.current['A']) {
      px = Math.max(-12, px - speed * delta);
    }
    if (keys.current['ArrowRight'] || keys.current['arrowright'] || keys.current['d'] || keys.current['D']) {
      px = Math.min(12, px + speed * delta);
    }
    positionRef.current.x = px;
    spriteRef.current.position.x = px;
  });

  return (
    <sprite ref={spriteRef} position={[positionRef.current.x, positionRef.current.y, 0]} scale={[2.5, 2.5, 1]}>
      <spriteMaterial map={texture} />
    </sprite>
  );
}

function Alien({ obj, isAnimating }) {
  const texture = useTexture(obj.image);
  const groupRef = useRef();

  useFrame((state) => {
    if (!isAnimating.current || !groupRef.current || !obj.alive) return;
    obj.hitboxY = obj.y + Math.sin(state.clock.elapsedTime * 2 + obj.x) * 0.2;
    groupRef.current.position.y = obj.hitboxY;
  });

  if (!obj.alive) return null;
  return (
    <group ref={groupRef} position={[obj.x, obj.y, 0]}>
      <sprite scale={[2.0, 2.0, 1]}>
         <spriteMaterial map={texture} />
      </sprite>
      <Text position={[0, -2.5, 0]} fontSize={0.32} color="#ffffff" maxWidth={5.8} textAlign="center" lineHeight={1.2}>
        {obj.text}
      </Text>
    </group>
  );
}

function Laser({ l, isAnimating }) {
  const meshRef = useRef();
  useFrame((state, delta) => {
    if (!isAnimating.current || !meshRef.current) return;
    l.y += 35 * delta;
    meshRef.current.position.y = l.y;
  });
  return (
    <mesh ref={meshRef} position={[l.x, l.y, 0]}>
      <planeGeometry args={[0.2, 1.2]} />
      <meshBasicMaterial color="#ff003c" />
    </mesh>
  );
}

function SceneManager({ gameState, onHit }) {
  const playerPos = useRef(new THREE.Vector3(0, -6, 0));
  const lasersRef = useRef([]);
  const isAnimating = useRef(true);
  
  const [aliens, setAliens] = useState([]);
  const [laserCount, setLaserCount] = useState(0);
  const keys = useRef({});
  const lastShot = useRef(0);
  
  // Shoot Controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.key] = true;
      if (e.key === ' ' && isAnimating.current) {
        const now = Date.now();
        if (now - lastShot.current > 300) { 
            lasersRef.current.push({ id: now, x: playerPos.current.x, y: playerPos.current.y + 1 });
            lastShot.current = now;
            setLaserCount(c => c + 1); // Trigger render
        }
      }
    };
    const handleKeyUp = (e) => (keys.current[e.key] = false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Initialize Wave
  useEffect(() => {
    if (gameState && gameState.options) {
      const spacing = 26 / gameState.options.length;
      const startX = -13 + spacing / 2;
      const newAliens = gameState.options.map((opt, i) => ({
        id: i,
        char: ALIEN_LETTERS[i] || '?',
        text: opt.replace(/^[A-D][.)]\s*/i, ''),
        x: startX + spacing * i,
        y: 6,
        hitboxY: 6,
        alive: true,
        image: ENEMY_UVIS[i % ENEMY_UVIS.length] 
      }));
      setAliens(newAliens);
      lasersRef.current = [];
      setLaserCount(0);
      isAnimating.current = true;
    }
  }, [gameState]);

  // Collision Loop
  useFrame(() => {
    if (!isAnimating.current) return;
    
    let hitAlien = null;
    
    // Check collisions
    for (let l of lasersRef.current) {
      for (let a of aliens) {
        if (a.alive && Math.abs(l.x - a.x) < 1.8 && Math.abs(l.y - a.hitboxY) < 2.0) {
           hitAlien = a;
           l.y = 999;
           break;
        }
      }
      if (hitAlien) break;
    }
    
    if (hitAlien) {
      isAnimating.current = false; // Freeze everything
      
      setAliens(prev => prev.map(a => a.id === hitAlien.id ? { ...a, alive: false } : a)); 
      onHit(hitAlien.char); 
    }
    
    let offscreen = false;
    lasersRef.current.forEach(l => { if (l.y > 15) offscreen = true; });
    if (offscreen) {
      lasersRef.current = lasersRef.current.filter(l => l.y < 15);
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      
      <Player positionRef={playerPos} isAnimating={isAnimating} keys={keys} />
      {lasersRef.current.map(l => (
         <Laser key={l.id} l={l} isAnimating={isAnimating} />
      ))}
      
      {aliens.map(a => (
         <Alien key={a.id} obj={a} isAnimating={isAnimating} />
      ))}
    </>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "red", textAlign: "center", paddingTop: "20%" }}>
          <h2 className="space-mono">Asset Loading Error!</h2>
          <p className="space-mono">Please make sure player.png, red.png, yellow.png, green.png exist exactly in mapping at frontend/public/</p>
        </div>
      );
    }
    return this.props.children; 
  }
}

export default function SpaceInvadersGame({ gameState, onAnswer, onClose }) {
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(7);
  const [timerActive, setTimerActive] = useState(false);

  // Handle Answer/Hit
  const handleHit = useCallback((char) => {
    setTimerActive(false);
    if (!char) {
      setFeedback('timeout');
      onAnswer('').then(res => {
         // Lives are updated via gameState
      });
      return;
    }

    onAnswer(char).then(res => {
        if (res.is_correct) setFeedback('correct');
        else setFeedback('incorrect');
    });
  }, [onAnswer]);

  // Reset timer on new question
  useEffect(() => {
     setFeedback(null);
     setTimeLeft(7);
     if (gameState) {
       setTimerActive(true);
     }
  }, [gameState]);

  // Countdown logic
  useEffect(() => {
    let interval = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && timerActive) {
      setTimerActive(false);
      handleHit(null);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft, handleHit]);

  return (
    <div className="space-invaders-container">
      <div className="si-header">
        <h2 className="space-mono">SPACE INVADERS MCQ MODE</h2>
        <div className="si-stats space-mono">
           <span className="si-timer" style={{ color: timeLeft <= 3 ? '#ff003c' : '#00ffcc', marginRight: '20px' }}>
             TIME: {timeLeft}s
           </span>
           <span>LIVES: {gameState?.lives || 0}</span>
           <button onClick={onClose} className="si-close-btn space-mono">QUIT</button>
        </div>
      </div>
      
      <div className="si-question-board space-mono">
        {gameState?.question}
      </div>

      <div className="si-play-area">
        {feedback && (
           <div className={`si-feedback ${feedback} space-mono`}>
              {feedback === 'correct' ? 'CORRECT!' : feedback === 'timeout' ? 'NOT ANSWERED!' : 'INCORRECT!'}
           </div>
        )}
        
        <ErrorBoundary>
          <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
            <Suspense fallback={null}>
               <SceneManager gameState={gameState} onHit={handleHit} />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
      </div>
      <div className="si-controls space-mono">
         A/D or LEFT/RIGHT to Move  |  SPACE to Shoot
      </div>
    </div>
  );
}
