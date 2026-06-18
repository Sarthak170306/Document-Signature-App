import { useState, useRef, MouseEvent, DragEvent } from 'react';
import { FileSignature, Trash2 } from 'lucide-react';
export interface ISignaturePlacement {
  id?: string;
  _id?: string;
  x: number;      // Top-left X in percentage
  y: number;      // Top-left Y in percentage
  width: number;  // Width in percentage
  height: number; // Height in percentage
  page: number;
  type: 'drag' | 'draw';
  signatureText?: string;
  status?: string;
}

interface SignatureOverlayProps {
  pageNumber: number;
  placements: ISignaturePlacement[];
  setPlacements: React.Dispatch<React.SetStateAction<ISignaturePlacement[]>>;
  isDrawMode: boolean;
  setIsDrawMode: (val: boolean) => void;
}

interface DragState {
  index: number;
  startMouseX: number;
  startMouseY: number;
  startBoxX: number;
  startBoxY: number;
}

interface ResizeState {
  index: number;
  startMouseX: number;
  startMouseY: number;
  startBoxWidth: number;
  startBoxHeight: number;
}

interface DrawPreview {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function SignatureOverlay({
  pageNumber,
  placements,
  setPlacements,
  isDrawMode,
  setIsDrawMode
}: SignatureOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  
  // Mode B states
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null);

  // Filter placements corresponding to the current active page
  const currentPagePlacements = placements.filter(p => p.page === pageNumber);

  // Mode B: MouseDown triggers drawing
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawMode || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setDrawStart({ x: startX, y: startY });
    setDrawPreview({ x: startX, y: startY, width: 0, height: 0 });
    setIsDrawing(true);
  };

  // Mode B & A resizing/dragging: MouseMove updates drawing, dragging, or resizing
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    // Handle Resizing mode
    if (resizeState !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - resizeState.startMouseX;
      const deltaY = e.clientY - resizeState.startMouseY;

      const deltaXPercent = (deltaX / rect.width) * 100;
      const deltaYPercent = (deltaY / rect.height) * 100;

      // Calculate minimum dimension percentages (Width >= 80px, Height >= 30px)
      const minWidthPercent = (80 / rect.width) * 100;
      const minHeightPercent = (30 / rect.height) * 100;

      setPlacements(prev => {
        const updated = [...prev];
        const target = updated[resizeState.index];
        if (target) {
          const newWidth = resizeState.startBoxWidth + deltaXPercent;
          const newHeight = resizeState.startBoxHeight + deltaYPercent;

          // Clamp so that box doesn't resize beyond right/bottom page boundaries
          target.width = Math.max(minWidthPercent, Math.min(100 - target.x, newWidth));
          target.height = Math.max(minHeightPercent, Math.min(100 - target.y, newHeight));
        }
        return updated;
      });
      return;
    }

    // Handle Drawing mode
    if (isDrawing && drawStart && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const x = Math.min(drawStart.x, currentX);
      const y = Math.min(drawStart.y, currentY);
      const width = Math.abs(drawStart.x - currentX);
      const height = Math.abs(drawStart.y - currentY);

      setDrawPreview({ x, y, width, height });
      return;
    }

    // Handle Dragging mode
    if (dragState !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = e.clientX - dragState.startMouseX;
      const deltaY = e.clientY - dragState.startMouseY;

      const deltaXPercent = (deltaX / rect.width) * 100;
      const deltaYPercent = (deltaY / rect.height) * 100;

      setPlacements(prev => {
        const updated = [...prev];
        const target = updated[dragState.index];
        if (target) {
          target.x = Math.max(0, Math.min(100 - target.width, dragState.startBoxX + deltaXPercent));
          target.y = Math.max(0, Math.min(100 - target.height, dragState.startBoxY + deltaYPercent));
        }
        return updated;
      });
    }
  };

  // MouseUp terminates actions (saving draw area, releasing drag/resize handles)
  const handleMouseUp = () => {
    // Save drawing area
    if (isDrawing && drawPreview && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const xPercent = (drawPreview.x / rect.width) * 100;
      const yPercent = (drawPreview.y / rect.height) * 100;
      const widthPercent = (drawPreview.width / rect.width) * 100;
      const heightPercent = (drawPreview.height / rect.height) * 100;

      // Restrict minimum signature sizing threshold (20px) to prevent simple clicks
      if (drawPreview.width > 20 && drawPreview.height > 20) {
        const newPlacement: ISignaturePlacement = {
          x: xPercent,
          y: yPercent,
          width: widthPercent,
          height: heightPercent,
          page: pageNumber,
          type: 'draw'
        };
        setPlacements(prev => [...prev, newPlacement]);
      }

      setIsDrawing(false);
      setDrawStart(null);
      setDrawPreview(null);
      setIsDrawMode(false); // Disable drawing crosshairs automatically
    }

    // Release Drag
    if (dragState !== null) {
      setDragState(null);
    }

    // Release Resize
    if (resizeState !== null) {
      setResizeState(null);
    }
  };

  // Mode A: Drag initialization on item MouseDown
  const startDragBox = (e: MouseEvent<HTMLDivElement>, placementIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (isDrawMode) return; // Ignore drag triggers if in selection mode

    const globalIndex = placements.findIndex(p => p === currentPagePlacements[placementIndex]);
    if (globalIndex === -1) return;

    setDragState({
      index: globalIndex,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startBoxX: placements[globalIndex].x,
      startBoxY: placements[globalIndex].y
    });
  };

  // Mode A & B: Resize initialization on handle MouseDown
  const startResizeBox = (e: MouseEvent<HTMLDivElement>, placementIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (isDrawMode) return; // Ignore resize triggers if in drawing selection mode

    const globalIndex = placements.findIndex(p => p === currentPagePlacements[placementIndex]);
    if (globalIndex === -1) return;

    setResizeState({
      index: globalIndex,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startBoxWidth: placements[globalIndex].width,
      startBoxHeight: placements[globalIndex].height
    });
  };

  // Remove placement anchor
  const deletePlacement = (e: MouseEvent<HTMLButtonElement>, placementIndex: number) => {
    e.stopPropagation();
    e.preventDefault();
    const globalIndex = placements.findIndex(p => p === currentPagePlacements[placementIndex]);
    if (globalIndex !== -1) {
      setPlacements(prev => prev.filter((_, idx) => idx !== globalIndex));
    }
  };

  // HTML5 Drag & Drop handlers for Mode A
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const data = e.dataTransfer.getData('text/plain');
    if (data === 'signature-box') {
      const rect = containerRef.current.getBoundingClientRect();
      
      // Default offset to center if not provided (75px width, 30px height)
      let offsetX = 75;
      let offsetY = 30;

      try {
        const rawJson = e.dataTransfer.getData('application/json');
        if (rawJson) {
          const dragData = JSON.parse(rawJson);
          if (typeof dragData.offsetX === 'number') offsetX = dragData.offsetX;
          if (typeof dragData.offsetY === 'number') offsetY = dragData.offsetY;
        }
      } catch (err) {
        console.error('[SignatureOverlay] Failed to parse drop offsets:', err);
      }

      // Compute drop coordinates relative to container
      const relativeX = e.clientX - rect.left - offsetX;
      const relativeY = e.clientY - rect.top - offsetY;

      // Convert dimensions and drop position to percentage space
      const widthPercent = (150 / rect.width) * 100;
      const heightPercent = (60 / rect.height) * 100;
      const xPercent = (relativeX / rect.width) * 100;
      const yPercent = (relativeY / rect.height) * 100;

      const newPlacement: ISignaturePlacement = {
        x: Math.max(0, Math.min(100 - widthPercent, xPercent)),
        y: Math.max(0, Math.min(100 - heightPercent, yPercent)),
        width: widthPercent,
        height: heightPercent,
        page: pageNumber,
        type: 'drag'
      };

      setPlacements(prev => [...prev, newPlacement]);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`absolute inset-0 z-20 select-none overflow-hidden ${isDrawMode ? 'cursor-crosshair' : 'cursor-default'}`}
    >
      {/* Placed signature areas */}
      {currentPagePlacements.map((placement, idx) => {
        const globalIndex = placements.indexOf(placement);
        const isFocused = focusedIndex === globalIndex;
        const showWatermark = !placement.signatureText && !isFocused;

        return (
          <div
            key={idx}
            onMouseDown={(e) => startDragBox(e, idx)}
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              width: `${placement.width}%`,
              height: `${placement.height}%`,
              borderWidth: '2px',
              borderColor: placement.type === 'draw' ? '#8B5CF6' : '#4F46E5',
              backgroundColor: placement.type === 'draw' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(79, 70, 229, 0.12)'
            }}
            className="absolute rounded-lg cursor-move flex flex-col items-center justify-center p-1 group select-none shadow-md backdrop-blur-xs border-solid transition-colors overflow-hidden"
          >
            {/* Watermark layer shown when empty and unfocused */}
            {showWatermark && (
              <div className="flex items-center gap-1.5 justify-center select-none pointer-events-none text-center">
                <FileSignature className={`w-3.5 h-3.5 opacity-70 ${placement.type === 'draw' ? 'text-purple-400' : 'text-brand-400'}`} />
                <span className={`text-[10px] font-bold tracking-wider uppercase select-none opacity-60 ${placement.type === 'draw' ? 'text-purple-300' : 'text-brand-350'}`}>
                  Signature Area
                </span>
              </div>
            )}

            {/* Input field overlayed */}
            <input
              type="text"
              value={placement.signatureText || ''}
              onChange={(e) => {
                const val = e.target.value;
                setPlacements(prev => {
                  const updated = [...prev];
                  if (globalIndex !== -1) {
                    updated[globalIndex] = { ...updated[globalIndex], signatureText: val };
                  }
                  return updated;
                });
              }}
              onFocus={() => setFocusedIndex(globalIndex)}
              onBlur={() => setFocusedIndex(null)}
              onMouseDown={(e) => {
                // Prevent drag action when typing/clicking inside the input field
                e.stopPropagation();
              }}
              placeholder={isFocused ? 'Type your name...' : ''}
              className={`w-full h-full bg-transparent border-none outline-none text-center text-blue-700 font-serif italic font-medium z-10 px-2 leading-none ${showWatermark ? 'opacity-0 focus:opacity-100' : 'opacity-100'}`}
              style={{
                fontFamily: 'cursive',
                fontSize: 'min(max(11px, 2.5vw), 18px)'
              }}
            />

            {/* Visual Resize Handle bottom-right corner */}
            <div
              onMouseDown={(e) => startResizeBox(e, idx)}
              title="Drag to resize signature area"
              className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-purple-600/80 hover:bg-purple-600 cursor-se-resize rounded-tl z-20 transition-colors flex items-center justify-center"
            >
              {/* Subtle diagonal lines inside resize handle */}
              <svg width="6" height="6" viewBox="0 0 6 6" fill="none" className="text-white opacity-85">
                <line x1="1.5" y1="5.5" x2="5.5" y2="1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                <line x1="3.5" y1="5.5" x2="5.5" y2="3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>

            {/* Delete Placement button */}
            <button
              onClick={(e) => deletePlacement(e, idx)}
              className="absolute -top-2.5 -right-2.5 p-1 rounded-full bg-slate-900 border border-slate-800 text-slate-450 hover:text-white transition-all scale-0 group-hover:scale-100 shadow-md z-30"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      {/* Mode B Bounding Box Preview */}
      {isDrawing && drawPreview && (
        <div
          style={{
            left: `${drawPreview.x}px`,
            top: `${drawPreview.y}px`,
            width: `${drawPreview.width}px`,
            height: `${drawPreview.height}px`
          }}
          className="absolute border-2 border-dashed border-purple-500 bg-purple-500/10 rounded-lg pointer-events-none"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-bold text-purple-400 bg-slate-950/80 px-2 py-0.5 rounded border border-purple-900/30">
              Draw Signature Area
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


