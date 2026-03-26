import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

export default function MermaidDiagram({ code, onNodeClick }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (code) {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          flowchart: { curve: 'basis' }
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
              el.addEventListener("click", () => {
                if (onNodeClick) onNodeClick(nodeId, label);
              });
            });
          }
        }).catch(err => {
          console.error("Mermaid API error:", err);
          if (chartRef.current) {
            chartRef.current.innerHTML = '<p class="text-red-500">Error rendering diagram. Please check the syntax.</p>';
          }
        });
      } catch (error) {
        console.error("Error rendering mermaid diagram:", error);
        if (chartRef.current) {
          chartRef.current.innerHTML =
            '<p class="text-red-500">Error rendering diagram. Please check the syntax.</p>';
        }
      }
    }
  }, [code, onNodeClick]);

  return (
    <div className="mermaid-container">
      <div ref={chartRef} className="mermaid-svg-wrapper" />
    </div>
  );
}
