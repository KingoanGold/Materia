import React, { useState, useEffect, useRef } from 'react';
import { Flame, Eraser, Dices, Beaker, Play, Pause, Maximize, Minus, Plus, Zap, Skull } from 'lucide-react';

// --- CONFIGURATION MOTEUR ---
const GRID_WIDTH = 100;
const GRID_HEIGHT = 150;
const TOTAL_CELLS = GRID_WIDTH * GRID_HEIGHT;

// Convertit un code hex (#FF0000) en nombre binaire pour la carte graphique (hyper rapide)
const hexToABGR = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (255 << 24) | (b << 16) | (g << 8) | r; // Format Little-Endian ABGR
};

const INITIAL_REGISTRY = {
  0: { id: 0, name: 'Vide', colorHex: '#0f172a', color: hexToABGR('#0f172a'), type: 'empty', density: 0 },
  1: { id: 1, name: 'Mur', colorHex: '#475569', color: hexToABGR('#475569'), type: 'solid', density: 100 },
  2: { id: 2, name: 'Sable', colorHex: '#fbbf24', color: hexToABGR('#fbbf24'), type: 'powder', density: 2.0 },
  3: { id: 3, name: 'Eau', colorHex: '#3b82f6', color: hexToABGR('#3b82f6'), type: 'liquid', density: 1.0, putsOutFire: true },
  4: { id: 4, name: 'Feu', colorHex: '#ef4444', color: hexToABGR('#ef4444'), type: 'gas', density: 0.1, isFire: true },
  5: { id: 5, name: 'Acide', colorHex: '#a3e635', color: hexToABGR('#a3e635'), type: 'acid', density: 1.2 }
};

const PREFIXES = ['Quantum', 'Néon', 'Cryo', 'Pyro', 'Toxic', 'Astra', 'Sombre', 'Nova', 'Mecha', 'Bio'];
const SUFFIXES = ['Poussière', 'Gel', 'Vapeur', 'Acide', 'Cristal', 'Fluide', 'Plasma', 'Scorie', 'Spores', 'Virus'];

export default function Game() {
  const canvasRef = useRef(null);
  
  // Utilisation de Refs pour la mémoire (évite à React de tout recalculer)
  const registryRef = useRef({ ...INITIAL_REGISTRY });
  const gridRef = useRef(new Uint16Array(TOTAL_CELLS));
  
  const [materials, setMaterials] = useState(Object.values(INITIAL_REGISTRY));
  const [currentToolId, setCurrentToolId] = useState(2);
  const [nextId, setNextId] = useState(6);
  
  // UI States
  const [isPaused, setIsPaused] = useState(false);
  const [brushSize, setBrushSize] = useState(2);
  const [notification, setNotification] = useState(null);

  // --- L'INVENTEUR D'ANOMALIES (L'IA MATHÉMATIQUE) ---
  const generateAnomaly = () => {
    const types = ['powder', 'liquid', 'gas', 'solid', 'acid', 'virus'];
    const type = types[Math.floor(Math.random() * types.length)];
    const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    
    // Couleurs vibrantes (Haut contraste)
    const colorHex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    
    let density = 1.0;
    if (type === 'gas') density = Math.random() * 0.5;
    if (type === 'liquid' || type === 'acid') density = 0.5 + Math.random();
    if (type === 'powder' || type === 'virus') density = 1.5 + Math.random();
    if (type === 'solid') density = 10.0;

    const newMaterial = {
      id: nextId,
      name: `${suffix} ${prefix}`,
      colorHex,
      color: hexToABGR(colorHex),
      type,
      density,
      flammable: Math.random() > 0.6,
      isFire: Math.random() > 0.9,
    };

    registryRef.current[nextId] = newMaterial;
    setMaterials(prev => [...prev, newMaterial]);
    setCurrentToolId(nextId);
    setNextId(prev => prev + 1);
    
    showNotif(`${newMaterial.name} créé !`, newMaterial.colorHex);
  };

  const showNotif = (text, color) => {
    setNotification({ text, color });
    setTimeout(() => setNotification(null), 2000);
  };

  // --- MOTEUR PHYSIQUE ULTRA HAUTE PERFORMANCE ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    // On crée un buffer de pixels qui va directement communiquer avec la carte graphique
    const imgData = ctx.createImageData(GRID_WIDTH, GRID_HEIGHT);
    const buf32 = new Uint32Array(imgData.data.buffer);
    
    let animationFrameId;
    let frameCount = 0;

    const updateGrid = () => {
      if (!isPaused) {
        frameCount++;
        const grid = gridRef.current;
        const newGrid = new Uint16Array(grid);
        const registry = registryRef.current;

        // Fonction pour échanger 2 pixels (Physique de densité)
        const swap = (i, target) => {
          newGrid[target] = grid[i];
          newGrid[i] = grid[target];
        };

        // On parcourt la grille de bas en haut
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
          // On alterne la lecture gauche/droite à chaque frame pour éviter que tout coule du même côté
          const dir = (frameCount + y) % 2 === 0 ? 1 : -1;
          const startX = dir === 1 ? 0 : GRID_WIDTH - 1;
          const endX = dir === 1 ? GRID_WIDTH : -1;

          for (let x = startX; x !== endX; x += dir) {
            const i = y * GRID_WIDTH + x;
            const matId = grid[i];

            if (matId === 0 || matId === 1) continue; // Vide et Murs ne bougent pas
            const mat = registry[matId];
            if (!mat) continue;

            const below = (y + 1) * GRID_WIDTH + x;
            const belowLeft = (y + 1) * GRID_WIDTH + (x - 1);
            const belowRight = (y + 1) * GRID_WIDTH + (x + 1);
            const above = (y - 1) * GRID_WIDTH + x;

            // --- PHYSIQUE DES MATIÈRES LOURDES (Poudres, Liquides, Acides) ---
            if (mat.type === 'powder' || mat.type === 'liquid' || mat.type === 'acid' || mat.type === 'virus') {
              if (y < GRID_HEIGHT - 1) {
                // 1. Couler tout droit si on est plus lourd
                if (mat.density > registry[grid[below]]?.density) {
                  swap(i, below);
                } 
                // 2. Glisser sur les côtés
                else {
                  const canGoLeft = x > 0 && mat.density > registry[grid[belowLeft]]?.density;
                  const canGoRight = x < GRID_WIDTH - 1 && mat.density > registry[grid[belowRight]]?.density;
                  
                  if (canGoLeft && canGoRight) {
                     swap(i, Math.random() > 0.5 ? belowLeft : belowRight);
                  } else if (canGoLeft) {
                     swap(i, belowLeft);
                  } else if (canGoRight) {
                     swap(i, belowRight);
                  } 
                  // 3. Spécifique aux liquides : s'étaler à l'horizontale
                  else if (mat.type === 'liquid' || mat.type === 'acid') {
                    const side = y * GRID_WIDTH + (x + dir);
                    if (x + dir >= 0 && x + dir < GRID_WIDTH && mat.density > registry[grid[side]]?.density) {
                      swap(i, side);
                    }
                  }
                }
              }
            }

            // --- PHYSIQUE DES GAZ (Monte) ---
            else if (mat.type === 'gas') {
              if (Math.random() < 0.03) { newGrid[i] = 0; continue; } // Se dissipe
              if (y > 0 && mat.density < registry[grid[above]]?.density) {
                swap(i, above);
              } else {
                const side = y * GRID_WIDTH + (x + dir);
                if (x + dir >= 0 && x + dir < GRID_WIDTH && mat.density < registry[grid[side]]?.density) {
                  swap(i, side);
                }
              }
            }

            // --- RÉACTIONS CHIMIQUES AVANCÉES ---
            const neighbors = [above, below, y * GRID_WIDTH + (x - 1), y * GRID_WIDTH + (x + 1)];
            
            // 1. Combustion
            if (mat.isFire) {
              neighbors.forEach(n => {
                if (n >= 0 && n < TOTAL_CELLS && registry[grid[n]]) {
                  if (registry[grid[n]].flammable && Math.random() < 0.1) newGrid[n] = matId; 
                  if (registry[grid[n]].putsOutFire) newGrid[i] = 0;
                }
              });
            }
            
            // 2. Acide (Ronge tout sauf les solides incassables, crée du gaz)
            if (mat.type === 'acid' && Math.random() < 0.2) {
              const target = neighbors[Math.floor(Math.random() * neighbors.length)];
              if (target >= 0 && target < TOTAL_CELLS && grid[target] !== 0 && grid[target] !== 1 && grid[target] !== matId) {
                newGrid[target] = 0; // Détruit
                newGrid[i] = 4; // Se transforme en fumée (feu) après avoir rongé
              }
            }

            // 3. Virus (Infecte les matières voisines)
            if (mat.type === 'virus' && Math.random() < 0.05) {
              const target = neighbors[Math.floor(Math.random() * neighbors.length)];
              if (target >= 0 && target < TOTAL_CELLS && grid[target] !== 0 && grid[target] !== 1) {
                newGrid[target] = matId; // Zombification
              }
            }
          }
        }
        gridRef.current = newGrid;
      } // Fin du if(!isPaused)

      // --- RENDU GRAPHIQUE DIRECT EN MÉMOIRE (Ultra Rapide) ---
      const renderGrid = gridRef.current;
      const currentRegistry = registryRef.current;
      for (let i = 0; i < TOTAL_CELLS; i++) {
        buf32[i] = currentRegistry[renderGrid[i]].color;
      }
      ctx.putImageData(imgData, 0, 0);

      animationFrameId = requestAnimationFrame(updateGrid);
    };

    animationFrameId = requestAnimationFrame(updateGrid);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPaused]);

  // --- DESSIN TACTILE/SOURIS ---
  const drawingRef = useRef(false);

  const handleDrawEvent = (e) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Calcul de la position par rapport à la grille interne
    const scaleX = GRID_WIDTH / rect.width;
    const scaleY = GRID_HEIGHT / rect.height;
    const x = Math.floor((clientX - rect.left) * scaleX);
    const y = Math.floor((clientY - rect.top) * scaleY);

    for (let dy = -brushSize; dy <= brushSize; dy++) {
      for (let dx = -brushSize; dx <= brushSize; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        // On dessine un cercle, pas un carré moche
        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT && (dx*dx + dy*dy <= brushSize*brushSize)) {
          // Ajout d'un spray naturel (sauf pour gomme et murs)
          if (Math.random() > 0.4 || currentToolId === 0 || currentToolId === 1) {
             gridRef.current[ny * GRID_WIDTH + nx] = currentToolId;
          }
        }
      }
    }
  };

  const clearCanvas = () => { gridRef.current = new Uint16Array(TOTAL_CELLS); showNotif("Laboratoire nettoyé", "#ef4444"); };

  const recentMaterials = materials.filter(m => m.id !== 0 && m.id !== 1).slice(-5).reverse();

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col font-sans touch-none selection:bg-none text-white overflow-hidden">
      
      {/* HEADER ULTRA DESIGN */}
      <header className="px-6 py-4 flex items-center justify-between bg-slate-900/50 backdrop-blur-xl border-b border-white/5 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/20 p-2 rounded-xl border border-purple-500/30">
            <Beaker className="text-purple-400" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest leading-none">MATERIA</h1>
            <p className="text-[10px] text-purple-400 font-bold tracking-[0.2em] uppercase mt-1">Sandbox Quantique</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsPaused(!isPaused)} className={`p-3 rounded-xl transition ${isPaused ? 'bg-amber-500 text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
            {isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
          </button>
          <button onClick={clearCanvas} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500/20 transition">
            <Eraser size={20} />
          </button>
        </div>
      </header>

      {/* ZONE DE JEU (CANVAS) */}
      <div className="flex-1 relative w-full flex items-center justify-center p-4">
        {notification && (
          <div className="absolute top-10 z-50 px-6 py-3 rounded-full font-black text-sm uppercase tracking-widest animate-in slide-in-from-top fade-in duration-300 shadow-2xl backdrop-blur-md border" style={{ backgroundColor: `${notification.color}20`, color: notification.color, borderColor: `${notification.color}50` }}>
            {notification.text}
          </div>
        )}
        
        <div className="relative w-full max-w-md aspect-[2/3] rounded-[2rem] overflow-hidden border-[6px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-slate-900">
          <canvas
            ref={canvasRef}
            width={GRID_WIDTH}
            height={GRID_HEIGHT}
            className="w-full h-full cursor-crosshair touch-none"
            onPointerDown={(e) => { drawingRef.current = true; handleDrawEvent(e); e.target.setPointerCapture(e.pointerId); }}
            onPointerUp={(e) => { drawingRef.current = false; e.target.releasePointerCapture(e.pointerId); }}
            onPointerLeave={() => drawingRef.current = false}
            onPointerMove={handleDrawEvent}
          />
        </div>
      </div>

      {/* BOÎTE À OUTILS */}
      <div className="bg-slate-900/90 backdrop-blur-2xl border-t border-slate-800 pb-safe pt-4 px-4 z-20">
        
        <div className="max-w-md mx-auto">
          {/* Outils secondaires (Pinceau, Mur) */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-3 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button onClick={() => setBrushSize(Math.max(1, brushSize - 1))} className="p-2 text-slate-400 hover:text-white"><Minus size={16} /></button>
              <span className="text-xs font-black text-slate-300 w-16 text-center">PINCEAU : {brushSize}</span>
              <button onClick={() => setBrushSize(Math.min(10, brushSize + 1))} className="p-2 text-slate-400 hover:text-white"><Plus size={16} /></button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => setCurrentToolId(1)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${currentToolId === 1 ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>Mur</button>
              <button onClick={() => setCurrentToolId(0)} className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${currentToolId === 0 ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-950 text-slate-500 border-slate-800'}`}>Gomme</button>
            </div>
          </div>

          {/* PALETTE PRINCIPALE */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 snap-x">
            {/* Bouton IA */}
            <button 
              onClick={generateAnomaly}
              className="snap-start shrink-0 w-20 flex flex-col items-center justify-center gap-2 p-3 bg-gradient-to-b from-purple-600 to-indigo-600 rounded-2xl shadow-lg shadow-purple-900/40 border border-purple-400/30 hover:scale-105 transition active:scale-95"
            >
              <Sparkles size={24} className="text-white animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-100 text-center">Générer</span>
            </button>

            {/* Matières existantes */}
            {recentMaterials.map(mat => {
              const isActive = currentToolId === mat.id;
              // On choisit une icône sympa selon le type
              let Icon = Maximize;
              if(mat.type === 'gas') Icon = Flame;
              if(mat.type === 'liquid') Icon = Zap;
              if(mat.type === 'acid') Icon = Skull;

              return (
                <button 
                  key={mat.id}
                  onClick={() => setCurrentToolId(mat.id)}
                  className={`snap-start shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all w-20 border ${isActive ? 'bg-slate-800 border-white/20 scale-105 shadow-xl' : 'bg-slate-950 border-slate-800 hover:bg-slate-800'}`}
                >
                  <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center" style={{ borderColor: mat.colorHex, backgroundColor: `${mat.colorHex}20` }}>
                    <Icon size={14} style={{ color: mat.colorHex }} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 truncate w-full text-center" style={{ color: isActive ? '#fff' : mat.colorHex }}>
                    {mat.name.split(' ')[0]}<br/>{mat.name.split(' ')[1] || ''}
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
