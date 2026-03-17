import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Eraser, Droplet, Flame, Hexagon, Leaf, Zap, Skull, Shield, Target, Unlock, RefreshCw } from 'lucide-react';

// --- HAUTE RÉSOLUTION (Adieu les gros pixels) ---
const GRID_WIDTH = 120;
const GRID_HEIGHT = 180;
const TOTAL_CELLS = GRID_WIDTH * GRID_HEIGHT;

const hexToABGR = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (255 << 24) | (b << 16) | (g << 8) | r;
};

// --- LE DICTIONNAIRE DES MATIÈRES (Vraies réactions) ---
const MATERIA = {
  EMPTY: 0, WALL: 1, SAND: 2, WATER: 3, FIRE: 4, WOOD: 5, 
  SMOKE: 6, STEAM: 7, GLASS: 8, SEED: 9, PLANT: 10, 
  ACID: 11, METAL: 12, LAVA: 13, STONE: 14
};

const REGISTRY = {
  [MATERIA.EMPTY]: { id: MATERIA.EMPTY, name: 'Vide', colorHex: '#0f172a', color: hexToABGR('#0f172a'), type: 'empty', density: 0 },
  [MATERIA.WALL]:  { id: MATERIA.WALL, name: 'Mur', colorHex: '#334155', color: hexToABGR('#334155'), type: 'solid', density: 100 },
  [MATERIA.SAND]:  { id: MATERIA.SAND, name: 'Sable', colorHex: '#fcd34d', color: hexToABGR('#fcd34d'), type: 'powder', density: 2.0 },
  [MATERIA.WATER]: { id: MATERIA.WATER, name: 'Eau', colorHex: '#3b82f6', color: hexToABGR('#3b82f6'), type: 'liquid', density: 1.0 },
  [MATERIA.FIRE]:  { id: MATERIA.FIRE, name: 'Feu', colorHex: '#f97316', color: hexToABGR('#f97316'), type: 'gas', density: 0.1 },
  [MATERIA.WOOD]:  { id: MATERIA.WOOD, name: 'Bois', colorHex: '#78350f', color: hexToABGR('#78350f'), type: 'solid', density: 10 },
  [MATERIA.SMOKE]: { id: MATERIA.SMOKE, name: 'Fumée', colorHex: '#9ca3af', color: hexToABGR('#9ca3af'), type: 'gas', density: 0.05 },
  [MATERIA.STEAM]: { id: MATERIA.STEAM, name: 'Vapeur', colorHex: '#e5e7eb', color: hexToABGR('#e5e7eb'), type: 'gas', density: 0.08 },
  [MATERIA.GLASS]: { id: MATERIA.GLASS, name: 'Verre', colorHex: '#67e8f9', color: hexToABGR('#67e8f9'), type: 'solid', density: 10 },
  [MATERIA.SEED]:  { id: MATERIA.SEED, name: 'Graine', colorHex: '#84cc16', color: hexToABGR('#84cc16'), type: 'powder', density: 1.5 },
  [MATERIA.PLANT]: { id: MATERIA.PLANT, name: 'Plante', colorHex: '#16a34a', color: hexToABGR('#16a34a'), type: 'solid', density: 10 },
  [MATERIA.ACID]:  { id: MATERIA.ACID, name: 'Acide', colorHex: '#bef264', color: hexToABGR('#bef264'), type: 'liquid', density: 1.2 },
  [MATERIA.METAL]: { id: MATERIA.METAL, name: 'Métal', colorHex: '#94a3b8', color: hexToABGR('#94a3b8'), type: 'solid', density: 20 },
  [MATERIA.LAVA]:  { id: MATERIA.LAVA, name: 'Lave', colorHex: '#dc2626', color: hexToABGR('#dc2626'), type: 'liquid', density: 3.0 },
  [MATERIA.STONE]: { id: MATERIA.STONE, name: 'Pierre', colorHex: '#4b5563', color: hexToABGR('#4b5563'), type: 'solid', density: 15 },
};

// --- SYSTÈME DE QUÊTES ---
const MISSIONS = [
  { id: 1, title: "Le Botaniste", desc: "Mélange de l'Eau et des Graines pour faire pousser la vie.", target: MATERIA.PLANT, unlock: MATERIA.WOOD },
  { id: 2, title: "L'Âge de Pierre", desc: "Brûle le Bois avec le Feu pour créer de la Fumée.", target: MATERIA.SMOKE, unlock: MATERIA.METAL },
  { id: 3, title: "Le Verrier", desc: "Fais fondre le Sable avec du Feu pour forger du Verre.", target: MATERIA.GLASS, unlock: MATERIA.ACID },
  { id: 4, title: "L'Alchimiste Fou", desc: "Utilise l'Acide pour ronger et dissoudre le Métal.", target: MATERIA.SMOKE, condition: 'acid_metal', unlock: MATERIA.LAVA },
  { id: 5, title: "Choc Thermique", desc: "Refroidis la Lave avec de l'Eau pour forger de la Pierre.", target: MATERIA.STONE, unlock: 'WIN' }
];

export default function Game() {
  const canvasRef = useRef(null);
  const gridRef = useRef(new Uint8Array(TOTAL_CELLS));
  
  // UI & Progression
  const [isPaused, setIsPaused] = useState(false);
  const [currentTool, setCurrentTool] = useState(MATERIA.SAND);
  const [missionIndex, setMissionIndex] = useState(0);
  const [unlockedTools, setUnlockedTools] = useState([MATERIA.SAND, MATERIA.WATER, MATERIA.FIRE, MATERIA.SEED]);
  const [showUnlock, setShowUnlock] = useState(false);

  // Mémoire des événements pour valider les quêtes
  const eventsRef = useRef(new Set());

  // --- MOTEUR PHYSIQUE & CHIMIQUE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.createImageData(GRID_WIDTH, GRID_HEIGHT);
    const buf32 = new Uint32Array(imgData.data.buffer);
    
    let animationId;
    let frame = 0;

    const updateGrid = () => {
      if (!isPaused) {
        frame++;
        const grid = gridRef.current;
        const newGrid = new Uint8Array(grid);

        const swap = (i, target) => { newGrid[target] = grid[i]; newGrid[i] = grid[target]; };
        const setCell = (i, mat) => { newGrid[i] = mat; eventsRef.current.add(mat); };

        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
          const dir = (frame + y) % 2 === 0 ? 1 : -1;
          const startX = dir === 1 ? 0 : GRID_WIDTH - 1;
          const endX = dir === 1 ? GRID_WIDTH : -1;

          for (let x = startX; x !== endX; x += dir) {
            const i = y * GRID_WIDTH + x;
            const matId = grid[i];

            if (matId === MATERIA.EMPTY || matId === MATERIA.WALL || matId === MATERIA.GLASS || matId === MATERIA.METAL || matId === MATERIA.STONE) continue;
            
            const mat = REGISTRY[matId];
            const below = (y + 1) * GRID_WIDTH + x;
            const belowLeft = (y + 1) * GRID_WIDTH + (x - 1);
            const belowRight = (y + 1) * GRID_WIDTH + (x + 1);
            const above = (y - 1) * GRID_WIDTH + x;

            // --- 1. GRAVITÉ ET DENSITÉ ---
            if (mat.type === 'powder' || mat.type === 'liquid') {
              if (y < GRID_HEIGHT - 1) {
                if (mat.density > REGISTRY[grid[below]]?.density) swap(i, below);
                else {
                  const canLeft = x > 0 && mat.density > REGISTRY[grid[belowLeft]]?.density;
                  const canRight = x < GRID_WIDTH - 1 && mat.density > REGISTRY[grid[belowRight]]?.density;
                  if (canLeft && canRight) swap(i, Math.random() > 0.5 ? belowLeft : belowRight);
                  else if (canLeft) swap(i, belowLeft);
                  else if (canRight) swap(i, belowRight);
                  else if (mat.type === 'liquid') {
                    const side = y * GRID_WIDTH + (x + dir);
                    if (x + dir >= 0 && x + dir < GRID_WIDTH && mat.density > REGISTRY[grid[side]]?.density) swap(i, side);
                  }
                }
              }
            } else if (mat.type === 'gas') {
              if (Math.random() < 0.05) { newGrid[i] = MATERIA.EMPTY; continue; }
              if (y > 0 && mat.density < REGISTRY[grid[above]]?.density) swap(i, above);
              else {
                const side = y * GRID_WIDTH + (x + dir);
                if (x + dir >= 0 && x + dir < GRID_WIDTH && mat.density < REGISTRY[grid[side]]?.density) swap(i, side);
              }
            }

            // --- 2. RÉACTIONS CHIMIQUES (Les Conséquences) ---
            const neighbors = [above, below, y * GRID_WIDTH + (x - 1), y * GRID_WIDTH + (x + 1)];
            
            neighbors.forEach(n => {
              if (n >= 0 && n < TOTAL_CELLS) {
                const targetId = grid[n];
                
                // Feu + Bois -> Fumée
                if (matId === MATERIA.FIRE && targetId === MATERIA.WOOD && Math.random() < 0.05) {
                  setCell(n, MATERIA.FIRE); setCell(i, MATERIA.SMOKE);
                }
                // Feu + Sable -> Verre
                if (matId === MATERIA.FIRE && targetId === MATERIA.SAND && Math.random() < 0.1) {
                  setCell(n, MATERIA.GLASS); newGrid[i] = MATERIA.EMPTY;
                }
                // Feu + Eau -> Vapeur
                if (matId === MATERIA.FIRE && targetId === MATERIA.WATER) {
                  setCell(n, MATERIA.STEAM); newGrid[i] = MATERIA.EMPTY;
                }
                // Eau + Graine -> Plante
                if (matId === MATERIA.WATER && targetId === MATERIA.SEED && Math.random() < 0.1) {
                  setCell(n, MATERIA.PLANT); newGrid[i] = MATERIA.EMPTY;
                }
                // Croissance de la Plante
                if (matId === MATERIA.PLANT && targetId === MATERIA.WATER && Math.random() < 0.02) {
                  newGrid[n] = MATERIA.EMPTY; // Boit l'eau
                  if (y > 0 && grid[above] === MATERIA.EMPTY) setCell(above, MATERIA.PLANT); // Pousse vers le haut
                }
                // Acide ronge Métal
                if (matId === MATERIA.ACID && targetId === MATERIA.METAL && Math.random() < 0.1) {
                  newGrid[n] = MATERIA.EMPTY; setCell(i, MATERIA.SMOKE);
                  eventsRef.current.add('acid_metal'); // Événement spécial pour la quête
                }
                // Lave fond Eau -> Pierre
                if (matId === MATERIA.LAVA && targetId === MATERIA.WATER) {
                  setCell(n, MATERIA.STEAM); setCell(i, MATERIA.STONE);
                }
                // Lave brûle Plante/Bois
                if (matId === MATERIA.LAVA && (targetId === MATERIA.PLANT || targetId === MATERIA.WOOD)) {
                  setCell(n, MATERIA.FIRE);
                }
              }
            });
          }
        }
        gridRef.current = newGrid;
      }

      // Rendu ultra-fluide direct en mémoire
      const renderGrid = gridRef.current;
      for (let i = 0; i < TOTAL_CELLS; i++) {
        buf32[i] = REGISTRY[renderGrid[i]].color;
      }
      ctx.putImageData(imgData, 0, 0);

      animationId = requestAnimationFrame(updateGrid);
    };

    animationId = requestAnimationFrame(updateGrid);
    return () => cancelAnimationFrame(animationId);
  }, [isPaused]);

  // --- VÉRIFICATION DES MISSIONS (Toutes les 500ms) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const mission = MISSIONS[missionIndex];
      if (!mission) return; // Jeu fini

      let success = false;
      if (mission.condition) {
        success = eventsRef.current.has(mission.condition);
      } else {
        success = eventsRef.current.has(mission.target);
      }

      if (success) {
        if (mission.unlock === 'WIN') {
          setShowUnlock("GAGNÉ !");
          setMissionIndex(99);
        } else {
          setUnlockedTools(prev => [...prev, mission.unlock]);
          setShowUnlock(REGISTRY[mission.unlock].name);
          setMissionIndex(prev => prev + 1);
        }
        eventsRef.current.clear(); // On reset pour la mission suivante
        
        setTimeout(() => setShowUnlock(false), 3000);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [missionIndex]);

  // --- INTERACTION TACTILE ---
  const drawingRef = useRef(false);

  const handleDraw = (e) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = GRID_WIDTH / rect.width;
    const scaleY = GRID_HEIGHT / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);
    
    const brushSize = currentTool === MATERIA.EMPTY || currentTool === MATERIA.WALL ? 4 : 2;

    for (let dy = -brushSize; dy <= brushSize; dy++) {
      for (let dx = -brushSize; dx <= brushSize; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT && (dx*dx + dy*dy <= brushSize*brushSize)) {
          if (Math.random() > 0.2 || currentTool === MATERIA.EMPTY || currentTool === MATERIA.WALL) {
             gridRef.current[ny * GRID_WIDTH + nx] = currentTool;
          }
        }
      }
    }
  };

  const clearCanvas = () => { gridRef.current = new Uint8Array(TOTAL_CELLS); eventsRef.current.clear(); };

  // Helper pour les icônes
  const getIcon = (matId) => {
    switch(matId) {
      case MATERIA.WATER: return <Droplet size={16}/>;
      case MATERIA.FIRE: return <Flame size={16}/>;
      case MATERIA.WOOD: return <Hexagon size={16}/>;
      case MATERIA.SEED: return <Leaf size={16}/>;
      case MATERIA.ACID: return <Skull size={16}/>;
      case MATERIA.METAL: return <Shield size={16}/>;
      case MATERIA.LAVA: return <Zap size={16}/>;
      default: return <div className="w-3 h-3 rounded-full bg-current"></div>;
    }
  };

  const activeMission = MISSIONS[missionIndex];

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col font-sans touch-none selection:bg-none text-white overflow-hidden">
      
      {/* BANNIÈRE DE MISSION */}
      {activeMission ? (
        <div className="bg-slate-900 border-b border-indigo-500/30 px-6 py-5 shadow-lg relative z-20">
          <div className="flex items-center gap-3 mb-1">
            <Target className="text-indigo-400" size={20} />
            <h2 className="text-indigo-400 font-black uppercase tracking-widest text-xs">Mission {missionIndex + 1} : {activeMission.title}</h2>
          </div>
          <p className="text-slate-300 text-sm font-medium">{activeMission.desc}</p>
        </div>
      ) : (
        <div className="bg-emerald-900/40 border-b border-emerald-500/50 px-6 py-5 text-center shadow-lg relative z-20">
          <h2 className="text-emerald-400 font-black uppercase tracking-widest text-lg">Maître Alchimiste</h2>
          <p className="text-emerald-200/70 text-sm">Tu as débloqué tous les éléments !</p>
        </div>
      )}

      {/* ZONE DE JEU (CANVAS) */}
      <div className="flex-1 relative w-full flex items-center justify-center p-4">
        
        {/* ANIMATION DE DÉBLOCAGE */}
        {showUnlock && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center animate-in zoom-in fade-in duration-500 pointer-events-none">
            <div className="w-24 h-24 bg-amber-400/20 rounded-full flex items-center justify-center border-2 border-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.6)] mb-4">
              <Unlock size={48} className="text-amber-400" />
            </div>
            <h3 className="text-3xl font-black text-white text-center drop-shadow-lg uppercase">
              {showUnlock === 'GAGNÉ !' ? 'JEU TERMINÉ !' : `DÉBLOQUÉ : ${showUnlock}`}
            </h3>
          </div>
        )}
        
        {/* Le Canvas lissé et haute résolution */}
        <div className="relative w-full max-w-sm aspect-[2/3] rounded-[2rem] overflow-hidden border-4 border-slate-800 shadow-2xl bg-[#0f172a]">
          <canvas
            ref={canvasRef}
            width={GRID_WIDTH}
            height={GRID_HEIGHT}
            className="w-full h-full cursor-crosshair touch-none"
            style={{ imageRendering: 'auto' }} // Force le lissage des contours !
            onPointerDown={(e) => { drawingRef.current = true; handleDraw(e); e.target.setPointerCapture(e.pointerId); }}
            onPointerUp={(e) => { drawingRef.current = false; e.target.releasePointerCapture(e.pointerId); }}
            onPointerLeave={() => drawingRef.current = false}
            onPointerMove={handleDraw}
          />
        </div>
      </div>

      {/* INVENTAIRE ET BOÎTE À OUTILS */}
      <div className="bg-slate-900 border-t border-slate-800 pb-safe pt-4 px-4 z-20">
        <div className="max-w-md mx-auto">
          
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex gap-2">
              <button onClick={() => setCurrentTool(MATERIA.WALL)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition ${currentTool === MATERIA.WALL ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>Mur</button>
              <button onClick={() => setCurrentTool(MATERIA.EMPTY)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition ${currentTool === MATERIA.EMPTY ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>Gomme</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsPaused(!isPaused)} className={`p-2 rounded-xl transition ${isPaused ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-white'}`}>
                {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
              </button>
              <button onClick={clearCanvas} className="p-2 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition"><RefreshCw size={18} /></button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 snap-x">
            {unlockedTools.map(matId => {
              const mat = REGISTRY[matId];
              const isActive = currentTool === matId;
              return (
                <button 
                  key={matId}
                  onClick={() => setCurrentTool(matId)}
                  className={`snap-start shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all w-20 border ${isActive ? 'bg-slate-800 border-white/20 scale-105 shadow-xl' : 'bg-slate-950 border-slate-800 opacity-80'}`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10" style={{ backgroundColor: mat.colorHex, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                    {getIcon(matId)}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 w-full text-center">
                    {mat.name}
                  </span>
                </button>
              )
            })}
          </div>
          
        </div>
      </div>

    </div>
  );
}
