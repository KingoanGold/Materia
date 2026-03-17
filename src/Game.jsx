import React, { useState, useEffect, useRef } from 'react';
import { Flame, Eraser, Sparkles, Dices, Beaker } from 'lucide-react';

const GRID_WIDTH = 80;
const GRID_HEIGHT = 100;
const CELL_SIZE = 5;

const INITIAL_REGISTRY = {
  0: { id: 0, name: 'Vide', color: '#0f172a', type: 'empty' },
  1: { id: 1, name: 'Feu Primordial', color: '#ef4444', type: 'gas', isFire: true, life: 10 },
  2: { id: 2, name: 'Sable de Base', color: '#fbbf24', type: 'powder', flammable: false },
  3: { id: 3, name: 'Eau Claire', color: '#3b82f6', type: 'liquid', putsOutFire: true }
};

const PREFIXES = ['Quantum', 'Néon', 'Cryo', 'Pyro', 'Toxic', 'Astra', 'Sombre', 'Nova', 'Mecha'];
const SUFFIXES = ['Poussière', 'Gel', 'Vapeur', 'Acide', 'Cristal', 'Fluide', 'Plasma', 'Scorie'];

export default function InfiniteMateria() {
  const canvasRef = useRef(null);
  const registryRef = useRef({ ...INITIAL_REGISTRY });
  const gridRef = useRef(new Uint16Array(GRID_WIDTH * GRID_HEIGHT));
  
  const [materials, setMaterials] = useState(Object.values(INITIAL_REGISTRY));
  const [currentToolId, setCurrentToolId] = useState(2);
  const [isDrawing, setIsDrawing] = useState(false);
  const [nextId, setNextId] = useState(4);

  const generateAnomaly = () => {
    const types = ['powder', 'liquid', 'gas', 'solid'];
    const type = types[Math.floor(Math.random() * types.length)];
    const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const name = `${suffix} ${prefix}`;
    const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    
    const newMaterial = {
      id: nextId, name, color, type,
      flammable: Math.random() > 0.5,
      isFire: Math.random() > 0.9,
      life: Math.floor(Math.random() * 50) + 10
    };

    registryRef.current[nextId] = newMaterial;
    setMaterials(prev => [...prev, newMaterial]);
    setCurrentToolId(nextId);
    setNextId(prev => prev + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    let animationFrameId;

    const updateGrid = () => {
      const grid = gridRef.current;
      const newGrid = new Uint16Array(grid);
      const registry = registryRef.current;

      for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
        const dir = Math.random() > 0.5 ? 1 : -1;

        for (let x = 0; x < GRID_WIDTH; x++) {
          const i = y * GRID_WIDTH + x;
          const matId = grid[i];

          if (matId === 0) continue;
          const mat = registry[matId];
          if (!mat) continue;

          const below = (y + 1) * GRID_WIDTH + x;
          const belowLeft = (y + 1) * GRID_WIDTH + (x - 1);
          const belowRight = (y + 1) * GRID_WIDTH + (x + 1);
          const above = (y - 1) * GRID_WIDTH + x;

          if (mat.type === 'powder') {
            if (y < GRID_HEIGHT - 1 && registry[grid[below]]?.type === 'empty') {
              newGrid[below] = matId; newGrid[i] = 0;
            } else if (y < GRID_HEIGHT - 1 && registry[grid[below]]?.type === 'liquid') {
              newGrid[below] = matId; newGrid[i] = grid[below];
            } else if (y < GRID_HEIGHT - 1 && x > 0 && registry[grid[belowLeft]]?.type === 'empty') {
              newGrid[belowLeft] = matId; newGrid[i] = 0;
            } else if (y < GRID_HEIGHT - 1 && x < GRID_WIDTH - 1 && registry[grid[belowRight]]?.type === 'empty') {
              newGrid[belowRight] = matId; newGrid[i] = 0;
            } else {
               newGrid[i] = matId;
            }
          }
          else if (mat.type === 'liquid') {
            if (y < GRID_HEIGHT - 1 && registry[grid[below]]?.type === 'empty') {
              newGrid[below] = matId; newGrid[i] = 0;
            } else if (y < GRID_HEIGHT - 1 && x > 0 && registry[grid[belowLeft]]?.type === 'empty') {
              newGrid[belowLeft] = matId; newGrid[i] = 0;
            } else if (y < GRID_HEIGHT - 1 && x < GRID_WIDTH - 1 && registry[grid[belowRight]]?.type === 'empty') {
              newGrid[belowRight] = matId; newGrid[i] = 0;
            } else {
              const side = y * GRID_WIDTH + (x + dir);
              if (x + dir >= 0 && x + dir < GRID_WIDTH && registry[grid[side]]?.type === 'empty') {
                newGrid[side] = matId; newGrid[i] = 0;
              } else {
                 newGrid[i] = matId;
              }
            }
          }
          else if (mat.type === 'gas') {
            if (Math.random() < 0.05) { newGrid[i] = 0; continue; }
            if (y > 0 && registry[grid[above]]?.type === 'empty') {
              newGrid[above] = matId; newGrid[i] = 0;
            } else {
              const side = y * GRID_WIDTH + (x + dir);
              if (x + dir >= 0 && x + dir < GRID_WIDTH && registry[grid[side]]?.type === 'empty') {
                newGrid[side] = matId; newGrid[i] = 0;
              } else {
                 newGrid[i] = matId;
              }
            }
          } else {
             newGrid[i] = matId; // Solid objects stay put
          }

          if (mat.isFire) {
            const neighbors = [above, below, y * GRID_WIDTH + (x - 1), y * GRID_WIDTH + (x + 1)];
            neighbors.forEach(n => {
              if (n >= 0 && n < grid.length && registry[grid[n]]) {
                const targetMat = registry[grid[n]];
                if (targetMat.flammable && Math.random() < 0.1) newGrid[n] = matId; 
                if (targetMat.putsOutFire) newGrid[i] = 0;
              }
            });
          }
        }
      }

      gridRef.current = newGrid;
      ctx.fillStyle = registry[0].color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < newGrid.length; i++) {
        if (newGrid[i] !== 0) {
          const x = i % GRID_WIDTH;
          const y = Math.floor(i / GRID_WIDTH);
          ctx.fillStyle = registry[newGrid[i]].color;
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
      animationFrameId = requestAnimationFrame(updateGrid);
    };

    updateGrid();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleDraw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.floor((clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((clientY - rect.top) / CELL_SIZE);
    const brushSize = currentToolId === 0 ? 3 : 1;

    for (let dy = -brushSize; dy <= brushSize; dy++) {
      for (let dx = -brushSize; dx <= brushSize; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < GRID_WIDTH && ny >= 0 && ny < GRID_HEIGHT) {
          if (Math.random() > 0.3 || currentToolId === 0 || registryRef.current[currentToolId]?.type === 'solid') {
             gridRef.current[ny * GRID_WIDTH + nx] = currentToolId;
          }
        }
      }
    }
  };

  const clearCanvas = () => { gridRef.current = new Uint16Array(GRID_WIDTH * GRID_HEIGHT); };

  const recentMaterials = materials.slice(-4).reverse();

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-between font-sans touch-none selection:bg-none">
      <header className="w-full p-6 text-center z-10 pointer-events-none">
        <h1 className="text-3xl font-black text-white tracking-widest flex items-center justify-center gap-3">
          <Beaker className="text-purple-400" /> MATERIA
        </h1>
        <p className="text-slate-400 text-sm mt-1">Infinité Procédurale</p>
      </header>

      <div className="relative rounded-3xl overflow-hidden border-4 border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <canvas
          ref={canvasRef}
          width={GRID_WIDTH * CELL_SIZE}
          height={GRID_HEIGHT * CELL_SIZE}
          className="bg-slate-900 cursor-crosshair touch-none"
          onMouseDown={() => setIsDrawing(true)}
          onMouseUp={() => setIsDrawing(false)}
          onMouseLeave={() => setIsDrawing(false)}
          onMouseMove={handleDraw}
          onTouchStart={(e) => { setIsDrawing(true); handleDraw(e); }}
          onTouchEnd={() => setIsDrawing(false)}
          onTouchMove={handleDraw}
        />
      </div>

      <div className="w-full max-w-sm px-4 pb-8 flex flex-col gap-4 z-10">
        <button 
          onClick={generateAnomaly}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-purple-900/50 flex items-center justify-center gap-3 hover:scale-[1.02] transition"
        >
          <Dices size={20} /> Créer une Anomalie
        </button>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-3 rounded-3xl flex gap-2 overflow-x-auto no-scrollbar justify-center shadow-2xl">
          {recentMaterials.map(mat => {
            if (mat.id === 0) return null;
            const isActive = currentToolId === mat.id;
            return (
              <button 
                key={mat.id}
                onClick={() => setCurrentToolId(mat.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-16 shrink-0 ${isActive ? 'scale-110 border border-white/20 bg-slate-800' : 'hover:bg-slate-800/50'}`}
              >
                <div className="w-6 h-6 rounded-full border-2 border-slate-800" style={{ backgroundColor: mat.color }}></div>
                <span className="text-[8px] font-black uppercase tracking-wider text-slate-300 truncate w-full text-center">
                  {mat.name}
                </span>
              </button>
            )
          })}
          
          <div className="w-px bg-slate-700 mx-1 shrink-0"></div>
          
          <button onClick={() => setCurrentToolId(0)} className={`flex flex-col items-center gap-1 p-2 rounded-xl w-14 shrink-0 ${currentToolId === 0 ? 'bg-slate-700 scale-110' : 'hover:bg-slate-800'}`}>
            <Eraser size={24} className={currentToolId === 0 ? 'text-white' : 'text-slate-500'} />
          </button>
          
          <button onClick={clearCanvas} className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/20 transition text-[10px] font-bold uppercase shrink-0">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
