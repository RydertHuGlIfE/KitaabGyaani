import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

export default function MermaidDiagram({ code, onNodeClick }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (code) {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'forest',
          securityLevel: 'loose',
          flowchart: { curve: 'basis', htmlLabels: true, useMaxWidth: false } // Disable max width to allow zoom
        });

        const id = `mermaid-${Date.now()}`;
        mermaid.mermaidAPI.render(id, code).then(({ svg }) => {
          if (chartRef.current) {
            chartRef.current.innerHTML = svg;

            // attach click events
            const nodeEls = chartRef.current.querySelectorAll(".node");
            nodeEls.forEach((el) => {
              const label = el.textContent?.trim() || "Unnamed Node";
              const nodeId = el.id || label;

              el.style.cursor = "pointer";
              el.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent dragging from triggering click
                if (onNodeClick) onNodeClick(nodeId, label);
              });
            });
            
            // Reset zoom/pan when new code is loaded
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }
        }).catch(err => {
          console.error("Mermaid API error:", err);
          if (chartRef.current) {
            chartRef.current.innerHTML = `
              <div class="mermaid-error">
                <p>⚠️ Visualizer Syntax Error</p>
                <small>The AI generated complex syntax. Try clicking "Visualize" again to regenerate.</small>
              </div>
            `;
          }
        });
      } catch (error) {
        console.error("Error rendering mermaid diagram:", error);
      }
    }
  }, [code, onNodeClick]);

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
    }
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div 
      className="mermaid-wrapper" 
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden', 
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'grab',
        background: '#fcfaf7',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}
    >
      <div 
        ref={chartRef} 
        className="mermaid-svg-wrapper"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: '100%',
          minHeight: '100%'
        }}
      />
      
      {/* Controls Overlay */}
      <div className="mermaid-controls" style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        zIndex: 10
      }}>
        <button className="btn btn-sm btn-circle" onClick={() => setZoom(z => Math.min(z * 1.2, 5))} title="Zoom In">+</button>
        <button className="btn btn-sm btn-circle" onClick={() => setZoom(z => Math.max(z / 1.2, 0.1))} title="Zoom Out">-</button>
        <button className="btn btn-sm px-2" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} title="Reset View">Reset</button>
      </div>

      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        fontSize: '10px',
        opacity: 0.6,
        pointerEvents: 'none',
        background: 'rgba(255,255,255,0.7)',
        padding: '2px 5px',
        borderRadius: '4px'
      }}>
        Ctrl + Wheel to zoom • Drag to pan
      </div>
    </div>
  );
}
